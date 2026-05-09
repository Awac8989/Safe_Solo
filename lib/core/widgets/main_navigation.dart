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
  BottomTab _active = BottomTab.home;

  late final Map<BottomTab, Widget> _pages = {
    BottomTab.home: const HomePage(),
    BottomTab.circle: const CirclePage(),
    BottomTab.messages: const MessengerPage(),
    BottomTab.heroes: const HeroesPage(),
    BottomTab.settings: const SettingsPage(),
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: IndexedStack(
        index: BottomTab.values.indexOf(_active),
        children: BottomTab.values.map((tab) => _pages[tab]!).toList(),
      ),
      bottomNavigationBar: CustomBottomNav(
        active: _active,
        onChanged: (tab) => setState(() => _active = tab),
      ),
    );
  }
}
