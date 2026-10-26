import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RoomAction, RoomView, RouteId, SignalId } from '../shared/protocol';

interface Props {
  room: RoomView;
  playerId: string;
  busy: boolean;
  connected: boolean;
  action: (event: RoomAction, data?: Record<string, unknown>) => Promise<void>;
}

export function Encounter({ room, playerId, busy, connected, action }: Props) {
  const [route, setRoute] = useState<RouteId | ''>('');
  const [signal, setSignal] = useState<SignalId | ''>('');
  const heading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { if (room.phase === 'DEBRIEF' || room.phase === 'FINISHED') resultHeading.current?.focus(); }, [room.phase]);
  const encounter = room.encounter;
  if (!encounter) return null;
  const isHost = room.hostId === playerId;
  const session = room.session!;
  const continueReady = encounter.continueReady.includes(playerId);
  const finished = room.phase === 'FINISHED';
  const locked = busy || !connected || encounter.paused || room.phase !== 'DISCUSS';
  const confirmed = encounter.confirmations.includes(playerId);
  const proposer = room.players.find(player => player.id === encounter.proposal?.proposedBy)?.nickname;
  function propose(event: FormEvent) {
    event.preventDefault();
    if (route && signal) void action('game:propose', { encounterId: encounter!.id, expectedRevision: encounter!.revision, routeId: route, signalId: signal });
  }

  return <section className="encounter-screen" aria-labelledby="encounter-heading" data-family={encounter.family} data-encounter={encounter.id}>
    <div className="encounter-topline"><span className="eyebrow">{encounter.title} · {encounter.tutorial ? 'PRACTICE' : `SHIP ${session.completed + (encounter.result ? 0 : 1)}`}</span><span className="encounter-code">ROOM <strong data-testid="room-code">{room.code}</strong></span></div>
    <div className="watch-progress" aria-label="Watch progress"><span data-testid="rescue-count">Rescued: {session.rescued}/3</span><span data-testid="damage-count">Damage: {session.damage}/3</span><span>{encounter.tutorial ? 'Practice does not count toward your score' : 'Rescue 3 ships before 3 damage · No timer'}</span></div>
    <h1 ref={heading} tabIndex={-1} id="encounter-heading">{encounter.ship}</h1>
    <p className="encounter-instructions">{encounter.instructions} Everyone must confirm the same proposal.</p>
    {encounter.tutorial && <section className="practice-guide" aria-label="Practice instructions"><h2>Practice together</h2><ol><li>Read your station notes. Your partner has the missing information.</li><li>Use the share buttons to put your clues in the crew notebook.</li><li>Find the safe route and matching beacon, then propose both.</li><li>Every keeper confirms. Review the explanation, then everyone chooses Continue.</li></ol><p>This practice has two routes and two signals. A mistake will not add damage.</p></section>}
    {encounter.paused && <div className="crew-message" role="status"><strong>A keeper lost connection. Decisions are paused for up to 60 seconds while they reconnect.</strong></div>}
    {encounter.result && <div className={`encounter-result ${encounter.result.rescued ? 'success' : 'failure'}`} role="status" aria-live="polite">
      <h2 ref={resultHeading} tabIndex={-1}>{finished ? session.outcome === 'VICTORY' ? 'The coast is safe!' : 'The watch has ended.' : encounter.tutorial ? encounter.result.rescued ? 'Practice complete!' : 'Practice: review the clues.' : encounter.result.rescued ? 'Ship rescued!' : 'The ship diverted to safety.'}</h2>
      <p>{encounter.result.rescued ? 'Your crew chose the safe passage and the right beacon.' : 'That route and beacon did not match all the clues. Compare the explanation with your notes.'}</p>
      <p data-testid="result-explanation">{encounter.result.explanation}</p>
      {finished ? <><p data-testid="session-summary">{session.rescued} ships rescued · {session.damage} damage marks · {session.completed} ships guided</p><p>{session.outcome === 'VICTORY' ? 'Your crew rescued three ships. The lighthouse shines through the storm.' : 'Three damage marks ended this watch. The ships diverted away; your crew can try again.'}</p>{isHost ? <button className="primary-button" disabled={busy || !connected} onClick={() => void action('game:lobby')}>Play again</button> : <p>Waiting for the host to open the next watch.</p>}</> : <><button className="primary-button" disabled={busy || !connected || encounter.paused || continueReady} onClick={() => void action('game:continue', { encounterId: encounter.id })}>{continueReady ? 'Waiting for the crew' : encounter.tutorial ? 'Continue to the watch' : 'Continue to next ship'}</button><p aria-live="polite">{encounter.continueReady.length}/{room.players.length} keepers ready to continue</p></>}
    </div>}
    <div className="encounter-grid">
      <div>
        <section className="instrument-panel" aria-label="Your private station clues">
          <div className="panel-heading"><h2>Your station notes</h2><span>PRIVATE UNTIL SHARED</span></div>
          <p className="panel-help">Only you receive these notes. The other keepers have different information.</p>
          {encounter.privateClues.map(clue => {
            const shared = encounter.sharedClues.some(item => item.id === clue.id);
            return <article className="clue-card" key={clue.id} data-testid={`private-${clue.id}`}>
              <span className="eyebrow">{clue.station}</span><h3>{clue.title}</h3><p>{clue.text}</p>
              <button className="secondary-button" disabled={locked || shared} onClick={() => void action('game:share', { encounterId: encounter.id, clueId: clue.id })} aria-label={shared ? `${clue.station} clue shared` : `Share ${clue.station} clue`}>{shared ? 'Shared with the crew' : 'Share this clue with the crew'}</button>
            </article>;
          })}
        </section>
        <section className="instrument-panel shared-log" aria-label="Shared clue log">
          <div className="panel-heading"><h2>Crew notebook</h2><span>VISIBLE TO EVERYONE</span></div>
          {encounter.sharedClues.length === 0 ? <p className="panel-help">No clues shared yet. Use a share button above, or discuss your notes with your crew.</p> : <ul>{encounter.sharedClues.map(clue => <li key={clue.id}><strong>{clue.station}</strong><small>Shared by {clue.nickname}</small><p>{clue.text}</p></li>)}</ul>}
        </section>
      </div>
      <div>
        <section className="instrument-panel" aria-label="Route and beacon proposal">
          <div className="panel-heading"><h2>Plot a passage</h2></div>
          <p className="panel-help">{encounter.instructions}</p>
          <form onSubmit={propose}>
            <fieldset disabled={locked}><legend>Choose a route</legend><div className="choice-row">{encounter.routes.map(id => <label className={`choice ${route === id ? 'selected' : ''}`} key={id}><input type="radio" name="route" value={id} checked={route === id} onChange={() => setRoute(id)}/>Route {id}</label>)}</div></fieldset>
            <fieldset disabled={locked}><legend>Choose a beacon</legend><div className="choice-row">{encounter.signals.map(id => <label className={`choice ${signal === id ? 'selected' : ''}`} key={id}><input type="radio" name="signal" value={id} checked={signal === id} onChange={() => setSignal(id)}/>{id}</label>)}</div></fieldset>
            <button className="primary-button" disabled={locked || !route || !signal} type="submit">{encounter.proposal ? 'Update proposal' : 'Propose answer'}</button>
          </form>
          <div className="current-proposal" aria-live="polite">
            <h3>Current crew proposal</h3>
            {encounter.proposal ? <><p className="proposed-pair" data-testid="current-proposal">Route {encounter.proposal.routeId} + {encounter.proposal.signalId}</p><p>Proposed by {proposer}. Revision {encounter.revision}.</p><p>Changing the proposal clears everyone’s confirmations.</p></> : <p>No proposal yet. Anyone can suggest a route and beacon.</p>}
            <ul className="confirmation-list">{room.players.map(player => <li key={player.id}><span>{player.nickname}{player.id === playerId ? ' (you)' : ''}</span><span>{!player.connected ? 'Reconnecting' : encounter.confirmations.includes(player.id) ? 'Confirmed' : 'Reviewing'}</span></li>)}</ul>
            <button className="secondary-button" disabled={locked || !encounter.proposal || confirmed} onClick={() => void action('game:confirm', { encounterId: encounter.id, expectedRevision: encounter.revision })}>{confirmed ? 'You confirmed this proposal' : 'Confirm this proposal'}</button>
            <p className="confirm-count">{encounter.confirmations.length}/{room.players.length} keepers confirmed</p>
          </div>
        </section>
        <div className="encounter-actions">{isHost && <button className="text-button" disabled={busy || !connected} onClick={() => void action('game:lobby')}>Return crew to lobby</button>}<button className="text-button" disabled={busy || !connected} onClick={() => void action('room:leave')}>Leave room</button></div>
      </div>
    </div>
  </section>;
}
