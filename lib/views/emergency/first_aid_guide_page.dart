import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../services/cpr_metronome_service.dart';

class FirstAidGuidePage extends StatefulWidget {
  const FirstAidGuidePage({super.key});

  @override
  State<FirstAidGuidePage> createState() => _FirstAidGuidePageState();
}

class _FirstAidGuidePageState extends State<FirstAidGuidePage> with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 4, vsync: this);
  final CprMetronomeService _cprService = CprMetronomeService.instance;

  @override
  void dispose() {
    _cprService.stop();
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cẩm nang Sơ cứu Khẩn cấp'),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.destructive,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.destructive,
          indicatorWeight: 3,
          isScrollable: true,
          tabs: const [
            Tab(icon: Icon(Icons.favorite_rounded), text: 'Ép tim CPR'),
            Tab(icon: Icon(Icons.psychology_rounded), text: 'Đột quỵ FAST'),
            Tab(icon: Icon(Icons.air_rounded), text: 'Hóc Heimlich'),
            Tab(icon: Icon(Icons.healing_rounded), text: 'Cầm máu & Bỏng'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildCprTab(),
          _buildFastTab(),
          _buildHeimlichTab(),
          _buildWoundTab(),
        ],
      ),
    );
  }

  Widget _buildCprTab() {
    return ValueListenableBuilder<CprState>(
      valueListenable: _cprService.stateNotifier,
      builder: (context, cpr, _) {
        final isRunning = _cprService.isRunning;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.destructive.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.destructive.withValues(alpha: 0.2)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: AppColors.destructive, size: 22),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Chuẩn AHA: 100 - 120 lần/phút. Nhấn sâu 5-6 cm giữa lồng ngực. Tỷ lệ 30 lần ép : 2 lần thổi ngạt.',
                        style: TextStyle(fontSize: 13, color: AppColors.destructive, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Animated CPR Circle
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: cpr.isVentilating
                      ? AppColors.primarySoft
                      : (cpr.beatTick ? AppColors.destructive.withValues(alpha: 0.25) : AppColors.destructive.withValues(alpha: 0.1)),
                  border: Border.all(
                    color: cpr.isVentilating ? AppColors.primary : AppColors.destructive,
                    width: cpr.beatTick ? 6 : 3,
                  ),
                ),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        cpr.isVentilating ? Icons.air_rounded : Icons.favorite_rounded,
                        color: cpr.isVentilating ? AppColors.primary : AppColors.destructive,
                        size: cpr.beatTick ? 42 : 36,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        cpr.isVentilating ? 'THỔI NGẠT' : (isRunning ? '${cpr.compressionCount}/30' : '110 BPM'),
                        style: TextStyle(
                          fontSize: cpr.isVentilating ? 18 : 28,
                          fontWeight: FontWeight.w900,
                          color: cpr.isVentilating ? AppColors.primary : AppColors.destructive,
                        ),
                      ),
                      Text(
                        cpr.isVentilating ? '2 hơi sâu' : (isRunning ? 'Chu kỳ ${cpr.cycleCount}' : 'Chuẩn AHA'),
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Stats Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _statBadge('Tổng lần ép', '${cpr.totalCompressions}'),
                  _statBadge('Chu kỳ', '${cpr.cycleCount}'),
                  _statBadge('Nhịp', '${cpr.bpm} bpm'),
                ],
              ),
              const SizedBox(height: 28),

              // Start / Stop CPR Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (isRunning) {
                      _cprService.stop();
                    } else {
                      _cprService.start();
                    }
                  },
                  icon: Icon(isRunning ? Icons.stop_rounded : Icons.play_arrow_rounded, color: Colors.white),
                  label: Text(
                    isRunning ? 'DỪNG ĐẾM NHỊP CPR' : 'BẮT ĐẦU ĐẾM NHỊP CPR (110 BPM)',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isRunning ? AppColors.textPrimary : AppColors.destructive,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              const Align(
                alignment: Alignment.centerLeft,
                child: Text('4 bước ép tim CPR đúng kỹ thuật:', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              const SizedBox(height: 10),
              _stepItem('1', 'Đặt nạn nhân nằm ngửa trên mặt phẳng cứng, kiểm tra phản xạ và hơi thở.'),
              _stepItem('2', 'Đặt gót bàn tay vào chính giữa ngực (nửa dưới xương ức), đan các ngón tay lại.'),
              _stepItem('3', 'Cánh tay thẳng đứng, dùng lực thân trên ép ngực sâu 5-6 cm theo nhịp đếm.'),
              _stepItem('4', 'Sau 30 lần ép ngực, ngửa đầu nâng cằm nạn nhân và thổi ngạt 2 hơi sâu.'),
            ],
          ),
        );
      },
    );
  }

  Widget _buildFastTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF3C7),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF59E0B)),
          ),
          child: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFB45309), size: 24),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Quy tắc F.A.S.T - Nhận biết đột quỵ trong 30 giây. Thời gian là tính mạng (Khung giờ vàng < 4.5 giờ).',
                  style: TextStyle(fontSize: 13, color: Color(0xFFB45309), fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _fastCard('F - Face (Khuôn mặt)', 'Mặt bị lệch, méo miệng. Yêu cầu nạn nhân cười: nụ cười có bị méo một bên không?'),
        _fastCard('A - Arms (Tay & Chân)', 'Yếu hoặc liệt một bên chi. Yêu cầu giơ 2 tay lên: một bên tay có bị rơi xuống hoặc không nâng lên được không?'),
        _fastCard('S - Speech (Giọng nói)', 'Nói ngọng, líu lưỡi hoặc không nói được từ đơn giản. Yêu cầu nhắc lại một câu ngắn: giọng có bị biến đổi không?'),
        _fastCard('T - Time (Thời gian)', 'Nếu có BẤT KỲ dấu hiệu nào trên, gọi ngay 115 và đưa nạn nhân tới bệnh viện có khoa đột quỵ gần nhất!'),
      ],
    );
  }

  Widget _buildHeimlichTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Nghiệm pháp Heimlich - Xử lý hóc dị vật đường thở',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 8),
        const Text(
          'Dấu hiệu: Nạn nhân ôm cổ họng, mặt tím tái, không nói và không ho được.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),
        _stepItem('1', 'Đứng phía sau nạn nhân, vòng 2 tay qua eo của họ.'),
        _stepItem('2', 'Nắm một bàn tay lại thành nắm đấm, đặt ngón cái của nắm đấm vào vùng thượng vị (ngay trên rốn, dưới xương ức).'),
        _stepItem('3', 'Bàn tay kia ôm lấy nắm đấm.'),
        _stepItem('4', 'Giật mạnh và dứt khoát theo hướng VÀO TRONG và LÊN TRÊN nhiều lần cho đến khi dị vật bật ra.'),
        _stepItem('5', 'Nếu nạn nhân bất tỉnh: Đặt nằm ngửa và tiến hành ép tim CPR ngay lập tức.'),
      ],
    );
  }

  Widget _buildWoundTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('1. Cầm máu vết thương chảy nhiều', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        _stepItem('•', 'Dùng gạc hoặc khăn sạch ép trực tiếp lên vết thương với lực vừa đủ trong ít nhất 5-10 phút.'),
        _stepItem('•', 'Nâng cao chi bị thương cao hơn mức tim nếu không có gãy xương.'),
        _stepItem('•', 'Không tháo bỏ gạc đầu tiên nếu máu thấm qua; đặt thêm lớp gạc mới lên trên và băng chặt lại.'),
        const SizedBox(height: 20),
        const Text('2. Sơ cứu vết bỏng nhiệt', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        _stepItem('•', 'Ngâm hoặc xả nước sạch mát (15-25°C) lên vùng bỏng trong 15-20 phút. KHÔNG dùng nước đá lạnh.'),
        _stepItem('•', 'Cởi bỏ đồ trang sức, quần áo chật trước khi vùng bỏng bị sưng phù.'),
        _stepItem('•', 'KHÔNG bôi kem đánh răng, mỡ trăn, nước mắm hoặc làm vỡ bóng nước.'),
        _stepItem('•', 'Che phủ nhẹ bằng gạc vô trùng hoặc màng bọc thực phẩm sạch và đưa đến cơ sở y tế.'),
      ],
    );
  }

  Widget _statBadge(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.secondary,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary)),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Widget _fastCard(String title, String desc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.destructive)),
          const SizedBox(height: 6),
          Text(desc, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, height: 1.4)),
        ],
      ),
    );
  }

  Widget _stepItem(String index, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              shape: BoxShape.circle,
            ),
            child: Text(index, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.primary)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, height: 1.4))),
        ],
      ),
    );
  }
}
