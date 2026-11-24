// Maintainer tool: replays everything the repo promises works offline, and lists recordings
// nothing uses (left over from older questions or wording). --prune deletes those.
//   node scripts/recordings.js [--prune]
import { readdirSync, unlinkSync } from 'node:fs';
import { loadTable, prepare, runLane } from '../src/race.js';
import { call, used, REC } from '../src/calls.js';
import { oracleTurn } from '../src/twenty.mjs';
import { JEV_MODEL } from '../src/lanes.js';
import { step1, step2 } from '../solutions/level2-steps.js';

const data = loadTable({ base: true });
const lanes = ['level1', 'level2', 'mine1', 'mine2', 'deepseek', 'sonnet'];
const TYPED = ['hedgehog', 'lasagna', 'teddy bear', 'stapler'];
let missing = 0;
const run = async (args) => { try { await runLane({ data, mode: 'replay', ...args }); } catch (e) { missing++; console.log(`missing: ${args.laneId} ${args.caseId}: ${e.message}`); } };

// The table build: one request per noun.
for (const n of data.items) await call('jev', { model: JEV_MODEL, ...(({ state, questions }) => ({ state, questions }))(oracleTurn(data, n).jev) }, 'replay').catch(() => { missing++; console.log(`missing: build row for ${n}`); });
// The score sets and the typed examples, every lane.
for (const caseId of ['a', 'b', 'c']) {
  for (const laneId of lanes) await run({ caseId, laneId });
  for (const [name, player] of Object.entries({ step1, step2 })) await run({ caseId, laneId: 'level2', player, name });
}
for (const thing of TYPED) {
  const { caseId, extra } = await prepare(data, thing, 'replay');
  for (const laneId of lanes) await run({ caseId, extra, laneId });
}

const all = readdirSync(REC).filter(f => f.endsWith('.json'));
const unused = all.filter(f => !used.has(f));
console.log(`${all.length} recordings, ${used.size} used, ${unused.length} unused${missing ? `, ${missing} missing` : ''}.`);
if (process.argv.includes('--prune')) { for (const f of unused) unlinkSync(new URL(f, REC)); console.log(`Deleted ${unused.length}.`); }
