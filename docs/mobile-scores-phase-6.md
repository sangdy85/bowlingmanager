# Mobile Scores Phase 6

## Existing API contract

`GET /api/mobile/v1/scores?page=<page>&limit=<limit>` uses the existing mobile
Bearer/session authentication helper. A request can only read `Score` rows whose
`userId` equals the authenticated user ID. It does not include resident league or
tournament score models.

- `page` defaults to 1 and `limit` defaults to 20.
- Non-positive, non-integer or otherwise invalid values use their defaults.
- `limit` is capped at 100.
- Rows are filtered to stored scores from 0 through 300 inclusive.
- Ordering is `gameDate DESC`, then `createdAt DESC`.
- Only `id`, `score`, `gameDate`, nullable `gameType`, nullable `memo`, and the
  nullable team `{id,name}` are selected.
- An empty result is successful with `items: []`, `total: 0`, and
  `totalPages: 0`.

Success response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "synthetic-score-id",
        "score": 215,
        "gameDate": "2026-09-15T00:00:00.000Z",
        "gameType": "정기전",
        "memo": null,
        "team": {"id": "synthetic-team-id", "name": "테스트 팀"}
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

## Flutter behavior

The Records screen uses the existing protected Dio client, including its Bearer
interceptor, single-flight refresh and one-time 401 retry. The provider is keyed
by authenticated user ID and auto-disposed so another account cannot reuse the
previous account's list.

Each API item is shown as one record. The schema has no match/session grouping
key, so records are not grouped merely because they share a date. Dates are
formatted from the parsed API value without converting to the device timezone.

Page 1 uses limit 20. A **더 보기** button loads the next page. Requests are
blocked while a page is loading and after the final page; duplicate IDs are not
appended. A pagination failure preserves existing items and provides a retry.
Pull-to-refresh reloads page 1 and replaces the list only after success.

The screen handles initial loading, data, empty results, initial errors,
loading-more, pagination errors and refresh errors. Capture and Club remain out
of scope. Integrated personal/league/tournament history requires a separate,
explicit API contract in a later phase.
