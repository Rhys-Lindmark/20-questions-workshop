// Builds the answer table, data/twenty/nouns.json: one pool of concrete nouns and one bank of
// general yes/no questions. Jev answers every question about every noun (one request per noun,
// one Noul per question, yes at 0.5 or more: the same oracleTurn the game uses for a typed
// thing), then FIXES pins the answers a spot-check found wrong. The script prints Jev's unsure
// answers and checks that no two nouns have the same answers to every question.
//
//   npm run build-table             (replays recorded answers; --live asks Jev again)
//   npm run build-table -- --mine   Level 3: the table plus your extras in starter/my-pool.js,
//                                   saved as data/twenty/mine.json (used instead when present)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { oracleTurn, prep, clashes } from '../src/twenty.mjs';
import { call } from '../src/calls.js';
import { jevCost, JEV_MODEL } from '../src/lanes.js';

export const NOUNS = [
  // animals
  'dog', 'cat', 'horse', 'cow', 'chicken', 'eagle', 'penguin', 'shark', 'goldfish', 'dolphin', 'elephant', 'frog', 'snake', 'bee', 'spider', 'butterfly',
  // plants
  'oak tree', 'rose', 'cactus', 'grass', 'sunflower', 'seaweed',
  // foods and drinks
  'apple', 'banana', 'carrot', 'bread', 'cheese', 'egg', 'pizza', 'chocolate', 'honey', 'ice cream', 'lemon', 'potato', 'milk',
  // household objects
  'chair', 'bed', 'table', 'lamp', 'mirror', 'pillow', 'towel', 'toothbrush', 'refrigerator', 'television', 'clock', 'candle', 'umbrella', 'book', 'key', 'mug',
  // tools
  'hammer', 'scissors', 'knife', 'shovel', 'ladder', 'broom', 'pencil',
  // vehicles and things that roll or fly
  'car', 'bicycle', 'airplane', 'boat', 'train', 'skateboard', 'helicopter', 'rocket', 'kite',
  // big things people build, and materials
  'house', 'tent', 'bridge', 'lighthouse', 'window', 'gold', 'paper', 'sand',
  // body parts
  'hand', 'eye', 'heart', 'tooth', 'hair',
  // natural things
  'volcano', 'moon', 'sun', 'cloud', 'desert', 'mountain', 'rainbow', 'ocean', 'snowflake',
  // electronics and instruments
  'phone', 'camera', 'guitar', 'piano', 'drum', 'light bulb',
  // things you wear or play with, money
  'shoe', 'glasses', 'ball', 'balloon', 'coin',
];

// One judgment each, answerable for any noun.
export const QUESTIONS = [
  'Is it alive?',
  'Is it an animal?',
  'Is it a plant?',
  'Is it made by people?',
  'Can you eat it?',
  'Is it bigger than a breadbox?',
  'Is it bigger than a car?',
  'Can you hold it in one hand?',
  'Is it usually kept indoors?',
  'Does it need electricity to work?',
  'Is it made mostly of metal?',
  'Is it a tool?',
  'Is it a vehicle?',
  'Is it a mammal?',
  'Can it fly?',
  'Is it usually in or on water?',
  'Is it usually found in a kitchen?',
  'Does it taste sweet?',
  'Does it come from an animal?',
  'Is it soft?',
  'Does it have legs?',
  'Does it have wheels?',
  'Does it have a handle?',
  'Can it cut things?',
  'Can you sit on it?',
  'Can you see through it?',
  'Does it give off light?',
  'Is it found in the sky?',
  'Is it found in space?',
  'Is it round?',
  'Is it flat?',
  'Is it mostly green?',
  'Is it mostly yellow?',
  'Is it mostly red?',
  'Is it a musical instrument?',
];

// Spot-check fixes: 'noun | question' -> the right answer, where Jev's answer was wrong or read
// the question another way than the rest of the table (a dog "comes from an animal", a car is
// "a tool"). 215 of the 3,500 answers, about 6%. Each question keeps one meaning across nouns.
export const FIXES = {
  'eye | Is it alive?': 'no',
  'hand | Is it alive?': 'no',
  'heart | Is it alive?': 'no',
  'potato | Is it alive?': 'no',
  'carrot | Is it a plant?': 'no',
  'lemon | Is it a plant?': 'no',
  'potato | Is it a plant?': 'no',
  'seaweed | Is it a plant?': 'yes',
  'bee | Can you eat it?': 'no',
  'cactus | Can you eat it?': 'no',
  'gold | Can you eat it?': 'no',
  'grass | Can you eat it?': 'no',
  'heart | Can you eat it?': 'no',
  'rose | Can you eat it?': 'no',
  'snowflake | Can you eat it?': 'no',
  'spider | Can you eat it?': 'no',
  'cactus | Is it bigger than a breadbox?': 'no',
  'grass | Is it bigger than a breadbox?': 'no',
  'kite | Is it bigger than a breadbox?': 'no',
  'grass | Is it bigger than a car?': 'no',
  'cactus | Can you hold it in one hand?': 'no',
  'cat | Can you hold it in one hand?': 'no',
  'chicken | Can you hold it in one hand?': 'no',
  'hair | Can you hold it in one hand?': 'no',
  'heart | Can you hold it in one hand?': 'no',
  'mirror | Can you hold it in one hand?': 'no',
  'pizza | Can you hold it in one hand?': 'no',
  'skateboard | Can you hold it in one hand?': 'no',
  'snake | Can you hold it in one hand?': 'no',
  'sunflower | Can you hold it in one hand?': 'yes',
  'bicycle | Is it usually kept indoors?': 'no',
  'gold | Is it usually kept indoors?': 'no',
  'ladder | Is it usually kept indoors?': 'no',
  'skateboard | Is it usually kept indoors?': 'no',
  'airplane | Does it need electricity to work?': 'no',
  'car | Does it need electricity to work?': 'no',
  'eye | Does it need electricity to work?': 'no',
  'heart | Does it need electricity to work?': 'no',
  'house | Does it need electricity to work?': 'no',
  'ice cream | Does it need electricity to work?': 'no',
  'rocket | Does it need electricity to work?': 'no',
  'train | Does it need electricity to work?': 'no',
  'clock | Is it made mostly of metal?': 'no',
  'lamp | Is it made mostly of metal?': 'no',
  'airplane | Is it a tool?': 'no',
  'bicycle | Is it a tool?': 'no',
  'boat | Is it a tool?': 'no',
  'book | Is it a tool?': 'no',
  'camera | Is it a tool?': 'no',
  'car | Is it a tool?': 'no',
  'clock | Is it a tool?': 'no',
  'glasses | Is it a tool?': 'no',
  'hand | Is it a tool?': 'no',
  'helicopter | Is it a tool?': 'no',
  'key | Is it a tool?': 'no',
  'lighthouse | Is it a tool?': 'no',
  'mirror | Is it a tool?': 'no',
  'phone | Is it a tool?': 'no',
  'rocket | Is it a tool?': 'no',
  'skateboard | Is it a tool?': 'no',
  'television | Is it a tool?': 'no',
  'train | Is it a tool?': 'no',
  'umbrella | Is it a tool?': 'no',
  'skateboard | Is it a vehicle?': 'no',
  'paper | Can it fly?': 'no',
  'snowflake | Can it fly?': 'no',
  'bridge | Is it usually in or on water?': 'no',
  'drum | Is it usually in or on water?': 'no',
  'lighthouse | Is it usually in or on water?': 'no',
  'chicken | Is it usually found in a kitchen?': 'no',
  'clock | Is it usually found in a kitchen?': 'no',
  'glasses | Is it usually found in a kitchen?': 'no',
  'light bulb | Is it usually found in a kitchen?': 'no',
  'paper | Is it usually found in a kitchen?': 'no',
  'scissors | Is it usually found in a kitchen?': 'no',
  'towel | Is it usually found in a kitchen?': 'no',
  'window | Is it usually found in a kitchen?': 'no',
  'carrot | Does it taste sweet?': 'no',
  'desert | Does it taste sweet?': 'no',
  'milk | Does it taste sweet?': 'no',
  'rose | Does it taste sweet?': 'no',
  'bee | Does it come from an animal?': 'no',
  'butterfly | Does it come from an animal?': 'no',
  'cat | Does it come from an animal?': 'no',
  'chicken | Does it come from an animal?': 'no',
  'cow | Does it come from an animal?': 'no',
  'dog | Does it come from an animal?': 'no',
  'dolphin | Does it come from an animal?': 'no',
  'drum | Does it come from an animal?': 'no',
  'eagle | Does it come from an animal?': 'no',
  'elephant | Does it come from an animal?': 'no',
  'eye | Does it come from an animal?': 'no',
  'frog | Does it come from an animal?': 'no',
  'goldfish | Does it come from an animal?': 'no',
  'hair | Does it come from an animal?': 'no',
  'hand | Does it come from an animal?': 'no',
  'heart | Does it come from an animal?': 'no',
  'horse | Does it come from an animal?': 'no',
  'ice cream | Does it come from an animal?': 'no',
  'penguin | Does it come from an animal?': 'no',
  'shark | Does it come from an animal?': 'no',
  'shoe | Does it come from an animal?': 'no',
  'snake | Does it come from an animal?': 'no',
  'spider | Does it come from an animal?': 'no',
  'tooth | Does it come from an animal?': 'no',
  'balloon | Is it soft?': 'no',
  'butterfly | Is it soft?': 'no',
  'chicken | Is it soft?': 'no',
  'cow | Is it soft?': 'no',
  'desert | Is it soft?': 'no',
  'dolphin | Is it soft?': 'no',
  'egg | Is it soft?': 'no',
  'eye | Is it soft?': 'no',
  'frog | Is it soft?': 'no',
  'gold | Is it soft?': 'no',
  'goldfish | Is it soft?': 'no',
  'hand | Is it soft?': 'no',
  'heart | Is it soft?': 'no',
  'honey | Is it soft?': 'no',
  'ocean | Is it soft?': 'no',
  'paper | Is it soft?': 'no',
  'penguin | Is it soft?': 'no',
  'pizza | Is it soft?': 'no',
  'potato | Is it soft?': 'no',
  'rose | Is it soft?': 'no',
  'sand | Is it soft?': 'no',
  'seaweed | Is it soft?': 'no',
  'snake | Is it soft?': 'no',
  'snowflake | Is it soft?': 'no',
  'tent | Is it soft?': 'no',
  'toothbrush | Is it soft?': 'no',
  'glasses | Does it have legs?': 'no',
  'refrigerator | Does it have legs?': 'no',
  'cheese | Does it have wheels?': 'no',
  'helicopter | Does it have wheels?': 'no',
  'refrigerator | Does it have wheels?': 'no',
  'bicycle | Does it have a handle?': 'no',
  'camera | Does it have a handle?': 'no',
  'car | Does it have a handle?': 'no',
  'house | Does it have a handle?': 'no',
  'key | Does it have a handle?': 'no',
  'tent | Does it have a handle?': 'no',
  'window | Does it have a handle?': 'no',
  'eagle | Can it cut things?': 'no',
  'ocean | Can it cut things?': 'no',
  'sand | Can it cut things?': 'no',
  'shark | Can it cut things?': 'no',
  'shovel | Can it cut things?': 'no',
  'airplane | Can you sit on it?': 'no',
  'boat | Can you sit on it?': 'no',
  'bridge | Can you sit on it?': 'no',
  'car | Can you sit on it?': 'no',
  'desert | Can you sit on it?': 'no',
  'drum | Can you sit on it?': 'no',
  'gold | Can you sit on it?': 'no',
  'helicopter | Can you sit on it?': 'no',
  'ladder | Can you sit on it?': 'no',
  'mountain | Can you sit on it?': 'no',
  'oak tree | Can you sit on it?': 'no',
  'piano | Can you sit on it?': 'no',
  'tent | Can you sit on it?': 'no',
  'train | Can you sit on it?': 'no',
  'volcano | Can you sit on it?': 'no',
  'bicycle | Can you see through it?': 'no',
  'bridge | Can you see through it?': 'no',
  'broom | Can you see through it?': 'no',
  'camera | Can you see through it?': 'no',
  'chair | Can you see through it?': 'no',
  'desert | Can you see through it?': 'no',
  'helicopter | Can you see through it?': 'no',
  'honey | Can you see through it?': 'no',
  'ladder | Can you see through it?': 'no',
  'rainbow | Can you see through it?': 'no',
  'snowflake | Can you see through it?': 'no',
  'airplane | Does it give off light?': 'no',
  'car | Does it give off light?': 'no',
  'helicopter | Does it give off light?': 'no',
  'refrigerator | Does it give off light?': 'no',
  'rocket | Does it give off light?': 'no',
  'train | Does it give off light?': 'no',
  'bee | Is it found in the sky?': 'no',
  'butterfly | Is it found in the sky?': 'no',
  'camera | Is it found in space?': 'no',
  'gold | Is it found in space?': 'no',
  'volcano | Is it found in space?': 'no',
  'bread | Is it round?': 'no',
  'candle | Is it round?': 'no',
  'hair | Is it round?': 'no',
  'lamp | Is it round?': 'no',
  'lighthouse | Is it round?': 'no',
  'mug | Is it round?': 'no',
  'rainbow | Is it round?': 'no',
  'umbrella | Is it round?': 'no',
  'volcano | Is it round?': 'no',
  'bed | Is it flat?': 'no',
  'book | Is it flat?': 'no',
  'bridge | Is it flat?': 'no',
  'broom | Is it flat?': 'no',
  'butterfly | Is it flat?': 'no',
  'clock | Is it flat?': 'no',
  'desert | Is it flat?': 'no',
  'grass | Is it flat?': 'no',
  'key | Is it flat?': 'no',
  'knife | Is it flat?': 'no',
  'milk | Is it flat?': 'no',
  'scissors | Is it flat?': 'no',
  'seaweed | Is it flat?': 'no',
  'shoe | Is it flat?': 'no',
  'snowflake | Is it flat?': 'no',
  'mountain | Is it mostly green?': 'no',
  'seaweed | Is it mostly green?': 'yes',
  'candle | Is it mostly yellow?': 'no',
  'cheese | Is it mostly yellow?': 'yes',
  'goldfish | Is it mostly yellow?': 'no',
  'pencil | Is it mostly yellow?': 'no',
};

// Three secrets per set; `npm run score` plays all three sets.
export const SETS = { a: ['frog', 'umbrella', 'volcano'], b: ['pizza', 'helicopter', 'heart'], c: ['guitar', 'cactus', 'penguin'] };

const OUT = new URL('../data/twenty/nouns.json', import.meta.url);
const MINE = new URL('../data/twenty/mine.json', import.meta.url);
const mode = process.argv.includes('--live') ? 'live' : 'auto';
const fail = m => { console.error(m); process.exit(1); };

// Ask Jev `questions` about each noun. Returns { noun: { question: probability } }.
async function ask(nouns, questions) {
  let cost = 0, slowest = 0, replayed = 0;
  const shape = { questions: Object.fromEntries(questions.map(q => [q, []])) };
  const rows = await Promise.all(nouns.map(async n => {
    const turn = oracleTurn(shape, n);
    const out = await call('jev', { model: JEV_MODEL, state: turn.jev.state, questions: turn.jev.questions }, mode);
    cost += jevCost(out); slowest = Math.max(slowest, out.ms); replayed += out.replayed ? 1 : 0;
    return [n, turn.jev.decide(out.answers).probs];
  }));
  console.log(`${nouns.length} requests of ${questions.length} questions, in parallel (slowest ${slowest} ms), $${cost.toFixed(5)}${replayed ? `, ${replayed} replayed from recordings` : ''}.`);
  return Object.fromEntries(rows);
}

function report(table, probs, fixes) {
  const t = prep(table);
  const w = Math.max(...t.items.map(i => i.length)) + 2;
  let unsure = 0;
  for (const n of Object.keys(probs)) {
    const u = Object.entries(probs[n]).filter(([q, p]) => p > 0.25 && p < 0.75 && !fixes[`${n} | ${q}`]).map(([q, p]) => `${q} ${p.toFixed(2)}`);
    unsure += u.length;
    const yes = Object.keys(t.questions).filter(q => t.yes[q].has(n));
    console.log(`${n.padEnd(w)}yes: ${yes.join(' · ') || 'nothing'}${u.length ? `\n${' '.repeat(w)}unsure: ${u.join(' · ')}` : ''}`);
  }
  console.log(`\n${unsure} unsure answers (between 0.25 and 0.75). Yes count per question:`);
  for (const q of Object.keys(t.questions)) {
    const n = t.questions[q].length;
    console.log(`  ${String(n).padStart(3)}  ${q}${n === 0 || n === t.items.length ? '   ← splits nothing' : ''}`);
  }
  const same = clashes(t);
  console.log(same.length ? `\nSame answers (no question tells these apart): ${same.map(v => v.join(' = ')).join('; ')}` : `\nEvery one of the ${t.items.length} things has its own answers.`);
  return same;
}

const toTable = (nouns, questions, rows, sets) => ({
  items: [...nouns].sort((a, b) => a.localeCompare(b)),
  questions: Object.fromEntries(questions.map(q => [q, nouns.filter(n => rows[n][q] === 'yes').sort((a, b) => a.localeCompare(b))])),
  sets,
});
const checkFixes = (fixes, nouns, questions) => {
  for (const k of Object.keys(fixes)) {
    const [n, q] = k.split(' | ');
    if (!nouns.includes(n) || !questions.includes(q)) fail(`FIXES: "${k}" doesn't name a noun and a question ('noun | question').`);
  }
};

if (!process.argv.includes('--mine')) {
  if (new Set(NOUNS).size !== NOUNS.length || new Set(QUESTIONS).size !== QUESTIONS.length) fail('Each noun and each question must appear once.');
  checkFixes(FIXES, NOUNS, QUESTIONS);
  console.log(`Asking Jev ${QUESTIONS.length} questions about each of ${NOUNS.length} nouns…`);
  const probs = await ask(NOUNS, QUESTIONS);
  const rows = Object.fromEntries(NOUNS.map(n => [n, Object.fromEntries(QUESTIONS.map(q => [q, FIXES[`${n} | ${q}`] ?? (probs[n][q] >= 0.5 ? 'yes' : 'no')]))]));
  const table = toTable(NOUNS, QUESTIONS, rows, SETS);
  console.log('');
  report(table, probs, FIXES);
  writeFileSync(OUT, JSON.stringify(table, null, 1) + '\n');
  console.log('\nSaved data/twenty/nouns.json.');
} else {
  // Level 3: your extra nouns get every question; every noun gets your extra questions.
  const { EXTRA_THINGS = [], EXTRA_QUESTIONS = [], FIXES: MY_FIXES = {} } = await import(new URL(`../starter/my-pool.js?t=${Date.now()}`, import.meta.url));
  if (!existsSync(OUT)) fail('Build the main table first: npm run build-table');
  const base = JSON.parse(readFileSync(OUT, 'utf8'));
  const baseQs = Object.keys(base.questions);
  const things = EXTRA_THINGS.map(x => x.trim().toLowerCase()), extraQs = EXTRA_QUESTIONS.map(q => q.trim());
  for (const x of things) if (base.items.includes(x)) fail(`"${x}" is already in the pool.`);
  for (const q of extraQs) if (baseQs.includes(q)) fail(`"${q}" is already a question.`);
  if (!things.length && !extraQs.length) fail('Add something to EXTRA_THINGS or EXTRA_QUESTIONS in starter/my-pool.js first.');
  const allQs = [...baseQs, ...extraQs], allNouns = [...base.items, ...things];
  checkFixes(MY_FIXES, allNouns, allQs);
  const probs = {};
  if (things.length) { console.log(`Asking Jev all ${allQs.length} questions about your ${things.length} new thing${things.length > 1 ? "s" : ""}…`); Object.assign(probs, await ask(things, allQs)); }
  if (extraQs.length) {
    console.log(`Asking Jev your ${extraQs.length} new question${extraQs.length > 1 ? 's' : ''} about the ${base.items.length} nouns already in the pool…`);
    for (const [n, p] of Object.entries(await ask(base.items, extraQs))) probs[n] = p;
  }
  const baseYes = prep(base).yes;
  const rows = Object.fromEntries(allNouns.map(n => [n, Object.fromEntries(allQs.map(q => [q,
    MY_FIXES[`${n} | ${q}`] ?? (baseQs.includes(q) && base.items.includes(n) ? (baseYes[q].has(n) ? 'yes' : 'no') : (probs[n][q] >= 0.5 ? 'yes' : 'no'))]))]));
  const table = toTable(allNouns, allQs, rows, base.sets);
  console.log('');
  report(table, Object.fromEntries(Object.entries(probs).filter(([n]) => things.includes(n) || extraQs.length)), MY_FIXES);
  writeFileSync(MINE, JSON.stringify(table, null, 1) + '\n');
  console.log(`\nSaved data/twenty/mine.json (${allNouns.length} things, ${allQs.length} questions). The page, play and score use it instead of nouns.json while it exists; delete it to go back.`);
}
