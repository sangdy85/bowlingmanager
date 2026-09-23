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

Debug builds continue to use Android's debug signing key:

```shell
flutter build apk --debug
```

Release builds never fall back to the debug signing key. The following command
requires a complete local `android/key.properties` file and an existing external
keystore; otherwise Gradle stops with a production-signing error:

```shell
flutter build apk --release
```

### Create the upload keystore on Windows

Keep the keystore outside the repository. The recommended per-user location is
`~/.bowlingmanager/keys`, which resolves under the current Windows user profile.
In PowerShell, create an RSA 4096-bit upload key with a 10,000-day validity:

```powershell
$keyDirectory = Join-Path $env:USERPROFILE ".bowlingmanager\keys"
New-Item -ItemType Directory -Force -Path $keyDirectory

$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
& $keytool -genkeypair -v `
  -keystore (Join-Path $keyDirectory "bowlingmanager-upload.jks") `
  -alias bowlingmanager-upload `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

`keytool` prompts for passwords and certificate details. Do not put passwords
on the command line, where they can remain in shell history.

Create the ignored local file `android/key.properties` with your local values:

```properties
storeFile=~/.bowlingmanager/keys/bowlingmanager-upload.jks
storePassword=<your-store-password>
keyPassword=<your-key-password>
keyAlias=bowlingmanager-upload
```

The Gradle configuration expands a leading `~/` using the Java user home. The
file must define all four entries and the referenced keystore must exist.
`android/.gitignore` excludes `key.properties`, `*.jks`, and `*.keystore`.

For CI, restore the encrypted keystore during the job and generate
`key.properties` from CI secrets. Remove both after the build; never commit them
or print their contents in logs.

### Google Play App Signing

Use this keystore as the **upload key**. It signs the AAB submitted by the
developer or CI. With Google Play App Signing enabled, Google protects the
separate **app signing key** and uses it to sign APKs delivered to users. Keep
the upload key even after enrollment because future releases must still be
authenticated. Follow Google's upload-key reset process if it is compromised or
lost; that does not replace the Play-managed app signing key.

### Backup policy

Keep at least one encrypted backup on storage separate from the development PC.
Record the alias and passwords in a password manager, and test that the backup
can be opened. Do not store an unencrypted backup, passwords, certificates with
private keys, or recovery notes in this repository.

## Authentication

The app uses the Mobile API access/refresh token flow. Concurrent 401 responses
share one `RefreshCoordinator` operation so a refresh token is rotated once.
