// MINE · LEVEL 2, one TODO at a time: the starter with TODO 1 done, then TODOs 1 and 2.
// (All three done is solutions/level2.js.) `npm test` checks each one's score, and the
// recordings replay, so a matching edit of yours replays too.
//
//   starter as shipped            never guesses until the turns run out
//   step1: + code's move          code guesses when one thing is left
//   step2: + the state            Jev sees `still_possible`
//   mine (solutions/level2.js):   + the question: "Which question splits what's left most evenly?"
import * as mine from './level2.js';

const starterQuestions = game => ({
  ask: { type: 'choice', instructions: 'Which question should I ask next?', criteria: Object.fromEntries(game.unasked.map(q => [q, null])) },
});
const starterState = game => {
  const { still_possible, ...rest } = mine.state(game);
  return rest;
};

export const step1 = { codeMove: mine.codeMove, state: starterState, questions: starterQuestions, decide: mine.decide };
export const step2 = { codeMove: mine.codeMove, state: mine.state, questions: starterQuestions, decide: mine.decide };
