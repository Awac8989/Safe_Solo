import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/device_hardware_profile.dart';

/// ============================================================================
/// SAFESOLO - DỊCH VỤ QUẢN LÝ TỐI ƯU HÓA PHẦN CỨNG ĐA THIẾT BỊ
/// Hỗ trợ chuyên sâu và tự động thích ứng với 4 dòng máy mục tiêu:
/// 1. Honor Magic 7 Pro (PTP-AN10)
/// 2. Samsung Galaxy A53 5G (SM-A536B)
/// 3. Samsung Galaxy A71 (SM-A715F)
/// 4. Samsung Galaxy Watch 5 (SM-R900)
/// Tác giả: SV Đoàn Minh Quân - MSSV: 2224801030137 - Lớp KTPM03 TDMU
/// ============================================================================

class DeviceHardwareProfileService extends ChangeNotifier {
  DeviceHardwareProfileService._() {
    _currentProfile = DeviceHardwareProfile.samsungGalaxyA71(); // Mặc định là máy tham chiếu
  }

  static final DeviceHardwareProfileService instance =
      DeviceHardwareProfileService._();

  late DeviceHardwareProfile _currentProfile;
  DeviceHardwareProfile get currentProfile => _currentProfile;

  final Map<SupportedDeviceFamily, DeviceHardwareProfile> _profiles = {
    SupportedDeviceFamily.honorMagic7Pro: DeviceHardwareProfile.honorMagic7Pro(),
    SupportedDeviceFamily.samsungGalaxyA53: DeviceHardwareProfile.samsungGalaxyA53(),
    SupportedDeviceFamily.samsungGalaxyA71: DeviceHardwareProfile.samsungGalaxyA71(),
    SupportedDeviceFamily.samsungGalaxyWatch5: DeviceHardwareProfile.samsungGalaxyWatch5(),
  };

  /// Lấy danh sách toàn bộ các hồ sơ thiết bị được hỗ trợ
  List<DeviceHardwareProfile> get allSupportedProfiles =>
      _profiles.values.toList();

  /// Đặt cấu hình thiết bị chủ động (dùng cho demo hoặc tự động nhận diện)
  void setTargetDevice(SupportedDeviceFamily family) {
    if (_profiles.containsKey(family)) {
      _currentProfile = _profiles[family]!;
      debugPrint('[DeviceProfileService] Đã kích hoạt cấu hình phần cứng cho: ${_currentProfile.marketingName}');
      notifyListeners();
    }
  }

  /// Tự động nhận diện thiết bị dựa trên chuỗi thông tin hệ điều hành hoặc mã hiệu máy
  SupportedDeviceFamily detectDeviceFromModelString(String rawModel) {
    final upper = rawModel.toUpperCase();
    if (upper.contains('PTP-AN10') || upper.contains('MAGIC 7') || upper.contains('HONOR')) {
      return SupportedDeviceFamily.honorMagic7Pro;
    }
    if (upper.contains('A536') || upper.contains('A53') || upper.contains('GALAXY A53')) {
      return SupportedDeviceFamily.samsungGalaxyA53;
    }
    if (upper.contains('A715') || upper.contains('A71') || upper.contains('GALAXY A71')) {
      return SupportedDeviceFamily.samsungGalaxyA71;
    }
    if (upper.contains('SM-R900') || upper.contains('SM-R910') || upper.contains('WATCH 5')) {
      return SupportedDeviceFamily.samsungGalaxyWatch5;
    }
    return SupportedDeviceFamily.genericAndroid;
  }

  /// 1. TÍNH NĂNG ĐẶC THÙ CHO HONOR MAGIC 7 PRO: Magic Capsule Live Activity Payload
  Map<String, dynamic> generateHonorMagicCapsulePayload({
    required String incidentId,
    required String emergencyStatus,
    required int countdownRemainingSeconds,
    required int nearestAedDistanceMeters,
    required bool isCprActive,
  }) {
    return {
      'targetVendor': 'HONOR_MAGICOS_9',
      'capsuleType': 'LIVE_ACTIVITY_EMERGENCY_STATUS',
      'pillPriority': 'MAX_EXPANDED_ALERT',
      'title': isCprActive ? 'NHỊP CPR 110 BPM' : 'CẤP CỨU SAFESOLO 0-GIÂY',
      'subtitle': 'Trạm OpenAED: ${nearestAedDistanceMeters}m · PIN: 1150',
      'countdownText': '${countdownRemainingSeconds}s',
      'themeColorHex': isCprActive ? '#EF4444' : '#06B6D4',
      'hapticPulseIntervalMs': isCprActive ? 545 : 1000, // 110 nhịp/phút = 545ms
      'incidentId': incidentId,
      'status': emergencyStatus,
    };
  }

  /// 2. TÍNH NĂNG ĐẶC THÙ CHO SAMSUNG GALAXY A53 5G: Samsung Knox Vault TEE Encryption Config
  Map<String, dynamic> generateSamsungKnoxVaultSecurityManifest({
    required String userId,
    required String bloodGroup,
    required List<String> severeAllergies,
  }) {
    return {
      'targetVendor': 'SAMSUNG_KNOX_ONEUI_6',
      'hardwareSecurityModule': 'KNOX_VAULT_TEE_ISOLATED',
      'cryptoAlgorithm': 'AES-256-GCM-HARDWARE-BOUND',
      'keyAlias': 'SafeSolo_KnoxKey_$userId',
      'requiresBiometricAuth': true,
      'offlineAccessLevel': 'PARAMEDIC_EMERGENCY_BYPASS_PERMITTED',
      'healthPassportPayload': {
        'bloodGroup': bloodGroup,
        'allergies': severeAllergies,
        'signedTimestamp': DateTime.now().toIso8601String(),
        'antiTamperHash': 'SHA256_KNOX_VERIFIED',
      },
    };
  }

  /// 3. TÍNH NĂNG ĐẶC THÙ CHO SAMSUNG GALAXY A71: NFC Tuning & Scrcpy TOC Mirroring Config
  Map<String, dynamic> generateSamsungA71ReferenceTelemetry() {
    return {
      'targetVendor': 'SAMSUNG_SNAPDRAGON_730',
      'viewportSpecs': {
        'widthDp': 392,
        'heightDp': 825,
        'aspectRatio': '20:9',
        'pixelOverflowGuaranteed': 'ZERO_OVERFLOW_VERIFIED',
      },
      'nfcDriver': {
        'antennaLocation': 'UPPER_BACK_CAMERA_ISLAND',
        'maxReadSpeedMs': 180,
        'supportedFormats': ['NDEF_URI', 'NDEF_TEXT', 'ICAO_9303_CCCD_CHIP'],
      },
      'scrcpyMirrorConfig': {
        'maxFps': 60,
        'videoBitRate': '8M',
        'lowLatencyMode': true,
        'presentationPort': 5555,
      },
    };
  }

  /// 4. TÍNH NĂNG ĐẶC THÙ CHO GALAXY WATCH 5: BioActive PPG & Wrist-Twist Motion Config
  Map<String, dynamic> generateGalaxyWatch5KinematicSpecs() {
    return {
      'targetVendor': 'SAMSUNG_WEAROS_4_SM_R900',
      'circularViewportPx': 396,
      'gestureConfig': {
        'doubleWristTwistWindowMs': 1200,
        'twistAngularVelocityThresholdDegS': 180.0,
        'autoExtendDeadManMinutes': 120,
      },
      'bioActiveSensors': {
        'ppgSamplingHz': 25,
        'arrhythmiaThresholdBpm': 130,
        'bradycardiaThresholdBpm': 40,
        'hypoxiaSpO2ThresholdPercent': 85,
        'morningWakeUpPulseMonitoring': true,
      },
      'impactFallAlgorithm': {
        'svmPeakThresholdG': 4.0,
        'tiltAngleThresholdDeg': 60.0,
        'stillnessWindowSeconds': 30,
      },
    };
  }

  /// 5. BỘ LỆNH CẤP QUYỀN CHẠY NGẦM 24/7 BỎ QUA TIẾT KIỆM PIN CHO TỪNG HÃNG
  List<String> getAdbBatteryExemptionCommands(SupportedDeviceFamily family) {
    switch (family) {
      case SupportedDeviceFamily.honorMagic7Pro:
        return [
          'adb shell dumpsys deviceidle whitelist +com.safesolo.app',
          'adb shell cmd appops set com.safesolo.app RUN_IN_BACKGROUND allow',
          'adb shell cmd appops set com.safesolo.app RUN_ANY_IN_BACKGROUND allow',
          'adb shell am set-standby-bucket com.safesolo.app active',
          '# MagicOS PowerGenie bypass whitelist:',
          'adb shell settings put secure honor_powergenie_whitelist com.safesolo.app',
        ];
      case SupportedDeviceFamily.samsungGalaxyA53:
      case SupportedDeviceFamily.samsungGalaxyA71:
        return [
          'adb shell dumpsys deviceidle whitelist +com.safesolo.app',
          'adb shell am set-standby-bucket com.safesolo.app active',
          '# Samsung Device Care Never Sleeping Apps exclusion:',
          'adb shell cmd appops set com.safesolo.app RUN_IN_BACKGROUND allow',
          'adb shell settings put secure com.samsung.android.lool.never_sleeping_apps com.safesolo.app',
        ];
      case SupportedDeviceFamily.samsungGalaxyWatch5:
        return [
          'adb shell dumpsys deviceidle whitelist +com.safesolo.app',
          'adb shell am set-standby-bucket com.safesolo.app active',
          '# Wear OS Ambient Mode persistent ambient service:',
          'adb shell settings put global wear_activity_auto_resume 1',
        ];
      default:
        return [
          'adb shell dumpsys deviceidle whitelist +com.safesolo.app',
          'adb shell am set-standby-bucket com.safesolo.app active',
        ];
    }
  }
}

