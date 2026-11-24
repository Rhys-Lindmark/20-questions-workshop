// The race page: http://localhost:3420
//   npm run app
// Lanes race side by side: your player (starter/level1.js or level2.js), mine, DeepSeek,
// Sonnet, and You. AI lanes run here on the server (keys stay here) and stream their moves to
// the page; your player file is loaded fresh at each race, so edit it and start a new race.
// Recorded calls replay at the speed they were recorded, so a race looks the same offline.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadTable, prepare, runRace, MINE } from '../src/race.js';
import { LANES } from '../src/lanes.js';
import { keys } from '../src/calls.js';
import { askText } from '../src/twenty.mjs';

const PORT = Number(process.env.PORT) || 3420;
const FILES = { '/': ['app/index.html', 'text/html; charset=utf-8'], '/app.js': ['app/app.js', 'text/javascript'], '/style.css': ['app/style.css', 'text/css'], '/twenty.mjs': ['src/twenty.mjs', 'text/javascript'] };
const TYPED = ['hedgehog', 'lasagna', 'teddy bear', 'stapler']; // recorded, so they replay offline

const send = (res, code, body, type = 'application/json') => { if (res.headersSent) return res.end(); res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(body) : body); };
const readBody = req => new Promise((ok, bad) => { let s = ''; req.on('data', c => { s += c; if (s.length > 50000) bad(new Error('too big')); }); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(e); } }); });

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (FILES[url.pathname]) { const [f, type] = FILES[url.pathname]; return send(res, 200, await readFile(new URL(`../${f}`, import.meta.url)), type); }
    if (url.pathname === '/api/state') {
      const { yes, ...table } = loadTable();
      return send(res, 200, { table, mine: existsSync(MINE), askText, keys: keys(), typed: TYPED,
        lanes: Object.fromEntries(Object.entries(LANES).map(([id, l]) => [id, { label: l.label, price: l.price, kind: l.kind, file: l.file }])) });
    }
    if (url.pathname === '/api/prepare' && req.method === 'POST') {
      const { input, mode } = await readBody(req);
      try { return send(res, 200, await prepare(loadTable(), input, mode)); }
      catch (e) { return send(res, 200, { error: e.message }); }
    }
    if (url.pathname === '/api/race') {
      // Server-sent events: one per move, from every lane.
      const q = url.searchParams;
      const lanes = (q.get('lanes') || '').split(',').filter(l => LANES[l]);
      const extra = q.get('extra') ? JSON.parse(q.get('extra')) : undefined;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      const ctl = new AbortController();
      req.on('close', () => ctl.abort());
      const emit = e => { if (!ctl.signal.aborted) res.write(`data: ${JSON.stringify(e)}\n\n`); };
      await runRace({ data: loadTable(), caseId: q.get('caseId'), extra, lanes, mode: q.get('mode') || 'auto', pace: true, emit, signal: ctl.signal, withRequest: true });
      emit({ type: 'end' });
      return res.end();
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
}).on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy (is the page already running?). Try: PORT=3421 npm run app` : e.message); process.exit(1); })
  .listen(PORT, () => console.log(`20 Questions race page: http://localhost:${PORT}\nEdit starter/level1.js or starter/level2.js, then start a new race.`));
