// The game engine and the answer table.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import twenty, { prep, view, answer, stillPossible, clashes, cleanThing, oracleFor, askText, GUESS, MISS_TURNS } from '../src/twenty.mjs';
import * as mine2 from '../solutions/level2.js';

const data = prep(JSON.parse(readFileSync(new URL('../data/twenty/nouns.json', import.meta.url), 'utf8')));

test('the table: 100 things, 35 questions, every thing with its own answers', () => {
  assert.equal(data.items.length, 100);
  assert.equal(Object.keys(data.questions).length, 35);
  assert.deepEqual(clashes(data), []);
  for (const [q, list] of Object.entries(data.questions)) for (const x of list) assert.ok(data.items.includes(x), `${q}: ${x}`);
});

test('the table reads the way a person would', () => {
  assert.equal(answer(data, 'frog', 'Is it an animal?'), 'yes');
  assert.equal(answer(data, 'frog', 'Is it a mammal?'), 'no');
  assert.equal(answer(data, 'volcano', 'Is it made by people?'), 'no');
  assert.equal(answer(data, 'umbrella', 'Does it have a handle?'), 'yes');
});

test('code crosses off what no longer fits', () => {
  let s = twenty.init(data, 'one:frog');
  assert.equal(stillPossible(data, s).length, 100);
  s = twenty.apply(data, s, 'Is it an animal?').s;
  const left = stillPossible(data, s);
  assert.ok(left.includes('frog') && left.includes('dog') && !left.includes('apple'));
  s = twenty.apply(data, s, 'Is it a mammal?').s;
  assert.ok(!stillPossible(data, s).includes('dog'));
});

test('a guess ends the secret; a wrong one is crossed off', () => {
  let s = twenty.init(data, 'set:frog|apple');
  let out = twenty.apply(data, s, GUESS + 'dog');
  assert.match(out.note, /No/); assert.ok(out.s.guessed.includes('dog'));
  out = twenty.apply(data, out.s, GUESS + 'frog');
  assert.deepEqual(out.round, { secret: 'frog', turns: 2, solved: true });
  assert.equal(out.s.r, 1);
});

test('20 turns without finding it counts as 25', () => {
  let s = twenty.init(data, 'one:frog');
  for (let i = 0; i < 20; i++) s = twenty.apply(data, s, GUESS + 'dog').s;
  assert.ok(twenty.done(s));
  assert.equal(twenty.result(s).turns, MISS_TURNS);
});

test('turn(): every racer gets the same question and the unasked questions; code guesses at one left', () => {
  let s = twenty.init(data, 'one:frog');
  let t = twenty.turn(data, s);
  assert.equal(t.question, askText);
  assert.equal(t.options.length, 35);
  assert.equal(t.forced, undefined);
  for (const q of ['Is it an animal?', 'Is it a mammal?', 'Is it usually in or on water?', 'Does it have legs?', 'Can it fly?', 'Can you eat it?', 'Is it mostly green?']) s = twenty.apply(data, s, q).s;
  assert.deepEqual(view(data, s).stillPossible, ['frog']);
  t = twenty.turn(data, s);
  assert.equal(t.forced, GUESS + 'frog');
});

test('my Level 2 player sends exactly the reference turn', () => {
  let s = twenty.init(data, 'a');
  s = twenty.apply(data, s, 'Is it alive?').s;
  const t = twenty.turn(data, s), g = view(data, s);
  assert.deepEqual({ state: mine2.state(g), questions: mine2.questions(g) }, { state: t.jev.state, questions: t.jev.questions });
  assert.equal(mine2.codeMove(g), t.forced ?? null);
});

test('a typed thing joins the pool with its own row', () => {
  assert.equal(cleanThing('  Teddy   Bear '), 'teddy bear');
  assert.equal(cleanThing('<script>'), null);
  assert.equal(oracleFor(data, null, 'frog'), null); // already in the pool
  const o = oracleFor(data, null, 'hedgehog');
  assert.equal(Object.keys(o.turn.jev.questions).length, 35);
  const row = Object.fromEntries(Object.keys(data.questions).map(q => [q, ['Is it an animal?', 'Is it a mammal?'].includes(q) ? 'yes' : 'no']));
  const s = twenty.init(data, 'type:hedgehog', { oracle: { thing: 'hedgehog', row } });
  const g = view(data, s);
  assert.ok(g.things.includes('hedgehog'));
  assert.equal(twenty.apply(data, s, 'Is it a mammal?').note, 'Is it a mammal? yes');
});
