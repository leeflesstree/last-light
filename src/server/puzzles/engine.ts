import type { ClueView, PuzzleFamily, RouteId, SignalId, Station } from '../../shared/protocol.js';

const ROUTES: RouteId[] = ['A', 'B', 'C'];
const SIGNALS: SignalId[] = ['Anchor', 'Bell', 'Star'];
const STATIONS: Station[] = ['Chart Table', 'Stormglass', 'Signal Desk', 'Beacon Console'];
const WORDS = ['ONE', 'TWO', 'THREE'];
const HEADINGS = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
const LANDMARKS = ['reef', 'buoy', 'cove'];
const ROUTE_GLYPHS = ['MOON', 'WAVE', 'LEAF'];
const SIGNAL_GLYPHS = ['DOT', 'DASH', 'RING'];
export interface Puzzle {
  family: PuzzleFamily;
  seed: number;
  title: string;
  instructions: string;
  tutorial: boolean;
  availableRoutes: RouteId[];
  availableSignals: SignalId[];
  clues: ClueView[];
  answer: { routeId: RouteId; signalId: SignalId };
  explanation: string;
  facts: {
    routes: Record<string, string[]>;
    unsafe: string;
    request: string;
    codebook: Record<string, SignalId>;
    headings: Record<string, string>;
    offset: number;
    reading: string;
    routeGlyph: string;
    routeKey: Record<string, string>;
  };
}
function random(seed: number) {
  let state = seed >>> 0;
  const int = (max: number) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return Math.floor(((value ^ (value >>> 14)) >>> 0) / 4294967296 * max);
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = int(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  };
  return { int, shuffle };
}

// This checker interprets the station constraints independently of the authored answer.
// When a station is omitted, enumerate its possible hidden inputs rather than using its facts.
export function solvePuzzle(puzzle: Puzzle, known: readonly Station[] = STATIONS) {
  const chart = known.includes('Chart Table'), weather = known.includes('Stormglass');
  const message = known.includes('Signal Desk'), beacon = known.includes('Beacon Console');
  const f = puzzle.facts;
  return puzzle.availableRoutes.flatMap(routeId => puzzle.availableSignals.flatMap(signalId => {
    let routeAllowed: boolean;
    if (puzzle.family === 'SAFE_PASSAGE') {
      routeAllowed = !chart || (weather ? [f.unsafe] : ['reef', 'buoy']).some(hazard => !f.routes[routeId].includes(hazard));
    } else if (puzzle.family === 'BROKEN_COMPASS') {
      routeAllowed = !chart || !message || (weather ? [f.offset] : [1, 2, 3]).some(offset => HEADINGS[(HEADINGS.indexOf(f.reading) - offset + 4) % 4] === f.headings[routeId]);
    } else {
      routeAllowed = !chart || !weather || !message || f.routes[routeId].includes(f.routeKey[f.routeGlyph]);
    }
    const signalAllowed = !message || !beacon || f.codebook[f.request] === signalId;
    return routeAllowed && signalAllowed ? [{ routeId, signalId }] : [];
  }));
}

function buildPuzzle(family: PuzzleFamily, seed: number, tutorial: boolean): Puzzle {
  const rng = random(seed);
  const availableRoutes = tutorial ? ROUTES.slice(0, 2) : [...ROUTES];
  const availableSignals = tutorial ? SIGNALS.slice(0, 2) : [...SIGNALS];
  const words = tutorial ? WORDS.slice(0, 2) : WORDS;
  const shuffledSignals = rng.shuffle(availableSignals);
  const codebook = Object.fromEntries(words.map((word, i) => [word, shuffledSignals[i]]));
  const request = words[rng.int(words.length)];
  const layouts = rng.shuffle(tutorial ? [['reef'], ['buoy']] : [['reef'], ['buoy'], ['reef', 'buoy']]);
  const routes = Object.fromEntries(availableRoutes.map((id, i) => [id, layouts[i]]));
  const unsafe = rng.int(2) ? 'reef' : 'buoy';
  const facts: Puzzle['facts'] = { routes, unsafe, request, codebook, headings: {}, offset: 1, reading: 'NORTH', routeGlyph: '', routeKey: {} };
  let title = 'Safe Passage';
  let instructions = 'Use the route landmarks and storm warning to find safe water. Match the ship’s request word with the beacon codebook.';
  let chartText = availableRoutes.map(id => `Route ${id} passes the ${routes[id].join(' and ')}.`).join(' ');
  let weatherText = `The storm makes every route past the ${unsafe} unsafe. The other landmark is safe tonight.`;
  let messageText = `The ship sends the request word ${request}. Use the Beacon Console codebook to find the matching signal.`;
  let beaconText = words.map(word => `${word} = ${codebook[word]}.`).join(' ');
  let routeId = availableRoutes.find(id => !routes[id].includes(unsafe))!;
  let signalId = codebook[request];
  let explanation = `The ${unsafe} is unsafe, so Route ${routeId} is the only safe passage. The ship requested ${request}, which the codebook maps to ${signalId}.`;
  if (family === 'BROKEN_COMPASS') {
    title = 'Broken Compass';
    instructions = 'The ship’s compass is offset. Correct its indicated heading using the Stormglass calibration, find that true heading on the Chart Table, then decode the beacon request.';
    const headings = rng.shuffle(HEADINGS).slice(0, 3);
    facts.headings = Object.fromEntries(ROUTES.map((id, i) => [id, headings[i]]));
    facts.offset = 1 + rng.int(3);
    routeId = ROUTES[rng.int(3)];
    facts.reading = HEADINGS[(HEADINGS.indexOf(facts.headings[routeId]) + facts.offset) % 4];
    chartText = ROUTES.map(id => `Route ${id} has true heading ${facts.headings[id]}.`).join(' ');
    weatherText = `The ship’s compass reads ${facts.offset * 90} degrees clockwise from true headings. Subtract ${facts.offset * 90} degrees from its indicated heading. Clockwise order: NORTH, EAST, SOUTH, WEST; each step is 90 degrees.`;
    messageText = `The ship’s indicated heading is ${facts.reading}. Its beacon request word is ${request}. Correct the heading with the Stormglass calibration.`;
    explanation = `Subtracting ${facts.offset * 90} degrees from ${facts.reading} gives true heading ${facts.headings[routeId]}, which is Route ${routeId}. Request ${request} maps to ${signalId}.`;
  } else if (family === 'SIGNAL_FOG') {
    title = 'Signal in the Fog';
    instructions = 'The ship sends two symbol words. Decode the first with the Stormglass to find a landmark, then locate its route on the Chart Table. Decode the second with the Beacon Console.';
    const landmarks = rng.shuffle(LANDMARKS);
    facts.routes = Object.fromEntries(ROUTES.map((id, i) => [id, [landmarks[i]]]));
    const keys = rng.shuffle(LANDMARKS);
    facts.routeKey = Object.fromEntries(ROUTE_GLYPHS.map((glyph, i) => [glyph, keys[i]]));
    facts.routeGlyph = ROUTE_GLYPHS[rng.int(3)];
    facts.request = SIGNAL_GLYPHS[rng.int(3)];
    facts.codebook = Object.fromEntries(SIGNAL_GLYPHS.map((glyph, i) => [glyph, shuffledSignals[i]]));
    routeId = ROUTES.find(id => facts.routes[id].includes(facts.routeKey[facts.routeGlyph]))!;
    signalId = facts.codebook[facts.request];
    chartText = ROUTES.map(id => `Route ${id} approaches the ${facts.routes[id][0]}.`).join(' ');
    weatherText = `First-symbol landmark key: ${ROUTE_GLYPHS.map(glyph => `${glyph} = ${facts.routeKey[glyph]}.`).join(' ')}`;
    messageText = `The ship sends ${facts.routeGlyph} then ${facts.request}. Use the first symbol for the route landmark and the second for the beacon signal.`;
    beaconText = `Second-symbol beacon key: ${SIGNAL_GLYPHS.map(glyph => `${glyph} = ${facts.codebook[glyph]}.`).join(' ')}`;
    explanation = `${facts.routeGlyph} means ${facts.routeKey[facts.routeGlyph]}, found on Route ${routeId}. The second symbol, ${facts.request}, means ${signalId}.`;
  }
  return {
    family, seed: seed >>> 0, title, instructions, tutorial, availableRoutes, availableSignals, facts,
    answer: { routeId, signalId }, explanation,
    clues: [
      { id: 'chart', station: 'Chart Table', title: family === 'BROKEN_COMPASS' ? 'True route headings' : 'Route landmarks', text: chartText },
      { id: 'weather', station: 'Stormglass', title: family === 'SAFE_PASSAGE' ? 'Storm warning' : family === 'BROKEN_COMPASS' ? 'Compass calibration' : 'First-symbol landmark key', text: weatherText },
      { id: 'message', station: 'Signal Desk', title: 'The ship’s message', text: messageText },
      { id: 'codebook', station: 'Beacon Console', title: 'Beacon codebook', text: beaconText },
    ],
  };
}

export function createPuzzle(family: PuzzleFamily, seed: number, tutorial = false): Puzzle {
  if (tutorial) family = 'SAFE_PASSAGE';
  const valid = (puzzle: Puzzle) => {
    const answers = solvePuzzle(puzzle);
    return answers.length === 1 && answers[0].routeId === puzzle.answer.routeId && answers[0].signalId === puzzle.answer.signalId
      && STATIONS.every(station => solvePuzzle(puzzle, STATIONS.filter(other => other !== station)).length > 1);
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    const puzzle = buildPuzzle(family, (seed + attempt) >>> 0, tutorial);
    if (valid(puzzle)) return puzzle;
  }
  const fallback = buildPuzzle(family, 20261026, tutorial);
  if (!valid(fallback)) throw new Error('Fallback puzzle failed validation');
  return fallback;
}
