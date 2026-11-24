// One race in the terminal.
//   npm run play -- frog                        your Level 2 vs mine vs DeepSeek vs Sonnet
//   npm run play -- frog --player level1        your Level 1 in the "yours" lane
//   npm run play -- a                           a set of three secrets (a, b or c), or: random
//   npm run play -- hedgehog                    anything: Jev answers every question about it first
//   npm run play -- frog --lanes level2,mine2   pick lanes: level1 level2 mine1 mine2 deepseek sonnet
//   --live (fresh calls) · --replay (recordings only, no network) · --quiet (results only)
import { loadTable, prepare, runRace } from '../src/race.js';
import { LANES } from '../src/lanes.js';

const args = process.argv.slice(2);
const flag = f => { const i = args.indexOf(f); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const player = flag('--player') || 'level2';
const lanes = (flag('--lanes') || [player, 'mine2', 'deepseek', 'sonnet'].filter((x, i, a) => a.indexOf(x) === i).join(',')).split(',');
const mode = args.includes('--live') ? 'live' : args.includes('--replay') ? 'replay' : 'auto';
const quiet = args.includes('--quiet');
const input = args.filter(a => !a.startsWith('--')).join(' ') || 'a';
for (const l of lanes) if (!LANES[l]) { console.error(`No lane "${l}". Lanes: ${Object.keys(LANES).join(', ')}`); process.exit(1); }

const data = loadTable();
let prep;
try { prep = await prepare(data, input, mode); } catch (e) { console.error(e.message); process.exit(1); }
const { caseId, extra, oracle } = prep;
console.log(`20 Questions · ${caseId.replace(/^(one|set|type):/, '').replaceAll('|', ', ')} · ${mode}\n`);
if (oracle) {
  const yes = Object.entries(oracle.row).filter(([, a]) => a === 'yes').map(([q]) => q);
  console.log(`"${oracle.thing}" isn't in the pool, so Jev answered all ${oracle.questions} questions about it in one request (${oracle.ms} ms, $${oracle.cost.toFixed(5)}${oracle.replayed ? ', recorded' : ''}).`);
  console.log(`Yes to: ${yes.join(' · ') || 'nothing'}\n`);
}
const w = Math.max(...lanes.map(l => LANES[l].label.length)) + 2;
const results = await runRace({ data, caseId, extra, lanes, mode, emit: e => {
  if (quiet) return;
  if (e.type === 'step') console.log(`${LANES[e.lane].label.padEnd(w)}${String(e.n).padStart(3)} ${e.code ? '  code' : String(e.ms).padStart(6) + ' ms'}  ${e.note}${e.why ? `   [${e.why}]` : ''}`);
  if (e.type === 'error') console.log(`${LANES[e.lane].label.padEnd(w)}ERROR ${e.message}`);
} });

console.log(`\n${'Lane'.padEnd(w)}${'Turns'.padStart(6)}${'Time'.padStart(9)}${'Cost'.padStart(11)}   Per secret`);
for (const r of results) {
  if (r.error) { console.log(`${LANES[r.lane].label.padEnd(w)}error: ${r.error}`); continue; }
  console.log(`${LANES[r.lane].label.padEnd(w)}${String(r.result.turns).padStart(6)}${((r.totals.ms / 1000).toFixed(1) + ' s').padStart(9)}${('$' + r.totals.cost.toFixed(5)).padStart(11)}   ${r.result.detail}${r.totals.calls && r.totals.replayed === r.totals.calls ? '   (recorded)' : ''}`);
}
