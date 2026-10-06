import 'package:home_widget/home_widget.dart';
import 'package:flutter/material.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;

class WidgetService {
  static const String appGroupId = 'safesolo_widget'; // App Group ID for iOS if needed
  static const String androidWidgetName = 'SafeSoloWidgetProvider';
  static const String locketWidgetName = 'LocketWidgetProvider';

  static Future<void> initialize() async {
    try {
      await HomeWidget.setAppGroupId(appGroupId);
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
}
