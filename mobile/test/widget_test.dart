import 'package:bowlingmanager_mobile/app/app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('splash transitions to the login foundation', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const BowlingManagerApp());

    expect(find.text('BowlingManager'), findsOneWidget);
    expect(find.text('볼링을 더 즐겁게,\n기록을 더 특별하게'), findsOneWidget);

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    expect(find.text('다시 만나 반가워요'), findsOneWidget);
    expect(find.text('로그인'), findsOneWidget);
  });

  testWidgets('debug login preview opens the home shell', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const BowlingManagerApp());
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    await tester.tap(find.text('로그인'));
    await tester.pumpAndSettle();

    expect(find.text('안녕하세요, 볼러님'), findsOneWidget);
    expect(find.text('CURRENT AVG'), findsOneWidget);
    expect(find.text('촬영'), findsOneWidget);
  });
}
