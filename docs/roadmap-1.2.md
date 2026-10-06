# BowlingManager 1.2 Roadmap

## Baseline

- Based on v1.1.1
- Development branch: codex/develop-1.2.0

## Development Rules

- P0/P1 production issues are handled in separate hotfix branches.
- P2 and IDEA work belongs to codex/develop-1.2.0.
- Web-only changes do not require Android versionCode changes.
- Any Android binary release after versionCode 5 must use versionCode >= 6.
- Production server must remain on main.
- Never mix unfinished 1.2 work into production hotfixes.

## Planned Work

| ID | Type | Feature / Fix | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- |

## Release Gate

- [ ] Node 20 full tests pass
- [ ] lint 0 errors
- [ ] typecheck pass
- [ ] production build pass
- [ ] Flutter analyze pass
- [ ] Flutter tests pass
- [ ] release AAB signed with existing upload key
- [ ] versionCode checked against Play Console
- [ ] production DB backup before migrations
- [ ] Prisma migration status verified
- [ ] production smoke tests passed
