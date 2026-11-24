// LEVEL 1 · Ask for the move.
//
// The first player most people write: give Jev the game, ask "What is your next move?" as one
// Choice over every legal move (each unasked question and each guess), and play the top one.
// Run it, read what it does, and decide whether it's a good question.
//
//   npm run play -- frog --player level1   a race in the terminal
//   npm run score -- --player level1       turns, time and cost on the 9 score secrets
//   npm run app                            the race page (pick "Your Level 1" for the Yours lane)
//
// The unedited file replays Jev's recorded answers, so it works without a key. Once you change
// the state or the question, Jev answers fresh: that needs TYPESAFE_API_KEY in .env.
//
// A player is a few functions:
//   state(game)             what Jev sees: JSON your code builds
//   questions(game)         the typed questions Jev answers about that state, in one request
//   decide(answers, game)   turns Jev's answers into a move
//   codeMove(game)          optional: a move code makes alone, with no Jev call (or null)
//
// `game` is everything code knows this turn:
//   game.things          the 100 things in the pool (plus a typed thing, if any)
//   game.answers         [{ question, answer: 'yes' | 'no' }] so far, for this secret
//   game.wrongGuesses    things guessed wrong
//   game.unasked         questions not asked yet
//   game.unguessed       things not guessed yet
//   game.stillPossible   things that fit every answer so far (code crossed off the rest)
//   game.turnsLeft       out of 20
//   game.moves           every legal move as text: each unasked question, and 'Guess: <thing>'
//
// To discuss:
//   - Could a smart person, shown only this state, answer "What is your next move?" at a glance?
//   - What does code already know that Jev is being asked to work out?

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
