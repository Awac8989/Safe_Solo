import 'package:flutter/material.dart';

import '../../views/circle/circle_page.dart';
import '../../views/heroes/heroes_page.dart';
import '../../views/home/home_page.dart';
import '../../views/messenger/messenger_page.dart';
import '../../views/settings/settings_page.dart';
import 'custom_bottom_nav.dart';

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  final PageController _pageController = PageController();
  BottomTab _active = BottomTab.home;

  late final List<Widget> _pages = const [
    HomePage(),
    CirclePage(),
    MessengerPage(),
    HeroesPage(),
    SettingsPage(),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _changeTab(BottomTab tab) async {
    setState(() => _active = tab);
    await _pageController.animateToPage(
      BottomTab.values.indexOf(tab),
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: _pages,
      ),
      bottomNavigationBar: CustomBottomNav(
        active: _active,
        onChanged: _changeTab,
      ),
    );
  }
}
