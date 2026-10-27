import { useState, type FormEvent } from 'react';
import { Coast } from './Coast';
import { useRoom } from './useRoom';
import { Encounter } from './Encounter';

export function App() {
  const { room, playerId, connected, busy, error, action, reconnect } = useRoom();
  const [mode, setMode] = useState<'create' | 'join'>(() => new URLSearchParams(location.search).has('room') ? 'join' : 'create');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.slice(0, 6).toUpperCase() ?? '');
  const [copied, setCopied] = useState('');
  const [tutorial, setTutorial] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => {
    try { return localStorage.getItem('last-light-motion-v1') === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return true; }
  });
  function toggleMotion() {
    const next = !reducedMotion;
    setReducedMotion(next);
    try { localStorage.setItem('last-light-motion-v1', next ? 'reduce' : 'full'); } catch { /* This visit still respects the setting. */ }
  }
  const me = room?.players.find(p => p.id === playerId);
  const online = room?.players.filter(p => p.connected).length ?? 0;
  const invite = room ? `${location.origin}/?room=${room.code}` : '';
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setCopied(`${label} copied`); }
    catch { setCopied(`Copy this ${label.toLowerCase()}: ${text}`); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void action(mode === 'create' ? 'room:create' : 'room:join', { nickname, ...(mode === 'join' ? { code } : {}) });
  }
  return <div className="app-shell" data-motion={reducedMotion ? 'reduce' : 'full'}>
    <a className="skip-link" href="#main">Skip to game</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="LAST LIGHT home"><span className="brand-mark" aria-hidden="true">✦</span> LAST LIGHT</a>
      <div className="header-right"><span className="edition">A COOPERATIVE MYSTERY</span><span className={`connection ${connected ? 'online' : ''}`} role="status"><i/>{connected ? 'Signal connected' : 'Connecting…'}</span></div>
    </header>
    <div className="play-settings"><button className="text-button" aria-pressed={reducedMotion} onClick={toggleMotion}>Reduce motion: {reducedMotion ? 'on' : 'off'}</button><span>No sound or voice required</span></div>
    <main id="main" tabIndex={-1}>
      {error && <div className="error-banner" role="alert"><span>{error}</span>{!connected && <button onClick={reconnect}>Reconnect</button>}</div>}
      {room?.notice && <p className="crew-message" role="status">{room.notice}</p>}
      {!room ? <>
        <div className="home-grid">
          <section className="intro" aria-labelledby="game-title">
            <div className="eyebrow"><span/> THE NIGHT SHIFT IS CALLING</div>
            <h1 id="game-title">One lighthouse.<br/>One storm.<br/><em>Your crew.</em></h1>
            <p className="intro-copy">Nobody has the whole picture.<br/>Find your people. Keep the light alive.</p>
            <div className="scene-wrap"><Coast/><span className="scene-caption">NORTH COAST · LIGHTHOUSE NO. 04</span></div>
          </section>
          <section className="boarding-card" aria-labelledby="boarding-title">
            <span className="card-icon" aria-hidden="true">✧</span>
            <div className="eyebrow">WELCOME TO THE LIGHTHOUSE</div>
            <h2 id="boarding-title">Assemble your crew.</h2>
            <p>Start a room, or follow a friend’s signal.</p>
            <div className="mode-switch" aria-label="Room action">
              <button type="button" className={mode === 'create' ? 'active' : ''} aria-pressed={mode === 'create'} onClick={() => setMode('create')}>Create a room</button>
              <button type="button" className={mode === 'join' ? 'active' : ''} aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Join a room</button>
            </div>
            <form onSubmit={submit}>
              <label htmlFor="nickname">YOUR NICKNAME</label>
              <input id="nickname" name="nickname" autoComplete="nickname" maxLength={24} required value={nickname} onChange={e => setNickname(e.target.value)} placeholder="What should the crew call you?" disabled={busy}/>
              {mode === 'join' && <><label htmlFor="room-code">ROOM CODE</label><input id="room-code" name="room-code" className="code-input" maxLength={6} minLength={6} pattern="[A-HJ-NP-Z2-9a-hj-np-z]{6}" required value={code} onChange={e => setCode(e.target.value.replace(/\s/g, '').toUpperCase())} placeholder="ABC234" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} disabled={busy}/></>}
              <button className="primary-button" disabled={busy || !connected} type="submit">{busy ? 'Following the signal…' : mode === 'create' ? 'Light the beacon' : 'Join the crew'}<span aria-hidden="true">↗</span></button>
            </form>
            <div className="card-note"><span aria-hidden="true">⚑</span><span>{mode === 'create' ? 'You’ll get a six-character code to share.' : 'Ask your friend for their six-character room code.'}</span></div>
            <div className="card-meta"><span>2–4 PLAYERS</span><b>·</b><span>ANY BROWSER</span><b>·</b><span>NO SIGN-UP</span></div>
          </section>
        </div>
        <section className="how-it-works" aria-label="How the lobby works"><div><span>01</span><p><strong>Send a signal</strong>Create a private room and share its code.</p></div><div><span>02</span><p><strong>Gather your crew</strong>Friends join from their own phone or computer.</p></div><div><span>03</span><p><strong>Take your station</strong>Check your assignment and mark yourself ready.</p></div></section>
      </> : room.encounter ? <Encounter key={room.encounter.id} room={room} playerId={playerId} busy={busy} connected={connected} action={action}/> : <div className="lobby-layout">
        <section className="lobby-main" aria-labelledby="lobby-title">
          <div className="eyebrow">LIGHTHOUSE NO. 04 · CREW QUARTERS</div>
          <h1 id="lobby-title" className="lobby-title">Keepers of <em>the light.</em></h1>
          <p className="lobby-subtitle">{online < 2 ? 'The first keeper is here. Send a signal to a friend.' : `${online} keepers connected. Your crew is coming together.`}</p>
          <div className="crew-heading"><h2>Your crew <span>{room.players.length}/4</span></h2><span>LIVE LOBBY</span></div>
          <ul className="crew-list" aria-label="Crew members">
            {room.players.map((player, index) => <li key={player.id} className={`crew-member ${player.id === playerId ? 'is-you' : ''}`}>
              <div className={`avatar avatar-${index}`} aria-hidden="true">{player.nickname.slice(0, 1).toLocaleUpperCase()}</div>
              <div className="crew-details"><div className="crew-name">{player.nickname}{player.id === playerId && <small>YOU</small>}{player.id === room.hostId && <span className="host-tag">HOST</span>}</div><p>{player.stations.join(' + ')}</p></div>
              <span className={`player-status ${!player.connected ? 'away' : player.ready ? 'ready' : ''}`}>{!player.connected ? 'Reconnecting · 60s grace' : player.ready ? '✓ Ready' : 'Getting settled'}</span>
            </li>)}
            {Array.from({ length: 4 - room.players.length }, (_, i) => <li key={`empty-${i}`} className="empty-seat"><span aria-hidden="true">+</span> An open seat by the sea</li>)}
          </ul>
          <div className={`crew-message ${room.crewReady ? 'all-ready' : ''}`} role="status" aria-live="polite"><span aria-hidden="true">{room.crewReady ? '✦' : '◌'}</span><div><strong>{room.crewReady ? 'The crew is ready.' : online < 2 ? 'A lighthouse needs at least two keepers.' : 'Settle in, then mark yourself ready.'}</strong><p>{room.crewReady ? 'The host can now guide the first ship. Compare your private clues to solve its passage.' : 'Station assignments update as crew members join or leave.'}</p></div></div>
          <div className="watch-rules"><strong>Your watch</strong><p>Rescue three ships before the lighthouse takes three damage marks. Share clues and confirm together. There is no timer.</p>{room.hostId === playerId && <label className="tutorial-option"><input type="checkbox" checked={tutorial} onChange={event => setTutorial(event.target.checked)} disabled={busy}/> Include an unscored practice encounter</label>}</div>
          {room.hostId === playerId && <button className="primary-button start-encounter" disabled={busy || !connected || !room.crewReady} onClick={() => void action('game:start', { tutorial })}>Begin the watch</button>}
          <div className="lobby-actions"><button className={`primary-button ${me?.ready ? 'is-ready' : ''}`} disabled={busy || !connected} onClick={() => void action('room:ready', { ready: !me?.ready })}>{me?.ready ? '✓ You’re ready · undo' : 'I’m ready at my station'}<span aria-hidden="true">↗</span></button><button className="text-button" disabled={busy || !connected} onClick={() => void action('room:leave')}>Leave room</button></div>
        </section>
        <aside className="invite-panel" aria-labelledby="invite-title"><div className="scene-wrap"><Coast compact/></div><div className="invite-content"><div className="eyebrow">YOUR PRIVATE SIGNAL</div><h2 id="invite-title">Bring a friend aboard.</h2><p>Open this site on another device and enter:</p><div className="room-code" aria-label={`Room code ${room.code}`} data-testid="room-code">{room.code}</div><button className="secondary-button" onClick={() => void copy(room.code, 'Code')}>Copy room code <span aria-hidden="true">⧉</span></button><button className="text-button invite-link" onClick={() => void copy(invite, 'Invite link')}>Copy invitation link ↗</button><p className="copy-feedback" role="status">{copied}</p><div className="invite-address"><label htmlFor="invite-url">OR SHARE THIS LINK</label><input id="invite-url" readOnly value={invite} onFocus={e => e.target.select()}/></div><p className="privacy-note">Only people with your code can find this room. No account needed.</p></div></aside>
      </div>}
    </main>
    <footer><span>LAST LIGHT <b>✦</b> LINDWAKE</span><span>PLAYABLE WATCH <b>·</b> BUILD 0.4</span><span>A little trust goes a long way.</span></footer>
  </div>;
}
