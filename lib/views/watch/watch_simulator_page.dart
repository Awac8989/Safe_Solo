import 'package:flutter/material.dart';
import 'smartwatch_connection_page.dart';

export 'smartwatch_connection_page.dart';
export '../wear_os/wear_os_watch_page.dart';

/// Trang Quản lý kết nối và theo dõi thông số trực tiếp từ Smartwatch (Samsung Galaxy Watch 5)
class WatchSimulatorPage extends StatelessWidget {
  const WatchSimulatorPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SmartwatchConnectionPage();
  }
}
