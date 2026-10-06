import 'package:home_widget/home_widget.dart';
import 'package:flutter/material.dart';

class WidgetService {
  static const String appGroupId = 'safesolo_widget'; // App Group ID for iOS if needed
  static const String androidWidgetName = 'SafeSoloWidgetProvider';

  static Future<void> initialize() async {
    await HomeWidget.setAppGroupId(appGroupId);
  }

  static Future<void> updateWidgetStatus({
    required bool isOkay,
    required String timeRemaining,
  }) async {
    final title = isOkay ? "Tôi ổn" : "Báo động!";
    final countdownText = isOkay ? "Check-in sau: $timeRemaining" : "Chạm để báo an toàn";
    final colorHex = isOkay ? "#2E7D32" : "#D32F2F"; // Green if okay, Red if danger

    await HomeWidget.saveWidgetData<String>('widget_title', title);
    await HomeWidget.saveWidgetData<String>('widget_countdown', countdownText);
    await HomeWidget.saveWidgetData<String>('widget_color', colorHex);

    await HomeWidget.updateWidget(
      name: androidWidgetName,
      iOSName: androidWidgetName,
    );
  }
}
