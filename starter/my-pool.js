// LEVEL 3 · Make it yours: add things to the pool, or questions to the bank.
//
//   npm run build-table -- --mine
//
// Jev builds the new parts of the answer table: every question about each new thing (one
// request per thing), and each new question about every thing already in the pool. Then it
// prints the table, Jev's unsure answers, and any things no question can tell apart, and
// saves data/twenty/mine.json. While that file exists, play, score and the page use it
// (delete it to go back). Races on your table call Jev live: they need TYPESAFE_API_KEY.
//
// The example below replays recorded answers, so it builds without a key. It fixes a failure
// from Level 3: Jev's answers for "stapler" are the same as for "hammer", so no question in
// the bank can tell them apart. One new question can.
//
// A good new question is one judgment that works for any thing, and splits the pool: yes for
// some, no for others. Read what Jev answered before you race on it.

export const EXTRA_THINGS = ['stapler'];

export const EXTRA_QUESTIONS = ['Is it usually found on a desk?'];

// Answers you pin by hand after reading the table: 'thing | question': 'yes' or 'no'.
export const FIXES = {
};
