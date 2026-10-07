import 'dart:async';
import 'package:home_widget/home_widget.dart';
import 'package:flutter/material.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;

class WidgetService {
  static const String appGroupId = 'safesolo_widget';
  static const String androidWidgetName = 'SafeSoloWidgetProvider';
  static const String locketWidgetName = 'LocketWidgetProvider';

  static StreamSubscription<Uri?>? _widgetClickSub;
  static void Function(String action)? _onWidgetActionHandler;

  /// Khởi tạo hệ thống widget & lắng nghe tương tác người dùng từ màn hình chính
  static Future<void> initialize({void Function(String action)? onAction}) async {
    _onWidgetActionHandler = onAction;
    try {
      await HomeWidget.setAppGroupId(appGroupId);

      // Đăng ký nhận sự kiện bấm nút từ Android Widget
      _widgetClickSub?.cancel();
      _widgetClickSub = HomeWidget.widgetClicked.listen((uri) {
        if (uri != null) {
          _handleUriAction(uri);
        }
      });

      final initialUri = await HomeWidget.initiallyLaunchedFromHomeWidget();
      if (initialUri != null) {
        _handleUriAction(initialUri);
      }

      await HomeWidget.saveWidgetData<String>('locket_author', 'SafeSolo Circle');
      await HomeWidget.saveWidgetData<String>('locket_caption', 'Chạm để cập nhật');
      await HomeWidget.updateWidget(
        name: locketWidgetName,
        iOSName: locketWidgetName,
      );
    } catch (e) {
      debugPrint('WidgetService initialize error: $e');
    }
  }

  static void setActionHandler(void Function(String action) handler) {
    _onWidgetActionHandler = handler;
  }

  static void _handleUriAction(Uri uri) {
    debugPrint('--> [WidgetService] Nhận tương tác từ Widget: $uri');
    final host = uri.host.toLowerCase();
    if (host == 'checkin') {
      _onWidgetActionHandler?.call('checkin');
    } else if (host == 'sos') {
      _onWidgetActionHandler?.call('sos');
    } else if (host == 'home') {
      _onWidgetActionHandler?.call('home');
    }
  }

  /// Cập nhật toàn diện dữ liệu thời gian thực lên Android Home Screen Widget
  static Future<void> updateWidgetStatus({
    required bool isOkay,
    required String timeRemaining,
    String? statusBadge,
    int? heartRate,
    int? steps,
    int? batteryLevel,
    bool isVacation = false,
    bool isNightShield = false,
  }) async {
    try {
      final title = isVacation
          ? 'NGHỈ DƯỠNG'
          : (isOkay ? 'CHECK-IN SAU' : 'ĐÃ QUÁ HẠN');

      final countdown = isVacation
          ? 'Tạm dừng'
          : (isOkay ? timeRemaining : 'Quá hạn điểm danh!');

      final badge = isVacation
          ? '● NGHỈ DƯỠNG'
          : (isNightShield
              ? '● KHIÊN ĐÊM'
              : (isOkay ? '● AN TOÀN' : '● NGUY CẤP'));

      final badgeColor = isVacation
          ? '#60A5FA' // Xanh dương
          : (isNightShield
              ? '#A78BFA' // Tím
              : (isOkay ? '#34D399' : '#EF4444')); // Lục hoặc Đỏ

      // Định dạng dòng chỉ số sinh trắc học & thiết bị
      final List<String> vitalsList = [];
      if (heartRate != null && heartRate > 0) {
        vitalsList.add('❤️ $heartRate BPM');
      }
      if (steps != null && steps > 0) {
        vitalsList.add('👟 $steps bước');
      }
      if (batteryLevel != null && batteryLevel > 0) {
        vitalsList.add('🔋 $batteryLevel%');
      }
      if (vitalsList.isEmpty) {
        vitalsList.add('🛡️ SafeSolo Active');
      }
      final vitalsText = vitalsList.join(' • ');

      await HomeWidget.saveWidgetData<bool>('widget_is_okay', isOkay && !isVacation ? isOkay : true);
      await HomeWidget.saveWidgetData<String>('widget_title', title);
      await HomeWidget.saveWidgetData<String>('widget_countdown', countdown);
      await HomeWidget.saveWidgetData<String>('widget_status_badge', statusBadge ?? badge);
      await HomeWidget.saveWidgetData<String>('widget_badge_color', badgeColor);
      await HomeWidget.saveWidgetData<String>('widget_vitals', vitalsText);

      await HomeWidget.updateWidget(
        name: androidWidgetName,
        iOSName: androidWidgetName,
      );
      debugPrint('--> [WidgetService] Đã đồng bộ Widget: isOkay=$isOkay, countdown=$countdown, vitals=$vitalsText');
    } catch (e) {
      debugPrint('WidgetService updateWidgetStatus error: $e');
    }
  }

  static Future<void> updateLocketWidget({
    required String author,
    required String caption,
    required String? imageUrl,
  }) async {
    await HomeWidget.saveWidgetData<String>('locket_author', author);
    await HomeWidget.saveWidgetData<String>('locket_caption', caption);

    if (imageUrl != null) {
      try {
        final uri = Uri.parse(imageUrl);
        final response = await http.get(uri);
        if (response.statusCode == 200) {
          final dir = await getApplicationDocumentsDirectory();
          final file = File('${dir.path}/locket_widget_img.jpg');
          await file.writeAsBytes(response.bodyBytes);
          await HomeWidget.saveWidgetData<String>('locket_image_path', file.path);
        }
      } catch (e) {
        debugPrint('Lỗi tải ảnh widget: $e');
      }
    }

    await HomeWidget.updateWidget(
      name: locketWidgetName,
      iOSName: locketWidgetName,
    );
  }

  static void dispose() {
    _widgetClickSub?.cancel();
    _widgetClickSub = null;
  }
}
