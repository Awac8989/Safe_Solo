import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/providers/app_provider.dart';
import '../../services/drug_shield_service.dart';

/// ============================================================================
/// SAFESOLO — MÀN HÌNH KHÓA CHỐNG CHỈ ĐỊNH THUỐC HIỆN TRƯỜNG (PHÂN HỆ 140)
/// Tra cứu thuốc và tự động đối soát với tiền sử dị ứng từ hồ sơ I.C.E
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

class DrugShieldPage extends StatefulWidget {
  const DrugShieldPage({super.key});

  @override
  State<DrugShieldPage> createState() => _DrugShieldPageState();
}

class _DrugShieldPageState extends State<DrugShieldPage> {
  final _drugController = TextEditingController();
  DrugSafetyCheckResult? _checkResult;

  static const List<String> _quickDrugs = [
    'Adrenaline',
    'Aspirin',
    'Morphin',
    'Penicillin',
    'Cephalosporin',
    'Paracetamol',
    'Nitroglycerin',
    'Iodine Contrast',
  ];

  void _verifyDrug(String drugName) {
    final medical = context.read<AppProvider>().medical;
    final result = DrugShieldService.instance.checkDrugSafety(
      drugName: drugName,
      victimAllergies: medical.allergies.isEmpty ? 'Dị ứng Penicillin, Hải sản' : medical.allergies,
      victimConditions: medical.conditions.isEmpty ? 'Viêm loét dạ dày' : medical.conditions,
    );
    setState(() {
      _checkResult = result;
      _drugController.text = drugName;
    });
  }

  @override
  void dispose() {
    _drugController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final medical = context.watch<AppProvider>().medical;

    return Scaffold(
      backgroundColor: const Color(0xFF0B132B),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Drug Contraindication Shield',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thông tin dị ứng ghi nhận từ I.C.E
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1C2541),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF3A506B)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.shield_rounded, color: Color(0xFF48CAE4), size: 20),
                      SizedBox(width: 8),
                      Text(
                        'HỒ SƠ DỊ ỨNG & BỆNH NỀN (I.C.E)',
                        style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Dị ứng đã lưu: ${medical.allergies.isEmpty ? "Penicillin, NSAID, Hải sản" : medical.allergies}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Bệnh lý nền: ${medical.conditions.isEmpty ? "Viêm loét dạ dày tá tràng" : medical.conditions}',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Ô tìm kiếm / nhập tên thuốc
            const Text(
              'Nhập hoặc chọn thuốc muốn đối soát:',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _drugController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'VD: Penicillin, Aspirin...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: const Color(0xFF1C2541),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                ElevatedButton(
                  onPressed: () {
                    if (_drugController.text.trim().isNotEmpty) {
                      _verifyDrug(_drugController.text.trim());
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF48CAE4),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Kiểm tra', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Thuốc phổ biến thường dùng
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _quickDrugs.map((drug) {
                return ActionChip(
                  label: Text(drug),
                  backgroundColor: const Color(0xFF1C2541),
                  labelStyle: const TextStyle(color: Colors.white70, fontSize: 12),
                  side: const BorderSide(color: Color(0xFF3A506B)),
                  onPressed: () => _verifyDrug(drug),
                );
              }).toList(),
            ),

            const SizedBox(height: 28),

            // Kết quả kiểm tra
            if (_checkResult != null) _buildResultCard(_checkResult!),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard(DrugSafetyCheckResult result) {
    final isBlocked = result.isBlocked;
    final color = isBlocked ? const Color(0xFFEF4444) : const Color(0xFF10B981);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(isBlocked ? Icons.block_rounded : Icons.check_circle_rounded, color: color, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  isBlocked ? 'KHÓA CẤM DÙNG: ${result.drugName.toUpperCase()}' : 'AN TOÀN: ${result.drugName.toUpperCase()}',
                  style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            result.reason,
            style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4),
          ),
          if (isBlocked) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lightbulb_outline_rounded, color: Colors.amber, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Phương án thay thế an toàn: ${result.recommendedAlternative}',
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
