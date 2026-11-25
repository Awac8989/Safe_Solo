import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class SmsDispatchResult {
  const SmsDispatchResult({
    required this.sent,
    required this.method,
    required this.phoneNumber,
    this.code,
    this.error,
    this.parts = 1,
  });

  final bool sent;
  final String method; // 'SMS_MANAGER' | 'SMS_COMPOSER_FALLBACK' | 'FAILED'
  final String phoneNumber;
  final String? code;
  final String? error;
  final int parts;
}

/// Dịch vụ Cứu hộ Ngoại tuyến (Offline SOS Fallback Service)
/// Hỗ trợ 2 tầng:
/// 1. Native Android SmsManager (gửi ngầm không cần bấm nút khi bất tỉnh / Duress / Dead-Man quá hạn)
/// 2. Fallback sms: URI composer qua url_launcher nếu chưa cấp quyền SEND_SMS (ngoại trừ Duress ẩn danh)
class OfflineSosService {
  OfflineSosService._();
  static final OfflineSosService instance = OfflineSosService._();

  static const MethodChannel _nativeChannel =
      MethodChannel('com.example.safesolo/watch_native');

  @visibleForTesting
  Future<dynamic> Function(String method, Map<String, dynamic>? args)?
      nativeInvokerForTest;

  @visibleForTesting
  Future<bool> Function(Uri uri)? uriLauncherForTest;

  int _autoSmsDispatchCount = 0;
  int get autoSmsDispatchCount => _autoSmsDispatchCount;

  SmsDispatchResult? _lastDispatchResult;
  SmsDispatchResult? get lastDispatchResult => _lastDispatchResult;

  Future<dynamic> _invokeNative(String method, [Map<String, dynamic>? args]) {
    if (nativeInvokerForTest != null) {
      return nativeInvokerForTest!(method, args);
    }
    return _nativeChannel.invokeMethod<dynamic>(method, args);
  }

  /// Tạo chuỗi tin nhắn SMS khẩn cấp cô đọng dễ đọc trên mạng 2G/GSM
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
    if (heartRate != null && heartRate > 0) vitals.add('HR:$heartRate');
    if (spO2 != null && spO2 > 0) vitals.add('SpO2:$spO2%');
    if (batteryLevel != null && batteryLevel > 0) vitals.add('Pin:$batteryLevel%');

    final vitalsStr = vitals.isNotEmpty ? ' [${vitals.join(',')}]' : '';
    final mapLink = 'https://maps.google.com/?q=$latStr,$lngStr';

    return 'SAFESOLO SOS! $victimName: $reason.$vitalsStr Vi tri: $mapLink';
  }

  /// Tạo URI gửi tin nhắn SMS khẩn cấp (composer fallback)
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

  /// Kiểm tra trạng thái quyền SEND_SMS thực tế trên Android
  Future<bool> hasDirectSmsPermission() async {
    if (nativeInvokerForTest != null) {
      try {
        final res = await _invokeNative('hasSmsPermission');
        if (res is Map) return res['granted'] == true;
        if (res is bool) return res;
      } catch (_) {}
      return false;
    }
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final res = await _invokeNative('hasSmsPermission');
      if (res is Map) {
        return res['granted'] == true;
      }
    } catch (_) {}
    return false;
  }

  /// Xin quyền SEND_SMS chủ động (dùng trong Cài đặt & Quyền hệ thống)
  Future<bool> requestDirectSmsPermission() async {
    if (nativeInvokerForTest == null && (kIsWeb || !Platform.isAndroid)) {
      return false;
    }
    try {
      await _invokeNative('requestSmsPermission');
      await Future<void>.delayed(const Duration(milliseconds: 300));
      return await hasDirectSmsPermission();
    } catch (_) {
      return false;
    }
  }

  /// Đồng bộ danh bạ khẩn cấp + tọa độ xuống SharedPreferences cho background service
  Future<void> syncEmergencyContext({
    required List<String> phoneNumbers,
    required String victimName,
    double? lat,
    double? lng,
  }) async {
    if (nativeInvokerForTest == null && (kIsWeb || !Platform.isAndroid)) {
      return;
    }
    try {
      await _invokeNative('saveEmergencyContactsForBackground', {
        'phoneNumbers': phoneNumbers,
        'victimName': victimName,
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      });
    } catch (_) {}
  }

  /// Gửi SMS khẩn cấp TỰ ĐỘNG KHÔNG CẦN CHẠM qua Android SmsManager
  /// - [fallbackToComposer]: false đối với Duress PIN (tuyệt đối không bật app Tin nhắn lộ liễu!)
  Future<SmsDispatchResult> sendDirectSms({
    required String phoneNumber,
    required String message,
    bool fallbackToComposer = true,
  }) async {
    final cleanPhone = phoneNumber.replaceAll(RegExp(r'[^0-9+]'), '');
    if (cleanPhone.length < 3) {
      const res = SmsDispatchResult(
        sent: false,
        method: 'FAILED',
        phoneNumber: '',
        code: 'INVALID_PHONE',
        error: 'Số điện thoại người thân không hợp lệ',
      );
      _lastDispatchResult = res;
      return res;
    }

    // Tầng 1: Native SmsManager (không mở UI soạn tin, gửi thẳng ngay cả khi bất tỉnh)
    if (nativeInvokerForTest != null || (!kIsWeb && Platform.isAndroid)) {
      try {
        final raw = await _invokeNative('sendDirectSms', {
          'phoneNumber': cleanPhone,
          'message': message,
        });
        if (raw is Map && raw['sent'] == true) {
          _autoSmsDispatchCount++;
          final res = SmsDispatchResult(
            sent: true,
            method: (raw['method'] as String?) ?? 'SMS_MANAGER',
            phoneNumber: cleanPhone,
            parts: (raw['parts'] as int?) ?? 1,
          );
          _lastDispatchResult = res;
          debugPrint('[OfflineSosService] Zero-touch SmsManager sent to $cleanPhone (${res.parts} parts)');
          return res;
        }
        final errCode = raw is Map ? raw['code']?.toString() : null;
        final errMsg = raw is Map ? raw['error']?.toString() : null;
        if (!fallbackToComposer) {
          final res = SmsDispatchResult(
            sent: false,
            method: 'SMS_MANAGER',
            phoneNumber: cleanPhone,
            code: errCode ?? 'SMS_MANAGER_REJECTED',
            error: errMsg ?? 'Không bật giao diện tin nhắn ở chế độ ẩn danh Duress',
          );
          _lastDispatchResult = res;
          return res;
        }
      } catch (e) {
        if (!fallbackToComposer) {
          final res = SmsDispatchResult(
            sent: false,
            method: 'SMS_MANAGER',
            phoneNumber: cleanPhone,
            code: 'CHANNEL_ERROR',
            error: e.toString(),
          );
          _lastDispatchResult = res;
          return res;
        }
      }
    }

    // Tầng 2 (chỉ khi không phải Duress và cho phép composer fallback)
    if (!fallbackToComposer) {
      final res = SmsDispatchResult(
        sent: false,
        method: 'FAILED',
        phoneNumber: cleanPhone,
        code: 'COMPOSER_DISABLED',
      );
      _lastDispatchResult = res;
      return res;
    }

    final uri = buildSmsUri(phoneNumber: cleanPhone, message: message);
    try {
      final launched = uriLauncherForTest != null
          ? await uriLauncherForTest!(uri)
          : (await canLaunchUrl(uri) && await launchUrl(uri));
      final res = SmsDispatchResult(
        sent: launched,
        method: launched ? 'SMS_COMPOSER_FALLBACK' : 'FAILED',
        phoneNumber: cleanPhone,
      );
      _lastDispatchResult = res;
      return res;
    } catch (e) {
      final res = SmsDispatchResult(
        sent: false,
        method: 'FAILED',
        phoneNumber: cleanPhone,
        error: e.toString(),
      );
      _lastDispatchResult = res;
      return res;
    }
  }

  /// Gửi hàng loạt SMS tự động cho danh sách người thân (tối đa 3 số ưu tiên)
  Future<List<SmsDispatchResult>> dispatchToContacts({
    required List<String> phoneNumbers,
    required String message,
    bool fallbackToComposer = true,
  }) async {
    final targets = phoneNumbers
        .map((e) => e.replaceAll(RegExp(r'[^0-9+]'), ''))
        .where((e) => e.length >= 3)
        .toSet()
        .take(3)
        .toList();
    if (targets.isEmpty) {
      targets.add('115');
    }
    final results = <SmsDispatchResult>[];
    for (var i = 0; i < targets.length; i++) {
      // Chỉ dùng composer fallback cho số đầu tiên nếu SmsManager bị từ chối quyền
      final res = await sendDirectSms(
        phoneNumber: targets[i],
        message: message,
        fallbackToComposer: fallbackToComposer && i == 0,
      );
      results.add(res);
    }
    return results;
  }

  /// API tương thích cũ: ưu tiên gửi SmsManager không cần chạm trước khi fallback uri
  Future<bool> sendEmergencySms({
    required String phoneNumber,
    required String message,
    bool fallbackToComposer = true,
  }) async {
    final res = await sendDirectSms(
      phoneNumber: phoneNumber,
      message: message,
      fallbackToComposer: fallbackToComposer,
    );
    return res.sent;
  }
}
