import { useId } from 'react';
import type { EncounterView, PingIntent, RoomAction } from '../shared/protocol';

const intents: { id: PingIntent; label: string; symbol: string }[] = [
  { id: 'inspect', label: 'Inspect', symbol: '?' },
  { id: 'safe', label: 'Looks safe', symbol: '+' },
  { id: 'avoid', label: 'Avoid', symbol: '×' },
];
const paths = ['M70 208 C130 190 170 55 320 75 S440 80 490 110', 'M70 208 C190 208 270 145 490 160', 'M70 208 C180 260 360 245 490 210'];

export function SeaChart({ encounter, playerId, locked, action }: {
  encounter: EncounterView; playerId: string; locked: boolean;
  action: (event: RoomAction, data?: Record<string, unknown>) => Promise<void>;
}) {
  const chartId = useId();
  const own = encounter.pings.find(ping => ping.playerId === playerId);
  const chosen = encounter.result ? encounter.proposal?.routeId : undefined;
  return <section className="instrument-panel sea-chart" aria-labelledby={`${chartId}-heading`}>
    <div className="panel-heading"><h2 id={`${chartId}-heading`}>The shared sea chart</h2><span>CREW MARKERS</span></div>
    <p className="panel-help">A route sketch, not a geographic clue. Read the Chart Table notes for landmarks and headings. Markers are crew opinions; they do not submit an answer.</p>
    <div className={`chart-scene ${encounter.result ? encounter.result.rescued ? 'chart-rescued' : 'chart-diverted' : ''}`}>
      <svg viewBox="0 0 560 300" role="img" aria-labelledby={`${chartId}-title ${chartId}-desc`}>
        <title id={`${chartId}-title`}>Passages to the lighthouse</title>
        <desc id={`${chartId}-desc`}>{encounter.result ? `The ship ${encounter.result.rescued ? 'was rescued' : 'diverted away'}. Selected route ${chosen}.` : `Available routes: ${encounter.routes.join(', ')}. No landmark or solution information is shown here.`}</desc>
        <defs><pattern id={`${chartId}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#638b91" strokeOpacity=".14"/></pattern></defs>
        <rect width="560" height="300" rx="12" fill="#102c38"/>
        <rect width="560" height="300" fill={`url(#${chartId}-grid)`}/>
        <path d="M0 255 Q45 230 100 262 T220 282 L250 300H0Z M450 0Q430 35 465 50T560 90V0Z" fill="#365350"/>
        <path d="M455 0Q435 33 470 44T560 84 M0 248Q45 223 103 255T230 278" fill="none" stroke="#719083" strokeWidth="2"/>
        {encounter.routes.map((id, i) => <g key={id} className={encounter.proposal?.routeId === id ? 'chart-route proposed' : 'chart-route'}>
          <path d={paths[i]} fill="none" stroke="currentColor" strokeWidth={chosen === id ? 5 : 2} strokeDasharray={chosen === id ? undefined : '7 6'}/>
          <circle cx="490" cy={110 + i * 50} r="17" fill="#173b46" stroke="currentColor"/>
          <text x="490" y={116 + i * 50} textAnchor="middle" fill="currentColor" fontSize="17">{id}</text>
          {encounter.pings.filter(ping => ping.routeId === id).map((ping, index) => <g key={ping.playerId} aria-hidden="true" transform={`translate(${350 + index * 27} ${110 + i * 50})`}>
            <circle r="11" fill="#edc783"/>
            <text y="5" textAnchor="middle" fill="#10252f" fontSize="16">{intents.find(intent => intent.id === ping.intent)!.symbol}</text>
          </g>)}
        </g>)}
        <g transform="translate(65 195)" className="chart-ship"><path d="M-19 12H20L9 24H-9Z" fill="#edc783"/><path d="M0 8V-18L16 8Z" fill="#e8e3d2"/><path d="M-3 7V-9L-15 7Z" fill="#90b4b6"/></g>
        <g transform="translate(510 46)"><path d="M-12 20L-7-13H7L12 20Z" fill="#e8e3d2"/><path d="M-11-15L0-25L11-15Z" fill="#dca662"/><rect x="-6" y="-12" width="12" height="8" fill="#f3c77c"/></g>
        <text x="23" y="32" fill="#96b3b7" fontSize="11" letterSpacing="3">NORTH COAST / PASSAGE BOARD</text>
        <text x="27" y="282" fill="#96b3b7" fontSize="11">{encounter.result ? encounter.result.rescued ? 'SAFE IN HARBOUR' : 'DIVERTED TO OPEN WATER' : 'WAITING FOR YOUR CREW’S DECISION'}</text>
      </svg>
    </div>
    <div className="route-markers">{encounter.routes.map(id => <div className="route-marker" key={id}>
      <h3>Route {id}</h3>
      <div className="ping-buttons">{intents.map(intent => <button key={intent.id} disabled={locked} aria-label={`Mark Route ${id}: ${intent.label}`} aria-pressed={own?.routeId === id && own.intent === intent.id} onClick={() => void action('game:ping', { encounterId: encounter.id, routeId: id, intent: intent.id })}><span aria-hidden="true">{intent.symbol}</span>{intent.label}</button>)}</div>
    </div>)}</div>
    <div className="chart-opinions" role="status" aria-live="polite" aria-atomic="true">
      {encounter.pings.length ? <ul>{encounter.pings.map(ping => <li key={ping.playerId}><strong>{ping.nickname}</strong>: Route {ping.routeId} — {intents.find(intent => intent.id === ping.intent)!.label}</li>)}</ul> : <p>No route markers yet. Each keeper can place one.</p>}
    </div>
    {own && <button className="text-button" disabled={locked} onClick={() => void action('game:ping', { encounterId: encounter.id, routeId: own.routeId, intent: null })}>Clear my marker</button>}
  </section>;
}
