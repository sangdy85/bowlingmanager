class ClubLegacyCsvDocument {
  const ClubLegacyCsvDocument({required this.mode, required this.rows});
  final String mode;
  final List<ClubLegacyCsvRow> rows;
}

class ClubLegacyCsvRow {
  const ClubLegacyCsvRow({
    required this.memberLabel,
    required this.points,
    this.eventDate,
    this.competitionType,
    this.placement,
    this.note,
  });
  final String memberLabel;
  final String? eventDate;
  final String? competitionType;
  final int? placement;
  final int points;
  final String? note;
}

ClubLegacyCsvDocument parseClubLegacyCsv(String source) {
  final lines = source
      .replaceFirst('\ufeff', '')
      .split(RegExp(r'\r?\n'))
      .where((line) => line.trim().isNotEmpty)
      .map(_parseLine)
      .toList(growable: false);
  if (lines.length < 2) throw const FormatException('CSV 데이터가 없습니다.');
  final headers = lines.first
      .map((value) => value.trim().toLowerCase())
      .toList();
  int column(String name) => headers.indexOf(name);
  final memberIndex = column('member');
  final pointsIndex = column('points');
  final dateIndex = column('date') >= 0 ? column('date') : column('month');
  if (memberIndex < 0 || pointsIndex < 0) {
    throw const FormatException('member, points 열이 필요합니다.');
  }
  final detailed = dateIndex >= 0;
  final typeIndex = column('competitiontype');
  final placementIndex = column('placement');
  final noteIndex = column('note');
  if (detailed && (typeIndex < 0 || placementIndex < 0)) {
    throw const FormatException(
      '상세 CSV에는 date/month, competitionType, placement 열이 필요합니다.',
    );
  }
  String? value(List<String> row, int index) =>
      index < 0 || index >= row.length || row[index].trim().isEmpty
      ? null
      : row[index].trim();
  final rows = <ClubLegacyCsvRow>[];
  for (final row in lines.skip(1)) {
    final member = value(row, memberIndex);
    final points = int.tryParse(value(row, pointsIndex) ?? '');
    final placement = detailed
        ? int.tryParse(value(row, placementIndex) ?? '')
        : null;
    final type = value(row, typeIndex)?.toUpperCase();
    if (member == null ||
        points == null ||
        points <= 0 ||
        (detailed &&
            (value(row, dateIndex) == null ||
                placement == null ||
                placement < 1 ||
                !const {'INDIVIDUAL', 'TEAM', 'EVENT'}.contains(type)))) {
      throw const FormatException('CSV 행의 회원, 날짜, 종류, 순위 또는 포인트를 확인해주세요.');
    }
    rows.add(
      ClubLegacyCsvRow(
        memberLabel: member,
        points: points,
        eventDate: value(row, dateIndex),
        competitionType: type,
        placement: placement,
        note: value(row, noteIndex),
      ),
    );
  }
  return ClubLegacyCsvDocument(
    mode: detailed ? 'DETAILED' : 'OPENING_BALANCE',
    rows: List.unmodifiable(rows),
  );
}

List<String> _parseLine(String line) {
  final values = <String>[];
  final buffer = StringBuffer();
  var quoted = false;
  for (var index = 0; index < line.length; index += 1) {
    final char = line[index];
    if (char == '"') {
      if (quoted && index + 1 < line.length && line[index + 1] == '"') {
        buffer.write('"');
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char == ',' && !quoted) {
      values.add(buffer.toString());
      buffer.clear();
    } else {
      buffer.write(char);
    }
  }
  if (quoted) throw const FormatException('CSV 따옴표 형식을 확인해주세요.');
  values.add(buffer.toString());
  return values;
}
