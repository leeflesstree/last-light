import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { createAppServer } from '../../src/server/app.js';
import { Rooms } from '../../src/server/rooms.js';
import { createSafePassage, solveSafePassage } from '../../src/server/puzzles/safe-passage.js';
import type { ClientEvents, Reply, RoomView, RouteId, ServerEvents, SignalId } from '../../src/shared/protocol.js';

type Client = Socket<ServerEvents, ClientEvents>;
function ok(reply: Reply) { if (!reply.ok) assert.fail(`${reply.code}: ${reply.message}`); return reply; }
function rejected(reply: Reply, code: string) { assert(!reply.ok); assert.equal(reply.code, code); }
function nextView(client: Client, phase: RoomView['phase'], matches = (_view: RoomView) => true) {
  return new Promise<RoomView>((resolve, reject) => {
    const timer = setTimeout(() => { client.off('room:snapshot', handler); reject(new Error(`Missing ${phase} snapshot`)); }, 5000);
    function handler(view: RoomView) { if (view.phase === phase && matches(view)) { clearTimeout(timer); client.off('room:snapshot', handler); resolve(view); } }
    client.on('room:snapshot', handler);
  });
}
async function withCrew(count: number, run: (clients: Client[], views: RoomView[]) => Promise<void>) {
  const server = await createAppServer();
  await new Promise<void>(done => server.http.listen(0, '127.0.0.1', done));
  const address = server.http.address(); assert(address && typeof address === 'object');
  const clients: Client[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const client: Client = io(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true, reconnection: false });
      await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); }); clients.push(client);
    }
    const created = ok(await clients[0].emitWithAck('room:create', { requestId: randomUUID(), nickname: 'Host' }));
    for (let i = 1; i < count; i++) ok(await clients[i].emitWithAck('room:join', { requestId: randomUUID(), code: created.room.code, nickname: `Keeper ${i}` }));
    rejected(await clients[1].emitWithAck('game:start', { requestId: randomUUID() }), 'HOST_ONLY');
    rejected(await clients[0].emitWithAck('game:start', { requestId: randomUUID() }), 'CREW_NOT_READY');
    for (const client of clients) ok(await client.emitWithAck('room:ready', { requestId: randomUUID(), ready: true }));
    const snapshots = clients.map(client => nextView(client, 'DISCUSS'));
    const started = ok(await clients[0].emitWithAck('game:start', { requestId: randomUUID() }));
    const views = await Promise.all(snapshots);
    assert.deepEqual(started.room, views[0]);
    await run(clients, views);
  } finally { clients.forEach(client => client.disconnect()); await server.close(); }
}
function solveFromNotes(views: RoomView[]) {
  const clues = views.flatMap(view => view.encounter!.privateClues);
  const chart = clues.find(c => c.id === 'chart')!.text;
  const unsafe = /past the (reef|buoy)/.exec(clues.find(c => c.id === 'weather')!.text)![1];
  const route = (['A', 'B', 'C'] as RouteId[]).find(id => !new RegExp(`Route ${id} passes the ([^.]+)`).exec(chart)![1].includes(unsafe))!;
  const request = /request word (ONE|TWO|THREE)/.exec(clues.find(c => c.id === 'message')!.text)![1];
  const signal = new RegExp(`${request} = (Anchor|Bell|Star)`).exec(clues.find(c => c.id === 'codebook')!.text)![1] as SignalId;
  return { routeId: route, signalId: signal };
}

test('chart pings synchronize without changing votes, validate inputs, and respect encounter boundaries', async () => withCrew(2, async ([host, guest], views) => {
  const id = views[0].encounter!.id;
  const answer = solveFromNotes(views);
  ok(await host.emitWithAck('game:propose', { requestId: randomUUID(), encounterId: id, expectedRevision: 0, ...answer }));
  ok(await host.emitWithAck('game:confirm', { requestId: randomUUID(), encounterId: id, expectedRevision: 1 }));
  const update = nextView(guest, 'DISCUSS', view => view.encounter!.pings.length === 1);
  const ping = ok(await host.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'A', intent: 'inspect' }));
  assert.deepEqual((await update).encounter!.pings, ping.room.encounter!.pings);
  assert.equal(ping.room.encounter!.revision, 1);
  assert.equal(ping.room.encounter!.confirmations.length, 1);
  const replaced = ok(await host.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'B', intent: 'avoid' }));
  assert.equal(replaced.room.encounter!.pings.length, 1);
  assert.equal(replaced.room.encounter!.pings[0].routeId, 'B');
  const both = ok(await guest.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'A', intent: 'safe' }));
  assert.equal(both.room.encounter!.pings.length, 2);
  const cleared = ok(await host.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'B', intent: null }));
  assert.equal(cleared.room.encounter!.pings[0].playerId, both.playerId);
  rejected(await guest.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'D', intent: 'safe' } as never), 'INVALID_INPUT');
  rejected(await guest.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'A', intent: 'arbitrary message' } as never), 'INVALID_INPUT');
  rejected(await guest.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: randomUUID(), routeId: 'A', intent: 'safe' }), 'STALE_ENCOUNTER');
  ok(await guest.emitWithAck('game:confirm', { requestId: randomUUID(), encounterId: id, expectedRevision: 1 }));
  rejected(await guest.emitWithAck('game:ping', { requestId: randomUUID(), encounterId: id, routeId: 'A', intent: 'safe' }), 'WRONG_PHASE');
  ok(await host.emitWithAck('game:continue', { requestId: randomUUID(), encounterId: id }));
  const next = ok(await guest.emitWithAck('game:continue', { requestId: randomUUID(), encounterId: id }));
  assert.deepEqual(next.room.encounter!.pings, []);
}));

test('authored puzzle variations always have one solvable answer', () => {
  for (let i = 0; i < 500; i++) { const puzzle = createSafePassage(); assert.deepEqual(solveSafePassage(puzzle), [puzzle.answer]); }
});

test('2/3/4-player acknowledgements and broadcasts only contain the recipient’s private notes', async () => {
  for (const count of [2, 3, 4]) await withCrew(count, async (clients, views) => {
    const clues = views.flatMap(view => view.encounter!.privateClues);
    assert.equal(clues.length, 4);
    for (let i = 0; i < count; i++) {
      const mine = views[i].encounter!.privateClues;
      const player = views[i].players[i];
      assert(mine.every(clue => player.stations.includes(clue.station)));
      assert.equal(views[i].encounter!.result, null);
      const payload = JSON.stringify(views[i]);
      assert(!payload.includes('"answer"')); assert(!payload.includes('"puzzle"'));
      for (const clue of clues.filter(clue => !mine.some(own => own.id === clue.id))) assert(!payload.includes(clue.text));
      const other = clues.find(clue => !mine.some(own => own.id === clue.id))!;
      rejected(await clients[i].emitWithAck('game:share', { requestId: randomUUID(), encounterId: views[i].encounter!.id, clueId: other.id }), 'FORBIDDEN_CLUE');
    }
    const clue = views[0].encounter!.privateClues[0];
    const guestSnapshot = nextView(clients[1], 'DISCUSS');
    const shared = ok(await clients[0].emitWithAck('game:share', { requestId: randomUUID(), encounterId: views[0].encounter!.id, clueId: clue.id }));
    assert.equal(shared.room.encounter!.sharedClues.length, 1);
    const guest = await guestSnapshot;
    assert.equal(guest.encounter!.sharedClues[0].text, clue.text);
    assert.deepEqual(guest.encounter!.privateClues, views[1].encounter!.privateClues);
    const again = ok(await clients[0].emitWithAck('game:share', { requestId: randomUUID(), encounterId: views[0].encounter!.id, clueId: clue.id }));
    assert.equal(again.room.encounter!.sharedClues.length, 1);
  });
});

test('proposal revisions clear confirmations; unanimous confirmation resolves once; replay rejects old intents', async () => withCrew(2, async (clients, views) => {
  const [host, guest] = clients;
  const id = views[0].encounter!.id;
  const answer = solveFromNotes(views);
  ok(await host.emitWithAck('game:propose', { requestId: randomUUID(), encounterId: id, expectedRevision: 0, ...answer }));
  ok(await guest.emitWithAck('game:confirm', { requestId: randomUUID(), encounterId: id, expectedRevision: 1 }));
  const edited = ok(await host.emitWithAck('game:propose', { requestId: randomUUID(), encounterId: id, expectedRevision: 1, ...answer }));
  assert.deepEqual(edited.room.encounter!.confirmations, []);
  rejected(await guest.emitWithAck('game:confirm', { requestId: randomUUID(), encounterId: id, expectedRevision: 1 }), 'STALE_PROPOSAL');
  const firstConfirm = ok(await host.emitWithAck('game:confirm', { requestId: randomUUID(), encounterId: id, expectedRevision: 2 }));
  assert.equal(firstConfirm.room.phase, 'DISCUSS'); assert.equal(firstConfirm.room.encounter!.result, null);
  const request = { requestId: randomUUID(), encounterId: id, expectedRevision: 2 };
  const finished = ok(await guest.emitWithAck('game:confirm', request));
  assert.equal(finished.room.phase, 'DEBRIEF'); assert.equal(finished.room.encounter!.result!.rescued, true);
  assert.deepEqual(await guest.emitWithAck('game:confirm', request), finished);
  rejected(await host.emitWithAck('game:confirm', { ...request, requestId: randomUUID() }), 'WRONG_PHASE');
  rejected(await host.emitWithAck('game:start', { requestId: randomUUID() }), 'WRONG_PHASE');
  const waiting = ok(await host.emitWithAck('game:continue', { requestId: randomUUID(), encounterId: id }));
  assert.equal(waiting.room.phase, 'DEBRIEF');
  const replay = ok(await guest.emitWithAck('game:continue', { requestId: randomUUID(), encounterId: id }));
  assert.notEqual(replay.room.encounter!.id, id); assert.equal(replay.room.encounter!.sharedClues.length, 0); assert.equal(replay.room.encounter!.result, null);
  rejected(await guest.emitWithAck('game:share', { requestId: randomUUID(), encounterId: id, clueId: 'weather' }), 'STALE_ENCOUNTER');
}));

test('incorrect pair resolves as a failed rescue and explains the clues', async () => withCrew(2, async (clients, views) => {
  const id = views[0].encounter!.id;
  const answer = solveFromNotes(views);
  const wrongRoute = (['A', 'B', 'C'] as RouteId[]).find(route => route !== answer.routeId)!;
  ok(await clients[0].emitWithAck('game:propose', { requestId: randomUUID(), encounterId: id, expectedRevision: 0, routeId: wrongRoute, signalId: answer.signalId }));
  for (const client of clients) {
    const reply = ok(await client.emitWithAck('game:confirm', { requestId: randomUUID(), encounterId: id, expectedRevision: 1 }));
    if (reply.room.phase === 'DEBRIEF') { assert.equal(reply.room.encounter!.result!.rescued, false); assert(reply.room.encounter!.result!.explanation.includes(`Route ${answer.routeId}`)); }
  }
  rejected(await clients[1].emitWithAck('game:lobby', { requestId: randomUUID() }), 'HOST_ONLY');
  const lobby = ok(await clients[0].emitWithAck('game:lobby', { requestId: randomUUID() }));
  assert.equal(lobby.room.phase, 'LOBBY'); assert.equal(lobby.room.encounter, null); assert(lobby.room.players.every(p => !p.ready));
}));

test('active encounter freezes on disconnect, resumes private notes, and returns to lobby on departure', () => {
  const rooms = new Rooms();
  const host = rooms.create('Host', 'host'); const guest = rooms.join(host.code, 'Guest', 'guest');
  rooms.ready('host', true); rooms.ready('guest', true);
  const started = rooms.start('host'); const id = started.room.encounter!.id;
  assert.throws(() => rooms.join(host.code, 'Late', 'late'), /guiding a ship/);
  rooms.disconnect('guest');
  assert.equal(rooms.connectedViews(host.code)[0].room.encounter!.paused, true);
  assert.throws(() => rooms.propose('host', id, 0, 'A', 'Bell'), /paused/);
  const resumed = rooms.resume(host.code, guest.token, 'guest-new');
  assert.equal(resumed.room.encounter!.id, id); assert.equal(resumed.room.encounter!.paused, false);
  assert.deepEqual(resumed.room.encounter!.privateClues.map(c => c.id), ['weather', 'codebook']);
  rooms.disconnect('guest-new');
  const expired = rooms.sweep(Date.now() + 60_001);
  assert.equal(expired[0].phase, 'LOBBY'); assert.equal(expired[0].encounter, null);
  assert.equal(rooms.connectedViews(host.code)[0].room.players.length, 1);
});
