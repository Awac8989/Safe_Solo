import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

class RecordedAudioNote {
  const RecordedAudioNote({
    required this.path,
    required this.durationSeconds,
  });

  final String path;
  final int durationSeconds;
}

class AudioNoteService {
  AudioNoteService({AudioRecorder? recorder}) : _recorder = recorder;

  AudioRecorder? _recorder;
  AudioRecorder? _getRecorderSafe() {
    if (Platform.environment.containsKey('FLUTTER_TEST')) return null;
    if (_recorder != null) return _recorder;
    try {
      _recorder = AudioRecorder();
      return _recorder;
    } catch (_) {
      return null;
    }
  }

  DateTime? _startedAt;

  Future<bool> start() async {
    final rec = _getRecorderSafe();
    if (rec == null) return false;
    try {
      if (!await rec.hasPermission()) {
        return false;
      }

      final tempDir = await getTemporaryDirectory();
      final voiceDir = Directory('${tempDir.path}${Platform.pathSeparator}safesolo_voice');
      if (!await voiceDir.exists()) {
        await voiceDir.create(recursive: true);
      }

      final path =
          '${voiceDir.path}${Platform.pathSeparator}voice_${DateTime.now().microsecondsSinceEpoch}.m4a';

      await rec.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: path,
      );

      _startedAt = DateTime.now();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<RecordedAudioNote?> stop() async {
    final rec = _getRecorderSafe();
    if (rec == null) return null;
    try {
      final path = await rec.stop();
      final startedAt = _startedAt;
      _startedAt = null;

      if (path == null || startedAt == null) {
        return null;
      }

      final file = File(path);
      if (!await file.exists()) {
        return null;
      }

      final seconds = DateTime.now().difference(startedAt).inSeconds.clamp(1, 999);
      return RecordedAudioNote(path: path, durationSeconds: seconds);
    } catch (_) {
      return null;
    }
  }

  Future<void> cancel() async {
    try {
      await _recorder?.cancel();
    } catch (_) {}
    _startedAt = null;
  }

  Future<void> dispose() async {
    try {
      await _recorder?.dispose();
    } catch (_) {}
  }
}
