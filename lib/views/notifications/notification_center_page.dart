import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../services/notification_center_service.dart';

class NotificationCenterPage extends StatefulWidget {
  const NotificationCenterPage({super.key});

  @override
  State<NotificationCenterPage> createState() => _NotificationCenterPageState();
}

class _NotificationCenterPageState extends State<NotificationCenterPage> {
  String _selectedFilter = 'ALL'; // 'ALL', 'SOS', 'CHECKIN', 'GUARDIAN', 'SYSTEM'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _syncNotifications();
    });
  }

  Future<void> _syncNotifications() async {
    final userId = context.read<AppProvider>().user?.id;
    if (userId == null || userId.isEmpty) return;
    await NotificationCenterService.instance.syncFromBackend(userId);
  }

  AppStrings _snapshotStrings() {
    return AppStrings(context.read<AppProvider>().language);
  }

  String _formatTimestamp(DateTime time, AppStrings strings) {
    final diff = DateTime.now().difference(time);
    if (diff.inSeconds < 60) {
      return strings.text('Vừa xong', 'Just now');
    }
    if (diff.inMinutes < 60) {
      return strings.text('${diff.inMinutes} phút trước', '${diff.inMinutes}m ago');
    }
    if (diff.inHours < 24) {
      return strings.text('${diff.inHours} giờ trước', '${diff.inHours}h ago');
    }
    if (diff.inDays < 7) {
      return strings.text('${diff.inDays} ngày trước', '${diff.inDays}d ago');
    }
    return '${time.day.toString().padLeft(2, '0')}/${time.month.toString().padLeft(2, '0')} ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  Color _getTypeColor(String type, bool isDark) {
    switch (type.toUpperCase()) {
      case 'SOS':
        return const Color(0xFFEF4444);
      case 'CHECKIN':
        return const Color(0xFF10B981);
      case 'GUARDIAN':
        return const Color(0xFF3B82F6);
      case 'SYSTEM':
      default:
        return const Color(0xFF8B5CF6);
    }
  }

  IconData _getTypeIcon(String type) {
    switch (type.toUpperCase()) {
      case 'SOS':
        return Icons.crisis_alert_rounded;
      case 'CHECKIN':
        return Icons.check_circle_outline_rounded;
      case 'GUARDIAN':
        return Icons.shield_rounded;
      case 'SYSTEM':
      default:
        return Icons.notifications_active_outlined;
    }
  }

  String _getTypeLabel(String type, AppStrings strings) {
    switch (type.toUpperCase()) {
      case 'SOS':
        return strings.text('Khẩn cấp / SOS', 'Emergency / SOS');
      case 'CHECKIN':
        return strings.text('Điểm danh', 'Check-in');
      case 'GUARDIAN':
        return strings.text('Giám hộ', 'Guardian');
      case 'SYSTEM':
      default:
        return strings.text('Hệ thống', 'System');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final strings = _snapshotStrings();
    final notifService = NotificationCenterService.instance;

    return AnimatedBuilder(
      animation: notifService,
      builder: (context, _) {
        final allItems = notifService.notifications;
        final unreadCount = notifService.unreadCount;
        final filteredItems = _selectedFilter == 'ALL'
            ? allItems
            : notifService.filterByType(_selectedFilter);

        return Scaffold(
          backgroundColor: isDark ? AppDarkColors.background : AppColors.background,
          appBar: AppBar(
            backgroundColor: isDark ? AppDarkColors.card : Colors.white,
            elevation: 0,
            leading: IconButton(
              icon: Icon(
                Icons.arrow_back_ios_new_rounded,
                color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                size: 20,
              ),
              onPressed: () => Navigator.pop(context),
            ),
            title: Row(
              children: [
                Text(
                  strings.text('Thông báo', 'Notifications'),
                  style: AppTextStyles.h3.copyWith(
                    color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                  ),
                ),
                if (unreadCount > 0) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '$unreadCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            actions: [
              if (allItems.isNotEmpty) ...[
                IconButton(
                  tooltip: strings.text('Đánh dấu đã đọc', 'Mark all read'),
                  icon: Icon(
                    Icons.done_all_rounded,
                    color: isDark ? AppDarkColors.textSecondary : AppColors.primary,
                    size: 22,
                  ),
                  onPressed: () {
                    notifService.markAllAsRead();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          strings.text('Đã đánh dấu đọc tất cả', 'Marked all as read'),
                        ),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                ),
                IconButton(
                  tooltip: strings.text('Xóa tất cả', 'Clear all'),
                  icon: Icon(
                    Icons.delete_sweep_outlined,
                    color: isDark ? AppDarkColors.textMuted : AppColors.textMuted,
                    size: 22,
                  ),
                  onPressed: () => _confirmClearAll(context, strings, notifService),
                ),
              ],
              const SizedBox(width: 4),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: _syncNotifications,
            child: Column(
              children: [
                // Filter Tabs
                _buildFilterChips(isDark, strings, allItems),

                // Notification List or Empty State
                Expanded(
                  child: filteredItems.isEmpty
                      ? _buildEmptyState(isDark, strings)
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: filteredItems.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final item = filteredItems[index];
                            return _buildNotificationCard(
                              context,
                              item,
                              isDark,
                              strings,
                              notifService,
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterChips(
    bool isDark,
    AppStrings strings,
    List<NotificationItem> allItems,
  ) {
    final filters = [
      {'key': 'ALL', 'label': strings.text('Tất cả', 'All'), 'icon': Icons.all_inbox_rounded},
      {'key': 'SOS', 'label': strings.text('Khẩn cấp', 'Emergency'), 'icon': Icons.crisis_alert_rounded},
      {'key': 'CHECKIN', 'label': strings.text('Điểm danh', 'Check-in'), 'icon': Icons.check_circle_outline_rounded},
      {'key': 'GUARDIAN', 'label': strings.text('Giám hộ', 'Guardian'), 'icon': Icons.shield_rounded},
      {'key': 'SYSTEM', 'label': strings.text('Hệ thống', 'System'), 'icon': Icons.notifications_none_rounded},
    ];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppDarkColors.card : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark ? const Color(0xFF263345) : const Color(0xFFF1F5F9),
            width: 1,
          ),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: filters.map((f) {
            final key = f['key'] as String;
            final label = f['label'] as String;
            final icon = f['icon'] as IconData;
            final isSelected = _selectedFilter == key;

            int count = 0;
            if (key == 'ALL') {
              count = allItems.length;
            } else {
              count = allItems.where((i) => i.type == key).length;
            }

            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                selected: isSelected,
                onSelected: (_) => setState(() => _selectedFilter = key),
                avatar: Icon(
                  icon,
                  size: 16,
                  color: isSelected
                      ? Colors.white
                      : (isDark ? AppDarkColors.textSecondary : AppColors.textSecondary),
                ),
                label: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                        color: isSelected
                            ? Colors.white
                            : (isDark ? AppDarkColors.textPrimary : AppColors.textPrimary),
                      ),
                    ),
                    if (count > 0) ...[
                      const SizedBox(width: 5),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? Colors.white.withValues(alpha: 0.25)
                              : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$count',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: isSelected
                                ? Colors.white
                                : (isDark ? AppDarkColors.textSecondary : AppColors.textSecondary),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                selectedColor: AppColors.primary,
                backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(
                    color: isSelected
                        ? AppColors.primary
                        : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                  ),
                ),
                showCheckmark: false,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildNotificationCard(
    BuildContext context,
    NotificationItem item,
    bool isDark,
    AppStrings strings,
    NotificationCenterService notifService,
  ) {
    final typeColor = _getTypeColor(item.type, isDark);
    final typeIcon = _getTypeIcon(item.type);

    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFEF4444),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.delete_outline_rounded, color: Colors.white, size: 24),
            SizedBox(width: 6),
            Text(
              'Xóa',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
      ),
      onDismissed: (_) {
        notifService.deleteNotification(item.id);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(strings.text('Đã xóa thông báo', 'Notification dismissed')),
            duration: const Duration(seconds: 2),
          ),
        );
      },
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          if (!item.isRead) {
            notifService.markAsRead(item.id);
          }
          _handleNotificationTap(item);
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark
                ? (item.isRead ? AppDarkColors.card : const Color(0xFF1B2A4A))
                : (item.isRead ? Colors.white : const Color(0xFFF0F7FF)),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? (item.isRead ? const Color(0xFF263345) : const Color(0xFF2563EB).withValues(alpha: 0.5))
                  : (item.isRead ? const Color(0xFFE2E8F0) : const Color(0xFF93C5FD)),
              width: item.isRead ? 1 : 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon Badge
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: typeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: typeColor.withValues(alpha: 0.25),
                    width: 1,
                  ),
                ),
                child: Icon(typeIcon, color: typeColor, size: 22),
              ),
              const SizedBox(width: 12),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: typeColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _getTypeLabel(item.type, strings),
                            style: TextStyle(
                              color: typeColor,
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          _formatTimestamp(item.timestamp, strings),
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? AppDarkColors.textMuted : AppColors.textMuted,
                          ),
                        ),
                        if (!item.isRead) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFF3B82F6),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: item.isRead ? FontWeight.w600 : FontWeight.bold,
                        color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                      ),
                    ),
                    if (item.body.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        item.body,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleNotificationTap(NotificationItem item) {
    if (item.type == 'SOS') {
      Navigator.pushNamed(context, '/hazard-feed');
    } else if (item.type == 'CHECKIN') {
      Navigator.pop(context); // Go back to Home
    } else if (item.type == 'GUARDIAN') {
      Navigator.pushNamed(context, '/network');
    }
  }

  Widget _buildEmptyState(bool isDark, AppStrings strings) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.notifications_off_outlined,
                size: 40,
                color: isDark ? AppDarkColors.textMuted : AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              strings.text('Không có thông báo nào', 'No notifications'),
              style: AppTextStyles.h3.copyWith(
                color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              strings.text(
                'Mọi cảnh báo an toàn và cập nhật hệ thống sẽ hiển thị tại đây.',
                'Safety alerts and system updates will appear here.',
              ),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmClearAll(
    BuildContext context,
    AppStrings strings,
    NotificationCenterService notifService,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text(strings.text('Xóa tất cả thông báo?', 'Clear all notifications?')),
        content: Text(
          strings.text(
            'Hành động này sẽ xóa toàn bộ danh sách thông báo hiện tại.',
            'This action will clear all current notifications.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: Text(strings.text('Hủy', 'Cancel')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () {
              notifService.clearAll();
              Navigator.pop(dialogCtx);
            },
            child: Text(strings.text('Xóa hết', 'Clear all')),
          ),
        ],
      ),
    );
  }
}
