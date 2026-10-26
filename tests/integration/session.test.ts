import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveNotes } from '../helpers/puzzle-notes.js';
import { Rooms } from '../../src/server/rooms.js';
import { createPuzzle, solvePuzzle } from '../../src/server/puzzles/engine.js';
import type { PuzzleFamily, RoomView, RouteId, SignalId, Station } from '../../src/shared/protocol.js';

const stations: Station[] = ['Chart Table', 'Stormglass', 'Signal Desk', 'Beacon Console'];
const families: PuzzleFamily[] = ['SAFE_PASSAGE', 'BROKEN_COMPASS', 'SIGNAL_FOG'];
function crew(count = 2, tutorial = false) {
  const rooms = new Rooms();
  const host = rooms.create('Host', 'seat-0');
  for (let i = 1; i < count; i++) rooms.join(host.code, `Keeper ${i}`, `seat-${i}`);
  for (let i = 0; i < count; i++) rooms.ready(`seat-${i}`, true);
  rooms.start('seat-0', tutorial);
  const views = () => rooms.connectedViews(host.code).map(view => view.room);
  const resolve = (correct: boolean) => {
    const before = views(); const encounter = before[0].encounter!;
    const answer = solveNotes(before);
    if (!correct) answer.signalId = encounter.signals.find(id => id !== answer.signalId)!;
    rooms.propose('seat-0', encounter.id, encounter.revision, answer.routeId, answer.signalId);
    for (let i = 0; i < count; i++) rooms.confirm(`seat-${i}`, encounter.id, encounter.revision + 1);
    return views()[0];
  };
  const advance = () => {
    const id = views()[0].encounter!.id;
    for (let i = 0; i < count; i++) rooms.continue(`seat-${i}`, id);
    return views()[0];
  };
  return { rooms, code: host.code, views, resolve, advance };
}

test('all puzzle families replay deterministically, solve uniquely, and require every station', () => {
  const groups: Station[][] = [['Chart Table', 'Signal Desk'], ['Stormglass', 'Beacon Console'], ['Chart Table'], ['Stormglass'], ['Signal Desk', 'Beacon Console'], ['Signal Desk'], ['Beacon Console']];
  for (const family of families) for (let seed = 0; seed < 500; seed++) {
    const puzzle = createPuzzle(family, seed);
    assert.deepEqual(createPuzzle(family, seed), puzzle);
    assert.deepEqual(solvePuzzle(puzzle), [puzzle.answer]);
    for (const station of stations) assert(solvePuzzle(puzzle, stations.filter(other => other !== station)).length > 1);
    for (const group of groups) assert(solvePuzzle(puzzle, group).length > 1);
  }
  for (let seed = 0; seed < 100; seed++) {
    const puzzle = createPuzzle('SAFE_PASSAGE', seed, true);
    assert.equal(puzzle.availableRoutes.length, 2); assert.equal(puzzle.availableSignals.length, 2);
    assert.deepEqual(solvePuzzle(puzzle), [puzzle.answer]);
  }
});

test('practice is playable, rejects unavailable choices, and never changes the watch score', () => {
  for (const correct of [true, false]) {
    const c = crew(2, true), initial = c.views()[0];
    assert.equal(initial.encounter!.tutorial, true);
    assert.throws(() => c.rooms.propose('seat-0', initial.encounter!.id, 0, 'C', 'Star'), /available routes/);
    const result = c.resolve(correct);
    assert.equal(result.phase, 'DEBRIEF'); assert.equal(result.session!.completed, 0);
    assert.equal(result.session!.rescued, 0); assert.equal(result.session!.damage, 0);
    const scored = c.advance();
    assert.equal(scored.encounter!.tutorial, false); assert.equal(scored.encounter!.family, 'SAFE_PASSAGE');
    assert.equal(scored.session!.practicing, false); assert.equal(scored.encounter!.routes.length, 3);
  }
});

test('2/3/4-player watches cover all families, win at three rescues, and replay in the same room', () => {
  for (const count of [2, 3, 4]) {
    const c = crew(count);
    for (let i = 0; i < 3; i++) {
      const before = c.views()[0];
      assert.equal(before.encounter!.family, families[i]);
      const json = JSON.stringify(before);
      for (const secret of ['"seed"', '"facts"', '"answer"', '"history"']) assert(!json.includes(secret));
      const result = c.resolve(true);
      assert.equal(result.session!.rescued, i + 1); assert.equal(result.session!.damage, 0);
      if (i < 2) {
        const id = result.encounter!.id;
        c.rooms.continue('seat-0', id);
        const duplicate = c.rooms.continue('seat-0', id);
        assert.equal(duplicate.room.encounter!.continueReady.length, 1);
        assert.equal(duplicate.room.phase, 'DEBRIEF');
        for (let j = 1; j < count; j++) c.rooms.continue(`seat-${j}`, id);
        assert.notEqual(c.views()[0].encounter!.id, id);
        assert.throws(() => c.rooms.continue('seat-0', id), /ended/);
      } else {
        assert.equal(result.phase, 'FINISHED'); assert.equal(result.session!.outcome, 'VICTORY');
        assert.throws(() => c.rooms.confirm('seat-0', result.encounter!.id, 1), /resolved/);
        assert.equal(c.views()[0].session!.rescued, 3);
      }
    }
    const replay = c.rooms.lobby('seat-0').room;
    assert.equal(replay.code, c.code); assert.equal(replay.players.length, count);
    assert.equal(replay.session, null); assert.equal(replay.encounter, null);
    assert(replay.players.every(player => !player.ready));
    for (let i = 0; i < count; i++) c.rooms.ready(`seat-${i}`, true);
    assert.equal(c.rooms.start('seat-0').room.session!.rescued, 0);
  }
});

test('a watch loses at three damage and mixed outcomes can last five ships', () => {
  for (const outcomes of [[false, false, false], [true, false, true, false, true], [false, true, false, true, false]]) {
    const c = crew();
    for (let i = 0; i < outcomes.length; i++) {
      const result = c.resolve(outcomes[i]);
      assert.equal(result.session!.completed, i + 1);
      if (i < outcomes.length - 1) { assert.equal(result.phase, 'DEBRIEF'); c.advance(); }
      else {
        assert.equal(result.phase, 'FINISHED');
        assert.equal(result.session!.outcome, outcomes[i] ? 'VICTORY' : 'DEFEAT');
        assert.equal(result.session!.rescued + result.session!.damage, outcomes.length);
        assert.throws(() => c.advance(), /Continue is only/);
      }
    }
  }
});
