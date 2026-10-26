import { randomInt } from 'node:crypto';
import { createPuzzle, solvePuzzle, type Puzzle } from './engine.js';

export type SafePassagePuzzle = Puzzle;
export const createSafePassage = (seed = randomInt(4294967296)) => createPuzzle('SAFE_PASSAGE', seed);
export const solveSafePassage = (puzzle: Puzzle) => solvePuzzle(puzzle);
