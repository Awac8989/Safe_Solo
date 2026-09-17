import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../models/fake_call_config.dart';
import '../../services/fake_call_service.dart';
import 'fake_call_screen.dart';

class FakeCallSetupSheet extends StatefulWidget {
  const FakeCallSetupSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const FakeCallSetupSheet(),
    );
  }

  @override
  State<FakeCallSetupSheet> createState() => _FakeCallSetupSheetState();
}

class _FakeCallSetupSheetState extends State<FakeCallSetupSheet> {
  String _selectedCaller = 'Bố';
  FakeCallScenario _scenario = FakeCallScenario.fatherWaiting;
  int _delaySeconds = 0;

  final List<Map<String, dynamic>> _callerOptions = [
    {
      'name': 'Bố',
      'number': '+84 912 345 678',
      'scenario': FakeCallScenario.fatherWaiting,
      'icon': Icons.family_restroom_rounded,
    },
    {
      'name': 'Chồng / Bạn trai',
      'number': '+84 988 765 432',
      'scenario': FakeCallScenario.fatherWaiting,
      'icon': Icons.favorite_rounded,
    },
    {
      'name': 'Công an khu vực',
      'number': '113',
      'scenario': FakeCallScenario.policeNearby,
      'icon': Icons.local_police_rounded,
    },
    {
      'name': 'Tài xế SafeSolo',
      'number': '1900 6868',
      'scenario': FakeCallScenario.taxiArrived,
      'icon': Icons.local_taxi_rounded,
    },
  ];

  final List<int> _delays = [0, 15, 30, 60];

  void _triggerCall() {
    final option = _callerOptions.firstWhere((c) => c['name'] == _selectedCaller);
    final config = FakeCallConfig(
      callerName: option['name'] as String,
      callerNumber: option['number'] as String,
      scenario: _scenario,
      delaySeconds: _delaySeconds,
    );

    FakeCallService.instance.scheduleFakeCall(customConfig: config);

    Navigator.pop(context); // Close sheet
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => const FakeCallScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.phone_callback_rounded, color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Cuộc gọi Thoát hiểm Ngụy trang',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                    Text(
                      'Tạo cớ rời đi an toàn khi bị bám đuôi hoặc đe dọa',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          const Text(
            'Chọn danh tính người gọi đến:',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _callerOptions.map((opt) {
              final isSelected = _selectedCaller == opt['name'];
              return ChoiceChip(
                avatar: Icon(
                  opt['icon'] as IconData,
                  size: 16,
                  color: isSelected ? Colors.white : AppColors.primary,
                ),
                label: Text(opt['name'] as String),
                selected: isSelected,
                selectedColor: AppColors.primary,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                onSelected: (_) {
                  setState(() {
                    _selectedCaller = opt['name'] as String;
                    _scenario = opt['scenario'] as FakeCallScenario;
                  });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 20),

          const Text(
            'Thời gian đổ chuông:',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _delays.map((sec) {
              final isSelected = _delaySeconds == sec;
              return GestureDetector(
                onTap: () => setState(() => _delaySeconds = sec),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(
                    sec == 0 ? 'Ngay' : '$sec s',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isSelected ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _triggerCall,
              icon: const Icon(Icons.ring_volume_rounded, color: Colors.white),
              label: Text(
                _delaySeconds == 0 ? 'ĐỔ CHUÔNG NGAY BÂY GIỜ' : 'HẸN GIỜ ĐỔ CHUÔNG ($_delaySeconds s)',
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
