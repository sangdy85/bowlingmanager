
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/league-templates.ts');
const fileContent = fs.readFileSync(filePath, 'utf-8');

// Regex to find the 16-team object: `16: { ... }` or at least the `rounds` property of it.
// Simpler: assume the file is structured nicely (it is) and we can grab the block.
// Let's use string manipulation for safety.

const index16Start = fileContent.indexOf('16: {');
if (index16Start === -1) {
    console.error("Could not find 16-team block.");
    process.exit(1);
}

// Find rounds '['
const roundsStart = fileContent.indexOf('rounds: [', index16Start);
if (roundsStart === -1) {
    console.error("Could not find rounds start.");
    process.exit(1);
}

const roundsContentStart = roundsStart + 'rounds: ['.length;

// Find closing ']' for rounds - this is tricky with nested braces.
let depth = 1; // start inside rounds [
let i = roundsContentStart;
while (i < fileContent.length && depth > 0) {
    if (fileContent[i] === '[') depth++;
    else if (fileContent[i] === ']') depth--;
    i++;
}

const roundsString = fileContent.substring(roundsContentStart, i - 1); // remove last ']'

// Now parse roundsString.
// Replace `teamA:` with `"teamA":`, etc. to make it valid JSON-ish and eval it
// Or eval it as JS object because `{ ... }` works in JS.
// We must be careful with eval but for verification it's fine.
const parsedRounds = eval(`[${roundsString}]`);

console.log("Verifying 16-Team Schedule...");

const fmt = (m) => `${m.teamA}-${m.teamB}`;

// Rounds to verify against image
const verify = (roundIdx, expected) => {
    const r = parsedRounds[roundIdx];
    const actual = r.map(fmt).join(", ");
    console.log(`\nRound ${roundIdx + 1} (Idx ${roundIdx})`);
    console.log(`Expected: ${expected}`);
    console.log(`Actual  : ${actual}`);
    if (expected.replace(/ /g, '') === actual.replace(/ /g, '')) {
        console.log("✅ MATCH");
    } else {
        console.log("❌ MISMATCH");
    }
}

// Round 2 (Idx 1)
verify(1, "13-12, 6-15, 8-3, 10-5, 11-7, 9-2, 1-16, 4-14");

// Round 5 (Idx 4)
verify(4, "8-5, 2-12, 13-1, 14-16, 15-4, 6-3, 10-7, 9-11");
// Actually from image: 8-5, 2-12, 13-1, 14-16, 15-4, 6-3, 10-7, 9-11 (Checks out)

// Round 12 (Idx 11) - Wait, Image Round 12 is My Round 12?
// Image Round 12: 11-10, 13-2, 16-4, 5-15, 7-3, 8-6, 9-1, 14-12.
// My previous log logic was confusing. Let's just check the index that matches.
// In image round 12 is the 12th row.
// In 0-indexed array, that's index 11.
// Let's print index 10 (Round 11) and 11 (Round 12) to be sure.
verify(10, "11-10, 13-2, 16-4, 5-15, 7-3, 8-6, 9-1, 14-12"); // This matches Image Round 12 which is index 10? No Image rounds are 1-16.
// Image Round 1 (Date 1) -> Index 0.
// Image Round 12 (Date 12) -> Index 11.
verify(11, "10-15, 4-8, 1-13, 14-11, 2-5, 3-7, 12-6, 16-9"); // Wait, this one (Idx 11) is confusing.
// Let's see what is printed.
