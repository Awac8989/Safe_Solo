import 'package:flutter/material.dart';

import 'views/auth/register_page.dart';
import 'views/home/home_page.dart';

void main() {
  runApp(const SafeSoloApp());
}

class SafeSoloApp extends StatelessWidget {
  const SafeSoloApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SafeSolo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00695C)),
      ),
      home: const RegisterPage(),
      routes: {
        HomePage.routeName: (_) => const HomePage(),
      },
    );
  }
}
