import 'package:bowlingmanager_mobile/features/club/domain/club_team_competition_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('captain selection payload is parsed', () {
    final selection = ClubCaptainOrderSelection.fromJson(<String, dynamic>{
      'required': true,
      'complete': false,
      'canChoose': true,
      'nextSelectionOrder': 1,
      'nextCaptainName': '팀장 A',
      'availableOrders': <int>[1, 2, 3, 4],
      'captains': <Map<String, dynamic>>[
        <String, dynamic>{
          'captainMemberId': 'a', 'captainName': '팀장 A',
          'selectionOrder': 1, 'selectedDraftOrder': null,
        },
        <String, dynamic>{
          'captainMemberId': 'b', 'captainName': '팀장 B',
          'selectionOrder': 2, 'selectedDraftOrder': 1,
        },
      ],
    });
    expect(selection.canChoose, isTrue);
    expect(selection.availableOrders, <int>[1, 2, 3, 4]);
    expect(selection.captains.first.selectedDraftOrder, isNull);
    expect(selection.captains.last.selectedDraftOrder, 1);
  });
}
