import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, Reply, RoomAction, RoomView, SeatCredential, ServerEvents } from '../shared/protocol';

const SEAT_KEY = 'last-light-seat-v1';
function readSeat(): SeatCredential | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SEAT_KEY) ?? 'null');
    return value && typeof value.code === 'string' && typeof value.token === 'string' ? value : null;
  } catch { return null; }
}
function saveSeat(seat: SeatCredential | null) {
  try { if (seat) sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat)); else sessionStorage.removeItem(SEAT_KEY); } catch { /* Tab can still play when storage is unavailable. */ }
}
export function requestId() {
  // getRandomValues also works on LAN HTTP, where crypto.randomUUID is unavailable.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function useRoom() {
  const [socket] = useState<Socket<ServerEvents, ClientEvents>>(() => io({ autoConnect: false }));
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(() => Boolean(readSeat()));
  const activeRoom = useRef<string | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);

  function accept(reply: Reply) {
    if (!mounted.current) return false;
    if (!reply.ok) { setError(reply.message); return false; }
    activeRoom.current = reply.room.code;
    setRoom(previous => previous?.code === reply.room.code && previous.version > reply.room.version ? previous : reply.room);
    setPlayerId(reply.playerId);
    if (reply.seat) saveSeat(reply.seat);
    setError('');
    return true;
  }

  useEffect(() => {
    mounted.current = true;
    const onConnect = async () => {
      setConnected(true);
      const seat = readSeat();
      if (!seat) { setRestoring(false); return; }
      setRestoring(true);
      try {
        const reply = await socket.timeout(8000).emitWithAck('room:resume', { requestId: requestId(), ...seat });
        if (!accept(reply)) { saveSeat(null); activeRoom.current = null; setRoom(null); }
      } catch { setError('Could not restore your seat. Reconnect to try again.'); }
      finally { if (mounted.current) setRestoring(false); }
    };
    const onDisconnect = () => setConnected(false);
    const onSnapshot = (next: RoomView) => {
      if (activeRoom.current !== next.code) return;
      setRoom(previous => !previous || next.version > previous.version ? next : previous);
    };
    const onReplaced = () => {
      saveSeat(null); activeRoom.current = null; setRoom(null); setPlayerId('');
      setError('This seat was opened in another tab. Join again to take a new seat.');
    };
    const onConnectError = () => { setConnected(false); setError('The lighthouse server is unreachable. We will keep trying to reconnect.'); };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:snapshot', onSnapshot);
    socket.on('seat:replaced', onReplaced);
    socket.connect();
    return () => {
      mounted.current = false;
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('connect_error', onConnectError);
      socket.off('room:snapshot', onSnapshot); socket.off('seat:replaced', onReplaced); socket.disconnect();
    };
  }, [socket]);

  async function action(event: RoomAction, data: Record<string, unknown> = {}) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    const payload = { requestId: requestId(), ...data };
    try {
      if (!socket.connected) { setError('Connection lost. Wait for the lighthouse to reconnect.'); return; }
      // The identical envelope is retried once if the acknowledgement is lost.
      const send = () => socket.timeout(8000).emitWithAck(event, payload as never);
      let reply: Reply;
      try { reply = await send(); } catch { if (!socket.connected) throw new Error('Disconnected'); reply = await send(); }
      if (accept(reply) && event === 'room:leave') {
        saveSeat(null); activeRoom.current = null; setRoom(null); setPlayerId('');
        history.replaceState(null, '', location.pathname);
      }
    } catch { setError('The server did not respond. Reconnect or refresh to recover your seat.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  function reconnect() { setError(''); socket.connect(); }
  return { room, playerId, connected, busy: busy || restoring, error, action, reconnect };
}
