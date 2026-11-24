// The players ("lanes" in a race) and how each one's request is built and read.
//
// Jev players are files with state(), questions(), decide() and, optionally, codeMove()
// (starter/, solutions/). The LLM lanes get exactly the turn my Level 2 player gets: the same
// state, the same question (askText) and the unasked questions as numbered options, and they
// reply with a number. Code guesses for them when one thing is left, as it does for Jev.

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-1.14.0';     // pinned, so recordings replay (picked 2026-11-24)
export const JEV_PRICE_PER_MTOK = 0.042;   // input only; output is free (docs.typesafe.ai/go/models)
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Jev players: the files you edit (starter/) and mine (solutions/). Loaded fresh at each race,
// so an edit shows up on the next race without a restart.
export const PLAYERS = {
  level1: { label: 'Your Level 1', file: 'starter/level1.js' },
  level2: { label: 'Your Level 2', file: 'starter/level2.js' },
  mine1:  { label: 'Mine: Level 1', file: 'solutions/level1.js' },
  mine2:  { label: 'Mine: Level 2', file: 'solutions/level2.js' },
};

// The LLM lanes, picked 2026-11-24, the same as the races at ai.rhyslindmark.com/jev/races.
// DeepSeek v4.1 Flash: the current cheap, good open-weight model. Claude Sonnet 5.5: the
// frontier comparison, on purpose, to put Jev's time and cost next to a frontier model.
// Reasoning off where the model allows it, so each move is one quick reply. Sonnet 5.5 on
// OpenRouter requires reasoning, so it gets the lowest effort (and no temperature, which
// reasoning doesn't accept).
export const DEEPSEEK_MODEL = 'deepseek/deepseek-v4.1-flash-1017';
export const SONNET_MODEL = 'anthropic/claude-sonnet-5.5';
export const LLMS = {
  deepseek: { label: 'DeepSeek v4.1 Flash', model: DEEPSEEK_MODEL, params: { max_tokens: 400, temperature: 0, reasoning: { enabled: false } } },
  sonnet:   { label: 'Claude Sonnet 5.5',   model: SONNET_MODEL,   params: { max_tokens: 3000, reasoning: { effort: 'low' } } },
};

export const LANES = {
  ...Object.fromEntries(Object.entries(PLAYERS).map(([id, p]) => [id, { ...p, kind: 'jev', price: 'Jev 1.14 · $0.042 / M in' }])),
  deepseek: { ...LLMS.deepseek, kind: 'llm', price: 'open-weight, via OpenRouter' },
  sonnet: { ...LLMS.sonnet, kind: 'llm', price: 'frontier · $2 / $10 per M' },
  // A yardstick, not a racer: code that reads the answer table and counts. It's only possible
  // because this toy game has the whole table in code.
  code: { label: 'Code alone (reads the table)', kind: 'code', price: 'no model' },
};

// The question that splits `still_possible` most evenly, counted from the table.
export function bestSplit(table, game) {
  const n = game.stillPossible.length;
  let best = null, bestScore = Infinity;
  for (const q of game.unasked) {
    const yes = game.stillPossible.filter(x => table.yes[q].has(x) || (table.custom?.thing === x && table.custom.row[q] === 'yes')).length;
    const score = Math.max(yes, n - yes);
    if (score < bestScore) { best = q; bestScore = score; }
  }
  return best;
}

// ---------- Jev ----------

export const jevRequest = (player, game) => ({ model: JEV_MODEL, state: player.state(game), questions: player.questions(game) });
export const jevCost = out => (out.input_tokens ?? 0) * JEV_PRICE_PER_MTOK / 1e6;
const top = (p, n = 5) => p && Object.entries(p).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +v.toFixed(3)]);

export function readJevMove(player, game, out) {
  const d = player.decide(out.answers, game) || {};
  return { move: d.move, why: d.why, probs: top(d.probs), ms: out.ms, cost: jevCost(out), replayed: !!out.replayed };
}

// ---------- LLMs ----------

const SYSTEM = 'You are playing 20 Questions. Each turn you see the game state, a question, and a numbered list of options. Reply with the number of your choice and nothing else.';

// turn: the game module's turn() (state, question, options).
export function llmRequest(laneId, turn) {
  const lane = LLMS[laneId];
  const text = [JSON.stringify(turn.state, null, 1), '', turn.question, '', ...turn.options.map((o, i) => `${i + 1}. ${o.name}`)].join('\n');
  return { model: lane.model, ...lane.params, usage: { include: true }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }] };
}

export function readLlmMove(turn, out) {
  const n = parseInt((out.reply.match(/\d+/g) || []).pop(), 10); // the last number: a model that explains itself ends on its choice
  const move = turn.options[n - 1]?.name;
  return { move: move ?? null, why: move ? undefined : `couldn't read a choice from "${out.reply.slice(0, 60)}"`, ms: out.ms, cost: out.cost ?? 0, replayed: !!out.replayed };
}
