import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import 'active_journey_page.dart';

class LiveJourneySetupSheet extends StatefulWidget {
  const LiveJourneySetupSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const LiveJourneySetupSheet(),
    );
  }

  @override
  State<LiveJourneySetupSheet> createState() => _LiveJourneySetupSheetState();
}

class _LiveJourneySetupSheetState extends State<LiveJourneySetupSheet> {
  final TextEditingController _destController = TextEditingController(text: 'Về nhà an toàn');
  int _selectedDuration = 20; // 20 minutes default
  bool _isStarting = false;

  final List<int> _durations = [15, 20, 30, 45, 60];

  final List<String> _quickDestinations = [
    'Về nhà an toàn',
    'Đi taxi / Grab đêm',
    'Đi bộ qua đoạn vắng',
    'Đến cơ quan / Trường học',
  ];

  @override
  void dispose() {
    _destController.dispose();
    super.dispose();
  }

  Future<void> _startJourney() async {
    final dest = _destController.text.trim();
    if (dest.isEmpty) {
      TopToast.show(context, message: 'Vui lòng nhập điểm đến', icon: Icons.error_outline_rounded);
      return;
    }

    setState(() => _isStarting = true);
    try {
      final provider = context.read<AppProvider>();
      final journey = await provider.startLiveJourney(
        destination: dest,
        durationMinutes: _selectedDuration,
      );

      if (!mounted) return;
      Navigator.pop(context); // Close sheet

      if (journey != null) {
        await Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) => const ActiveJourneyPage(),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      TopToast.show(context, message: 'Lỗi bắt đầu hành trình: $e', icon: Icons.error_outline_rounded);
    } finally {
      if (mounted) setState(() => _isStarting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 24 + bottomInset),
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
          const SizedBox(height: 18),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.navigation_rounded, color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Live Journey Guard',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                    ),
                    Text(
                      'Hộ tống di chuyển an toàn thời gian thực',
                      style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Điểm đến của bạn',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _destController,
            decoration: InputDecoration(
              hintText: 'Nhập điểm đến...',
              prefixIcon: const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 20),
              filled: true,
              fillColor: AppColors.background,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.border),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _quickDestinations.map((dest) {
                final isSelected = _destController.text == dest;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(dest, style: TextStyle(fontSize: 12, color: isSelected ? Colors.white : AppColors.textSecondary)),
                    backgroundColor: isSelected ? AppColors.primary : AppColors.secondary,
                    side: BorderSide.none,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    onPressed: () => setState(() => _destController.text = dest),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Thời gian di chuyển dự kiến',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _durations.map((d) {
              final isSelected = _selectedDuration == d;
              return GestureDetector(
                onTap: () => setState(() => _selectedDuration = d),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.border,
                    ),
                  ),
                  child: Text(
                    '$d p',
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
              onPressed: _isStarting ? null : _startJourney,
              icon: _isStarting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.shield_rounded, color: Colors.white),
              label: Text(
                _isStarting ? 'Đang khởi động...' : 'BẮT ĐẦU BẢO VỆ HÀNH TRÌNH',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
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
