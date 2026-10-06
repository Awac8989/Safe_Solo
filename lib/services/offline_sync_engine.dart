import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class QueuedRequest {
  final String id;
  final String endpoint;
  final String method;
  final Map<String, dynamic> body;
  final int timestampMs;

  QueuedRequest({
    required this.id,
    required this.endpoint,
    required this.method,
    required this.body,
    required this.timestampMs,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'endpoint': endpoint,
    'method': method,
    'body': body,
    'timestampMs': timestampMs,
  };

  factory QueuedRequest.fromJson(Map<String, dynamic> json) => QueuedRequest(
    id: json['id'] as String,
    endpoint: json['endpoint'] as String,
    method: json['method'] as String,
    body: Map<String, dynamic>.from(json['body'] as Map),
    timestampMs: json['timestampMs'] as int,
  );
}

class OfflineSyncEngine {
  OfflineSyncEngine._();
  static final OfflineSyncEngine instance = OfflineSyncEngine._();

  static const String _queueKey = 'offline_sync_queue';
  
  final ValueNotifier<bool> isOfflineMode = ValueNotifier(false);
  final ValueNotifier<double> syncProgress = ValueNotifier(0.0);
  final ValueNotifier<int> pendingCount = ValueNotifier(0);

  List<QueuedRequest> _queue = [];
  bool _isFlushing = false;

  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw != null) {
      try {
        final list = jsonDecode(raw) as List;
        _queue = list.map((e) => QueuedRequest.fromJson(e as Map<String, dynamic>)).toList();
        _queue.sort((a, b) => a.timestampMs.compareTo(b.timestampMs));
        pendingCount.value = _queue.length;
      } catch (e) {
        debugPrint('Failed to load sync queue: $e');
      }
    }
  }

  Future<void> _saveQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final data = _queue.map((e) => e.toJson()).toList();
    await prefs.setString(_queueKey, jsonEncode(data));
    pendingCount.value = _queue.length;
  }

  Future<void> enqueueRequest({
    required String endpoint,
    String method = 'POST',
    required Map<String, dynamic> body,
  }) async {
    final req = QueuedRequest(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      endpoint: endpoint,
      method: method,
      body: {
        ...body,
        '_clientTimestamp': DateTime.now().toIso8601String(), // For conflict resolution (Last Write Wins)
      },
      timestampMs: DateTime.now().millisecondsSinceEpoch,
    );
    _queue.add(req);
    await _saveQueue();
    isOfflineMode.value = true;
  }

  Future<void> flushQueue() async {
    if (_queue.isEmpty || _isFlushing) {
      if (_queue.isEmpty) isOfflineMode.value = false;
      return;
    }
    
    _isFlushing = true;
    isOfflineMode.value = false; // Attempting to sync, so assuming online
    final total = _queue.length;
    int processed = 0;

    // Use a copy to iterate
    final currentQueue = List<QueuedRequest>.from(_queue);

    for (final req in currentQueue) {
      try {
        if (req.method == 'POST') {
          await ApiService.instance.postRaw(req.endpoint, req.body);
        } else if (req.method == 'PUT') {
          await ApiService.instance.putRaw(req.endpoint, req.body);
        }
        
        _queue.removeWhere((e) => e.id == req.id);
        await _saveQueue();
        
        processed++;
        syncProgress.value = processed / total;
      } catch (e) {
        debugPrint('Failed to sync req ${req.id}: $e');
        isOfflineMode.value = true; // Still offline
        break; // Stop flushing if a network error occurs
      }
    }
    
    _isFlushing = false;
    Future.delayed(const Duration(seconds: 2), () {
      if (syncProgress.value >= 1.0) syncProgress.value = 0.0;
    });
  }
}
