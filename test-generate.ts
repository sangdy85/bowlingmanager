import { generateLeagueSchedule } from "./src/app/actions/league-actions";

async function run() {
    try {
        console.log("Testing generation...");
        const res = await generateLeagueSchedule("dummy-id", ["t1", "t2", "t3", "t4"], 1, 4, [], undefined, 1, []);
        console.log("Result:", res);
    } catch(e) {
        console.error("Uncaught exception:", e);
    }
}
run();
