import 'package:bowlingmanager_mobile/features/club/presentation/club_season_date_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('club season date helpers preserve exact calendar dates', () {
    expect(formatClubDate(DateTime(2026, 1, 2)), '2026-01-02');
    expect(parseClubDate('2026-12-31'), DateTime(2026, 12, 31));
    expect(parseClubDate('2026-02-30'), isNull);
    expect(parseClubDate('2026-2-03'), isNull);
  });

  testWidgets('season date field is read-only and uses the date picker', (
    tester,
  ) async {
    final controller = TextEditingController(text: '2026-01-01');
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ClubSeasonDateField(
            key: const Key('date-field'),
            controller: controller,
            label: '시작일',
          ),
        ),
      ),
    );

    final field = find.byWidgetPredicate(
      (widget) => widget is TextField && widget.key == const Key('date-field'),
    );
    expect(tester.widget<TextField>(field).readOnly, isTrue);
    await tester.tap(field);
    await tester.pumpAndSettle();
    expect(find.byType(DatePickerDialog), findsOneWidget);
    Navigator.of(tester.element(find.byType(DatePickerDialog))).pop();
    await tester.pumpAndSettle();
    expect(controller.text, '2026-01-01');
  });
}
