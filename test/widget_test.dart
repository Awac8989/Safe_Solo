import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:safesolo/main.dart';

void main() {
  testWidgets('SafeSolo app renders auth flow', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({
      'safesolo_state_v3': jsonEncode({
        'onboarded': true,
        'permissionsGranted': true,
        'streak': 0,
        'highContrast': false,
        'medical': <String, dynamic>{},
        'automation': <String, dynamic>{},
        'security': <String, dynamic>{},
        'badges': <String>[],
        'circlePosts': <Map<String, dynamic>>[],
        'chatThreads': <Map<String, dynamic>>[],
      }),
    });

    await tester.pumpWidget(const SafeSoloApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('SafeSolo'), findsOneWidget);
    expect(find.text('Dang nhap hoac tao ho so'), findsOneWidget);
    expect(find.text('Ho va ten'), findsOneWidget);
    expect(find.text('So dien thoai'), findsOneWidget);
  });
}
