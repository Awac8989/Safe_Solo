import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:safesolo/models/watch_protocol.dart';
import 'package:safesolo/services/fall_fusion_engine.dart';
import 'package:safesolo/services/offline_sos_service.dart';
import 'package:safesolo/services/watch_sync_manager.dart';

void main() {
  group('3-Phase Sensor Fusion Anti-False-Alarm (IMU + Off-Body + PPG)', () {
    test('Phase 1+2 rejects drop-on-table impact when Off-Body == true', () {
      var fakeNow = DateTime(2026, 11, 25, 16, 0, 0);
      final fusion = FallFusionEngine.testable(clock: () => fakeNow);
      var confirmedCalled = false;
      FallFusionPhase? blockedPhase;
      fusion.onConfirmedFall = (_) => confirmedCalled = true;
      fusion.onFalseAlarmBlocked = (phase, _) => blockedPhase = phase;

      // Đồng hồ tháo trên tay nằm trên bàn -> phát sinh va chạm 3.2G khi đặt mạnh
      fusion.updateVitals(heartRate: 0, spO2: 0, isOffWrist: true);
      fusion.ingestAccelerometer(axG: 3.2, ayG: 0.2, azG: 0.1, timestamp: fakeNow);

      expect(fusion.phase, FallFusionPhase.rejectedOffWrist);
      expect(blockedPhase, FallFusionPhase.rejectedOffWrist);
      expect(fusion.falseAlarmsBlockedCount, 1);
      expect(confirmedCalled, isFalse);
    });

    test('Phase 2 rejects bump when wearer keeps moving during 4s window', () {
      var fakeNow = DateTime(2026, 11, 25, 16, 0, 0);
      final fusion = FallFusionEngine.testable(clock: () => fakeNow);
      var confirmedCalled = false;
      fusion.onConfirmedFall = (_) => confirmedCalled = true;

      fusion.updateVitals(heartRate: 88, spO2: 98, isOffWrist: false);
      // Pha 1: Va chạm 2.8G khi vỗ tay / đập nhẹ lúc đeo trên tay
      fusion.ingestAccelerometer(axG: 2.8, ayG: 0.1, azG: 0.2, timestamp: fakeNow);
      expect(fusion.phase, FallFusionPhase.stillnessOffBodyCheck);

      // Pha 2: Người dùng tiếp tục vận động bình thường (deltaG > 0.65G) trong 4 giây
      for (var sec = 1; sec <= 4; sec++) {
        fakeNow = fakeNow.add(const Duration(seconds: 1));
        fusion.ingestAccelerometer(axG: 1.85, ayG: 0.4, azG: 0.3, timestamp: fakeNow);
      }

      expect(fusion.phase, FallFusionPhase.rejectedPostImpactMotion);
      expect(fusion.falseAlarmsBlockedCount, 1);
      expect(confirmedCalled, isFalse);
    });

    test('Phase 1 -> 2 -> 3 confirms unconscious fall on wrist with PPG tachycardia & stillness', () {
      var fakeNow = DateTime(2026, 11, 25, 16, 0, 0);
      final fusion = FallFusionEngine.testable(clock: () => fakeNow);
      FallFusionConfirmedEvent? confirmedEvent;
      int? countdownSecs;
      fusion.onConfirmedFall = (e) => confirmedEvent = e;
      fusion.onPhase3CountdownStarted = (sec, _, __) => countdownSecs = sec;

      fusion.updateVitals(heartRate: 138, spO2: 89, isOffWrist: false);

      // Pha 1: Té ngã va chạm 3.8G khi đeo trên cổ tay
      fusion.ingestAccelerometer(axG: 3.7, ayG: 0.6, azG: 0.6, timestamp: fakeNow);
      expect(fusion.phase, FallFusionPhase.stillnessOffBodyCheck);

      // Pha 2: Bất động ~1.0G liên tục trong cửa sổ 4 giây (On-wrist == true)
      for (var ms = 1200; ms <= 4200; ms += 600) {
        final ts = fakeNow.add(Duration(milliseconds: ms));
        fusion.ingestAccelerometer(axG: 0.02, ayG: 0.01, azG: 1.0, timestamp: ts);
      }

      expect(fusion.phase, FallFusionPhase.ppgAndCountdown);
      expect(countdownSecs, 15);
      expect(fusion.ppgAnomalyReason, contains('138 BPM'));
      expect(fusion.ppgAnomalyReason, contains('89%'));

      // Kết thúc 15s không hủy -> Xác nhận SOS với đầy đủ sóng G-Force & PPG
      final event = fusion.confirmPhase3Now();
      expect(fusion.phase, FallFusionPhase.confirmedSos);
      expect(confirmedEvent, isNotNull);
      expect(event.peakSvmG, greaterThanOrEqualTo(3.7));
      expect(event.isOffWrist, isFalse);
      expect(event.fusionConfidence, greaterThanOrEqualTo(0.85));
      expect(event.gForceWaveform.length, greaterThanOrEqualTo(5));
      expect(event.ppgWaveform.length, greaterThanOrEqualTo(5));

      // Cleanup timer if still scheduled
      fusion.resetForTesting();
    });
  });

  group('Zero-Touch SmsManager & Duress Stealth Safety', () {
    tearDown(() {
      OfflineSosService.instance.nativeInvokerForTest = null;
      OfflineSosService.instance.uriLauncherForTest = null;
    });

    test('sendDirectSms uses Android SmsManager without launching UI composer', () async {
      var composerLaunched = false;
      String? capturedMethod;
      String? capturedPhone;

      OfflineSosService.instance.nativeInvokerForTest = (method, args) async {
        capturedMethod = method;
        capturedPhone = args?['phoneNumber'] as String?;
        return {'sent': true, 'method': 'SMS_MANAGER', 'parts': 1};
      };
      OfflineSosService.instance.uriLauncherForTest = (_) async {
        composerLaunched = true;
        return true;
      };

      final res = await OfflineSosService.instance.sendDirectSms(
        phoneNumber: '0909 123 456',
        message: 'SAFESOLO SOS TEST',
        fallbackToComposer: true,
      );

      expect(capturedMethod, 'sendDirectSms');
      expect(capturedPhone, '0909123456');
      expect(res.sent, isTrue);
      expect(res.method, 'SMS_MANAGER');
      expect(composerLaunched, isFalse);
    });

    test('Duress stealth mode NEVER opens SMS composer UI when permission denied', () async {
      var composerLaunched = false;
      OfflineSosService.instance.nativeInvokerForTest = (_, __) async {
        return {'sent': false, 'code': 'PERMISSION_DENIED'};
      };
      OfflineSosService.instance.uriLauncherForTest = (_) async {
        composerLaunched = true;
        return true;
      };

      final res = await OfflineSosService.instance.sendDirectSms(
        phoneNumber: '0909123456',
        message: 'SILENT DURESS PIN',
        fallbackToComposer: false,
      );

      expect(res.sent, isFalse);
      expect(composerLaunched, isFalse);
    });
  });

  group('Wear OS Data Layer Bluetooth Bridge -> Phone Relay & Fallback', () {
    test('Phone handles incoming Wear MessageClient packet over BT and calls offline fallback', () async {
      final mgr = WatchSyncManager.instance;
      mgr.setIsRunningOnWatch(false);
      mgr.cloudRelayOverrideForTest = (_) async => false; // Mô phỏng Phone mất mạng 4G/Wi-Fi

      String? receivedAction;
      String? offlineFallbackAction;
      mgr.onWatchEmergencyReceived = (action, _) {
        receivedAction = action;
      };
      mgr.onOfflineEmergencyFallback = (action, _) async {
        offlineFallbackAction = action;
      };

      final pkt = WatchPacket.create(
        sender: WatchSender.watch,
        type: WatchPacketType.emergency,
        action: WatchAction.duressSos,
        payload: {
          'deviceId': 'watch_r900_bt_test',
          'heartRate': 134,
          'spO2': 93,
          'battery': 77,
        },
      );

      await mgr.handleNativeWearBridgeEvent({
        'sensorType': 'WEAR_MESSAGE',
        'path': '/safesolo/packet',
        'payloadJson': jsonEncode(pkt.toJson()),
        'timestamp': DateTime.now().millisecondsSinceEpoch - 18,
      });

      expect(mgr.isWearDataLayerConnected, isTrue);
      expect(mgr.connectionType, WatchConnectionType.localBle);
      expect(receivedAction, WatchAction.duressSos);
      expect(offlineFallbackAction, WatchAction.duressSos);
      mgr.cloudRelayOverrideForTest = null;
    });
  });
}
