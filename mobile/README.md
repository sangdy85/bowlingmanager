# BowlingManager Mobile

Flutter client for BowlingManager's authenticated Mobile API, including the
dashboard, score records, scoreboard capture, club, and profile experiences.

## API configuration

Development defaults to the Android emulator host:

```text
http://10.0.2.2:3000/api/mobile/v1
```

Production defaults to:

```text
https://bowlingmanager.co.kr/api/mobile/v1
```

Debug builds default to development and can select production or override the
URL at build time:

```shell
flutter run
flutter run --dart-define=APP_ENV=production
flutter run --dart-define=API_BASE_URL=https://example.com/api/mobile/v1
```

Release builds default to production, so the standard APK command is:

```shell
flutter build apk --release
```

`APP_ENV=development` cannot switch a release build to the emulator URL. A
release `API_BASE_URL` override is accepted only when it is a valid HTTPS URL.

## Android release signing

The current release build is signed with the debug key for local installation.
Before Google Play distribution, create a private upload keystore outside Git,
store its path and credentials in ignored `android/key.properties`, configure a
release signing config, and keep the keystore and passwords out of the source
tree.

## Authentication

The app uses the Mobile API access/refresh token flow. Concurrent 401 responses
share one `RefreshCoordinator` operation so a refresh token is rotated once.
