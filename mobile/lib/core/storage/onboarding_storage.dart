import 'package:shared_preferences/shared_preferences.dart';

const String growthOnboardingCompletedKey = 'growth_onboarding_completed_v1';
const String growthOnboardingIntentKey = 'growth_onboarding_intent_v1';

enum OnboardingIntent {
  personal('personal'),
  joinClub('join_club'),
  manageClub('manage_club');

  const OnboardingIntent(this.storageValue);

  final String storageValue;

  static OnboardingIntent? fromStorage(String? value) {
    for (final OnboardingIntent intent in values) {
      if (intent.storageValue == value) return intent;
    }
    return null;
  }
}

class OnboardingSnapshot {
  const OnboardingSnapshot({required this.completed, this.intent});

  final bool completed;
  final OnboardingIntent? intent;
}

abstract interface class OnboardingStorage {
  Future<OnboardingSnapshot> read();

  Future<void> complete({OnboardingIntent? intent});

  Future<void> consumeIntent();
}

class SharedPreferencesOnboardingStorage implements OnboardingStorage {
  @override
  Future<void> consumeIntent() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.remove(growthOnboardingIntentKey);
  }

  @override
  Future<OnboardingSnapshot> read() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    return OnboardingSnapshot(
      completed: preferences.getBool(growthOnboardingCompletedKey) ?? false,
      intent: OnboardingIntent.fromStorage(
        preferences.getString(growthOnboardingIntentKey),
      ),
    );
  }

  @override
  Future<void> complete({OnboardingIntent? intent}) async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    if (intent != null) {
      await preferences.setString(
        growthOnboardingIntentKey,
        intent.storageValue,
      );
    }
    await preferences.setBool(growthOnboardingCompletedKey, true);
  }
}
