import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants.dart';

class ChatService {
  static final ChatService _instance = ChatService._internal();
  static ChatService get instance => _instance;

  ChatService._internal();

  IO.Socket? _socket;
  String? _token;
  final _client = http.Client();

  final List<Function(Map<String, dynamic>)> _messageListeners = [];

  void addMessageListener(Function(Map<String, dynamic>) listener) {
    _messageListeners.add(listener);
  }

  void removeMessageListener(Function(Map<String, dynamic>) listener) {
    _messageListeners.remove(listener);
  }

  String get _socketUrl {
    final base = AppConstants.backendBaseUrl;
    if (base.endsWith('/api')) {
      return base.substring(0, base.length - 4);
    }
    return base;
  }

  void connect(String token) {
    if (_socket != null && _socket!.connected) return;
    _token = token;

    _socket = IO.io(
      _socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket!.onConnect((_) {
      print('ChatService connected to socket');
    });

    _socket!.onDisconnect((_) {
      print('ChatService disconnected from socket');
    });

    _socket!.on('new_message', (data) {
      for (final listener in _messageListeners) {
        listener(data);
      }
    });

    _socket!.on('message_sent', (data) {
      for (final listener in _messageListeners) {
        listener(data);
      }
    });

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _token = null;
  }

  void joinRoom(String roomId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('join_rescue_room', roomId);
    }
  }

  void leaveRoom(String roomId) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('leave_rescue_room', roomId);
    }
  }

  void sendMessageSocket(String roomId, String messageType, String content) {
    if (_socket != null && _socket!.connected) {
      _socket!.emit('send_message', {
        'roomId': roomId,
        'messageType': messageType,
        'content': content,
      });
    }
  }

  Future<List<Map<String, dynamic>>> getMessages(String roomId, String token) async {
    final uri = Uri.parse('${AppConstants.backendBaseUrl}/chat/$roomId/messages');
    final response = await _client.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = jsonDecode(response.body);
      if (data['success'] == true) {
        return List<Map<String, dynamic>>.from(data['data']['messages'] ?? []);
      }
    }
    throw Exception('Failed to get messages: ${response.body}');
  }
}
