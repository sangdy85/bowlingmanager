# Mobile notifications (QA-046)

The Android client uses Firebase Cloud Messaging for competition-operation push notifications. Notification records and per-device delivery rows form a transactional outbox; business mutations only write database rows and never wait for Firebase.

## Required deployment configuration

- Backend: set `FIREBASE_SERVICE_ACCOUNT_JSON` to the complete service-account JSON through the deployment secret store. Never add it to Git or a Flutter build.
- Backend worker: set a high-entropy `MOBILE_PUSH_WORKER_SECRET`. A trusted scheduler calls `POST /api/internal/mobile-notifications/deliver` with `Authorization: Bearer <secret>` at least once per minute.
- Android: add the real Firebase Android app configuration as `mobile/android/app/google-services.json` through the protected release pipeline, apply the Google Services Gradle plugin required by FlutterFire, and build with `--dart-define=FCM_ENABLED=true`.
- The repository intentionally contains no Firebase project identifier, API key, service-account key, or placeholder credential. Without release configuration, the app reports that Firebase configuration is required and all existing app features remain available.

The worker atomically claims each due delivery as `PROCESSING` before contacting FCM, so overlapping worker runs do not send the same row twice. A five-minute claim lease allows a later run to recover work after a crashed worker. Transient failures use bounded exponential delay. Invalid or unregistered FCM tokens disable only the affected device. Notification bodies, routing context, and safe provider error codes are stored; provider responses and credentials are not stored.

## API

- `POST /api/mobile/v1/push/devices`: register or refresh the current user's Android token.
- `DELETE /api/mobile/v1/push/devices`: revoke the current user's token before logout.
- `GET /api/mobile/v1/notifications`: list only the current user's notifications.
- `POST /api/mobile/v1/notifications/{id}/read`: mark only the current user's notification as read.

FCM payload navigation uses `type`, `teamId`, `eventId`, and `target`. A tap while logged out is retained in memory and opened after authentication succeeds.
