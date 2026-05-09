import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  int _currentIndex = 0;

  final List<_OnboardingSlide> _slides = const [
    _OnboardingSlide(
      icon: Icons.favorite_border_rounded,
      title: "I'm Alive · Tôi vẫn ổn",
      description:
          'Mỗi ngày bạn chỉ cần chạm một nút để báo cho người thân biết bạn vẫn an toàn.',
    ),
    _OnboardingSlide(
      icon: Icons.notifications_active_outlined,
      title: 'Nhắc đúng lúc',
      description:
          'SafeSolo giữ nhịp check-in nhẹ nhàng để bạn yên tâm mà không thấy áp lực.',
    ),
    _OnboardingSlide(
      icon: Icons.shield_outlined,
      title: 'Cảnh báo khi cần',
      description:
          'Khi bạn im lặng quá lâu, vòng bảo hộ sẽ nhận tín hiệu và biết lúc nào nên hỗ trợ.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final slide = _slides[_currentIndex];
    final isLast = _currentIndex == _slides.length - 1;

    return Scaffold(
      body: AppPage(
        child: Column(
          children: [
            const Spacer(flex: 2),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shield_outlined, size: 24, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  'SafeSolo',
                  style: AppTextStyles.title.copyWith(
                    fontSize: 18,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 56),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              child: Container(
                key: ValueKey(_currentIndex),
                child: Column(
                  children: [
                    Container(
                      width: 176,
                      height: 176,
                      decoration: BoxDecoration(
                        gradient: AppColors.safeGradient,
                        borderRadius: BorderRadius.circular(36),
                        boxShadow: AppShadows.safe,
                      ),
                      child: Icon(
                        slide.icon,
                        color: AppColors.primaryForeground,
                        size: 78,
                      ),
                    ),
                    const SizedBox(height: 40),
                    Text(
                      slide.title,
                      textAlign: TextAlign.center,
                      style: AppTextStyles.h2.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        slide.description,
                        textAlign: TextAlign.center,
                        style: AppTextStyles.bodyLarge.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.55,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_slides.length, (index) {
                final active = index == _currentIndex;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: active ? 28 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: active ? AppColors.primary : AppColors.border,
                    borderRadius: BorderRadius.circular(999),
                  ),
                );
              }),
            ),
            const Spacer(flex: 3),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  if (isLast) {
                    context.read<AppProvider>().completeOnboarding();
                  } else {
                    setState(() => _currentIndex += 1);
                  }
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(isLast ? 'Bắt đầu' : 'Tiếp tục'),
                    const SizedBox(width: 8),
                    const Icon(Icons.chevron_right_rounded, size: 20),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.read<AppProvider>().completeOnboarding(),
              child: Text(
                'Bỏ qua',
                style: AppTextStyles.bodyStrong.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _OnboardingSlide {
  const _OnboardingSlide({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;
}
