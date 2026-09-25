# Production temporary QA fixture

This tool creates a temporary `TEST_TEAM` and ten normal user accounts for real mobile QA. It uses the normal application schema and authentication path; it does not add a test-only API or bypass authorization.

## Before every production run

1. Put the application into the normal deployment maintenance procedure.
2. Create and verify an online SQLite backup using the established production backup runbook.
3. Confirm that the backup timestamp and integrity check are recorded outside the application directory.
4. Run a dry-run and review the counts before running the confirmed command.

Never run the mutating command without a current backup.

## Create

```text
npm run qa:create -- --dry-run
npm run qa:create -- --confirm-production-qa-fixture
```

The fixture is:

- Team: `test` (`TEST_TEAM`), Bowler Hidden enabled, season ranking enabled
- Owner: `test1@local.test`
- Manager: `test2@local.test`
- Members: `test3@local.test` through `test10@local.test`
- Password for all ten accounts: `1234`

The users keep the ordinary `USER` application role. None receives `SUPER_ADMIN`.

Creation stops if the reserved team code, deterministic fixture ids, or email namespace belongs to unknown data. A repeated run is an idempotent no-op only after the complete fixture identity has been verified.

## Remove after phone QA

1. Stop using all ten QA accounts.
2. Create and verify another online SQLite backup.
3. Review the removal inventory:

```text
npm run qa:remove -- --dry-run
```

4. If the counts are expected, remove the fixture:

```text
npm run qa:remove -- --confirm-production-qa-fixture
```

5. Run the removal dry-run again. It should report `not-found` with zero counts.
6. Verify that the ten accounts can no longer refresh or log in and that `TEST_TEAM` is absent.

Removal fails closed if a QA user belongs to another team, a non-QA user belongs to `TEST_TEAM`, or the fixture is linked to center, league, or tournament data. Resolve the contamination manually only after reviewing a fresh backup. Post image paths must pass the shared upload-directory boundary check; database deletion completes before strict filesystem cleanup. Missing image files are safe, while other cleanup failures return a nonzero command result for operational follow-up.
