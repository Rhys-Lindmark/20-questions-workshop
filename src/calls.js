// Calls to Jev and OpenRouter, with recordings.
//
// Every call is saved in recordings/, filed under a hash of its exact request. So a race that
// has been run once replays without keys or Wi-Fi, and any edit that changes a request (new
// state, new wording) is a new call.
//   mode 'auto'   replay a recording if there is one, else call live (and record it)
//   mode 'live'   always call (and re-record)
//   mode 'replay' recordings only; a missing one is an error
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JEV_URL, OPENROUTER_URL } from './lanes.js';

const ROOT = new URL('../', import.meta.url);
try { process.loadEnvFile(new URL('.env', ROOT)); } catch {}
// The speaker's own eval keys go by other names.
process.env.TYPESAFE_API_KEY ||= process.env.TYPESAFE_KEY_JEV_EVAL || '';
process.env.OPENROUTER_API_KEY ||= process.env.OPENROUTER_KEY_JEV_EVAL || '';

export const REC = new URL('recordings/', ROOT);
export const keys = () => ({ jev: !!process.env.TYPESAFE_API_KEY, openrouter: !!process.env.OPENROUTER_API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A recording's file name: the first 24 hex characters of the SHA-256 of the request.
export const recordingName = req => createHash('sha256').update(JSON.stringify(req)).digest('hex').slice(0, 24) + '.json';
export const hasRecording = req => existsSync(new URL(recordingName(req), REC));
// The recordings this process read or wrote (scripts/recordings.js prunes the rest).
export const used = new Set();

// kind 'jev': req is { model, state, questions }. Returns { answers, input_tokens, ms, replayed }.
// kind 'llm': req is an OpenRouter chat request. Returns { reply, cost, ms, replayed }.
export async function call(kind, req, mode = 'auto') {
  const file = new URL(recordingName(req), REC);
  used.add(recordingName(req));
  if (mode !== 'live' && existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), replayed: true };
  const key = kind === 'jev' ? process.env.TYPESAFE_API_KEY : process.env.OPENROUTER_API_KEY;
  const keyName = kind === 'jev' ? 'TYPESAFE_API_KEY' : 'OPENROUTER_API_KEY';
  if (mode === 'replay') throw new Error('No recording for this request. Run it once with keys, or use auto mode.');
  if (!key) throw new Error(`No recording for this request, and no ${keyName} in .env to ask live (see Keys in README.md).`);
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    const r = await fetch(kind === 'jev' ? JEV_URL : OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': '20-questions-workshop' },
      body: JSON.stringify(req),
    });
    const ms = Date.now() - t0;
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await sleep(600 * 2 ** attempt); continue; }
    // A failed call is an error, never a move.
    if (!r.ok) throw new Error(`${kind === 'jev' ? 'Jev' : req.model} HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = await r.json();
    const out = kind === 'jev'
      ? { answers: data.answers, input_tokens: data.usage?.input_tokens ?? 0, ms }
      : { reply: data.choices?.[0]?.message?.content ?? '', cost: data.usage?.cost ?? 0, ms };
    if (kind === 'jev') for (const k of Object.keys(req.questions)) if (!data.answers?.[k]) throw new Error(`Jev returned no answer for "${k}": ${JSON.stringify(data).slice(0, 300)}`);
    mkdirSync(REC, { recursive: true });
    writeFileSync(file, JSON.stringify({ ...out, recorded_at: new Date().toISOString() }) + '\n');
    return { ...out, replayed: false };
  }
}
