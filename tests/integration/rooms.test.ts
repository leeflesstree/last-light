import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { createAppServer } from '../../src/server/app.js';
import { Rooms } from '../../src/server/rooms.js';
import type { ClientEvents, Reply, RoomView, ServerEvents } from '../../src/shared/protocol.js';

type Client = Socket<ServerEvents, ClientEvents>;
function ok(reply: Reply) { if (!reply.ok) assert.fail(`${reply.code}: ${reply.message}`); return reply; }
async function fixture(run: (connect: () => Promise<Client>, server: Awaited<ReturnType<typeof createAppServer>>) => Promise<void>) {
  const server = await createAppServer();
  await new Promise<void>(done => server.http.listen(0, '127.0.0.1', done));
  const address = server.http.address();
  assert(address && typeof address === 'object');
  const clients: Client[] = [];
  const connect = () => new Promise<Client>((resolve, reject) => {
    const client: Client = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true, reconnection: false });
    clients.push(client);
    client.once('connect', () => resolve(client)); client.once('connect_error', reject);
  });
  try { await run(connect, server); } finally { clients.forEach(c => c.disconnect()); await server.close(); }
}

test('two independent clients create/join, receive matching public state and become ready', async () => fixture(async connect => {
  const host = await connect(), guest = await connect();
  const created = ok(await host.emitWithAck('room:create', { requestId: randomUUID(), nickname: 'Alex' }));
  assert.match(created.room.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const snapshot = new Promise<unknown>(done => host.once('room:snapshot', done));
  const joined = ok(await guest.emitWithAck('room:join', { requestId: randomUUID(), code: created.room.code.toLowerCase(), nickname: 'Robin' }));
  assert.equal(joined.room.players.length, 2);
  assert.deepEqual(await snapshot, joined.room);
  assert.equal(joined.room.hostId, created.playerId);
  assert.deepEqual(joined.room.players.map(p => p.stations), [['Chart Table', 'Signal Desk'], ['Stormglass', 'Beacon Console']]);
  assert(!JSON.stringify(joined.room).includes(created.seat!.token));
  assert(!JSON.stringify(joined.room).includes('tokenHash'));
  await host.emitWithAck('room:ready', { requestId: randomUUID(), ready: true });
  const ready = ok(await guest.emitWithAck('room:ready', { requestId: randomUUID(), ready: true }));
  assert.equal(ready.room.crewReady, true);
}));

test('room creation retries are idempotent and conflicting IDs are rejected', async () => fixture(async (connect, server) => {
  const host = await connect();
  const input = { requestId: randomUUID(), nickname: 'Alex' };
  const first = ok(await host.emitWithAck('room:create', input));
  assert.deepEqual(await host.emitWithAck('room:create', input), first);
  assert.equal(server.rooms.count, 1);
  const conflict = await host.emitWithAck('room:create', { ...input, nickname: 'Other' });
  assert(!conflict.ok); assert.equal(conflict.code, 'REQUEST_CONFLICT');
}));

test('simultaneous joins cannot overfill the fourth seat', async () => fixture(async connect => {
  const clients = await Promise.all(Array.from({ length: 6 }, connect));
  const created = ok(await clients[0].emitWithAck('room:create', { requestId: randomUUID(), nickname: 'Host' }));
  const replies = await Promise.all(clients.slice(1).map((client, i) => client.emitWithAck('room:join', { requestId: randomUUID(), code: created.room.code, nickname: `Guest ${i}` })));
  assert.equal(replies.filter(r => r.ok).length, 3);
  const rejected = replies.filter(r => !r.ok);
  assert.equal(rejected.length, 2);
  rejected.forEach(r => { assert(!r.ok); assert.equal(r.code, 'ROOM_FULL'); });
}));

test('invalid input, missing rooms and forged seats fail without room mutation', async () => fixture(async (connect, server) => {
  const client = await connect();
  for (const name of ['', 'x'.repeat(25), 'bad\u0001name', 'bad\u202ename']) {
    const reply = await client.emitWithAck('room:create', { requestId: randomUUID(), nickname: name });
    assert(!reply.ok); assert.equal(reply.code, 'INVALID_INPUT');
  }
  assert.equal(server.rooms.count, 0);
  const missing = await client.emitWithAck('room:join', { requestId: randomUUID(), code: 'ABC234', nickname: 'Alex' });
  assert(!missing.ok); assert.equal(missing.code, 'ROOM_NOT_FOUND');
  const forged = await client.emitWithAck('room:ready', { requestId: randomUUID(), ready: true });
  assert(!forged.ok); assert.equal(forged.code, 'NOT_SEATED');
  const created = ok(await client.emitWithAck('room:create', { requestId: randomUUID(), nickname: 'Host' }));
  const attacker = await connect();
  const invalid = await attacker.emitWithAck('room:resume', { requestId: randomUUID(), code: created.room.code, token: 'a'.repeat(43) });
  assert(!invalid.ok); assert.equal(invalid.code, 'INVALID_SEAT');
}));

test('refresh resumes the same seat and a second connection replaces the first', async () => fixture(async connect => {
  const host = await connect(), guest = await connect();
  const created = ok(await host.emitWithAck('room:create', { requestId: randomUUID(), nickname: 'Alex' }));
  await guest.emitWithAck('room:join', { requestId: randomUUID(), code: created.room.code, nickname: 'Robin' });
  const disconnected = new Promise<void>(done => guest.once('room:snapshot', () => done()));
  host.disconnect(); await disconnected;
  const refresh = await connect();
  const resumed = ok(await refresh.emitWithAck('room:resume', { requestId: randomUUID(), ...created.seat! }));
  assert.equal(resumed.playerId, created.playerId);
  assert.equal(resumed.room.players.length, 2);
  assert.equal(resumed.room.players.find(p => p.id === created.playerId)?.connected, true);
  assert.equal(resumed.room.players.find(p => p.id !== created.playerId)?.id, resumed.room.hostId);
  const replacement = await connect();
  const replaced = new Promise<void>(done => refresh.once('seat:replaced', done));
  const again = ok(await replacement.emitWithAck('room:resume', { requestId: randomUUID(), ...created.seat! }));
  await replaced;
  assert.equal(again.room.players.length, 2);
  assert.equal(again.playerId, created.playerId);
}));

test('leaving transfers host and frees the seat immediately', async () => fixture(async connect => {
  const host = await connect(), guest = await connect();
  const created = ok(await host.emitWithAck('room:create', { requestId: randomUUID(), nickname: 'Alex' }));
  const joined = ok(await guest.emitWithAck('room:join', { requestId: randomUUID(), code: created.room.code, nickname: 'Robin' }));
  const snapshot = new Promise<RoomView>(done => guest.once('room:snapshot', done));
  await host.emitWithAck('room:leave', { requestId: randomUUID() });
  const remaining = await snapshot;
  assert.equal(remaining.players.length, 1);
  assert.equal(remaining.hostId, joined.playerId);
}));

test('disconnected seats expire and abandoned rooms are cleaned up', () => {
  const rooms = new Rooms(60_000, 30 * 60_000);
  const created = rooms.create('Alex', 'one');
  rooms.join(created.code, 'Robin', 'two');
  rooms.disconnect('one');
  const changed = rooms.sweep(Date.now() + 60_001);
  assert.equal(changed[0].players.length, 1);
  assert.equal(changed[0].hostId, changed[0].players[0].id);
  assert.throws(() => rooms.resume(created.code, created.token, 'three'), /expired/);
  rooms.disconnect('two');
  rooms.sweep(Date.now() + 30 * 60_000 + 1);
  assert.equal(rooms.count, 0);
  assert.throws(() => rooms.join(created.code, 'Again', 'four'), /ended/);
});
