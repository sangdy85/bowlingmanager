import 'package:bowlingmanager_mobile/core/network/api_exception.dart';
import 'package:bowlingmanager_mobile/features/notifications/application/notification_providers.dart';
import 'package:bowlingmanager_mobile/features/notifications/domain/mobile_notification.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class NotificationScreen extends ConsumerWidget {
  const NotificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('알림')),
      body: notifications.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                error is ApiException ? error.userMessage : '알림을 불러오지 못했습니다.',
              ),
              TextButton(
                onPressed: () => ref.invalidate(notificationListProvider),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
        data: (items) => items.isEmpty
            ? const Center(child: Text('새로운 알림이 없습니다.'))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(notificationListProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) => _NotificationTile(
                    item: items[index],
                    onTap: () async {
                      await ref
                          .read(notificationApiProvider)
                          .markRead(items[index].id);
                      ref.invalidate(notificationListProvider);
                      final path = mobileNotificationPath(<String, dynamic>{
                        'teamId': items[index].teamId,
                        'eventId': items[index].eventId,
                        'target': items[index].target,
                      });
                      if (context.mounted && path != null) context.push(path);
                    },
                  ),
                ),
              ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item, required this.onTap});
  final MobileNotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Icon(
        item.isUnread ? Icons.notifications_active : Icons.notifications_none,
      ),
      title: Text(item.title),
      subtitle: Text(item.body),
      trailing: item.isUnread
          ? const Icon(Icons.circle, size: 10, color: Colors.blueAccent)
          : null,
      onTap: onTap,
    ),
  );
}
