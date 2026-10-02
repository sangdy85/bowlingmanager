import 'package:shared_preferences/shared_preferences.dart';

const String growthOnboardingCompletedKey = 'growth_onboarding_completed_v1';
const String growthOnboardingIntentKey = 'growth_onboarding_intent_v1';
const String growthPendingInviteCodeKey = 'growth_pending_invite_code_v1';

String? normalizePendingInviteCode(Object? value) {
  if (value is! String) return null;
  final String code = value.trim().toUpperCase();
  return RegExp(r'^[A-Z0-9]{6}$').hasMatch(code) ? code : null;
}

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
  const OnboardingSnapshot({
    required this.completed,
    this.intent,
    this.pendingInviteCode,
  });

  final bool completed;
  final OnboardingIntent? intent;
  final String? pendingInviteCode;
}

abstract interface class OnboardingStorage {
  Future<OnboardingSnapshot> read();

  Future<void> complete({OnboardingIntent? intent});

  Future<void> consumeIntent();

  Future<void> savePendingInviteCode(String code);

  Future<void> clearPendingInviteCode();
}

class SharedPreferencesOnboardingStorage implements OnboardingStorage {
  @override
  Future<void> clearPendingInviteCode() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.remove(growthPendingInviteCodeKey);
  }

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
      pendingInviteCode: normalizePendingInviteCode(
        preferences.getString(growthPendingInviteCodeKey),
      ),
    );
  }

  @override
  Future<void> savePendingInviteCode(String code) async {
    final String? normalized = normalizePendingInviteCode(code);
    if (normalized == null) {
      throw const FormatException('Invalid team invite code.');
    }
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(growthPendingInviteCodeKey, normalized);
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
