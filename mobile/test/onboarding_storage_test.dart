import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  for (final OnboardingIntent intent in OnboardingIntent.values) {
    test('stores ${intent.storageValue} intent and completion', () async {
      final SharedPreferencesOnboardingStorage storage =
          SharedPreferencesOnboardingStorage();

      await storage.complete(intent: intent);

      final OnboardingSnapshot snapshot = await storage.read();
      final SharedPreferences preferences =
          await SharedPreferences.getInstance();
      expect(snapshot.completed, isTrue);
      expect(snapshot.intent, intent);
      expect(preferences.getBool(growthOnboardingCompletedKey), isTrue);
      expect(
        preferences.getString(growthOnboardingIntentKey),
        intent.storageValue,
      );
    });
  }

  test('completed onboarding remains completed on relaunch', () async {
    await SharedPreferencesOnboardingStorage().complete(
      intent: OnboardingIntent.personal,
    );

    final OnboardingSnapshot relaunched =
        await SharedPreferencesOnboardingStorage().read();

    expect(relaunched.completed, isTrue);
    expect(relaunched.intent, OnboardingIntent.personal);
  });

  test('existing-account path completes without inventing an intent', () async {
    final SharedPreferencesOnboardingStorage storage =
        SharedPreferencesOnboardingStorage();

    await storage.complete();

    final OnboardingSnapshot snapshot = await storage.read();
    expect(snapshot.completed, isTrue);
    expect(snapshot.intent, isNull);
  });

  test(
    'consuming an intent preserves completion and clears only the intent',
    () async {
      final SharedPreferencesOnboardingStorage storage =
          SharedPreferencesOnboardingStorage();
      await storage.complete(intent: OnboardingIntent.joinClub);

      await storage.consumeIntent();

      final OnboardingSnapshot snapshot = await storage.read();
      expect(snapshot.completed, isTrue);
      expect(snapshot.intent, isNull);
    },
  );

  test(
    'pending invite is normalized, survives relaunch, and clears alone',
    () async {
      final SharedPreferencesOnboardingStorage storage =
          SharedPreferencesOnboardingStorage();
      await storage.complete(intent: OnboardingIntent.joinClub);

      await storage.savePendingInviteCode(' a1b2c3 ');

      final OnboardingSnapshot relaunched = await storage.read();
      expect(relaunched.pendingInviteCode, 'A1B2C3');
      expect(relaunched.intent, OnboardingIntent.joinClub);
      await storage.clearPendingInviteCode();

      final OnboardingSnapshot cleared = await storage.read();
      expect(cleared.pendingInviteCode, isNull);
      expect(cleared.completed, isTrue);
      expect(cleared.intent, OnboardingIntent.joinClub);
    },
  );

  test(
    'pending invite rejects values outside the six-character format',
    () async {
      final SharedPreferencesOnboardingStorage storage =
          SharedPreferencesOnboardingStorage();
      await expectLater(
        storage.savePendingInviteCode('../secret'),
        throwsFormatException,
      );
      expect((await storage.read()).pendingInviteCode, isNull);
    },
  );
}
