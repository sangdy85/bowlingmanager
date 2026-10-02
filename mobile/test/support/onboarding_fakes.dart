import 'package:bowlingmanager_mobile/core/storage/onboarding_storage.dart';

class MemoryOnboardingStorage implements OnboardingStorage {
  MemoryOnboardingStorage({this.completed = false, this.intent});

  bool completed;
  OnboardingIntent? intent;
  int readCount = 0;
  int completeCount = 0;
  int consumeCount = 0;

  @override
  Future<void> consumeIntent() async {
    consumeCount += 1;
    intent = null;
  }

  @override
  Future<OnboardingSnapshot> read() async {
    readCount += 1;
    return OnboardingSnapshot(completed: completed, intent: intent);
  }

  @override
  Future<void> complete({OnboardingIntent? intent}) async {
    completeCount += 1;
    this.intent = intent ?? this.intent;
    completed = true;
  }
}
