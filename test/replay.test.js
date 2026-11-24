// Recorded races replay offline, with the numbers the README reports.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTable, prepare, runLane } from '../src/race.js';

const data = loadTable({ base: true });

// Turns over sets A, B and C (9 secrets), as recorded on 2026-11-24.
const EXPECTED = { mine1: 160, level1: 160, level2: 225, mine2: 106, deepseek: 88, sonnet: 81, code: 69 };

for (const [laneId, turns] of Object.entries(EXPECTED)) {
  test(`${laneId} replays the score sets offline: ${turns} turns`, async () => {
    let total = 0;
    for (const caseId of ['a', 'b', 'c']) total += (await runLane({ data, caseId, laneId, mode: 'replay' })).result.turns;
    assert.equal(total, turns);
  });
}

test('typed things replay offline, Jev\'s oracle answers included', async () => {
  for (const thing of ['hedgehog', 'lasagna', 'teddy bear', 'stapler']) {
    const { caseId, extra, oracle } = await prepare(data, thing, 'replay');
    assert.equal(oracle.thing, thing);
    for (const laneId of ['level1', 'level2', 'mine2', 'deepseek', 'sonnet']) {
      const r = await runLane({ data, caseId, extra, laneId, mode: 'replay' });
      assert.equal(r.result.detail.split(':')[0], thing);
    }
  }
});

// Level 2 one TODO at a time (solutions/level2-steps.js): code's move, then the state, then the question.
test('Level 2 step by step replays: 225 → 129 → 107 → 106 turns', async () => {
  const { step1, step2 } = await import('../solutions/level2-steps.js');
  for (const [player, turns] of [[step1, 129], [step2, 107]]) {
    let total = 0;
    for (const caseId of ['a', 'b', 'c']) total += (await runLane({ data, caseId, laneId: 'level2', player, mode: 'replay' })).result.turns;
    assert.equal(total, turns);
  }
});

// Level 3's example: Jev's rows for starter/my-pool.js replay, and the new question tells stapler from hammer.
test('the Level 3 example table builds offline', async () => {
  const { execFileSync } = await import('node:child_process');
  const { existsSync, unlinkSync } = await import('node:fs');
  const mine = new URL('../data/twenty/mine.json', import.meta.url);
  const had = existsSync(mine);
  const env = { ...process.env, TYPESAFE_API_KEY: '', OPENROUTER_API_KEY: '', TYPESAFE_KEY_JEV_EVAL: '', OPENROUTER_KEY_JEV_EVAL: '' };
  try {
    const out = execFileSync(process.execPath, ['scripts/build-table.js', '--mine'], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
    assert.match(out, /Every one of the 101 things has its own answers/);
  } finally { if (!had && existsSync(mine)) unlinkSync(mine); }
});
