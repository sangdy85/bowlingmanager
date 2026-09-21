# Mobile Dashboard Phase 5.1

## Shared web definition

`src/lib/personal-statistics.ts` owns the three reads and normalized integrated
records. `/personal` and the mobile dashboard both use it. Web annual selection,
profile calculations, official group tables and the other statistics rows stay
in the page. The target is the **통합 종합 (공식+개인 전체)** row, not the profile's
총평균 or team rankings.

- Personal: exact userId, selected UTC year, all teams, excluding only 벙개.
- League: the web's existing user/name/active-team predicates; positive raw
  score1/2/3 games plus the row's handicap.
- Tournament: the web's existing registration user/name/active-team predicates;
  every selected score plus registration handicap.
- No 0–300 filter or cross-source deduplication: preserve the web population.
  Handicap-adjusted values can exceed 300. Stored negative values are also not
  silently removed; this follows the existing web calculation.
- Average uses JavaScript `Number(value.toFixed(1))`, matching StatsDisplayRow's
  displayed precision. Highest score and game count use the same records.
- Recent records use event date descending, then namespaced ID ascending, take 10.
  Recent average is mobile-only, also rounded to one decimal.

The legacy name fallback can match a different/null userId using a name substring
and matching team ID/name. This is preserved for parity, not strengthened identity
proof. Same-name attribution should be addressed separately on both web and API.
Official records without a dated round do not pass the original year predicate.

## GET /api/mobile/v1/dashboard

Bearer/session handling is unchanged. Optional `year` must be one occurrence of
four ASCII digits, 1900–2100 inclusive. Missing year uses the server's current
year (`new Date().getFullYear()`). Invalid input returns 400 with
`{success:false,error:{code:"INVALID_YEAR",message:"..."}}`.
UTC boundaries are Jan 1 00:00:00.000Z through Dec 31 23:59:59.999Z, exactly as
the web page. The web's default remains latest active year; compare explicit years.

Success example (synthetic data):

```json
{
  "success": true,
  "data": {
    "year": 2026,
    "average": 310,
    "highScore": 310,
    "gameCount": 1,
    "recentAverage": 310,
    "recentScores": [{
      "id": "LEAGUE:example:1",
      "source": "LEAGUE",
      "score": 310,
      "gameDate": "2026-06-01T00:00:00.000Z",
      "gameType": "상주리그",
      "memo": null,
      "team": {"id": "example-team", "name": "Example team"}
    }]
  }
}
```

Sources/IDs: PERSONAL:<Score id>, LEAGUE:<row id>:<1-based game>,
TOURNAMENT:<TournamentScore id>. JSON numbers do not preserve trailing zeroes;
Flutter displays averages with one decimal.
Personal gameType/memo/team preserve database nulls. Official memo is null.
League label is 상주리그; tournament label is 이벤트전 for EVENT, otherwise 챔프전.
Tournament team is null if no real Team relation exists; guest team text is not
presented as a fabricated team ID.

Flutter preserves year, validates source via an enum, rejects unknown/missing
sources as malformed, and shows 개인/리그/대회. It uses the existing protected Dio.
The chart displays the latest seven games oldest-to-newest; cards show the latest
three; recentAverage always summarizes the API's latest ten (or fewer).
`GET /scores` retains its original Score-only contract and is not the integrated
dashboard's record feed. Records/Capture/Club screens are outside this change.

## Verification

Backend, without database access or writes:

```text
node --test tests/personal-statistics.test.cjs
npx prisma generate
npm run build
```

Tests use in-memory Prisma fixtures and the pre-extraction web calculation as
an oracle. They exercise filters, identity rules, boundaries, handicaps, mixed
sources, deterministic recent ten, empty data and the route's 400/200 envelopes.
They are not a live SQLite or production integration test.

Flutter:

```text
dart format lib test
flutter analyze --no-pub
flutter test
flutter build apk --debug
```

## Read-only comparison for a selected account/year

No production data or schema change is needed. Before deployment, use the fixture
suite or an authorized read-only replica with the candidate code. After the
candidate API is available, sign into the same account in the web browser and
open `/personal?year=2026`. Compare its integrated row's average, single-game high,
and games with `/api/mobile/v1/dashboard?year=2026`.

This browser-console snippet uses the existing web session, performs only GET,
and prints numeric summaries only (no tokens, IDs, names, or raw response):

```js
const requestedYear = 2026;
const response = await fetch(`/api/mobile/v1/dashboard?year=${requestedYear}`, {
  credentials: 'same-origin', cache: 'no-store'
});
const envelope = await response.json();
if (!response.ok || envelope.success !== true) throw new Error('Dashboard check failed');
const { year, average, highScore, gameCount, recentAverage } = envelope.data;
console.table([{ year, average, highScore, gameCount, recentAverage }]);
```

Expect the first three statistics to equal the web integrated row for that year.
Recent average has no web counterpart. Check a user with personal/league/tournament
records and another with no records. Do not compare to the profile's total average.
The old deployed API has no year/source fields; it must not be mistaken for the
candidate API. No deployment is performed by this implementation task.

## Remaining limits

- Web and mobile defaults select different years by product instruction.
- Legacy substring/name attribution can include ambiguous records.
- Queries are consecutive reads, not a snapshot transaction; concurrent score
  edits during requests can make two separately fetched pages differ.
- Annual records are materialized for parity; monitor large annual datasets.
- Updated Flutter requires the new year/source contract. Coordinate release of
  backend and app; existing Phase 5 parsers also reject scores above 300.
