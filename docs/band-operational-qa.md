# NAVER BAND integration — pre-release operational QA

**Status:** development only. Do not merge PR #8 to main or run production migration/deployment until NAVER BAND approval and an explicit release decision.

## Local verification (Windows PowerShell)

```powershell
cd C:\bmrc
git fetch origin
git pull --ff-only origin codex/develop-band-next
node --test tests/band-integration.test.cjs tests/band-post-preview.test.cjs tests/band-operational-qa.test.cjs
npx prisma validate
git diff --check origin/main...HEAD
npm.cmd run build
git status --short
```

The build generates Prisma Client before TypeScript type checking. Local QA must not require posting to a real BAND.

## Admin safety checklist

- A regular user and a manager of a different bowling center cannot preview or publish another center's post.
- New OAuth connections start with both automatic posting switches **off**; the administrator must explicitly enable them.
- In the tournament and round views, manual posting requires preview, review of target BAND, content, notification setting, and confirmation.
- Preview approvals are server-signed, bound to the manager and all publication data, and expire after 15 minutes.
- If underlying content, BAND selection, notification settings or the latest publication status changes, repeat the preview.
- No publication may exceed the **internal** 16,000 UTF-8 byte guard; the application rejects oversized posts rather than truncating them. This is **not** presented as NAVER BAND's officially documented maximum.
- For LEAGUE, only finished weekly match results have a manual publishing control; overall league tournament status transitions must not post generic recruitment or final-result notices.
- For CHAMP/EVENT, verify participants, lane assignment and final-result previews using a dedicated non-production dataset.
- Before allowing actual test posts after approval, double-check that notifications (`doPush`) are disabled when testing.

## Unknown-delivery recovery

A failed request **after outbound transmission started** may have already created a BAND post.

1. Never click Repost while the latest status is `UNKNOWN` or `PENDING`.
2. Have a bowling-center administrator open the target BAND and compare the displayed text with the stored publication snapshot.
3. For `PENDING`, wait at least 30 minutes before manually resolving; the request may still be executing.
4. If the post exists, check **게시됨 확인**. This records a manual verification and prevents automatic retry.
5. If the post definitely does not exist, check **게시되지 않음 확인**. A fresh preview is then required before retrying.
6. Both actions require explicit acknowledgment, confirm dialog and server-side center-admin verification; only the latest uncertain revision can be resolved.
7. Never resolve uncertainty by deleting the `BandPost` row or running unrestricted SQL on production.

## Release boundary

Before merging the Draft PR: run all tests, review OAuth scope and token storage, verify connection settings on a staging DB, and complete a controlled external BAND posting test **only after official approval**. Back up the production SQLite database before any approved migration. Keep migration, OAuth keys and token secret out of production until release.
