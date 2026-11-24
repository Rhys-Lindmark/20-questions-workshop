// MINE · LEVEL 2 · Jev makes one judgment; code does the rest.
//
// What changed from Level 1:
//
// 1. Code does what code can do exactly. The answers come from a table, so code crosses off
//    every thing that doesn't fit them, the way you would on paper. When one thing is left,
//    code guesses it. No model is asked.
// 2. The state. Code already knows what's left, so it goes in the state as `still_possible`
//    instead of asking Jev to redo the bookkeeping from `answers`. Fix the state before the
//    wording.
// 3. The question. "What is your next move?" is a decision that hides a judgment. The judgment
//    is: which question splits what's left most evenly? That's one Choice over the unasked
//    questions, and the only thing Jev decides.
//
// The LLM lanes and You get exactly this turn: this state, this question, these options.
//
//   npm run play -- frog --player mine2

// Code's move, with no model call: one thing left (or no questions left), so guess it.
export function codeMove(game) {
  if (game.stillPossible.length === 1 || !game.unasked.length) return 'Guess: ' + game.stillPossible[0];
  return null;
}

export function state(game) {
  return {
    game: 'I am thinking of one thing from `things`. Find it in as few turns as possible.',
    things: game.things,
    answers: game.answers.map(a => `${a.question} ${a.answer}`),
    ...(game.wrongGuesses.length ? { wrong_guesses: game.wrongGuesses } : {}),
    still_possible: game.stillPossible,
    turns_left: game.turnsLeft,
  };
}

export function questions(game) {
  return {
    ask: { type: 'choice', instructions: "Which question splits what's left most evenly?", criteria: Object.fromEntries(game.unasked.map(q => [q, null])) },
  };
}

export function decide(answers, game) {
  return { move: answers.ask.choice, probs: answers.ask.probabilities, why: `${game.stillPossible.length} left → ask` };
}
