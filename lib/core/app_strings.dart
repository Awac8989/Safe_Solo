import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_language.dart';
import 'providers/app_provider.dart';

class AppStrings {
  const AppStrings(this.language);

  final AppLanguage language;

  bool get isVietnamese => language == AppLanguage.vi;

  static AppStrings of(BuildContext context) {
    final language = context.select<AppProvider, AppLanguage>(
      (provider) => provider.language,
    );
    return AppStrings(language);
  }

  String text(String vi, String en) => isVietnamese ? vi : en;

  String moodLabel(Mood mood) {
    switch (mood) {
      case Mood.calm:
        return text('Bình an', 'Calm');
      case Mood.happy:
        return text('Tích cực', 'Positive');
      case Mood.tired:
        return text('Hơi mệt', 'Tired');
      case Mood.sick:
        return text('Cần lưu ý', 'Need attention');
      case Mood.focused:
        return text('Đang tập trung', 'Focused');
    }
  }

  String bottomTab(BottomNavLabel label) {
    switch (label) {
      case BottomNavLabel.home:
        return text('Điểm danh', 'Check-in');
      case BottomNavLabel.circle:
        return text('Vòng tròn', 'Circle');
      case BottomNavLabel.messages:
        return text('Tin nhắn', 'Messages');
      case BottomNavLabel.heroes:
        return text('Hiệp sĩ', 'Heroes');
      case BottomNavLabel.settings:
        return text('Cài đặt', 'Settings');
    }
  }
}

enum BottomNavLabel { home, circle, messages, heroes, settings }
