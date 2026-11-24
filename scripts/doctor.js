// Checks your setup.
//   npm run doctor            offline checks: Node, the answer table, the recordings, your player files
//   npm run doctor -- --live  also checks that your keys work (one tiny Jev call and one OpenRouter key lookup)
import { existsSync, readdirSync } from 'node:fs';
import { keys } from '../src/calls.js';
import { loadTable, loadPlayer, MINE } from '../src/race.js';
import { clashes } from '../src/twenty.mjs';
import { PLAYERS, JEV_URL, JEV_MODEL } from '../src/lanes.js';

const live = process.argv.includes('--live');
const ok = (b, msg, fix, optional) => { console.log(`${b ? '✓' : optional ? '·' : '✗'} ${msg}${!b && fix ? `\n    → ${fix}` : ''}`); return b; };
const major = Number(process.versions.node.split('.')[0]);
let good = ok(major >= 22, `Node ${process.versions.node}`, 'Install Node 22 or newer (nvm install 22 && nvm use 22).');

try {
  const t = loadTable();
  const same = clashes(t);
  good = ok(!same.length, `Answer table: ${t.items.length} things × ${Object.keys(t.questions).length} questions${existsSync(MINE) ? ' (your data/twenty/mine.json)' : ''}`,
    `These have the same answers to every question: ${same.map(v => v.join(' = ')).join('; ')}`) && good;
} catch (e) { good = ok(false, `Reading the answer table: ${e.message}`, 'Re-clone the repo.') && good; }

const recs = existsSync(new URL('../recordings/', import.meta.url)) ? readdirSync(new URL('../recordings/', import.meta.url)).length : 0;
good = ok(recs > 100, `${recs} recorded calls (races replay without keys)`, 'Re-clone the repo: recordings/ is missing.') && good;

for (const id of ['level1', 'level2']) {
  try { await loadPlayer(id); ok(true, `${PLAYERS[id].file} loads`); }
  catch (e) { good = ok(false, `${PLAYERS[id].file}: ${e.message}`, 'Fix the syntax error, or git checkout the file to start over.') && good; }
}

const k = keys();
ok(k.jev, 'TYPESAFE_API_KEY in .env (for edited players, live races and typing your own things)', 'See Keys in README.md. Everything unedited works without it.', true);
ok(k.openrouter, 'OPENROUTER_API_KEY in .env (for live DeepSeek and Sonnet lanes)', 'See Keys in README.md. The LLM lanes replay recorded races without it.', true);

if (live) {
  if (k.jev) {
    try {
      const r = await fetch(JEV_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: JEV_MODEL, state: { thing: 'frog' }, questions: { alive: { type: 'noul', instructions: 'About frog: Is it alive?' } } }) });
      const d = await r.json().catch(() => ({}));
      good = ok(r.ok && typeof d.answers?.alive?.noul === 'number', r.ok ? `Jev answers ("About frog: Is it alive?" = ${d.answers?.alive?.noul?.toFixed(2)})` : `Jev key rejected: HTTP ${r.status}`,
        r.status === 401 ? 'Check the key in .env (no quotes, no spaces). See Keys in README.md.' : 'See Keys in README.md') && good;
    } catch (e) { good = ok(false, `Reaching Jev: ${e.message}`) && good; }
  }
  if (k.openrouter) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
      const d = await r.json().catch(() => ({}));
      good = ok(r.ok, r.ok ? `OpenRouter key works${d.data?.limit_remaining != null ? ` ($${Number(d.data.limit_remaining).toFixed(2)} left on its limit)` : ''}` : `OpenRouter key rejected: HTTP ${r.status}`, 'Check the key in .env. See Keys in README.md.') && good;
    } catch (e) { good = ok(false, `Reaching OpenRouter: ${e.message}`) && good; }
  }
}
console.log(good ? `\nReady. Try: npm run play -- frog${live ? '' : '   (npm run doctor -- --live checks your keys)'}` : '\nFix the ✗ items above.');
process.exit(good ? 0 : 1);
