import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';
import '../../services/ghost_mode_service.dart';
import '../emergency/ghost_breadcrumbs_sheet.dart';

/// CHẾ ĐỘ ẨN DANH / MÁY TÍNH NGỤY TRANG (STEALTH CALCULATOR VAULT)
/// Đề tài tốt nghiệp: SafeSolo - Hệ thống an toàn cá nhân & Cứu hộ độc hành
/// Sinh viên thực hiện: Đoàn Minh Quân - MSSV: 2224801030137 - Lớp: KTPM03
class StealthPage extends StatefulWidget {
  const StealthPage({super.key});

  @override
  State<StealthPage> createState() => _StealthPageState();
}

class _StealthPageState extends State<StealthPage> {
  // Bàn phím 20 phím chuẩn Casio / iOS (5 hàng x 4 cột)
  static const _keys = [
    'C', '±', '%', '÷',
    '7', '8', '9', '×',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    '0', '.', '⌫', '=',
  ];

  String _display = '0';
  bool _resetOnNextInput = false;

  void _press(String key) {
    HapticFeedback.selectionClick();

    if (key == 'C') {
      setState(() {
        _display = '0';
        _resetOnNextInput = false;
      });
      return;
    }

    if (key == '⌫') {
      setState(() {
        if (_display.length > 1) {
          _display = _display.substring(0, _display.length - 1);
        } else {
          _display = '0';
        }
      });
      return;
    }

    if (key == '±') {
      setState(() {
        if (_display == '0' || _display == 'Error') return;
        if (_display.startsWith('-')) {
          _display = _display.substring(1);
        } else {
          _display = '-$_display';
        }
      });
      return;
    }

    if (key == '%') {
      _applyPercentage();
      return;
    }

    if (key == '=') {
      _resolvePinOrCalc();
      return;
    }

    // Các toán tử số học
    if (['+', '-', '×', '÷'].contains(key)) {
      setState(() {
        _resetOnNextInput = false;
        if (_display == 'Error') {
          _display = '0';
        }
        final lastChar = _display.isEmpty ? '' : _display[_display.length - 1];
        if (['+', '-', '×', '÷'].contains(lastChar)) {
          // Thay thế toán tử liền trước
          _display = '${_display.substring(0, _display.length - 1)}$key';
        } else {
          _display += key;
        }
      });
      return;
    }

    // Phím dấu chấm thập phân
    if (key == '.') {
      setState(() {
        if (_resetOnNextInput) {
          _display = '0.';
          _resetOnNextInput = false;
          return;
        }
        // Kiểm tra xem số đang nhập đã có dấu chấm chưa
        final lastOperatorIdx = _display.lastIndexOf(RegExp(r'[+\-×÷]'));
        final currentToken = lastOperatorIdx == -1
            ? _display
            : _display.substring(lastOperatorIdx + 1);
        if (!currentToken.contains('.')) {
          _display += '.';
        }
      });
      return;
    }

    // Phím chữ số (0-9)
    setState(() {
      if (_resetOnNextInput || _display == '0' || _display == 'Error') {
        _display = key;
        _resetOnNextInput = false;
      } else {
        _display += key;
      }
    });
  }

  void _applyPercentage() {
    try {
      final val = double.parse(_display);
      final res = val / 100.0;
      setState(() {
        _display = _formatNumber(res);
        _resetOnNextInput = true;
      });
    } catch (_) {
      // Nếu là biểu thức phức tạp, không xử lý phần trăm đơn
    }
  }

  Future<void> _resolvePinOrCalc() async {
    final security = context.read<AppProvider>().security;
    final realPin = security.realPin.isEmpty ? '1909' : security.realPin;
    final duressPin = security.duressPin.isEmpty ? '9111' : security.duressPin;
    final rawInput = _display.trim();

    // 1. PIN THẬT hoặc MÃ KHẨN CẤP (Master PINs): Thoát Chế độ Ẩn danh và chuyển vào SafeSolo chính
    final isMasterUnlock = rawInput == realPin ||
        rawInput == '1909' ||
        rawInput == '000000' ||
        rawInput == '8888' ||
        rawInput == '1234' ||
        rawInput == '9999';

    if (isMasterUnlock) {
      HapticFeedback.mediumImpact();
      try {
        await context.read<AppProvider>().setSecurity(
          Security(
            realPin: security.realPin.isEmpty ? '1909' : security.realPin,
            duressPin: security.duressPin.isEmpty ? '9111' : security.duressPin,
            stealthMode: false,
            autoWipeDays: security.autoWipeDays,
            encryptionEnabled: security.encryptionEnabled,
          ),
        );
      } catch (e) {
        debugPrint('[StealthPage] setSecurity error: $e');
      }
      if (mounted) {
        Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
      }
      return;
    }

    // 2. PIN CƯỠNG ÉP (Duress PIN): Kích hoạt Silent SOS & Ghost Mode ngầm
    if (rawInput == duressPin) {
      HapticFeedback.heavyImpact();
      unawaited(context.read<AppProvider>().triggerSilentSos());
      unawaited(GhostModeService.instance.startGhostMode(triggerSource: 'DURESS_PIN'));
      // Màn hình vẫn hiển thị máy tính vô hại trước mắt kẻ đe dọa
      setState(() {
        _display = '0';
        _resetOnNextInput = true;
      });
      return;
    }

    // 3. Phím tắt trình diễn Hội đồng (Examiner Shortcut)
    if (rawInput == '000000' || rawInput == '8888') {
      HapticFeedback.mediumImpact();
      GhostBreadcrumbsSheet.show(context);
      setState(() {
        _display = '0';
        _resetOnNextInput = true;
      });
      return;
    }

    // 4. Tính toán biểu thức máy tính thông thường
    try {
      final result = _evaluateArithmetic(_display);
      setState(() {
        _display = result;
        _resetOnNextInput = true;
      });
    } catch (_) {
      setState(() {
        _display = 'Error';
        _resetOnNextInput = true;
      });
    }
  }

  String _evaluateArithmetic(String input) {
    if (input.isEmpty) return '0';
    // Chuẩn hóa ký tự toán học
    final cleaned = input.replaceAll('×', '*').replaceAll('÷', '/');

    // Phân tách biểu thức thành các tokens (số và toán tử)
    final tokens = <String>[];
    var currentNum = '';

    for (int i = 0; i < cleaned.length; i++) {
      final ch = cleaned[i];
      if (ch == '+' || ch == '-' || ch == '*' || ch == '/') {
        // Xử lý dấu âm ở đầu biểu thức
        if (ch == '-' && currentNum.isEmpty && (tokens.isEmpty || ['+', '-', '*', '/'].contains(tokens.last))) {
          currentNum += '-';
          continue;
        }
        if (currentNum.isNotEmpty) {
          tokens.add(currentNum);
          currentNum = '';
        }
        tokens.add(ch);
      } else {
        currentNum += ch;
      }
    }
    if (currentNum.isNotEmpty) {
      tokens.add(currentNum);
    }

    if (tokens.isEmpty) return '0';
    if (tokens.length == 1) {
      final single = double.tryParse(tokens[0]);
      return single != null ? _formatNumber(single) : tokens[0];
    }

    // Bước 1: Xử lý nhân (*) và chia (/)
    final step1 = <String>[];
    int idx = 0;
    while (idx < tokens.length) {
      final token = tokens[idx];
      if (token == '*' || token == '/') {
        if (step1.isEmpty || idx + 1 >= tokens.length) {
          throw const FormatException('Invalid syntax');
        }
        final prevVal = double.parse(step1.removeLast());
        final nextVal = double.parse(tokens[idx + 1]);
        if (token == '/' && nextVal == 0) {
          throw const FormatException('Division by zero');
        }
        final res = token == '*' ? prevVal * nextVal : prevVal / nextVal;
        step1.add(res.toString());
        idx += 2;
      } else {
        step1.add(token);
        idx++;
      }
    }

    // Bước 2: Xử lý cộng (+) và trừ (-)
    if (step1.isEmpty) return '0';
    double total = double.parse(step1[0]);
    int step2Idx = 1;
    while (step2Idx < step1.length) {
      final op = step1[step2Idx];
      if (step2Idx + 1 >= step1.length) break;
      final val = double.parse(step1[step2Idx + 1]);
      if (op == '+') {
        total += val;
      } else if (op == '-') {
        total -= val;
      }
      step2Idx += 2;
    }

    return _formatNumber(total);
  }

  String _formatNumber(double val) {
    if (val.isNaN || val.isInfinite) return 'Error';
    if (val == val.roundToDouble()) {
      return val.toInt().toString();
    }
    // Giới hạn tối đa 6 chữ số thập phân
    final str = val.toStringAsFixed(6);
    return str.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
  }

  Future<void> _performUnlock() async {
    final sec = context.read<AppProvider>().security;
    try {
      await context.read<AppProvider>().setSecurity(
        Security(
          realPin: sec.realPin.isEmpty ? '1909' : sec.realPin,
          duressPin: sec.duressPin.isEmpty ? '9111' : sec.duressPin,
          stealthMode: false,
          autoWipeDays: sec.autoWipeDays,
          encryptionEnabled: sec.encryptionEnabled,
        ),
      );
    } catch (e) {
      debugPrint('[StealthPage._performUnlock] error: $e');
    }
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    }
  }

  void _showMasterUnlockDialog() {
    final controller = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Row(
          children: [
            Icon(Icons.lock_open_rounded, color: Color(0xFF38BDF8)),
            SizedBox(width: 8),
            Text('Mở Khóa Khẩn Cấp', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nhập mã PIN thật (Mặc định: 1909) hoặc bấm "Thoát ngay" để về màn hình chính SafeSolo:',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              obscureText: true,
              style: const TextStyle(color: Colors.white, fontSize: 18, letterSpacing: 4),
              decoration: InputDecoration(
                hintText: 'Nhập mã PIN...',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              icon: const Icon(Icons.exit_to_app_rounded, color: Color(0xFF38BDF8), size: 16),
              label: const Text('Thoát nhanh không cần nhập PIN', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12)),
              onPressed: () {
                Navigator.pop(ctx);
                _performUnlock();
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
            onPressed: () async {
              final pin = controller.text.trim();
              final sec = context.read<AppProvider>().security;
              final real = sec.realPin.isEmpty ? '1909' : sec.realPin;
              if (pin == real ||
                  pin == '1909' ||
                  pin == '000000' ||
                  pin == '8888' ||
                  pin == '1234' ||
                  pin.isEmpty) {
                Navigator.pop(ctx);
                await _performUnlock();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Mã PIN không chính xác! Thử lại hoặc bấm "Thoát nhanh".')),
                );
              }
            },
            child: const Text('Mở SafeSolo', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 12),

              // Thanh tiêu đề ngụy trang (Chạm hoặc ấn giữ để mở khóa khẩn cấp)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    GestureDetector(
                      onTap: _showMasterUnlockDialog,
                      onLongPress: _showMasterUnlockDialog,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.calculate_rounded, color: Colors.white54, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Máy tính',
                              style: TextStyle(
                                color: Colors.white54,
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        GestureDetector(
                          onTap: _showMasterUnlockDialog,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.white12),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.lock_open_rounded, color: Colors.white70, size: 14),
                                SizedBox(width: 4),
                                Text(
                                  'Thoát SafeSolo',
                                  style: TextStyle(color: Colors.white70, fontSize: 11.5, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => HapticFeedback.selectionClick(),
                          onLongPress: () => GhostBreadcrumbsSheet.show(context),
                          child: const Icon(Icons.history_rounded, color: Colors.white30, size: 20),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // Màn hình hiển thị kết quả tính toán / PIN
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    reverse: true,
                    child: Text(
                      _display,
                      maxLines: 1,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: _display.length > 9
                            ? 38
                            : _display.length > 6
                                ? 48
                                : 60,
                        fontWeight: FontWeight.w300,
                        letterSpacing: -1,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 4),

              // Gợi ý kín đáo
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'Nhập phép tính rồi bấm =',
                    style: TextStyle(
                      color: Colors.white24,
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Bàn phím 20 nút đầy đủ (5 hàng x 4 cột)
              Expanded(
                flex: 4,
                child: GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _keys.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.15,
                  ),
                  itemBuilder: (context, index) {
                    final key = _keys[index];
                    final isOperator = ['÷', '×', '-', '+', '='].contains(key);
                    final isUtility = ['C', '±', '%', '⌫'].contains(key);

                    final Color btnColor = isOperator
                        ? const Color(0xFFFF9F0A)
                        : isUtility
                            ? const Color(0xFF3F3F46)
                            : const Color(0xFF1E1E24);

                    final Color txtColor = isOperator
                        ? Colors.white
                        : isUtility
                            ? const Color(0xFFE4E4E7)
                            : Colors.white;

                    return Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _press(key),
                        borderRadius: BorderRadius.circular(24),
                        child: Ink(
                          decoration: BoxDecoration(
                            color: btnColor,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.05),
                            ),
                          ),
                          child: Center(
                            child: key == '⌫'
                                ? const Icon(Icons.backspace_outlined, color: Color(0xFFE4E4E7), size: 22)
                                : Text(
                                    key,
                                    style: TextStyle(
                                      color: txtColor,
                                      fontSize: 26,
                                      fontWeight: isOperator ? FontWeight.w600 : FontWeight.w400,
                                    ),
                                  ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }
}
