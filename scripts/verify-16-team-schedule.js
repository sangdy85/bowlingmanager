const { LEAGUE_TEMPLATES } = require('../src/lib/league-templates.dummy');

const rounds = LEAGUE_TEMPLATES[16].rounds;

console.log("Verifying 16-Team Schedule...");

// Helper to format a match
const fmt = (m) => `${m.teamA}-${m.teamB}`;

// Check Round 2 (Index 1)
const r2 = rounds[1];
console.log("Round 2 (Should be: 13-12, 6-15, 8-3, 10-5, 11-7, 9-2, 1-16, 4-14)");
console.log("Actual : " + r2.map(fmt).join(", "));

// Check Round 12 (Index 11, User Round 13) - Wait, my index 11 corresponds to User Round 13?
// No. Array Index 0 = User Round 1.
// Array Index 8 = User Round 10.
// Array Index 10 = User Round 12.
const r12 = rounds[10];
console.log("Round 12 (Should be: 11-10, 13-2, 16-4, 5-15, 7-3, 8-6, 9-1, 14-12)");
console.log("Actual  : " + r12.map(fmt).join(", "));

// Check Round 16 (Index 14)
const r16 = rounds[14];
console.log("Round 16 (Should be: 16-8, 14-5, 10-2, 9-7, 4-6, 3-1, 12-15, 11-13)");
console.log("Actual  : " + r16.map(fmt).join(", "));
