import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';

class StealthPage extends StatefulWidget {
  const StealthPage({super.key});

  @override
  State<StealthPage> createState() => _StealthPageState();
}

class _StealthPageState extends State<StealthPage> {
  static const _keys = [
    'C', '÷', '×', '⌫',
    '7', '8', '9', '-',
    '4', '5', '6', '+',
    '1', '2', '3', '=',
    '0', '.',
  ];

  String _display = '0';

  void _press(String value) {
    if (value == 'C') {
      setState(() => _display = '0');
      return;
    }

    if (value == '⌫') {
      setState(() {
        _display = _display.length > 1 ? _display.substring(0, _display.length - 1) : '0';
      });
      return;
    }

    if (value == '=') {
      _resolvePinOrCalc();
      return;
    }

    setState(() {
      if (_display == '0' || _display == 'Error') {
        _display = value;
      } else {
        _display += value;
      }
    });
  }

  Future<void> _resolvePinOrCalc() async {
    final security = context.read<AppProvider>().security;
    final realPin = security.realPin.isEmpty ? '1909' : security.realPin;
    final duressPin = security.duressPin.isEmpty ? '9111' : security.duressPin;
    final rawInput = _display.trim();

    if (rawInput == realPin) {
      await context.read<AppProvider>().setSecurity(
        Security(
          realPin: security.realPin,
          duressPin: security.duressPin,
          stealthMode: false,
          autoWipeDays: security.autoWipeDays,
          encryptionEnabled: security.encryptionEnabled,
        ),
      );
      return;
    }

    if (rawInput == duressPin) {
      unawaited(context.read<AppProvider>().triggerSilentSos());
      setState(() => _display = '0');
      return;
    }

    try {
      final normalized = rawInput.replaceAll('×', '*').replaceAll('÷', '/');
      final result = _simpleEvaluate(normalized);
      setState(() => _display = result);
    } catch (_) {
      setState(() => _display = 'Error');
    }
  }

  String _simpleEvaluate(String input) {
    final match = RegExp(
      r'^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$',
    ).firstMatch(input);
    if (match == null) {
      return input;
    }

    final left = double.parse(match.group(1)!);
    final operator = match.group(2)!;
    final right = double.parse(match.group(3)!);
    final value = switch (operator) {
      '+' => left + right,
      '-' => left - right,
      '*' => left * right,
      '/' => right == 0 ? double.nan : left / right,
      _ => left,
    };

    if (value.isNaN || value.isInfinite) {
      throw StateError('invalid');
    }
    if (value == value.roundToDouble()) {
      return value.toStringAsFixed(0);
    }
    return value.toStringAsFixed(2);
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
              const SizedBox(height: 16),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Máy tính',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Icon(Icons.calculate_outlined, color: Colors.white70),
                  ],
                ),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    _display,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 62,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 24),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    'Nhập phép tính rồi bấm =',
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Expanded(
                flex: 2,
                child: GridView.builder(
                  padding: const EdgeInsets.all(12),
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _keys.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 1,
                  ),
                  itemBuilder: (context, index) {
                    final key = _keys[index];
                    final isOperator = ['÷', '×', '-', '+', '='].contains(key);
                    final isUtility = ['C', '⌫'].contains(key);

                    return GestureDetector(
                      onTap: () => _press(key),
                      child: Container(
                        decoration: BoxDecoration(
                          color: isOperator
                              ? const Color(0xFFFF9F0A)
                              : isUtility
                              ? const Color(0xFF5E5E5E)
                              : const Color(0xFF1C1C1E),
                          borderRadius: BorderRadius.circular(26),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          key,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
