import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { z } from 'zod';
import type { ClientEvents, Reply, ServerEvents } from '../shared/protocol.js';
import { RoomError, Rooms } from './rooms.js';

const envelope = z.object({ requestId: z.string().uuid() });
const nickname = z.string().trim().min(1).max(24).refine(s => !/[\p{Cc}\p{Cf}]/u.test(s), 'Use a nickname without control characters.');
const code = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const createSchema = envelope.extend({ nickname });
const joinSchema = createSchema.extend({ code });
const resumeSchema = envelope.extend({ code, token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
const readySchema = envelope.extend({ ready: z.boolean() });
const startSchema = envelope.extend({ tutorial: z.boolean().optional().default(false) });
const encounterSchema = envelope.extend({ encounterId: z.string().uuid() });
const revisionSchema = encounterSchema.extend({ expectedRevision: z.number().int().min(0) });
const shareSchema = encounterSchema.extend({ clueId: z.string().min(1).max(40) });
const proposalSchema = revisionSchema.extend({ routeId: z.enum(['A', 'B', 'C']), signalId: z.enum(['Anchor', 'Bell', 'Star']) });

export async function createAppServer(options: { production?: boolean; graceMs?: number; idleMs?: number; sweepMs?: number; development?: boolean } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const http = createServer(app);
  const allowedOrigins = (process.env.PUBLIC_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const io = new Server<ClientEvents, ServerEvents>(http, {
    maxHttpBufferSize: 8192,
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      let sameHost = false;
      try { sameHost = Boolean(origin && new URL(origin).host === req.headers.host); } catch { /* Reject malformed origins. */ }
      callback(null, !origin || (allowedOrigins.length ? allowedOrigins.includes(origin) : !options.production || sameHost));
    },
  });
  const rooms = new Rooms(options.graceMs, options.idleMs);
  // A room-wide payload must never contain everyone's private clues.
  function broadcast(code: string) {
    for (const view of rooms.connectedViews(code)) io.to(view.socketId).emit('room:snapshot', view.room);
  }
  // Bounded per-address budget for room churn and code guessing. No credentials are logged.
  const budgets = new Map<string, { count: number; reset: number }>();
  function consume(address: string, event: string) {
    const key = `${address}:${event}`;
    const now = Date.now();
    let budget = budgets.get(key);
    if (!budget || budget.reset <= now) { budget = { count: 0, reset: now + 60_000 }; budgets.set(key, budget); }
    if (++budget.count > (event === 'room:create' ? 12 : 80)) throw new RoomError('RATE_LIMITED', 'Too many requests. Wait a minute, then try again.');
  }
  const timer = setInterval(() => {
    for (const room of rooms.sweep()) broadcast(room.code);
    for (const [key, value] of budgets) if (value.reset <= Date.now()) budgets.delete(key);
  }, options.sweepMs ?? 1000);
  timer.unref();

  io.on('connection', socket => {
    const replies = new Map<string, { fingerprint: string; reply: Reply }>();
    function handle<T>(event: keyof ClientEvents, schema: z.ZodType<T>, work: (input: T) => Reply) {
      // Validate at the network boundary; clients can send arbitrary payloads.
      socket.on(event, ((raw: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        try {
          const input = schema.parse(raw);
          const requestId = (input as { requestId: string }).requestId;
          const fingerprint = JSON.stringify([event, input]);
          const cached = replies.get(requestId);
          if (cached) {
            if (cached.fingerprint !== fingerprint) throw new RoomError('REQUEST_CONFLICT', 'Use a new request identifier for a different action.');
            ack(cached.reply); return;
          }
          consume(socket.handshake.address, event);
          const reply = work(input);
          replies.set(requestId, { fingerprint, reply });
          if (replies.size > 100) replies.delete(replies.keys().next().value!);
          ack(reply);
        } catch (error) {
          const reply: Reply = error instanceof RoomError ? { ok: false, code: error.code, message: error.message }
            : { ok: false, code: 'INVALID_INPUT', message: 'Invalid request. Check your input and try again.' };
          ack(reply);
        }
      }) as never);
    }
    handle('room:create', createSchema, input => {
      const result = rooms.create(input.nickname, socket.id);
      socket.join(result.code);
      broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId, seat: { code: result.code, token: result.token } };
    });
    handle('room:join', joinSchema, input => {
      const result = rooms.join(input.code, input.nickname, socket.id);
      socket.join(result.code);
      broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId, seat: { code: result.code, token: result.token } };
    });
    handle('room:resume', resumeSchema, input => {
      const result = rooms.resume(input.code, input.token, socket.id);
      if (result.previousSocketId) {
        const previous = io.sockets.sockets.get(result.previousSocketId);
        previous?.emit('seat:replaced');
        previous?.disconnect(true);
      }
      socket.join(result.code);
      broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('room:ready', readySchema, input => {
      const result = rooms.ready(socket.id, input.ready);
      broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('room:leave', envelope, () => {
      const result = rooms.leave(socket.id);
      socket.leave(result.code);
      broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('game:start', startSchema, input => {
      const result = rooms.start(socket.id, input.tutorial); broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('game:continue', encounterSchema, input => {
      const result = rooms.continue(socket.id, input.encounterId); broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('game:share', shareSchema, input => {
      const result = rooms.share(socket.id, input.encounterId, input.clueId); broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('game:propose', proposalSchema, input => {
      const result = rooms.propose(socket.id, input.encounterId, input.expectedRevision, input.routeId, input.signalId); broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('game:confirm', revisionSchema, input => {
      const result = rooms.confirm(socket.id, input.encounterId, input.expectedRevision); broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    handle('game:lobby', envelope, () => {
      const result = rooms.lobby(socket.id); broadcast(result.code);
      return { ok: true, room: result.room, playerId: result.playerId };
    });
    socket.on('disconnect', () => {
      const room = rooms.disconnect(socket.id);
      if (room) broadcast(room.code);
    });
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'last-light' }));
  let closeVite: (() => Promise<void>) | undefined;
  if (options.production) {
    app.use(express.static(resolve('dist/client')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/client/index.html')));
  } else if (options.development) {
    const { createServer: createVite } = await import('vite');
    const vite = await createVite({ server: { middlewareMode: true, allowedHosts: true, hmr: { server: http } }, appType: 'spa' });
    app.use(vite.middlewares);
    closeVite = () => vite.close();
  }
  return { app, http, io, rooms, close: async () => { clearInterval(timer); await closeVite?.(); await new Promise<void>(done => io.close(() => done())); } };
}
