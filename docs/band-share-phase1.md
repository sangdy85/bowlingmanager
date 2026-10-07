# BAND Share Phase 1

## Scope

Phase 1 adds operator-confirmed BAND sharing to the existing league weekly result screen.

Included:

- BAND OAuth connection and disconnect
- encrypted access/refresh token storage
- joined BAND list
- posting permission verification
- editable text preview before every publish
- weekly league result text generation
- success/failure history
- retry of a previous post
- existing four PNG result downloads remain unchanged

Not included:

- automatic posting triggered by status changes
- automatic image upload to BAND
- background/cron posting
- mobile BAND integration
- Champ/Event BAND sharing (planned after the common layer is verified)

## BAND API notes

The official BAND Open API documents OAuth 2.0 authorization, joined-BAND lookup,
posting-permission lookup, and text post creation.

The documented post-create endpoint accepts:

- access_token
- band_key
- content
- do_push

The public post-create documentation does not expose an image-upload parameter.
For that reason Phase 1 keeps the existing four downloadable report images and
automates the text post only. Do not depend on undocumented attachment behavior.

New BAND Developer applications require preliminary review before a Client ID and
Client Secret are issued. Existing approved clients follow BAND's current policy.

## Required production environment

Add these values to the production server `.env`:

```dotenv
BAND_CLIENT_ID=...
BAND_CLIENT_SECRET=...
BAND_REDIRECT_URI=https://www.bowlingmanager.co.kr/api/integrations/band/callback
BAND_TOKEN_ENCRYPTION_KEY=...
```

Generate a 32-byte base64 encryption key with Node 20:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the encryption key stable after connections are created. Replacing it makes
stored BAND tokens unreadable and requires operators to reconnect.

## BAND Developer registration

Register the production domain and configure the OAuth redirect URI so that BAND
can return the authorization code to:

```text
https://www.bowlingmanager.co.kr/api/integrations/band/callback
```

The OAuth connect route is:

```text
GET /api/integrations/band/connect
```

The official OAuth authorization interface documents response_type, client_id and
redirect_uri. It does not document a returned state parameter. BowlingManager
therefore stores the pending flow in a short-lived HTTP-only cookie signed with
`AUTH_SECRET` and verifies the signed user/session binding in the callback.

Access and refresh tokens are encrypted before database persistence and are never
returned to the browser.

## Database

Migration:

```text
20261007120000_add_band_sharing
```

Adds:

- `BandConnection`
- `BandShareLog`

The migration is additive. No existing tables or columns are removed.

Before production migration, follow the existing SQLite backup and
`PRAGMA integrity_check` release procedure.

## Permissions

The BAND connection belongs to the authenticated BowlingManager user.

Publishing a league weekly result additionally requires the existing bowling
center administrator check for the selected tournament. Before each post the
server also:

1. decrypts the current user's BAND access token;
2. fetches BAND groups joined by that BAND account;
3. confirms the selected `band_key` belongs to that account;
4. calls BAND posting-permission API for `posting`;
5. creates the post only after all checks pass.

Retry performs the checks again.

## Weekly result content

The generated text includes:

- tournament name and week
- team standings
- weekly matchup results
- individual average TOP 10
- configured report notice when present

The operator can edit the complete body before publishing.

The existing `WeeklyResultDownloader` four-image workflow remains available:

- team standings and awards
- individual ranking by team
- match record sheet
- individual average TOP 30

## Release checklist

1. Apply the migration to a verified database backup first.
2. Configure the four BAND environment values.
3. Run `npm ci`.
4. Run Node tests.
5. Run `npm run build`.
6. Confirm BAND connect/disconnect.
7. Confirm joined BAND list.
8. Confirm a BAND without posting permission is rejected.
9. Preview one weekly result and edit the body.
10. Publish with `do_push` disabled first.
11. Confirm history records SUCCESS.
12. Retry the history row and confirm a second post is created.
13. Verify existing four image downloads still work.
