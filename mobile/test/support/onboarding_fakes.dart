import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';

class MemoryOnboardingStorage implements OnboardingStorage {
  MemoryOnboardingStorage({
    this.completed = false,
    this.intent,
    this.pendingInviteCode,
  });

  bool completed;
  OnboardingIntent? intent;
  String? pendingInviteCode;
  int readCount = 0;
  int completeCount = 0;
  int consumeCount = 0;
  int savePendingInviteCount = 0;
  int clearPendingInviteCount = 0;

  @override
  Future<void> clearPendingInviteCode() async {
    clearPendingInviteCount += 1;
    pendingInviteCode = null;
  }

  @override
  Future<void> consumeIntent() async {
    consumeCount += 1;
    intent = null;
  }

  @override
  Future<OnboardingSnapshot> read() async {
    readCount += 1;
    return OnboardingSnapshot(
      completed: completed,
      intent: intent,
      pendingInviteCode: pendingInviteCode,
    );
  }

  @override
  Future<void> savePendingInviteCode(String code) async {
    savePendingInviteCount += 1;
    pendingInviteCode = normalizePendingInviteCode(code);
  }

  @override
  Future<void> complete({OnboardingIntent? intent}) async {
    completeCount += 1;
    this.intent = intent ?? this.intent;
    completed = true;
  }
}
