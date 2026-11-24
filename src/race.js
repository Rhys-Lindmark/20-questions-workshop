// A race: every lane plays the same secrets from the same start, in parallel, one move per
// call. Used by `npm run play`, `npm run score` and the page (`npm run app`).
import { existsSync, readFileSync } from 'node:fs';
import twenty, { view, prep, cleanThing, oracleFor, tableFor, answer } from './twenty.mjs';
import { LANES, jevRequest, readJevMove, llmRequest, readLlmMove, jevCost, bestSplit } from './lanes.js';
import { call } from './calls.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const DATA = new URL('../data/', import.meta.url);

// The answer table: data/twenty/nouns.json, or your Level 3 version (data/twenty/mine.json,
// from `npm run build-table -- --mine`) while it exists.
export const MINE = new URL('twenty/mine.json', DATA);
export function loadTable({ base = false } = {}) {
  const readJson = p => JSON.parse(readFileSync(p === 'twenty/nouns.json' && !base && existsSync(MINE) ? MINE : new URL(p, DATA), 'utf8'));
  return prep(readJson('twenty/nouns.json'));
}

// A player file, loaded fresh so edits show up on the next race.
export async function loadPlayer(laneId) {
  const lane = LANES[laneId];
  const mod = await import(new URL(`../${lane.file}?t=${Date.now()}`, import.meta.url));
  for (const f of ['state', 'questions', 'decide']) if (typeof mod[f] !== 'function') throw new Error(`${lane.file} must export a function ${f}()`);
  return mod;
}

// What to race, from what someone typed or clicked:
//   'frog'               one secret          'frog,umbrella,volcano'   several
//   'a' | 'b' | 'c'      a set of three      'random'                  three random
//   'hedgehog'           not in the pool: Jev answers every question about it first (the oracle)
// Returns { caseId, extra?, oracle? } for twenty.init(data, caseId, extra).
export async function prepare(data, input, mode = 'auto') {
  const text = String(input ?? '').trim().toLowerCase();
  if (data.sets[text]) return { caseId: text };
  if (text === 'random') return { caseId: twenty.resolve(data, 'random') };
  const things = text.split(',').map(cleanThing);
  if (!things.length || things.some(t => !t)) throw new Error('Type a thing: letters and spaces, up to 40 characters.');
  if (things.every(t => data.items.includes(t))) return { caseId: things.length === 1 ? `one:${things[0]}` : `set:${things.join('|')}` };
  if (things.length > 1) throw new Error('Several secrets have to come from the pool. Type one new thing at a time.');
  const o = oracleFor(data, null, things[0]);
  const out = await call('jev', { model: 'jev-1.14.0', state: o.turn.jev.state, questions: o.turn.jev.questions }, mode);
  const d = o.turn.jev.decide(out.answers);
  return { caseId: `type:${o.ask.thing}`, extra: { oracle: d.move },
    oracle: { thing: o.ask.thing, row: d.move.row, probs: d.probs, questions: Object.keys(o.turn.jev.questions).length,
      sameAs: data.items.filter(x => Object.keys(data.questions).every(q => answer(data, x, q) === d.move.row[q])), ms: out.ms, cost: jevCost(out), replayed: !!out.replayed } };
}

// One lane through every secret. emit gets { type: 'step' | 'done' | 'error', … }.
// pace: wait out a replayed call's recorded time, so a replayed race looks like the live one.
export async function runLane({ data, caseId, extra, laneId, player: given, mode = 'auto', pace = false, emit = () => {}, signal, withRequest = false }) {
  const lane = LANES[laneId];
  if (!lane) throw new Error(`No lane "${laneId}". Lanes: ${Object.keys(LANES).join(', ')}`);
  const player = lane.kind === 'jev' ? given ?? await loadPlayer(laneId) : null; // given: a player module passed in directly
  let s = twenty.init(data, caseId, extra);
  const totals = { steps: 0, ms: 0, cost: 0, replayed: 0, calls: 0 };
  while (!twenty.done(s) && totals.steps < 100) {
    if (signal?.aborted) return null;
    const game = view(data, s);
    let p, request;
    if (player) {
      const forced = player.codeMove?.(game);
      if (forced) p = { move: forced, why: game.stillPossible.length === 1 ? '1 left → code guesses' : 'code guesses', ms: 0, cost: 0, code: true };
      else {
        request = jevRequest(player, game);
        p = readJevMove(player, game, await call('jev', request, mode));
      }
    } else {
      const turn = twenty.turn(data, s);
      p = turn.forced ? { move: turn.forced, why: turn.why, ms: 0, cost: 0, code: true }
        : lane.kind === 'code' ? { move: bestSplit(tableFor(data, s), game), why: `${game.stillPossible.length} left → best split`, ms: 0, cost: 0, code: true }
        : readLlmMove(turn, await call('llm', llmRequest(laneId, turn), mode));
    }
    if (signal?.aborted) return null;
    if (p.replayed && pace) await sleep(p.ms);
    const out = twenty.apply(data, s, p.move);
    s = out.s;
    totals.steps++; totals.ms += p.ms; totals.cost += p.cost;
    if (!p.code) { totals.calls++; totals.replayed += p.replayed ? 1 : 0; }
    emit({ type: 'step', lane: laneId, n: totals.steps, secret: game.secretNumber, left: game.stillPossible.length, move: p.move, why: p.why, probs: p.probs, ms: p.ms, cost: p.cost, replayed: p.replayed, code: !!p.code, note: out.note, round: out.round, totals: { ...totals },
      ...(withRequest && request ? { request: { state: request.state, questions: Object.fromEntries(Object.entries(request.questions).map(([k, q]) => [k, { type: q.type, instructions: q.instructions, options: q.criteria ? Object.keys(q.criteria).length : undefined }])) } } : {}) });
  }
  const r = twenty.result(s);
  emit({ type: 'done', lane: laneId, result: r, totals });
  return { lane: laneId, result: r, totals };
}

export async function runRace({ data, caseId, extra, lanes, mode, pace, emit = () => {}, signal, withRequest }) {
  return Promise.all(lanes.map(laneId => runLane({ data, caseId, extra, laneId, mode, pace, emit, signal, withRequest })
    .catch(e => { emit({ type: 'error', lane: laneId, message: e.message }); return { lane: laneId, error: e.message }; })));
}
