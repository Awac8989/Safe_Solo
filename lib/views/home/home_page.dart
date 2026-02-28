import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/location_service.dart';
import '../auth/register_page.dart';

class HomePage extends StatefulWidget {
  static const routeName = '/home';

  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _api = ApiService();
  final _locationService = LocationService();
  final ValueNotifier<String> _countdownText = ValueNotifier<String>('--:--:--');
  Timer? _timer;

  UserModel? _user;
  String? _userId;
  bool _loading = true;
  bool _checkinLoading = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString(AppConstants.userIdStorageKey);
    if (userId == null || userId.isEmpty) {
      if (!mounted) {
        return;
      }
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const RegisterPage()),
      );
      return;
    }

    _userId = userId;
    await _refreshUser();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateCountdown();
    });
  }

  Future<void> _refreshUser() async {
    try {
      final loadedUser = await _api.getUserById(_userId!);
      if (!mounted) {
        return;
      }
      setState(() {
        _user = loadedUser;
        _loading = false;
      });
      _updateCountdown();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Tai du lieu that bai: $error')),
      );
    }
  }

  void _updateCountdown() {
    final deadline = _user?.nextDeadline;
    if (deadline == null) {
      return;
    }
    final diff = deadline.difference(DateTime.now());
    final seconds = diff.inSeconds;
    final abs = seconds.abs();
    final h = (abs ~/ 3600).toString().padLeft(2, '0');
    final m = ((abs % 3600) ~/ 60).toString().padLeft(2, '0');
    final s = (abs % 60).toString().padLeft(2, '0');
    final text = seconds >= 0 ? '$h:$m:$s' : '-$h:$m:$s';

    if (_countdownText.value != text) {
      _countdownText.value = text;
    }
  }

  Future<void> _performCheckin() async {
    if (_userId == null || _checkinLoading) {
      return;
    }

    setState(() => _checkinLoading = true);
    try {
      final pos = await _locationService.getCurrentPosition();
      final updated = await _api.checkin(
        userId: _userId!,
        lat: pos.latitude,
        lng: pos.longitude,
      );
      if (!mounted) {
        return;
      }
      setState(() => _user = updated);
      _updateCountdown();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Check-in thanh cong')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Check-in that bai: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _checkinLoading = false);
      }
    }
  }

  Future<void> _changeTimer() async {
    if (_userId == null || _user == null) {
      return;
    }

    int selected = _user!.timerIntervalMinutes;
    final changed = await showDialog<int>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Cap nhat chu ky check-in'),
          content: DropdownButtonFormField<int>(
            value: selected,
            items: const [180, 360, 720, 1440]
                .map((value) => DropdownMenuItem(value: value, child: Text('$value phut')))
                .toList(),
            onChanged: (value) {
              if (value != null) {
                selected = value;
              }
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Huy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, selected),
              child: const Text('Luu'),
            ),
          ],
        );
      },
    );

    if (changed == null) {
      return;
    }

    try {
      final updated = await _api.updateTimer(_userId!, changed);
      if (!mounted) {
        return;
      }
      setState(() => _user = updated);
      _updateCountdown();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cap nhat timer that bai: $error')),
      );
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.userIdStorageKey);
    if (!mounted) {
      return;
    }
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const RegisterPage()),
      (_) => false,
    );
  }

  Future<void> _setSleepMode() async {
    if (_userId == null || _user == null) {
      return;
    }

    final selected = await showDialog<int>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Che do tam dung canh bao'),
          content: const Text('Chon thoi gian tam dung (phut). Chon 0 de tat Sleep Mode.'),
          actions: [
            Wrap(
              spacing: 8,
              children: [0, 30, 60, 120]
                  .map(
                    (minute) => FilledButton.tonal(
                      onPressed: () => Navigator.pop(context, minute),
                      child: Text('$minute'),
                    ),
                  )
                  .toList(),
            ),
          ],
        );
      },
    );

    if (selected == null) {
      return;
    }

    try {
      final updated = await _api.setSleepMode(userId: _userId!, minutes: selected);
      if (!mounted) {
        return;
      }
      setState(() => _user = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(selected == 0 ? 'Da tat Sleep Mode' : 'Da bat Sleep Mode $selected phut')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cap nhat Sleep Mode that bai: $error')),
      );
    }
  }

  Future<void> _changeProtectionRules() async {
    if (_userId == null || _user == null) {
      return;
    }

    final startController = TextEditingController(text: _user!.quietHoursStart);
    final endController = TextEditingController(text: _user!.quietHoursEnd);
    final graceController = TextEditingController(text: _user!.falseAlertGraceMinutes.toString());

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Quiet Hours & Grace'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: startController,
                decoration: const InputDecoration(labelText: 'Quiet start (HH:mm)'),
              ),
              TextField(
                controller: endController,
                decoration: const InputDecoration(labelText: 'Quiet end (HH:mm)'),
              ),
              TextField(
                controller: graceController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Grace minutes'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huy')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Luu')),
          ],
        );
      },
    );

    if (confirmed != true) {
      return;
    }

    try {
      final updated = await _api.updatePreferences(
        userId: _userId!,
        quietHoursStart: startController.text.trim(),
        quietHoursEnd: endController.text.trim(),
        falseAlertGraceMinutes: int.tryParse(graceController.text.trim()) ?? 3,
      );
      if (!mounted) {
        return;
      }
      setState(() => _user = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Da cap nhat quy tac chong bao dong gia')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cap nhat quiet hours that bai: $error')),
      );
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _countdownText.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    final status = user?.currentStatus ?? 'SAFE';

    return Scaffold(
      appBar: AppBar(
        title: const Text('SafeSolo'),
        actions: [
          IconButton(onPressed: _refreshUser, icon: const Icon(Icons.refresh)),
          IconButton(onPressed: _logout, icon: const Icon(Icons.logout)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : user == null
              ? const Center(child: Text('Khong tim thay thong tin user'))
              : Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Xin chao, ${user.fullName}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Text('Trang thai hien tai: $status'),
                      const SizedBox(height: 4),
                      Text('Han check-in: ${DateFormat('dd/MM/yyyy HH:mm').format(user.nextDeadline!)}'),
                      const SizedBox(height: 4),
                      Text('Quiet hours: ${user.quietHoursStart} - ${user.quietHoursEnd} | Grace: ${user.falseAlertGraceMinutes}p'),
                      const SizedBox(height: 4),
                      Text(
                        user.sleepModeUntil != null && user.sleepModeUntil!.isAfter(DateTime.now())
                            ? 'Sleep mode den: ${DateFormat('dd/MM HH:mm').format(user.sleepModeUntil!)}'
                            : 'Sleep mode: tat',
                      ),
                      const SizedBox(height: 12),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              const Text('Thoi gian con lai'),
                              const SizedBox(height: 8),
                              ValueListenableBuilder<String>(
                                valueListenable: _countdownText,
                                builder: (_, value, __) => Text(
                                  value,
                                  style: Theme.of(context).textTheme.displaySmall,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Expanded(
                        child: FilledButton(
                          onPressed: _checkinLoading ? null : _performCheckin,
                          style: FilledButton.styleFrom(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          ),
                          child: Text(
                            _checkinLoading ? 'Dang check-in...' : 'CHECK-IN AN TOAN',
                            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _changeTimer,
                        icon: const Icon(Icons.timer),
                        label: Text('Doi chu ky (hien tai ${user.timerIntervalMinutes} phut)'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _setSleepMode,
                        icon: const Icon(Icons.bedtime_outlined),
                        label: const Text('Bat/Tat Sleep Mode'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _changeProtectionRules,
                        icon: const Icon(Icons.tune),
                        label: const Text('Quiet Hours & Grace'),
                      ),
                    ],
                  ),
                ),
    );
  }
}