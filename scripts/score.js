// Scores players on the same 9 secrets: sets A, B and C (data/twenty/nouns.json). Fewer turns
// is better; a secret not found in 20 turns counts as 25.
//   npm run score                       every lane
//   npm run score -- --player level2    your Level 2 next to mine and the LLMs
//   npm run score -- --lanes level2,mine2
//   --live (fresh calls) · --replay (recordings only, no network)
// Unedited players replay recorded answers, so this works without keys. An edited player
// needs TYPESAFE_API_KEY (a whole run is well under a cent of Jev).
import { loadTable, runLane } from '../src/race.js';
import { LANES } from '../src/lanes.js';

const args = process.argv.slice(2);
const flag = f => { const i = args.indexOf(f); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const player = flag('--player');
const lanes = (flag('--lanes') || (player ? [player, 'mine2', 'deepseek', 'sonnet'] : Object.keys(LANES)).filter((x, i, a) => a.indexOf(x) === i).join(',')).split(',');
const mode = args.includes('--live') ? 'live' : args.includes('--replay') ? 'replay' : 'auto';
for (const l of lanes) if (!LANES[l]) { console.error(`No lane "${l}". Lanes: ${Object.keys(LANES).join(', ')}`); process.exit(1); }

const data = loadTable();
const SETS = ['a', 'b', 'c'];
console.log(`Scoring on ${SETS.map(k => `set ${k.toUpperCase()} (${data.sets[k].join(', ')})`).join(', ')}${mode === 'auto' ? '' : ` · ${mode}`}\n`);

const rows = await Promise.all(lanes.map(async laneId => {
  const row = { laneId, games: [], turns: 0, solved: 0, ms: 0, cost: 0, calls: 0, replayed: 0 };
  try {
    for (const caseId of SETS) {
      const r = await runLane({ data, caseId, laneId, mode });
      row.games.push(r.result.turns); row.turns += r.result.turns; row.solved += r.result.solved;
      row.ms += r.totals.ms; row.cost += r.totals.cost; row.calls += r.totals.calls; row.replayed += r.totals.replayed;
    }
  } catch (e) { row.error = e.message; }
  return row;
}));

const ref = rows.find(r => r.laneId === 'mine2' && !r.error);
const w = Math.max(...lanes.map(l => LANES[l].label.length)) + 2;
const x = n => n >= 10 ? n.toFixed(0) + '×' : n.toFixed(1) + '×';
console.log(`${'Player'.padEnd(w)}${'Set A'.padStart(7)}${'Set B'.padStart(7)}${'Set C'.padStart(7)}${'Turns'.padStart(7)}${'Found'.padStart(7)}${'Time'.padStart(9)}${'Cost'.padStart(11)}${ref ? '   vs Mine: Level 2' : ''}`);
for (const r of rows) {
  if (r.error) { console.log(`${LANES[r.laneId].label.padEnd(w)}${r.error}`); continue; }
  const vs = ref && r !== ref && r.ms ? `   ${x(r.ms / ref.ms)} the time, ${x(r.cost / ref.cost)} the cost` : '';
  console.log(`${LANES[r.laneId].label.padEnd(w)}${r.games.map(g => String(g).padStart(7)).join('')}${String(r.turns).padStart(7)}${`${r.solved}/9`.padStart(7)}${((r.ms / 1000).toFixed(1) + ' s').padStart(9)}${('$' + r.cost.toFixed(4)).padStart(11)}${vs}${r.replayed < r.calls ? `   (${r.calls - r.replayed} live calls)` : ''}`);
}
console.log('\nTurns per set: 3 secrets each, 25 for a miss. Time is the sum of each model call\'s latency, as recorded; code\'s moves take no time.');
if (rows.some(r => r.error)) process.exitCode = 1;
