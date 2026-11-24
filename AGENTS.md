# For coding agents

You're helping someone at a workshop build a 20 Questions player with Jev, TypeSafe's System One model. Guide them level by level. Don't solve the levels for them: run things, show what happened, ask what they think, and let them make the edits (or make the edit they choose).

## Set up

1. Check Node: `node --version` must be 22 or newer. There's nothing to install. `npm run doctor` checks the setup (`-- --live` checks keys).
2. Run `npm run play -- frog` and show the result. It replays recorded answers, so no keys are needed.
3. If they have keys, help them create `.env` from `.env.example` (`TYPESAFE_API_KEY`, optionally `OPENROUTER_API_KEY`). Never print or commit a key.

## How the code fits together

- `src/twenty.mjs`: the game. A pool of 100 nouns, 35 general yes/no questions, the answer table (`data/twenty/nouns.json`), crossing off, turns.
- `starter/level1.js`, `starter/level2.js`: the players they edit. A player is `state(game)`, `questions(game)`, `decide(answers, game)` and optional `codeMove(game)`. The comments at the top of `starter/level1.js` describe `game`.
- `solutions/`: the facilitator's versions (lanes `mine1`, `mine2`). Don't show these before they've tried.
- `scripts/play.js` (`npm run play`), `scripts/score.js` (`npm run score`): races and scores. `scripts/app.js` (`npm run app`): the race page at http://localhost:3420. `scripts/build-table.js` (`npm run build-table`): Jev builds the answer table. `npm run doctor` checks setup; `npm test` checks the engine and that recordings replay.
- Calls are recorded in `recordings/`. An unedited player replays; an edited one calls Jev live and needs `TYPESAFE_API_KEY`.

TypeSafe's docs: https://docs.typesafe.ai/llms.txt (append `.md` to a page path for Markdown).

## Level 1 · Ask for the move

1. Run `npm run play -- frog --player level1` and `npm run score -- --player level1`.
2. Open `starter/level1.js` with them. It asks Jev "What is your next move?" over every question and guess.
3. Ask: could a smart person answer that at a glance from this state? What is Jev being asked to work out that code already knows?

## Level 2 · Jev makes one judgment, code does the rest

`starter/level2.js` has three TODOs. Take them in order, and run `npm run score -- --player level2` after each:

1. **Code's move**: when does code know the answer for sure? (When one thing is left, guess it. No model needed.)
2. **The state**: fix the state before the wording. Code already crossed off everything that doesn't fit (`game.stillPossible`); hand Jev that instead of making it redo the work.
3. **The question**: "Which question should I ask next?" is still a decision. What makes a question good right now? (It splits what's left most evenly.) Ask Jev for that, one judgment.

Let them try each before hinting. When they're done, compare with `npm run score` (their lane next to `mine2`, DeepSeek and Sonnet).

## Level 3 · Race it, make it yours

- `npm run play -- a` (three secrets), `npm run play -- <any noun>`: for a noun not in the pool, Jev answers every question about it once, and it joins the pool.
- Talk through the scoreboard: turns, time and cost per lane. Jev takes a few more turns than the LLMs; it's far faster than both and far cheaper than Sonnet (about the same cost as DeepSeek). Code alone, reading the whole table, beats them all: ask where a model's judgment is actually needed (things typed in, with no table).
- `npm run app` (http://localhost:3420) shows the same races as lanes side by side with a timeline. It keeps running: start it in the background or ask them to run it in their own terminal. Their player file is reloaded at each race, so they edit and start a new race. Tick "You" to let them play the same turn by hand.
- `npm run play -- stapler` is a planned failure: Jev's answers for it match hammer's, so no one can tell them apart. Ask what they'd add before showing the fix.
- Make it yours: `starter/my-pool.js` lists extra things and extra questions. `npm run build-table -- --mine` has Jev answer the new parts of the table and saves `data/twenty/mine.json`, which play, score and the page then use (delete it to go back). The shipped example adds "Is it usually found on a desk?", which tells stapler from hammer, and replays offline. Read the printed table with them (unsure answers, things with the same answers) before racing. Races on their table call Jev live and need `TYPESAFE_API_KEY`.

## Rules of thumb (from TypeSafe's guidance)

- Judgments in Jev, decisions in code.
- When an answer looks wrong, fix the state first, then the scope of the question, then the wording.
- One judgment per question; a person should be able to answer it at a glance.
- No prompt gymnastics: don't name test cases in criteria or tune thresholds to a few secrets.
