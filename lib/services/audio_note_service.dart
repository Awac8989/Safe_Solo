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
  AudioNoteService() : _recorder = AudioRecorder();

  final AudioRecorder _recorder;
  DateTime? _startedAt;

  Future<bool> start() async {
    if (!await _recorder.hasPermission()) {
      return false;
    }

    final tempDir = await getTemporaryDirectory();
    final voiceDir = Directory('${tempDir.path}${Platform.pathSeparator}safesolo_voice');
    if (!await voiceDir.exists()) {
      await voiceDir.create(recursive: true);
    }

    final path =
        '${voiceDir.path}${Platform.pathSeparator}voice_${DateTime.now().microsecondsSinceEpoch}.m4a';

    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
      ),
      path: path,
    );

    _startedAt = DateTime.now();
    return true;
  }

  Future<RecordedAudioNote?> stop() async {
    final path = await _recorder.stop();
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
  }

  Future<void> cancel() async {
    await _recorder.cancel();
    _startedAt = null;
  }

  Future<void> dispose() async {
    await _recorder.dispose();
  }
}
