import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/constants.dart';

/// ============================================================================
/// SAFESOLO - FIELD WEBRTC & AUDIO PTT SERVICE (HIỆP SĨ A71 <-> BÁC SĨ 115)
/// Tận dụng Socket.IO trên Backend (:4000) làm signaling WebRTC & Audio PTT:
/// - Room: incident_<incidentId>
/// - Camera2 Native 320x240 JPEG Live Feed -> Web Admin Drawer (/)
/// - Record / AudioPlayer 2-way Push-To-Talk & Doctor 115 CPR/Tourniquet directives
/// ============================================================================
class FieldWebRtcService extends ChangeNotifier {
  FieldWebRtcService._();
  static final FieldWebRtcService instance = FieldWebRtcService._();

  static const MethodChannel _nativeChannel =
      MethodChannel('com.example.safesolo/watch_native');
  static const EventChannel _sensorEventChannel =
      EventChannel('com.example.safesolo/watch_sensors');

  io.Socket? _socket;
  StreamSubscription<dynamic>? _cameraEventSub;
  AudioRecorder? _recorder;
  AudioPlayer? _player;

  String? _roomId;
  String? _peerName;
  bool _isConnected = false;
  bool _isCameraStreaming = false;
  bool _isPttTransmitting = false;
  bool _isReceivingAudio = false;
  int _framesSentCount = 0;
  int _remotePeerCount = 0;
  Uint8List? _latestLocalFrameBytes;
  String? _latestDoctorInstruction;
  String? _latestDoctorName;
  String? _currentAudioTempPath;
  DateTime? _pttStartedAt;
  final List<String> _activityLog = [];

  bool get isConnected => _isConnected;
  bool get isCameraStreaming => _isCameraStreaming;
  bool get isPttTransmitting => _isPttTransmitting;
  bool get isReceivingAudio => _isReceivingAudio;
  int get framesSentCount => _framesSentCount;
  int get remotePeerCount => _remotePeerCount;
  String? get roomId => _roomId;
  Uint8List? get latestLocalFrameBytes => _latestLocalFrameBytes;
  String? get latestDoctorInstruction => _latestDoctorInstruction;
  String? get latestDoctorName => _latestDoctorName;
  List<String> get activityLog => List.unmodifiable(_activityLog);

  void _log(String entry) {
    _activityLog.insert(0, entry);
    if (_activityLog.length > 20) _activityLog.removeLast();
  }

  String _resolveSocketBaseUrl() {
    var base = AppConstants.backendBaseUrl.trim();
    if (base.endsWith('/api')) {
      base = base.substring(0, base.length - 4);
    }
    return base;
  }

  /// Kết nối phòng WebRTC/PTT cho ca sự cố đang tác chiến
  void joinIncidentRoom({
    required String incidentId,
    required String heroId,
    required String heroName,
  }) {
    final targetRoom = incidentId.startsWith('incident_') ? incidentId : 'incident_$incidentId';
    if (_roomId == targetRoom && _socket != null && _socket!.connected) {
      return;
    }

    leaveRoom();
    _roomId = targetRoom;
    _peerName = heroName;

    final socketUrl = _resolveSocketBaseUrl();
    final sock = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'type': 'webrtc_field', 'apiKey': 'android-app-key-abc'})
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );

    sock.onConnect((_) {
      _isConnected = true;
      _log('Đã kết nối phòng WebRTC $targetRoom');
      sock.emit('webrtc:join_room', {
        'roomId': targetRoom,
        'peerId': heroId,
        'role': 'hero',
        'name': heroName,
      });
      sock.emit('ptt:join_channel', {
        'channelId': targetRoom,
        'roomId': targetRoom,
        'userId': heroId,
        'userName': heroName,
        'role': 'hero',
      });
      notifyListeners();
    });

    sock.onDisconnect((_) {
      _isConnected = false;
      notifyListeners();
    });

    sock.on('webrtc:room_peers', (data) {
      if (data is Map && data['peers'] is List) {
        _remotePeerCount = (data['peers'] as List).length;
        notifyListeners();
      }
    });

    sock.on('webrtc:peer_joined', (data) {
      _remotePeerCount++;
      if (data is Map) {
        _log('${data['name'] ?? 'Bác sĩ 115 / TOC'} đã vào phòng');
      }
      notifyListeners();
    });

    sock.on('webrtc:peer_left', (_) {
      if (_remotePeerCount > 0) _remotePeerCount--;
      notifyListeners();
    });

    // Nhận chỉ đạo trực tiếp CPR / Garô từ Bác sĩ 115 Web Admin
    sock.on('webrtc:doctor_instruction', (data) {
      if (data is Map) {
        _latestDoctorName = data['doctorName']?.toString() ?? 'Bác sĩ 115 TOC';
        _latestDoctorInstruction = data['message']?.toString() ?? '';
        _log('[$_latestDoctorName]: $_latestDoctorInstruction');
        HapticFeedback.heavyImpact();
        notifyListeners();
      }
    });

    sock.on('ptt:talk_start', (data) {
      _isReceivingAudio = true;
      if (data is Map && data['userName'] != null) {
        _log('${data['userName']} đang nói PTT...');
      }
      notifyListeners();
    });

    sock.on('ptt:audio_chunk', (data) async {
      if (data is! Map) return;
      final b64 = data['chunkBase64']?.toString();
      if (b64 == null || b64.isEmpty) return;
      try {
        final bytes = base64Decode(b64);
        _player ??= AudioPlayer();
        await _player!.play(BytesSource(bytes));
      } catch (e) {
        debugPrint('[FieldWebRtcService] Audio playback error: $e');
      }
    });

    sock.on('ptt:talk_end', (_) {
      _isReceivingAudio = false;
      notifyListeners();
    });

    sock.connect();
    _socket = sock;
    notifyListeners();
  }

  /// Bật / Tắt luồng Video 1 chiều từ Camera sau (Galaxy A71) gửi về Web Admin TOC
  Future<bool> startCameraStream() async {
    if (_isCameraStreaming) return true;
    if (kIsWeb || !Platform.isAndroid) return false;

    try {
      final raw = await _nativeChannel.invokeMethod<dynamic>('startFieldCameraStream');
      if (raw is Map && raw['started'] == true) {
        _isCameraStreaming = true;
        _framesSentCount = 0;
        _cameraEventSub?.cancel();
        _cameraEventSub = _sensorEventChannel.receiveBroadcastStream().listen((event) {
          if (event is! Map || !_isCameraStreaming) return;
          if (event['sensorType'] != 'FIELD_CAMERA_FRAME') return;
          final frameB64 = event['frameBase64'] as String?;
          if (frameB64 == null || frameB64.isEmpty) return;

          try {
            _latestLocalFrameBytes = base64Decode(frameB64);
          } catch (_) {}

          _framesSentCount++;
          if (_socket != null && _socket!.connected && _roomId != null) {
            _socket!.emit('webrtc:video_frame', {
              'roomId': _roomId,
              'frameBase64': frameB64,
              'width': event['width'] ?? 320,
              'height': event['height'] ?? 240,
              'fps': 8,
              'senderName': _peerName ?? 'Hiệp sĩ',
              'cameraFacing': 'BACK',
              'ts': event['timestamp'] ?? DateTime.now().millisecondsSinceEpoch,
            });
          }
          notifyListeners();
        });
        _log('Đã bật Camera trực tiếp gửi về Bác sĩ 115 Web Admin');
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('[FieldWebRtcService] startCameraStream failed: $e');
    }
    return false;
  }

  Future<void> stopCameraStream() async {
    _isCameraStreaming = false;
    await _cameraEventSub?.cancel();
    _cameraEventSub = null;
    if (!kIsWeb && Platform.isAndroid) {
      try {
        await _nativeChannel.invokeMethod('stopFieldCameraStream');
      } catch (_) {}
    }
    _log('Đã dừng luồng Camera hiện trường');
    notifyListeners();
  }

  /// Bắt đầu giữ nút Bộ đàm PTT (thu âm thật micro nếu có quyền)
  Future<void> startPttTalk({required String userId, required String userName}) async {
    if (_isPttTransmitting) return;
    _isPttTransmitting = true;
    _pttStartedAt = DateTime.now();
    HapticFeedback.mediumImpact();

    _socket?.emit('ptt:talk_start', {
      'channelId': _roomId ?? 'channel_emergency_main',
      'roomId': _roomId,
      'userId': userId,
      'userName': userName,
      'role': 'hero',
    });

    try {
      _recorder ??= AudioRecorder();
      if (await _recorder!.hasPermission()) {
        final dir = await getTemporaryDirectory();
        final path = '${dir.path}/ptt_${DateTime.now().millisecondsSinceEpoch}.m4a';
        _currentAudioTempPath = path;
        await _recorder!.start(
          const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 64000, sampleRate: 16000),
          path: path,
        );
      }
    } catch (e) {
      debugPrint('[FieldWebRtcService] AudioRecorder start fallback: $e');
    }
    notifyListeners();
  }

  /// Nhả nút Bộ đàm PTT -> Đóng gói âm thanh thật gửi Bác sĩ 115 qua Socket.IO
  Future<void> stopPttTalk({required String userId, required String userName}) async {
    if (!_isPttTransmitting) return;
    _isPttTransmitting = false;
    HapticFeedback.lightImpact();

    final duration = DateTime.now().difference(_pttStartedAt ?? DateTime.now()).inSeconds;
    String? recordedPath;
    try {
      recordedPath = await _recorder?.stop();
    } catch (_) {}

    final pathToRead = recordedPath ?? _currentAudioTempPath;
    _currentAudioTempPath = null;
    if (pathToRead != null && File(pathToRead).existsSync()) {
      try {
        final bytes = await File(pathToRead).readAsBytes();
        if (bytes.isNotEmpty && bytes.length < 2 * 1024 * 1024) {
          _socket?.emit('ptt:audio_chunk', {
            'channelId': _roomId ?? 'channel_emergency_main',
            'roomId': _roomId,
            'userId': userId,
            'userName': userName,
            'role': 'hero',
            'mimeType': 'audio/mp4',
            'chunkBase64': base64Encode(bytes),
          });
        }
        unawaited(File(pathToRead).delete().catchError((_) => File(pathToRead)));
      } catch (e) {
        debugPrint('[FieldWebRtcService] PTT send audio error: $e');
      }
    }

    _socket?.emit('ptt:talk_end', {
      'channelId': _roomId ?? 'channel_emergency_main',
      'roomId': _roomId,
      'userId': userId,
      'userName': userName,
      'role': 'hero',
      'durationSeconds': duration,
    });
    _log('Đã truyền thoại PTT (${duration}s) tới Bác sĩ 115');
    notifyListeners();
  }

  void leaveRoom() {
    unawaited(stopCameraStream());
    if (_socket != null) {
      if (_roomId != null) {
        _socket!.emit('webrtc:leave_room', {'roomId': _roomId});
      }
      _socket!.dispose();
      _socket = null;
    }
    _roomId = null;
    _isConnected = false;
    _remotePeerCount = 0;
    notifyListeners();
  }
}
