export const STATIONS = ['Chart Table', 'Stormglass', 'Signal Desk', 'Beacon Console'] as const;
export type Station = typeof STATIONS[number];
export type RouteId = 'A' | 'B' | 'C';
export type SignalId = 'Anchor' | 'Bell' | 'Star';
export type PingIntent = 'inspect' | 'safe' | 'avoid';
export interface ChartPing { playerId: string; nickname: string; routeId: RouteId; intent: PingIntent }
export type PuzzleFamily = 'SAFE_PASSAGE' | 'BROKEN_COMPASS' | 'SIGNAL_FOG';
export interface SessionView { rescued: number; damage: number; completed: number; practicing: boolean; outcome: 'VICTORY' | 'DEFEAT' | null }
export interface ClueView { id: string; station: Station; title: string; text: string }
export interface SharedClue extends ClueView { sharedBy: string; nickname: string }
export interface ProposalView { routeId: RouteId; signalId: SignalId; revision: number; proposedBy: string }
export interface EncounterResult { rescued: boolean; correctRoute: RouteId; correctSignal: SignalId; explanation: string }
export interface EncounterView {
  id: string;
  ship: string;
  family: PuzzleFamily;
  title: string;
  instructions: string;
  tutorial: boolean;
  continueReady: string[];
  routes: RouteId[];
  signals: SignalId[];
  privateClues: ClueView[];
  sharedClues: SharedClue[];
  pings: ChartPing[];
  proposal: ProposalView | null;
  revision: number;
  confirmations: string[];
  paused: boolean;
  result: EncounterResult | null;
}
export interface PlayerView {
  id: string;
  nickname: string;
  connected: boolean;
  ready: boolean;
  stations: Station[];
  reconnectUntil: number | null;
}
export interface RoomView {
  code: string;
  version: number;
  phase: 'LOBBY' | 'DISCUSS' | 'DEBRIEF' | 'FINISHED';
  hostId: string;
  players: PlayerView[];
  crewReady: boolean;
  encounter: EncounterView | null;
  notice: string | null;
  session: SessionView | null;
}
export interface SeatCredential { code: string; token: string }
export type ErrorCode = 'INVALID_INPUT' | 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'INVALID_SEAT' | 'NOT_SEATED' | 'ALREADY_SEATED' | 'RATE_LIMITED' | 'REQUEST_CONFLICT' | 'WRONG_PHASE' | 'HOST_ONLY' | 'CREW_NOT_READY' | 'FORBIDDEN_CLUE' | 'STALE_PROPOSAL' | 'STALE_ENCOUNTER' | 'CREW_DISCONNECTED';
export type Reply = { ok: true; room: RoomView; playerId: string; seat?: SeatCredential } | { ok: false; code: ErrorCode; message: string };
export interface ServerEvents {
  'room:snapshot': (room: RoomView) => void;
  'room:ended': (message: string) => void;
  'seat:replaced': () => void;
}
export interface ClientEvents {
  'room:create': (data: { requestId: string; nickname: string }, ack: (reply: Reply) => void) => void;
  'room:join': (data: { requestId: string; nickname: string; code: string }, ack: (reply: Reply) => void) => void;
  'room:resume': (data: { requestId: string; code: string; token: string }, ack: (reply: Reply) => void) => void;
  'room:ready': (data: { requestId: string; ready: boolean }, ack: (reply: Reply) => void) => void;
  'room:leave': (data: { requestId: string }, ack: (reply: Reply) => void) => void;
  'game:start': (data: { requestId: string; tutorial?: boolean }, ack: (reply: Reply) => void) => void;
  'game:continue': (data: { requestId: string; encounterId: string }, ack: (reply: Reply) => void) => void;
  'game:share': (data: { requestId: string; encounterId: string; clueId: string }, ack: (reply: Reply) => void) => void;
  'game:ping': (data: { requestId: string; encounterId: string; routeId: RouteId; intent: PingIntent | null }, ack: (reply: Reply) => void) => void;
  'game:propose': (data: { requestId: string; encounterId: string; expectedRevision: number; routeId: RouteId; signalId: SignalId }, ack: (reply: Reply) => void) => void;
  'game:confirm': (data: { requestId: string; encounterId: string; expectedRevision: number }, ack: (reply: Reply) => void) => void;
  'game:lobby': (data: { requestId: string }, ack: (reply: Reply) => void) => void;
}
export type RoomAction = Exclude<keyof ClientEvents, 'room:resume'>;
