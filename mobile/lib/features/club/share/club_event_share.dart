import 'package:bowlingmanager_mobile/features/club/domain/club_event_models.dart';
import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart';

/// Share schedule details only; member lists and private competition data stay in app.
String clubEventShareText(ClubEvent event) => <String>[
  '[볼링매니저 일정]',
  if (event.teamName?.trim().isNotEmpty == true) event.teamName!,
  event.title,
  '일시: ${event.date} ${event.time}',
  '장소: ${event.location}',
  if (event.gameType != null) '경기 유형: ${event.gameType}',
].join('\n');

Future<void> shareClubEvent(
  ClubEvent event, {
  Rect? sharePositionOrigin,
}) async {
  // Text sharing also works in receivers that discard captions on image shares.
  await SharePlus.instance.share(
    ShareParams(
      text: clubEventShareText(event),
      sharePositionOrigin: sharePositionOrigin,
    ),
  );
}
