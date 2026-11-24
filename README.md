# 20 Questions with Jev

A hands-on workshop. You build a 20 Questions player with [Jev](https://docs.typesafe.ai) (TypeSafe's System One model), then race it against DeepSeek and Claude Sonnet.

The game is classic 20 Questions over any noun: a secret thing from a pool of 100 (a frog, a toaster, the moon, a volcano…), 20 turns, and 35 yes/no questions that work for anything ("Is it alive?", "Is it made by people?", "Is it bigger than a breadbox?"). The answers come from a fixed table (Jev filled all 3,500 cells once; 6% were pinned by hand to one meaning per question), so every player hears the same truth.

The lesson: **Jev makes one judgment, code does the rest.** Each turn there's one decision that needs judgment: which question to ask next. Answering it, crossing off the things that don't fit and guessing when one thing is left are all plain code.

## Start

Paste this into your coding agent (Claude Code, Codex, Cursor…):

> Set up https://github.com/Rhys-Lindmark/20-questions-workshop and help me build a 20 Questions player with Jev. Follow its AGENTS.md.

Or do it yourself. You need Git and Node.js 22 or newer. There is nothing to install:

```bash
git clone https://github.com/Rhys-Lindmark/20-questions-workshop.git
cd 20-questions-workshop
npm run play -- frog
```

That races the provided players on the secret "frog", using recorded answers, so it works without keys. To change a player and see Jev answer it fresh, add a key:

```bash
cp .env.example .env          # paste TYPESAFE_API_KEY (and OPENROUTER_API_KEY to race the LLMs live)
```

## The levels

| Level | You edit | You run | You learn |
| - | - | - | - |
| 1 · Ask for the move | [starter/level1.js](starter/level1.js) | `npm run play -- frog --player level1` | Calling Jev, and why "What is your next move?" is a weak question |
| 2 · One judgment, code does the rest | [starter/level2.js](starter/level2.js) (three TODOs) | `npm run score -- --player level2` | Splitting a decision: code's exact moves, state code already knows, one question answerable at a glance |
| 3 · Race it, make it yours | your Level 2 | `npm run play -- hedgehog`, `npm run score` | Racing Jev against LLMs on turns, time and cost; any noun you type (Jev answers the questions about it first) |

My versions are in [solutions/](solutions/), as the `mine1` and `mine2` lanes. Look at them after you've tried.

## Results

Nine secrets (sets a, b and c: frog, umbrella, volcano · pizza, helicopter, heart · guitar, cactus, penguin), recorded runs. A miss counts as 25 turns.

| Player | Turns | Found | Time | Cost |
| - | - | - | - | - |
| Level 1: "What is your next move?" | 160 | 5/9 | 16.0 s | $0.0116 |
| Level 2 as shipped (never guesses) | 225 | 0/9 | 20.9 s | $0.0088 |
| + TODO 1: code guesses when one thing is left | 129 | 7/9 | | |
| + TODO 2: hand Jev `still_possible` (the state) | 107 | 8/9 | | |
| + TODO 3: the question (my Level 2) | 106 | 9/9 | 11.9 s | $0.0052 |
| DeepSeek v4.1 Flash | 88 | 9/9 | 67.3 s | $0.0070 |
| Claude Sonnet 5.5 | 81 | 9/9 | 152.4 s | $0.3528 |
| Code alone (reads the whole table, best split) | 69 | 9/9 | 0 | $0 |

What it shows: fixing the state is worth 22 turns, the wording 1. Jev takes a few more turns than the LLMs (about 12 per secret vs 9–10), and is 13× faster and 68× cheaper than Sonnet, 5.7× faster than DeepSeek at about the same cost. And because code holds the whole table here, code alone plays best: a model's judgment earns its place where no table exists, like the things you type in.

## The race

Every racer gets the same turn: the same state and the same legal moves. Each turn shows how many turns it took, how long each racer's calls took, and what they cost (Jev at $0.042 per million input tokens; the LLMs at OpenRouter's billed price).

```bash
npm run play -- frog                    # your Level 2 vs mine vs DeepSeek vs Sonnet
npm run play -- a                       # three secrets (sets a, b, c)
npm run play -- hedgehog                # any noun: Jev answers every question about it first
npm run play -- stapler                 # a planned failure: Jev's answers match hammer's exactly
npm run score                           # every lane on the same 9 secrets
```

`--live` makes fresh calls, `--replay` uses recordings only (no network).

## Keys

- `TYPESAFE_API_KEY`: from the TypeSafe console. A whole scored run is well under a cent.
- `OPENROUTER_API_KEY`: only to race DeepSeek and Sonnet live (Sonnet costs a few cents per race).

Keys go in `.env`, which git ignores.

## See it live

The same race, with a page and a timeline, is at [ai.rhyslindmark.com/jev/races](https://ai.rhyslindmark.com/jev/races/?game=twenty) (behind a login). Another workshop in this format: [model-router-workshop](https://github.com/Rhys-Lindmark/model-router-workshop).

## License

MIT
