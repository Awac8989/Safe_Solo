import 'package:flutter/material.dart';

import 'api_service.dart';

/// Notification model for local display
class NotificationItem {
  final String id;
  final String title;
  final String body;
  final String type; // 'SOS', 'CHECKIN', 'GUARDIAN', 'SYSTEM', 'JOURNEY', 'VITALS'
  final DateTime timestamp;
  bool isRead;
  final Map<String, dynamic>? metadata;

  NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    required this.timestamp,
    this.isRead = false,
    this.metadata,
  });
}

/// In-memory notification store with ChangeNotifier for reactivity
class NotificationCenterService extends ChangeNotifier {
  NotificationCenterService._();
  static final NotificationCenterService instance =
      NotificationCenterService._();

  final List<NotificationItem> _notifications = [];
  int _unreadCount = 0;

  List<NotificationItem> get notifications =>
      List.unmodifiable(_notifications);
  int get unreadCount => _unreadCount;

  /// Add a notification from FCM or local trigger
  void addNotification({
    required String title,
    required String body,
    required String type,
    Map<String, dynamic>? metadata,
  }) {
    final item = NotificationItem(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      title: title,
      body: body,
      type: type,
      timestamp: DateTime.now(),
      metadata: metadata,
    );
    _notifications.insert(0, item);
    _unreadCount++;

    // Keep max 200 notifications
    if (_notifications.length > 200) {
      _notifications.removeRange(200, _notifications.length);
    }
    notifyListeners();
  }

  /// Mark a single notification as read
  void markAsRead(String id) {
    final item = _notifications.firstWhere(
      (n) => n.id == id,
      orElse: () => NotificationItem(
        id: '',
        title: '',
        body: '',
        type: '',
        timestamp: DateTime.now(),
      ),
    );
    if (item.id.isNotEmpty && !item.isRead) {
      item.isRead = true;
      _unreadCount = _notifications.where((n) => !n.isRead).length;
      notifyListeners();
    }
  }

  /// Mark all as read
  void markAllAsRead() {
    for (final n in _notifications) {
      n.isRead = true;
    }
    _unreadCount = 0;
    notifyListeners();
  }

  /// Delete a notification
  void deleteNotification(String id) {
    _notifications.removeWhere((n) => n.id == id);
    _unreadCount = _notifications.where((n) => !n.isRead).length;
    notifyListeners();
  }

  /// Clear all
  void clearAll() {
    _notifications.clear();
    _unreadCount = 0;
    notifyListeners();
  }

  /// Sync recent notifications from backend
  Future<void> syncFromBackend(String userId) async {
    try {
      final items = await ApiService().fetchUserNotifications(userId);
      for (final raw in items) {
        final id = raw['id']?.toString() ?? raw['_id']?.toString() ?? '';
        if (id.isEmpty) continue;
        final exists = _notifications.any((n) => n.id == id);
        if (!exists) {
          final level = (raw['level']?.toString() ?? '').toUpperCase();
          final status = (raw['status']?.toString() ?? '').toUpperCase();
          String type = 'SYSTEM';
          if (level == 'SOS' ||
              status.contains('SOS') ||
              status.contains('FALL') ||
              status.contains('DEADMAN')) {
            type = 'SOS';
          } else if (status.contains('CHECKIN') ||
              status.contains('REMINDER')) {
            type = 'CHECKIN';
          } else if (status.contains('GUARDIAN') ||
              status.contains('PING')) {
            type = 'GUARDIAN';
          }

          DateTime ts = DateTime.now();
          if (raw['createdAt'] != null) {
            ts = DateTime.tryParse(raw['createdAt'].toString()) ?? ts;
          }

          _notifications.add(NotificationItem(
            id: id,
            title: raw['title']?.toString() ?? 'SafeSolo Alert',
            body: raw['message']?.toString() ?? '',
            type: type,
            timestamp: ts,
            metadata: raw['metadata'] is Map
                ? Map<String, dynamic>.from(raw['metadata'] as Map)
                : null,
          ));
        }
      }
      _notifications.sort((a, b) => b.timestamp.compareTo(a.timestamp));
      _unreadCount = _notifications.where((n) => !n.isRead).length;
      notifyListeners();
    } catch (_) {}
  }

  /// Filter by type
  List<NotificationItem> filterByType(String type) {
    return _notifications.where((n) => n.type == type).toList();
  }
}

