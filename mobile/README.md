# BowlingManager Mobile

Flutter foundation for the BowlingManager mobile app. This phase contains the
design system, navigation shell, mock screens, API configuration, and secure
storage boundary. It does not call the Mobile API or persist tokens yet.

## API configuration

Development defaults to the Android emulator host:

```text
http://10.0.2.2:3000/api/mobile/v1
```

Production defaults to:

```text
https://bowlingmanager.co.kr/api/mobile/v1
```

Select production or override the URL at build time:

```shell
flutter run --dart-define=APP_ENV=production
flutter run --dart-define=API_BASE_URL=https://example.com/api/mobile/v1
```

## Authentication follow-up

Phase 4 will connect the login API and add a Dio bearer-token interceptor. Its
refresh path must use one shared `RefreshCoordinator` future so concurrent 401
responses cannot rotate the same refresh token more than once. The insertion
point is documented in `lib/core/network/api_client.dart`.
