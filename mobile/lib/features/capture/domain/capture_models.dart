import 'dart:typed_data';

class CaptureImageData {
  const CaptureImageData({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
  });

  final Uint8List bytes;
  final String fileName;
  final String mimeType;
}

class CaptureMember {
  const CaptureMember({required this.id, required this.name});

  final String id;
  final String name;

  factory CaptureMember.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    if (id is! String || id.isEmpty || name is! String || name.isEmpty) {
      throw const FormatException('Invalid capture member.');
    }
    return CaptureMember(id: id, name: name);
  }
}

class CaptureTeam {
  const CaptureTeam({
    required this.id,
    required this.name,
    required this.members,
  });

  final String id;
  final String name;
  final List<CaptureMember> members;

  factory CaptureTeam.fromJson(Map<String, dynamic> json) {
    final Object? id = json['id'];
    final Object? name = json['name'];
    final Object? members = json['members'];
    if (id is! String ||
        id.isEmpty ||
        name is! String ||
        name.isEmpty ||
        members is! List) {
      throw const FormatException('Invalid capture team.');
    }
    return CaptureTeam(
      id: id,
      name: name,
      members: List<CaptureMember>.unmodifiable(
        members.map(
          (Object? value) =>
              CaptureMember.fromJson(Map<String, dynamic>.from(value as Map)),
        ),
      ),
    );
  }
}

class CaptureOptions {
  const CaptureOptions({required this.gameTypes, required this.teams});

  final List<String> gameTypes;
  final List<CaptureTeam> teams;

  factory CaptureOptions.fromJson(Map<String, dynamic> json) {
    final Object? gameTypes = json['gameTypes'];
    final Object? teams = json['teams'];
    if (gameTypes is! List || teams is! List) {
      throw const FormatException('Invalid capture options.');
    }
    final List<String> parsedGameTypes = gameTypes
        .map((Object? value) {
          if (value is! String || value.isEmpty) {
            throw const FormatException('Invalid game type.');
          }
          return value;
        })
        .toList(growable: false);
    if (parsedGameTypes.isEmpty) {
      throw const FormatException('Missing game types.');
    }
    return CaptureOptions(
      gameTypes: List<String>.unmodifiable(parsedGameTypes),
      teams: List<CaptureTeam>.unmodifiable(
        teams.map(
          (Object? value) =>
              CaptureTeam.fromJson(Map<String, dynamic>.from(value as Map)),
        ),
      ),
    );
  }
}

class OcrPlayer {
  const OcrPlayer({
    required this.name,
    required this.scores,
    required this.matchedMemberId,
  });

  final String name;
  final List<int> scores;
  final String? matchedMemberId;

  factory OcrPlayer.fromJson(Map<String, dynamic> json) {
    final Object? name = json['name'];
    final Object? scores = json['scores'];
    final Object? memberId = json['matchedMemberId'];
    if (name is! String ||
        name.trim().isEmpty ||
        scores is! List ||
        scores.isEmpty ||
        (memberId != null && memberId is! String)) {
      throw const FormatException('Invalid OCR player.');
    }
    final List<int> parsedScores = scores
        .map((Object? value) {
          if (value is! int || value < 0 || value > 300) {
            throw const FormatException('Invalid OCR score.');
          }
          return value;
        })
        .toList(growable: false);
    return OcrPlayer(
      name: name.trim(),
      scores: List<int>.unmodifiable(parsedScores),
      matchedMemberId: memberId as String?,
    );
  }
}

class CapturePlayerDraft {
  const CapturePlayerDraft({
    required this.inputId,
    required this.name,
    required this.scoreTexts,
    required this.memberId,
  });

  factory CapturePlayerDraft.fromOcr(
    OcrPlayer player, {
    required int inputId,
  }) => CapturePlayerDraft(
    inputId: inputId,
    name: player.name,
    scoreTexts: player.scores.map((int score) => '$score').toList(),
    memberId: player.matchedMemberId,
  );

  final int inputId;
  final String name;
  final List<String> scoreTexts;
  final String? memberId;

  CapturePlayerDraft copyWith({
    String? name,
    List<String>? scoreTexts,
    String? memberId,
    bool clearMemberId = false,
  }) => CapturePlayerDraft(
    inputId: inputId,
    name: name ?? this.name,
    scoreTexts: scoreTexts ?? this.scoreTexts,
    memberId: clearMemberId ? null : memberId ?? this.memberId,
  );

  List<int>? validatedScores() {
    if (scoreTexts.isEmpty) return null;
    final List<int> result = <int>[];
    for (final String text in scoreTexts) {
      final int? score = int.tryParse(text.trim());
      if (score == null || score < 0 || score > 300) return null;
      result.add(score);
    }
    return result;
  }
}

class BulkSaveResult {
  const BulkSaveResult({required this.createdCount, required this.playerCount});

  final int createdCount;
  final int playerCount;

  factory BulkSaveResult.fromJson(Map<String, dynamic> json) {
    final Object? createdCount = json['createdCount'];
    final Object? playerCount = json['playerCount'];
    if (createdCount is! int ||
        createdCount < 0 ||
        playerCount is! int ||
        playerCount < 0) {
      throw const FormatException('Invalid bulk save result.');
    }
    return BulkSaveResult(createdCount: createdCount, playerCount: playerCount);
  }
}
