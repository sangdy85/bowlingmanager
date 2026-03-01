// Mocking functions from tournament-utils.ts
function parseKSTDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    const dateString = String(dateInput);

    if (dateString.includes('Z') || (dateString.includes('+') && dateString.length > 19)) {
        return new Date(dateString);
    }

    let formatted = dateString;
    if (dateString.length === 10) {
        formatted = `${dateString}T00:00`;
    } else if (dateString.length === 16) {
        formatted = `${dateString}:00`;
    }

    const date = new Date(`${formatted}+09:00`);
    return isNaN(date.getTime()) ? null : date;
}

function formatKSTDate(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    const y = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    const h = String(kst.getUTCHours()).padStart(2, '0');
    const m = String(kst.getUTCMinutes()).padStart(2, '0');

    return `${y}. ${parseInt(mm)}. ${parseInt(d)}. ${h}:${m}`;
}

function getEffectiveRoundDate(roundDate, leagueTime, tournamentType) {
    if (!roundDate) return null;
    const date = new Date(roundDate);
    if (isNaN(date.getTime())) return null;

    const kst = new Date(date.getTime() + 9 * 60 * 60000);
    const h = kst.getUTCHours();
    const m = kst.getUTCMinutes();

    if (h !== 0 || m !== 0) {
        return date;
    }

    // For EVENT type, we ALWAYS respect the date field time even if it's 00:00.
    if (tournamentType === 'EVENT') {
        return date;
    }

    if (leagueTime && leagueTime.includes(':')) {
        const [targetH, targetM] = leagueTime.split(':').map(Number);
        const y = kst.getUTCFullYear();
        const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
        const d = String(kst.getUTCDate()).padStart(2, '0');
        const hh = String(isNaN(targetH) ? 0 : targetH).padStart(2, '0');
        const min = String(isNaN(targetM) ? 0 : targetM).padStart(2, '0');
        return new Date(`${y}-${mm}-${d}T${hh}:${min}:00+09:00`);
    }

    return date;
}

function test(label, inputDateStr, leagueTime, tournamentType) {
    console.log(`=== Test: ${label} ===`);
    console.log(`Input String: "${inputDateStr}"`);
    console.log(`League Time: "${leagueTime}"`);
    console.log(`Type: "${tournamentType || 'LEAGUE'}"`);

    const parsed = parseKSTDate(inputDateStr);
    console.log(`Parsed (UTC): ${parsed ? parsed.toISOString() : 'null'}`);

    const effective = getEffectiveRoundDate(parsed, leagueTime, tournamentType);
    console.log(`Effective (UTC): ${effective ? effective.toISOString() : 'null'}`);

    const formatted = formatKSTDate(effective);
    console.log(`Formatted (KST): ${formatted}`);
    console.log("");
}

// 1. Event normal case (18:00)
test("Event 18:00", "2026-03-02T18:00", null, "EVENT");

// 2. Event midnight case (00:00)
test("Event 00:00", "2026-03-02T00:00", null, "EVENT");

// 3. League midnight case with leagueTime
test("League 00:00 with 19:30", "2026-03-02T00:00", "19:30", "LEAGUE");

// 4. Case where leagueTime is incorrectly set for Event
test("Event 18:00 with accidental 00:00 leagueTime", "2026-03-02T18:00", "00:00", "EVENT");

// 5. Case where date is saved as 00:00 and leagueTime is 19:30
test("Event 00:00 with accidental 19:30 leagueTime", "2026-03-02T00:00", "19:30", "EVENT");

// 6. Case where input is already ISO (e.g. from JSON settings)
test("ISO string from settings", "2026-03-02T09:00:00.000Z", null, "EVENT");
