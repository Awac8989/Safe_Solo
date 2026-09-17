import 'package:url_launcher/url_launcher.dart';

/// Dịch vụ Cứu hộ Ngoại tuyến (Offline SOS Fallback Service)
/// Đóng gói tin nhắn SMS khẩn cấp ngắn gọn khi mất hoàn toàn kết nối Internet
class OfflineSosService {
  OfflineSosService._();
  static final OfflineSosService instance = OfflineSosService._();

  /// Tạo chuỗi tin nhắn SMS khẩn cấp cô đọng dưới 160 ký tự
  String formatEmergencySms({
    required String victimName,
    required double lat,
    required double lng,
    int? heartRate,
    int? spO2,
    int? batteryLevel,
    String reason = 'SOS KHAN CAP',
  }) {
    final latStr = lat.toStringAsFixed(5);
    final lngStr = lng.toStringAsFixed(5);
    final vitals = <String>[];
    if (heartRate != null) vitals.add('HR:$heartRate');
    if (spO2 != null) vitals.add('SpO2:$spO2%');
    if (batteryLevel != null) vitals.add('Pin:$batteryLevel%');

    final vitalsStr = vitals.isNotEmpty ? ' [${vitals.join(',')}]' : '';
    final mapLink = 'https://maps.google.com/?q=$latStr,$lngStr';

    return 'SAFESOLO SOS! $victimName: $reason.$vitalsStr Vi tri: $mapLink';
  }

  /// Tạo URI gửi tin nhắn SMS khẩn cấp
  Uri buildSmsUri({
    required String phoneNumber,
    required String message,
  }) {
    final cleanPhone = phoneNumber.replaceAll(RegExp(r'[^0-9+]'), '');
    return Uri(
      scheme: 'sms',
      path: cleanPhone,
      queryParameters: {'body': message},
    );
  }

  /// Khởi chạy ứng dụng SMS trên thiết bị để phát lệnh cứu hộ
  Future<bool> sendEmergencySms({
    required String phoneNumber,
    required String message,
  }) async {
    final uri = buildSmsUri(phoneNumber: phoneNumber, message: message);
    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri);
      }
    } catch (_) {}
    return false;
  }
}
