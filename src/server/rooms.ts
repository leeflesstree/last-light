import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { EncounterResult, ErrorCode, ProposalView, RoomView, RouteId, SessionView, SharedClue, SignalId, Station } from '../shared/protocol.js';
import { createPuzzle, type Puzzle } from './puzzles/engine.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
interface Seat {
  id: string;
  nickname: string;
  tokenHash: string;
  socketId: string | null;
  ready: boolean;
  reconnectUntil: number | null;
}
interface Encounter {
  id: string;
  puzzle: Puzzle;
  sharedClues: SharedClue[];
  proposal: ProposalView | null;
  revision: number;
  confirmations: string[];
  result: EncounterResult | null;
  continueReady: string[];
}
interface Session extends SessionView { seed: number; sequence: number; history: string[] }
interface Room { code: string; version: number; hostId: string; players: Seat[]; emptySince: number | null; phase: RoomView['phase']; encounter: Encounter | null; notice: string | null; session: Session | null }
function stationAssignments(count: number): Station[][] {
  return count <= 2 ? [['Chart Table', 'Signal Desk'], ['Stormglass', 'Beacon Console']]
    : count === 3 ? [['Chart Table'], ['Stormglass'], ['Signal Desk', 'Beacon Console']]
    : [['Chart Table'], ['Stormglass'], ['Signal Desk'], ['Beacon Console']];
}
export class RoomError extends Error {
  constructor(public code: ErrorCode, message: string) { super(message); }
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class Rooms {
  private rooms = new Map<string, Room>();
  private membership = new Map<string, { code: string; playerId: string }>();
  constructor(private graceMs = 60_000, private idleMs = 30 * 60_000) {}
  get count() { return this.rooms.size; }

  private get(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'That room has ended or the code is incorrect. Check the code or create a new room.');
    return room;
  }
  private ensureUnseated(socketId: string) {
    if (this.membership.has(socketId)) throw new RoomError('ALREADY_SEATED', 'Leave your current room before joining another.');
  }
  create(nickname: string, socketId: string) {
    this.ensureUnseated(socketId);
    if (this.rooms.size >= 1000) throw new RoomError('RATE_LIMITED', 'The lighthouse is busy. Please try again later.');
    let code: string;
    do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    this.rooms.set(code, { code, version: 0, hostId: '', players: [], emptySince: null, phase: 'LOBBY', encounter: null, notice: null, session: null });
    return this.join(code, nickname, socketId);
  }
  join(code: string, nickname: string, socketId: string) {
    this.ensureUnseated(socketId);
    const room = this.get(code);
    if (room.phase !== 'LOBBY') throw new RoomError('WRONG_PHASE', 'This crew is guiding a ship. Ask the host to return to the lobby before you join.');
    if (room.players.length >= 4) throw new RoomError('ROOM_FULL', 'This lighthouse already has four crew members. Ask for another room code.');
    const token = randomBytes(32).toString('base64url');
    const player: Seat = { id: randomUUID(), nickname, tokenHash: hashToken(token), socketId, ready: false, reconnectUntil: null };
    room.players.push(player);
    room.emptySince = null;
    this.membership.set(socketId, { code, playerId: player.id });
    if (!room.hostId || !room.players.some(p => p.id === room.hostId && p.socketId)) room.hostId = player.id;
    this.resetReadiness(room);
    room.version++;
    return { code, playerId: player.id, token, room: this.view(room, player.id) };
  }
  resume(code: string, token: string, socketId: string) {
    this.ensureUnseated(socketId);
    const room = this.get(code);
    const player = room.players.find(p => p.tokenHash === hashToken(token));
    if (!player || (player.reconnectUntil !== null && player.reconnectUntil <= Date.now())) throw new RoomError('INVALID_SEAT', 'Your reserved seat has expired. Join again with your nickname.');
    const previousSocketId = player.socketId;
    if (previousSocketId) this.membership.delete(previousSocketId);
    player.socketId = socketId;
    player.reconnectUntil = null;
    room.emptySince = null;
    this.membership.set(socketId, { code, playerId: player.id });
    this.assignHost(room);
    room.version++;
    return { code, playerId: player.id, room: this.view(room, player.id), previousSocketId };
  }
  ready(socketId: string, ready: boolean) {
    const { room, player } = this.member(socketId);
    if (room.phase !== 'LOBBY') throw new RoomError('WRONG_PHASE', 'Readiness can only be changed in the lobby.');
    player.ready = ready;
    room.version++;
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  leave(socketId: string) {
    const { room, player } = this.member(socketId);
    if (room.phase !== 'LOBBY') this.returnToLobby(room, `${player.nickname} left. The crew returned to the lobby so stations can be reassigned.`);
    this.membership.delete(socketId);
    room.players = room.players.filter(p => p.id !== player.id);
    this.resetReadiness(room);
    this.assignHost(room);
    room.version++;
    const view = this.view(room, player.id);
    if (!room.players.length) this.rooms.delete(room.code);
    return { code: room.code, playerId: player.id, room: view };
  }
  disconnect(socketId: string) {
    if (!this.membership.has(socketId)) return null;
    const { room, player } = this.member(socketId);
    this.membership.delete(socketId);
    player.socketId = null;
    player.ready = false;
    player.reconnectUntil = Date.now() + this.graceMs;
    if (!room.players.some(p => p.socketId)) room.emptySince = Date.now();
    this.assignHost(room);
    room.version++;
    return this.view(room);
  }
  sweep(now = Date.now()) {
    const changed: RoomView[] = [];
    for (const room of this.rooms.values()) {
      if (room.emptySince !== null && now - room.emptySince >= this.idleMs) { this.rooms.delete(room.code); continue; }
      const remaining = room.players.filter(p => p.reconnectUntil === null || p.reconnectUntil > now);
      if (remaining.length !== room.players.length) {
        if (room.phase !== 'LOBBY') this.returnToLobby(room, 'A keeper did not reconnect in time. The crew returned to the lobby.');
        room.players = remaining;
        this.resetReadiness(room);
        this.assignHost(room);
        room.version++;
        changed.push(this.view(room));
      }
    }
    return changed;
  }
  // Every transport delivery, including acknowledgements, must use a seat-specific view.
  connectedViews(code: string) {
    const room = this.rooms.get(code);
    if (!room) return [];
    return room.players.flatMap(player => player.socketId ? [{ socketId: player.socketId, room: this.view(room, player.id) }] : []);
  }
  start(socketId: string, tutorial = false) {
    const { room, player } = this.member(socketId);
    this.requireHost(room, player);
    if (room.phase !== 'LOBBY') throw new RoomError('WRONG_PHASE', 'A watch can only begin in the lobby. Continue together after each ship.');
    if (room.players.length < 2 || room.players.some(p => !p.socketId || !p.ready)) {
      throw new RoomError('CREW_NOT_READY', 'At least two keepers must be connected, and everyone must be ready in the lobby.');
    }
    room.session = { seed: randomInt(4294967296), sequence: 0, history: [], rescued: 0, damage: 0, completed: 0, practicing: tutorial, outcome: null };
    this.beginEncounter(room, tutorial);
    room.notice = null; room.version++;
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  continue(socketId: string, encounterId: string) {
    const { room, player, encounter } = this.discuss(socketId, encounterId, 'DEBRIEF');
    if (!encounter.continueReady.includes(player.id)) { encounter.continueReady.push(player.id); room.version++; }
    if (room.players.every(p => encounter.continueReady.includes(p.id))) {
      room.session!.practicing = false;
      this.beginEncounter(room, false);
    }
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  private beginEncounter(room: Room, tutorial: boolean) {
    const session = room.session!;
    const family = session.completed === 0 ? 'SAFE_PASSAGE' : session.completed === 1 ? 'BROKEN_COMPASS' : 'SIGNAL_FOG';
    let puzzle: Puzzle;
    for (let attempt = 0; ; attempt++) {
      const seed = (session.seed + Math.imul(++session.sequence, 0x9e3779b9)) >>> 0;
      puzzle = createPuzzle(family, seed, tutorial);
      const signature = JSON.stringify(puzzle.clues.map(clue => clue.text));
      if (!session.history.includes(signature) || attempt >= 15) { session.history.push(signature); break; }
    }
    room.encounter = { id: randomUUID(), puzzle, sharedClues: [], proposal: null, revision: 0, confirmations: [], result: null, continueReady: [] };
    room.phase = 'DISCUSS';
  }
  share(socketId: string, encounterId: string, clueId: string) {
    const { room, player, encounter } = this.discuss(socketId, encounterId);
    const clue = encounter.puzzle.clues.find(c => c.id === clueId);
    const stations = stationAssignments(room.players.length)[room.players.indexOf(player)];
    if (!clue || !stations.includes(clue.station)) throw new RoomError('FORBIDDEN_CLUE', 'Only share clues from your own stations.');
    if (!encounter.sharedClues.some(c => c.id === clue.id)) {
      encounter.sharedClues.push({ ...clue, sharedBy: player.id, nickname: player.nickname });
      room.version++;
    }
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  propose(socketId: string, encounterId: string, expectedRevision: number, routeId: RouteId, signalId: SignalId) {
    const { room, player, encounter } = this.discuss(socketId, encounterId);
    this.requireRevision(encounter, expectedRevision);
    if (!encounter.puzzle.availableRoutes.includes(routeId) || !encounter.puzzle.availableSignals.includes(signalId)) throw new RoomError('INVALID_INPUT', 'Choose one of this encounter’s available routes and signals.');
    encounter.revision++;
    encounter.proposal = { routeId, signalId, revision: encounter.revision, proposedBy: player.id };
    encounter.confirmations = [];
    room.version++;
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  confirm(socketId: string, encounterId: string, expectedRevision: number) {
    const { room, player, encounter } = this.discuss(socketId, encounterId);
    this.requireRevision(encounter, expectedRevision);
    if (!encounter.proposal) throw new RoomError('INVALID_INPUT', 'Propose both a route and a beacon before confirming.');
    if (!encounter.confirmations.includes(player.id)) { encounter.confirmations.push(player.id); room.version++; }
    if (room.players.every(p => encounter.confirmations.includes(p.id))) {
      const answer = encounter.puzzle.answer;
      encounter.result = {
        rescued: encounter.proposal.routeId === answer.routeId && encounter.proposal.signalId === answer.signalId,
        correctRoute: answer.routeId, correctSignal: answer.signalId, explanation: encounter.puzzle.explanation,
      };
      room.phase = 'DEBRIEF';
      if (!encounter.puzzle.tutorial) {
        const session = room.session!;
        session.completed++;
        if (encounter.result.rescued) session.rescued++; else session.damage++;
        session.outcome = session.rescued >= 3 ? 'VICTORY' : session.damage >= 3 ? 'DEFEAT' : null;
        if (session.outcome) room.phase = 'FINISHED';
      }
    }
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  lobby(socketId: string) {
    const { room, player } = this.member(socketId);
    this.requireHost(room, player);
    this.returnToLobby(room, 'The host returned the crew to the lobby.');
    room.version++;
    return { code: room.code, playerId: player.id, room: this.view(room, player.id) };
  }
  private requireHost(room: Room, player: Seat) {
    if (room.hostId !== player.id) throw new RoomError('HOST_ONLY', 'Only the host can do that.');
  }
  private requireRevision(encounter: Encounter, revision: number) {
    if (revision !== encounter.revision) throw new RoomError('STALE_PROPOSAL', 'The proposal changed. Review the current choice before trying again.');
  }
  private discuss(socketId: string, encounterId: string, phase: 'DISCUSS' | 'DEBRIEF' = 'DISCUSS') {
    const { room, player } = this.member(socketId);
    if (room.encounter?.id !== encounterId) throw new RoomError('STALE_ENCOUNTER', 'That encounter has ended. Review the current ship.');
    if (room.phase !== phase) throw new RoomError('WRONG_PHASE', phase === 'DISCUSS' ? 'This ship has already been resolved. Continue together to the next ship.' : 'Continue is only available after a result.');
    if (room.players.some(p => !p.socketId)) throw new RoomError('CREW_DISCONNECTED', 'Waiting for a keeper to reconnect. Decisions are paused.');
    return { room, player, encounter: room.encounter };
  }
  private returnToLobby(room: Room, notice: string) {
    room.phase = 'LOBBY'; room.encounter = null; room.session = null; room.notice = notice; this.resetReadiness(room);
  }
  private member(socketId: string) {
    const member = this.membership.get(socketId);
    if (!member) throw new RoomError('NOT_SEATED', 'Join a room before changing your crew status.');
    const room = this.get(member.code);
    const player = room.players.find(p => p.id === member.playerId)!;
    return { room, player };
  }
  private resetReadiness(room: Room) { room.players.forEach(p => { p.ready = false; }); }
  private assignHost(room: Room) {
    if (!room.players.some(p => p.id === room.hostId && p.socketId)) room.hostId = room.players.find(p => p.socketId)?.id ?? room.players[0]?.id ?? '';
  }
  private view(room: Room, viewerId?: string): RoomView {
    const assignments = stationAssignments(room.players.length);
    const ownStations = assignments[room.players.findIndex(p => p.id === viewerId)] ?? [];
    const encounter = room.encounter;
    return {
      code: room.code, version: room.version, phase: room.phase, hostId: room.hostId, notice: room.notice,
      session: room.session ? { rescued: room.session.rescued, damage: room.session.damage, completed: room.session.completed, practicing: room.session.practicing, outcome: room.session.outcome } : null,
      crewReady: room.players.length >= 2 && room.players.every(p => p.socketId && p.ready),
      players: room.players.map((p, i) => ({ id: p.id, nickname: p.nickname, connected: p.socketId !== null, ready: p.ready, stations: assignments[i] ?? [], reconnectUntil: p.reconnectUntil })),
      encounter: encounter ? {
        id: encounter.id, ship: encounter.puzzle.tutorial ? 'The Practice Boat' : ['The Wandering Tern', 'The Copper Finch', 'The Quiet Current', 'The Northern Star', 'The Morrow'][room.session!.completed - (encounter.result ? 1 : 0)] ?? 'The Morrow',
        family: encounter.puzzle.family, title: encounter.puzzle.title, instructions: encounter.puzzle.instructions, tutorial: encounter.puzzle.tutorial,
        routes: [...encounter.puzzle.availableRoutes], signals: [...encounter.puzzle.availableSignals], continueReady: [...encounter.continueReady],
        privateClues: encounter.puzzle.clues.filter(clue => ownStations.includes(clue.station)).map(clue => ({ ...clue })),
        sharedClues: encounter.sharedClues.map(clue => ({ ...clue })),
        proposal: encounter.proposal ? { ...encounter.proposal } : null, revision: encounter.revision,
        confirmations: [...encounter.confirmations], paused: room.players.some(p => !p.socketId),
        result: encounter.result ? { ...encounter.result } : null,
      } : null,
    };
  }
}
