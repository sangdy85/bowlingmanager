import 'dart:math' as math;

import 'package:bowlingmanager_mobile/core/domain/game_session.dart';
import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class RecentAverageChart extends StatelessWidget {
  const RecentAverageChart({required this.sessions, super.key});

  final List<GameSession> sessions;

  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) {
      return const Card(
        child: SizedBox(
          height: 120,
          child: Center(
            child: Text(
              '최근 기록이 없습니다.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ),
      );
    }

    // The API returns newest first. Keep the same seven sessions, oldest at left.
    final visible = sessions.take(7).toList(growable: false).reversed.toList();
    final averages = visible.map((session) => session.average).toList();
    // Leave the reference chart's 0 / 125 / 250 scale for normal averages,
    // extending it when a session (including handicap scores) exceeds 250.
    final maximum = math.max(
      250.0,
      (averages.reduce(math.max) / 50).ceil() * 50.0,
    );
    const axisStyle = TextStyle(color: AppColors.textSecondary, fontSize: 12);

    return Card(
      key: const Key('recent-average-chart'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text('최근 ${visible.length}경기', style: axisStyle),
                ),
                Text(
                  visible.last.average.toStringAsFixed(1),
                  style: const TextStyle(
                    color: AppColors.primaryBright,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 5),
                const Text('AVG', style: axisStyle),
              ],
            ),
            const SizedBox(height: 18),
            SizedBox(
              height: 164,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  SizedBox(
                    width: 34,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: <Widget>[
                        Text(_axisLabel(maximum), style: axisStyle),
                        Text(_axisLabel(maximum / 2), style: axisStyle),
                        const Text('0', style: axisStyle),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Semantics(
                      label:
                          '최근 경기 평균, 오래된 순서. ${visible.map((session) => '${_dateLabel(session.gameDate)} 평균 ${session.average.toStringAsFixed(1)}점').join(', ')}',
                      child: CustomPaint(
                        key: const Key('recent-average-line-chart'),
                        painter: _AverageLinePainter(
                          averages: averages,
                          maximum: maximum,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.only(left: 52, right: 8),
              child: visible.length == 1
                  ? Text(
                      _dateLabel(visible.first.gameDate),
                      textAlign: TextAlign.center,
                      style: axisStyle,
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: <Widget>[
                        Text(
                          _dateLabel(visible.first.gameDate),
                          style: axisStyle,
                        ),
                        Text(
                          _dateLabel(visible.last.gameDate),
                          style: axisStyle,
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

String _dateLabel(DateTime date) => '${date.month}. ${date.day}.';

String _axisLabel(double value) => value == value.roundToDouble()
    ? value.toStringAsFixed(0)
    : value.toStringAsFixed(1);

class _AverageLinePainter extends CustomPainter {
  const _AverageLinePainter({required this.averages, required this.maximum});

  final List<double> averages;
  final double maximum;

  @override
  void paint(Canvas canvas, Size size) {
    const inset = 8.0;
    final width = math.max(0.0, size.width - inset * 2);
    final height = math.max(0.0, size.height - inset * 2);
    final grid = Paint()
      ..color = AppColors.divider
      ..strokeWidth = 1;
    for (int row = 0; row < 3; row++) {
      final y = inset + height * row / 2;
      for (double x = inset; x < size.width - inset; x += 7) {
        canvas.drawLine(
          Offset(x, y),
          Offset(math.min(x + 3, size.width - inset), y),
          grid,
        );
      }
    }

    final points = <Offset>[
      for (int index = 0; index < averages.length; index++)
        Offset(
          averages.length == 1
              ? size.width / 2
              : inset + width * index / (averages.length - 1),
          inset + height * (1 - (averages[index] / maximum).clamp(0.0, 1.0)),
        ),
    ];
    if (points.isEmpty) return;
    final stroke = Paint()
      ..color = AppColors.primaryBright
      ..strokeWidth = 2.3
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(path, stroke);
    final fill = Paint()..color = AppColors.surface;
    for (final point in points) {
      canvas.drawCircle(point, 3.5, fill);
      canvas.drawCircle(point, 3.5, stroke..strokeWidth = 1.8);
    }
  }

  @override
  bool shouldRepaint(covariant _AverageLinePainter oldDelegate) =>
      oldDelegate.maximum != maximum ||
      oldDelegate.averages.length != averages.length ||
      !Iterable.generate(averages.length)
          .every((index) => oldDelegate.averages[index] == averages[index]);
}
