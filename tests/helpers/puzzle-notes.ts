import type { PuzzleFamily, RoomView, RouteId, SignalId } from '../../src/shared/protocol.js';

// Solve from the text actually delivered to the crew, independently of engine facts/answer.
export function solveClueText(family: PuzzleFamily, routes: RouteId[], notes: Record<string, string>) {
  const encounter = { family, routes };
  const note = (id: string) => notes[id];
  const chart = note('chart'), weather = note('weather'), message = note('message'), codebook = note('codebook');
  let routeId: RouteId;
  let request: string;
  if (encounter.family === 'SAFE_PASSAGE') {
    const unsafe = /past the (reef|buoy)/.exec(weather)![1];
    routeId = encounter.routes.find(id => !new RegExp(`Route ${id} passes the ([^.]+)`).exec(chart)![1].includes(unsafe))!;
    request = /request word (ONE|TWO|THREE)/.exec(message)![1];
  } else if (encounter.family === 'BROKEN_COMPASS') {
    const order = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    const offset = Number(/reads (\d+) degrees/.exec(weather)![1]) / 90;
    const indicated = /indicated heading is (\w+)/.exec(message)![1];
    const heading = order[(order.indexOf(indicated) - offset + 4) % 4];
    routeId = encounter.routes.find(id => new RegExp(`Route ${id} has true heading (\\w+)`).exec(chart)![1] === heading)!;
    request = /request word is (\w+)/.exec(message)![1];
  } else {
    const symbols = /sends (\w+) then (\w+)/.exec(message)!;
    const landmark = new RegExp(`${symbols[1]} = (\\w+)`).exec(weather)![1];
    routeId = encounter.routes.find(id => new RegExp(`Route ${id} approaches the (\\w+)`).exec(chart)![1] === landmark)!;
    request = symbols[2];
  }
  const signalId = new RegExp(`${request} = (Anchor|Bell|Star)`).exec(codebook)![1] as SignalId;
  return { routeId, signalId };
}

export function solveNotes(views: RoomView[]) {
  const encounter = views[0].encounter!;
  return solveClueText(encounter.family, encounter.routes, Object.fromEntries(views.flatMap(view => view.encounter!.privateClues).map(clue => [clue.id, clue.text])));
}
