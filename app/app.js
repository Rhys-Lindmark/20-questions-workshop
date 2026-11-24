// The race page. AI lanes run on the server (scripts/app.js) and stream their moves here;
// the You lane runs in this browser on the same game module (src/twenty.mjs).
import twenty, { prep, view, GUESS } from './twenty.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = x => x === 0 ? '$0' : x < 0.01 ? '$' + x.toFixed(4) : '$' + x.toFixed(3);
const secs = ms => (ms / 1000).toFixed(1) + 's';
const times = x => (x < 10 ? x.toFixed(1) : x.toFixed(0)) + '×';

const meta = await fetch('api/state').then(r => r.json());
const data = prep(meta.table);
$('#asktext').textContent = meta.askText;
$('#count').textContent = data.items.length;
$('#keys').innerHTML = [['jev', 'Jev key'], ['openrouter', 'OpenRouter key']].map(([k, l]) => `<span class="pill ${meta.keys[k] ? 'on' : ''}">${l}${meta.keys[k] ? '' : ': none, replaying'}</span>`).join(' ')
  + (meta.mine ? ' <span class="pill on">your table: data/twenty/mine.json</span>' : '');

// The picker: type anything, the score secrets, the sets.
const examples = [...new Set(Object.values(data.sets).flat())];
$('#chips').innerHTML = [...examples.map(x => `<button class="chip" data-input="${esc(x)}">${esc(x)}</button>`),
  ...meta.typed.map(x => `<button class="chip typed" data-input="${esc(x)}" title="Not in the pool: Jev answers every question about it first">${esc(x)}</button>`)].join('');
$('#sets').innerHTML = Object.entries(data.sets).map(([k, v]) => `<button class="chip set" data-input="${k}">${k.toUpperCase()}: ${esc(v.join(', '))}</button>`).join('')
  + '<button class="chip set" data-input="random">3 random</button>';
document.body.addEventListener('click', e => { const b = e.target.closest('[data-input]'); if (b) start(b.dataset.input); });
$('#typeany').onsubmit = e => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v) start(v); };

// Lanes to race. "Yours" is your Level 1 or Level 2 file.
const L = meta.lanes;
$('#lanepick').innerHTML = `<label><input type="checkbox" value="yours" checked> Yours: <select id="yours"><option value="level2">${esc(L.level2.file)}</option><option value="level1">${esc(L.level1.file)}</option></select></label>`
  + [['mine2', true], ['deepseek', true], ['sonnet', true], ['code', false]].map(([id, on]) => `<label><input type="checkbox" value="${id}" ${on ? 'checked' : ''}> ${esc(L[id].label)}</label>`).join('')
  + '<label><input type="checkbox" value="you"> You</label>';
const laneInfo = id => id === 'you' ? { label: 'You', price: 'a person in the room' } : L[id];

let run = 0, lanes = {}, source = null, current = null;

function stop() {
  run++;
  source?.close(); source = null;
  Object.values(lanes).forEach(l => l.timer && clearInterval(l.timer));
  lanes = {};
}

async function start(input) {
  stop();
  const myRun = run, mode = $('#mode').value;
  const picked = [...document.querySelectorAll('#lanepick input:checked')].map(i => i.value === 'yours' ? $('#yours').value : i.value);
  if (!picked.length) return;
  $('#prepnote').textContent = 'Getting ready…';
  const prep = await fetch('api/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, mode }) }).then(r => r.json());
  if (myRun !== run) return;
  if (prep.error) { $('#prepnote').innerHTML = `<span class="no">${esc(prep.error)}</span>`; return; }
  $('#prepnote').textContent = '';
  current = prep;
  drawBoard(prep);
  $('#scores').innerHTML = '';
  $('#lanes').innerHTML = picked.map(id => `
    <div class="lane ${L[id]?.kind ?? 'you'}" id="lane-${id}">
      <h2>${esc(laneInfo(id).label)} <small>${esc(laneInfo(id).price)}</small></h2>
      <div class="stats"><div class="stat"><b class="steps">0</b><span>turns</span></div>
        <div class="stat"><b class="time">0.0s</b><span>time</span></div><div class="stat"><b class="cost">$0</b><span>cost</span></div></div>
      <div class="status">${id === 'you' ? 'Your move' : 'Thinking…'}</div>
      ${id === 'you' ? '<div class="play"></div>' : '<div class="now"></div>'}
      <div class="log"></div>
    </div>`).join('');
  for (const id of picked) lanes[id] = { id, steps: 0, ms: 0, cost: 0, done: false, ticks: [] };
  drawTimeline();
  const ai = picked.filter(id => id !== 'you');
  if (ai.length) {
    const q = new URLSearchParams({ caseId: prep.caseId, lanes: ai.join(','), mode, ...(prep.extra ? { extra: JSON.stringify(prep.extra) } : {}) });
    source = new EventSource('api/race?' + q);
    source.onmessage = m => { if (myRun === run) onEvent(JSON.parse(m.data)); };
    source.onerror = () => { source?.close(); };
  }
  if (picked.includes('you')) playHuman(prep);
}

// Above the lanes: what's being raced, and for a typed thing, Jev's answers about it.
function drawBoard(prep) {
  const o = prep.oracle;
  const what = prep.caseId.replace(/^(one|set|type):/, '').replaceAll('|', ', ');
  let html = `<div class="racing">Racing: <b>${esc(data.sets[what] ? data.sets[what].join(', ') : what)}</b></div>`;
  if (o) {
    const yes = Object.entries(o.row).filter(([, a]) => a === 'yes').map(([q]) => q);
    html += `<div class="oracle"><b>${esc(o.thing)}</b> isn't in the pool, so Jev answered all ${o.questions} questions about it in one request (${o.ms} ms, $${o.cost.toFixed(5)}${o.replayed ? ', recorded' : ''}). Every racer hears these answers.
      <div>${yes.map(q => `<span class="chip yes">${esc(q)}</span>`).join('') || '<span class="muted">No to everything.</span>'}</div>
      ${o.sameAs.length ? `<div class="no">Same answers as ${esc(o.sameAs.join(', '))}: no question can tell them apart.</div>` : ''}</div>`;
  }
  $('#board').innerHTML = html;
}

function onEvent(e) {
  if (e.type === 'end') { source?.close(); source = null; return; }
  const lane = lanes[e.lane]; if (!lane) return;
  const el = $('#lane-' + e.lane);
  if (e.type === 'error') { lane.done = lane.error = true; setStatus(el, e.message, 'err'); return maybeScores(); }
  if (e.type === 'step') {
    Object.assign(lane, { steps: e.totals.steps, ms: e.totals.ms, cost: e.totals.cost });
    lane.ticks.push({ ms: lane.ms, bad: !e.move || /not a legal/.test(e.note), code: e.code });
    stats(el, lane);
    setStatus(el, e.code ? 'code moved' : (e.replayed ? 'replaying recorded calls' : 'live'));
    addRow(el, e);
    if (e.request) el.querySelector('.now').innerHTML = `<details><summary>What Jev saw (turn ${e.n})</summary><pre>${esc(JSON.stringify(e.request, null, 1))}</pre></details>`;
  }
  if (e.type === 'done') { Object.assign(lane, { done: true, result: e.result }); setStatus(el, e.result.headline, 'done'); maybeScores(); }
}

const setStatus = (el, text, cls = '') => { const st = el.querySelector('.status'); st.className = 'status ' + cls; st.textContent = text; };

function addRow(el, e) {
  let body;
  if (e.move?.startsWith(GUESS)) {
    const hit = /Yes!/.test(e.note);
    body = `Guess <b>${esc(e.move.slice(GUESS.length))}</b> → <span class="${hit ? 'yes' : 'no'}">${hit ? 'yes!' : 'no'}</span>`;
  } else if (e.move && e.note.startsWith(e.move)) {
    const a = e.note.slice(e.move.length).trim();
    body = `${esc(e.move)} → <span class="${a}">${a}</span>`;
  } else body = `<span class="${/Out of turns/.test(e.note) ? 'no' : ''}">${esc(e.note)}</span>`;
  if (e.round) body += `<div class="round">${esc(e.round.secret)}: ${e.round.solved ? `${e.round.turns} turns` : 'missed'}</div>`;
  const probs = e.probs ? `<div class="probs">${e.probs.map(([k, p]) => `${esc(k)} ${(p * 100).toFixed(0)}%`).join(' · ')}</div>` : '';
  const left = e.left != null ? `<span class="left">${e.left} left</span>` : '';
  const log = el.querySelector('.log');
  log.insertAdjacentHTML('beforeend', `<div class="row"><span class="t">${e.code ? 'code' : e.ms != null ? e.ms + ' ms' : ''}</span><span class="n">${e.n}</span> ${left} ${body}${e.why ? `<div class="why">${esc(e.why)}</div>` : ''}${probs}</div>`);
  log.scrollTop = log.scrollHeight;
}

function stats(el, lane) {
  drawTimeline();
  el.querySelector('.steps').textContent = lane.steps;
  el.querySelector('.time').textContent = secs(lane.ms);
  el.querySelector('.cost').textContent = money(lane.cost);
}

// The race at the bottom: one track per racer, the bar is its time so far, each tick a move.
function drawTimeline() {
  const all = Object.values(lanes), box = $('#timeline');
  if (!all.length) { box.innerHTML = ''; return; }
  const max = Math.max(1000, ...all.map(l => l.ms)) * 1.04;
  const pct = ms => (100 * ms / max).toFixed(2) + '%';
  box.innerHTML = `<div class="tl-scale">${secs(max / 1.04)}</div>` + all.map(l => `
    <div class="tl-row ${L[l.id]?.kind ?? 'you'}">
      <div class="tl-name">${esc(laneInfo(l.id).label)}</div>
      <div class="tl-track"><div class="tl-bar" style="width:${pct(l.ms)}"></div>
        ${l.ticks.map(t => `<i class="${t.bad ? 'bad' : t.code ? 'code' : ''}" style="left:${pct(t.ms)}"></i>`).join('')}</div>
      <div class="tl-state ${l.done ? (l.error ? 'err' : 'done') : ''}">${l.error ? 'ERROR' : l.done ? 'FINISHED' : `${l.steps} · ${secs(l.ms)}`}</div>
    </div>`).join('');
}

// ---------- You ----------
function playHuman(prep) {
  const lane = lanes.you, el = $('#lane-you'), myRun = run;
  let s = twenty.init(data, prep.caseId, prep.extra);
  const t0 = Date.now();
  lane.timer = setInterval(() => { lane.ms = Date.now() - t0; stats(el, lane); }, 100);
  const play = (move, code) => {
    const out = twenty.apply(data, s, move);
    s = out.s; lane.steps++; lane.ms = Date.now() - t0;
    lane.ticks.push({ ms: lane.ms, code });
    stats(el, lane);
    addRow(el, { n: lane.steps, move, note: out.note, round: out.round, code, why: code ? '1 left → code guesses' : undefined });
    draw();
  };
  const draw = () => {
    if (myRun !== run) return;
    if (twenty.done(s)) {
      clearInterval(lane.timer); lane.ms = Date.now() - t0; stats(el, lane);
      Object.assign(lane, { done: true, result: twenty.result(s) });
      el.querySelector('.play').innerHTML = '';
      setStatus(el, lane.result.headline, 'done');
      return maybeScores();
    }
    const turn = twenty.turn(data, s), g = view(data, s);
    const answers = g.answers.map(a => `<div>${esc(a.question)} → <span class="${a.answer}">${a.answer}</span></div>`).join('');
    el.querySelector('.play').innerHTML = `<div class="youview">
      <div class="muted">Secret ${g.secretNumber} of ${g.secretCount} · ${g.turnsLeft} turns left · ${g.stillPossible.length} still possible</div>
      ${answers}
      <details ${g.stillPossible.length <= 30 ? 'open' : ''}><summary class="muted">still_possible</summary><div class="poss">${g.stillPossible.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div></details>
      <div><b>${esc(turn.question)}</b></div></div>
      <div class="moves">${turn.forced ? `<span class="muted">One left: code guesses…</span>` : turn.options.map((o, i) => `<button data-i="${i}">${esc(o.name)}</button>`).join('')}</div>`;
    if (turn.forced) return setTimeout(() => myRun === run && play(turn.forced, true), 600);
    el.querySelector('.moves').onclick = ev => { const i = ev.target.dataset.i; if (i != null) play(turn.options[i].name, false); };
  };
  draw();
}

// ---------- the scoreboard ----------
function maybeScores() {
  drawTimeline();
  const all = Object.values(lanes);
  if (!all.every(l => l.done)) return;
  const ok = all.filter(l => l.result).sort((a, b) => a.result.turns - b.result.turns || a.ms - b.ms);
  const ref = lanes.mine2?.result ? lanes.mine2 : null;
  const best = ok[0]?.result.turns;
  $('#scores').innerHTML = `<table><tr><th>Racer</th><th>Turns</th><th>Time</th><th>Cost</th>${ref ? '<th>vs Mine: Level 2</th>' : ''}</tr>
    ${ok.map(l => `<tr><td class="${l.result.turns === best ? 'win' : ''}">${esc(laneInfo(l.id).label)}<div class="muted small">${esc(l.result.detail)}</div></td>
      <td class="num">${l.result.turns}</td><td class="num">${secs(l.ms)}</td><td class="num">${money(l.cost)}</td>
      ${ref ? `<td class="num">${l === ref || l.id === 'you' || l.id === 'code' || !ref.cost ? '' : `${times(l.ms / ref.ms)} the time, ${times(l.cost / ref.cost)} the cost`}</td>` : ''}</tr>`).join('')}</table>`;
}
