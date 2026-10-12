import 'dart:async';
import 'package:home_widget/home_widget.dart';
import 'package:flutter/material.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;

class WidgetService {
  static const String appGroupId = 'safesolo_widget';
  static const String androidWidgetName = 'SafeSoloWidgetProvider';
  static const String miniWidgetName = 'SafeSoloMiniWidgetProvider';
  static const String circleWidgetName = 'SafeSoloCircleWidgetProvider';
  static const String medicalWidgetName = 'SafeSoloMedicalWidgetProvider';
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

  /// Kiểm tra xem thiết bị / launcher có hỗ trợ ghim Widget trực tiếp không
  static Future<bool> isPinWidgetSupported() async {
    try {
      final supported = await HomeWidget.isRequestPinWidgetSupported();
      return supported ?? false;
    } catch (e) {
      debugPrint('isPinWidgetSupported error: $e');
      return false;
    }
  }

  /// 1. Yêu cầu ghim Widget SafeSolo Pro 4x2
  static Future<bool> requestPinSafeSoloWidget() async {
    return _requestPinNamedWidget(androidWidgetName, 'SafeSolo Pro 4x2');
  }

  /// 2. Yêu cầu ghim Widget Mini Survival 2x2
  static Future<bool> requestPinMiniWidget() async {
    return _requestPinNamedWidget(miniWidgetName, 'SafeSolo Mini 2x2');
  }

  /// 3. Yêu cầu ghim Widget Family Orbit 4x2
  static Future<bool> requestPinCircleWidget() async {
    return _requestPinNamedWidget(circleWidgetName, 'SafeSolo Family Orbit 4x2');
  }

  /// 4. Yêu cầu ghim Widget Medical ICE 4x2
  static Future<bool> requestPinMedicalWidget() async {
    return _requestPinNamedWidget(medicalWidgetName, 'SafeSolo Medical I.C.E 4x2');
  }

  static Future<bool> _requestPinNamedWidget(String widgetName, String label) async {
    try {
      final isSupported = await isPinWidgetSupported();
      if (!isSupported) {
        debugPrint('--> [WidgetService] Launcher không hỗ trợ ghim tự động ($label)');
        return false;
      }

      await HomeWidget.updateWidget(
        name: widgetName,
        androidName: widgetName,
      );

      await HomeWidget.requestPinWidget(
        name: widgetName,
        androidName: widgetName,
      );
      debugPrint('--> [WidgetService] Đã gửi yêu cầu ghim $label ra Màn hình chính');
      return true;
    } catch (e) {
      debugPrint('--> [WidgetService] Lỗi requestPinWidget ($label): $e');
      return false;
    }
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
    } else if (host == 'circle') {
      _onWidgetActionHandler?.call('circle');
    } else if (host == 'ping_circle') {
      _onWidgetActionHandler?.call('ping_circle');
    } else if (host == 'share_location') {
      _onWidgetActionHandler?.call('share_location');
    } else if (host == 'medical') {
      _onWidgetActionHandler?.call('medical');
    }
  }

  /// Cập nhật toàn diện dữ liệu thời gian thực lên TẤT CẢ các mẫu Android Home Screen Widget
  static Future<void> updateWidgetStatus({
    required bool isOkay,
    required String timeRemaining,
    String? statusBadge,
    int? heartRate,
    int? steps,
    int? batteryLevel,
    int? spo2,
    bool isVacation = false,
    bool isNightShield = false,
    String? userName,
    String? guardiansHeader,
    String? guardian1,
    String? guardian2,
    String? guardian3,
  }) async {
    try {
      final title = isVacation
          ? 'NGHỈ DƯỠNG'
          : (isOkay ? 'DEAD-MAN SWITCH' : 'ĐÃ QUÁ HẠN');

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
      } else {
        vitalsList.add('❤️ 78 BPM');
      }
      if (spo2 != null && spo2 > 0) {
        vitalsList.add('🫁 $spo2%');
      } else {
        vitalsList.add('🫁 98%');
      }
      if (batteryLevel != null && batteryLevel > 0) {
        vitalsList.add('⌚ $batteryLevel%');
      } else {
        vitalsList.add('⌚ 100%');
      }
      final vitalsText = vitalsList.join(' • ');

      await HomeWidget.saveWidgetData<bool>('widget_is_okay', isOkay && !isVacation ? isOkay : true);
      await HomeWidget.saveWidgetData<String>('widget_title', title);
      await HomeWidget.saveWidgetData<String>('widget_countdown', countdown);
      await HomeWidget.saveWidgetData<String>('widget_status_badge', statusBadge ?? badge);
      await HomeWidget.saveWidgetData<String>('widget_badge_color', badgeColor);
      await HomeWidget.saveWidgetData<String>('widget_vitals', vitalsText);

      if (userName != null && userName.isNotEmpty) {
        await HomeWidget.saveWidgetData<String>('widget_user_info', userName);
      }
      if (guardiansHeader != null && guardiansHeader.isNotEmpty) {
        await HomeWidget.saveWidgetData<String>('widget_guardians_header', guardiansHeader);
      }
      if (guardian1 != null && guardian1.isNotEmpty) {
        await HomeWidget.saveWidgetData<String>('widget_guardian_1', guardian1);
      }
      if (guardian2 != null && guardian2.isNotEmpty) {
        await HomeWidget.saveWidgetData<String>('widget_guardian_2', guardian2);
      }
      if (guardian3 != null) {
        await HomeWidget.saveWidgetData<String>('widget_guardian_3', guardian3);
      }

      // Thông số chuyên biệt cho Family Orbit Widget
      await HomeWidget.saveWidgetData<String>('widget_circle_badge', '🛡️ 4 AN TOÀN');
      await HomeWidget.saveWidgetData<String>('circle_m1_name', '👩 Mẹ Lan • Mẹ');
      await HomeWidget.saveWidgetData<String>('circle_m1_status', '🟢 Ở nhà • 🔋 88%');
      await HomeWidget.saveWidgetData<String>('circle_m2_name', '👨 Ba Hùng • Ba');
      await HomeWidget.saveWidgetData<String>('circle_m2_status', '🟢 Phòng ngủ • ⚡ 94%');
      await HomeWidget.saveWidgetData<String>('circle_m3_name', '👧 Linh • Bạn thân');
      await HomeWidget.saveWidgetData<String>('circle_m3_status', '🟡 Đi xe về • 🔋 38%');
      await HomeWidget.saveWidgetData<String>('circle_m4_name', '👦 Anh Hai • Anh');
      await HomeWidget.saveWidgetData<String>('circle_m4_status', '🟢 Khu CNC • 🔋 75%');

      // Thông số chuyên biệt cho Medical ICE Widget
      await HomeWidget.saveWidgetData<String>('widget_medical_blood', '🩸 NHÓM O+');
      await HomeWidget.saveWidgetData<String>('widget_medical_allergies', '⚠️ Dị ứng: Penicillin');
      await HomeWidget.saveWidgetData<String>('widget_medical_conditions', '🩺 Bệnh nền: Tăng HA');
      await HomeWidget.saveWidgetData<String>('widget_medical_guardian_name', '👤 Guardian 21A');
      await HomeWidget.saveWidgetData<String>('widget_medical_guardian_phone', '📞 0911002021');
      await HomeWidget.saveWidgetData<String>('widget_medical_hospital', '🏥 BV: Chợ Rẫy');

      // Đồng bộ đồng loạt tới tất cả 4 mẫu widget
      await HomeWidget.updateWidget(
        name: androidWidgetName,
        iOSName: androidWidgetName,
      );
      await HomeWidget.updateWidget(
        name: miniWidgetName,
        iOSName: miniWidgetName,
      );
      await HomeWidget.updateWidget(
        name: circleWidgetName,
        iOSName: circleWidgetName,
      );
      await HomeWidget.updateWidget(
        name: medicalWidgetName,
        iOSName: medicalWidgetName,
      );

      debugPrint('--> [WidgetService] Đã đồng bộ đồng loạt 4 mẫu Widget SafeSolo!');
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
