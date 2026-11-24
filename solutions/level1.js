// MINE · LEVEL 1 · Ask for the move.
//
// My first 20 Questions player: one Choice, "What is your next move?", over every legal move
// (each unasked question and each guess), and code plays whatever Jev ranks first. It's the
// same file you start from in starter/level1.js.
//
//   npm run play -- frog --player mine1

export function state(game) {
  return {
    game: 'I am thinking of one thing from `things`. Find it in as few turns as possible.',
    things: game.things,
    answers: game.answers.map(a => `${a.question} ${a.answer}`),
    ...(game.wrongGuesses.length ? { wrong_guesses: game.wrongGuesses } : {}),
    turns_left: game.turnsLeft,
  };
}

export function questions(game) {
  return {
    move: { type: 'choice', instructions: 'What is your next move?', criteria: Object.fromEntries(game.moves.map(m => [m, null])) },
  };
}

export function decide(answers) {
  return { move: answers.move.choice, probs: answers.move.probabilities };
}
