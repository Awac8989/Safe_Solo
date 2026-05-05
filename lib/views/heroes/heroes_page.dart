import 'package:flutter/material.dart';

class HeroesPage extends StatelessWidget {
  const HeroesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Người thân'),
      ),
      body: const Center(
        child: Text('Heroes Page - Coming Soon'),
      ),
    );
  }
}