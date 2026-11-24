// LEVEL 2 · Jev makes one judgment; code does the rest.
//
// "What is your next move?" is a decision, and it hides the one judgment it depends on. This
// player is already split into parts: a move code makes alone, the state Jev sees, the
// question Jev answers, and decide(). It runs as is, but badly: it never guesses. Fix it in
// this order, and score after each step:
//
//   TODO 1  code's move    (what can code decide exactly, with no model?)
//   TODO 2  the state      (fix the state before the wording)
//   TODO 3  the question   (one judgment, answerable at a glance)
//
//   npm run score -- --player level2   turns, time and cost on the 9 score secrets
//   npm run play -- frog               a race in the terminal: yours, mine, DeepSeek, Sonnet
//   npm run app                        the race page (start a new race after each edit)
//
// The unedited file replays recorded answers. After an edit, Jev answers fresh, which needs
// TYPESAFE_API_KEY in .env (a whole scored run costs well under a cent).
// `game` is described at the top of starter/level1.js.

// A move code makes alone, with no model call, or null to ask Jev.
export function codeMove(game) {
  // TODO 1 · The answers come from a table, and code has already crossed off every thing that
  //          doesn't fit them (game.stillPossible). When does code know the answer for sure?
  if (!game.unasked.length) return 'Guess: ' + game.stillPossible[0];
  return null;
}

export function state(game) {
  return {
    game: 'I am thinking of one thing from `things`. Find it in as few turns as possible.',
    things: game.things,
    answers: game.answers.map(a => `${a.question} ${a.answer}`),
    ...(game.wrongGuesses.length ? { wrong_guesses: game.wrongGuesses } : {}),
    // TODO 2 · State. Jev is reading `answers` and redoing the crossing-off in its head. Code
    //          already did it. Hand Jev the result.
    turns_left: game.turnsLeft,
  };
}

export function questions(game) {
  return {
    // TODO 3 · The question. "Which question should I ask next?" is still a decision in
    //          disguise. What makes a question a good one to ask now? Ask Jev for that.
    ask: { type: 'choice', instructions: 'Which question should I ask next?', criteria: Object.fromEntries(game.unasked.map(q => [q, null])) },
  };
}

export function decide(answers, game) {
  return { move: answers.ask.choice, probs: answers.ask.probabilities, why: `${game.stillPossible.length} left → ask` };
}
