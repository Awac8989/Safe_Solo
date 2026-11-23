import 'package:flutter/material.dart';

import '../../core/app_theme.dart';
import '../../services/ambulance_prealert_service.dart';

/// ============================================================================
/// SAFESOLO — DIALOG CẢNH BÁO TRƯỚC PHÒNG CẤP CỨU BỆNH VIỆN (PHÂN HỆ 142)
/// Phát tín hiệu HL7 FHIR tới Trauma Center chuẩn bị kíp mổ / ICU
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03 - TDMU
/// ============================================================================

class AmbulancePreAlertDialog extends StatefulWidget {
  const AmbulancePreAlertDialog({super.key});

  @override
  State<AmbulancePreAlertDialog> createState() => _AmbulancePreAlertDialogState();
}

class _AmbulancePreAlertDialogState extends State<AmbulancePreAlertDialog> {
  final _service = AmbulancePreAlertService.instance;
  String _selectedHospital = 'Bệnh viện Đa khoa tỉnh Bình Dương';
  PreAlertPriority _priority = PreAlertPriority.codeRed;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(
        children: [
          Icon(Icons.local_hospital_rounded, color: Color(0xFFEF4444), size: 26),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Phát Lệnh Pre-Alert Bệnh Viện',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Chọn Trung tâm Cấp cứu Đích:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              value: _selectedHospital,
              dropdownColor: const Color(0xFF0F172A),
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              items: const [
                DropdownMenuItem(value: 'Bệnh viện Đa khoa tỉnh Bình Dương', child: Text('BV ĐK tỉnh Bình Dương')),
                DropdownMenuItem(value: 'Bệnh viện Chợ Rẫy TP.HCM', child: Text('BV Chợ Rẫy TP.HCM')),
                DropdownMenuItem(value: 'Bệnh viện Nhân dân 115', child: Text('BV Nhân dân 115')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _selectedHospital = val);
              },
            ),

            const SizedBox(height: 14),
            const Text(
              'Mức độ ưu tiên tiếp nhận:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                _priorityRadio(PreAlertPriority.codeRed, 'Code Red', Colors.red),
                const SizedBox(width: 8),
                _priorityRadio(PreAlertPriority.codeYellow, 'Code Yellow', Colors.orange),
              ],
            ),

            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Dữ liệu tự động truyền kèm:', style: TextStyle(color: Colors.white60, fontSize: 12)),
                  SizedBox(height: 4),
                  Text('• ETA: 7 phút tiếp cận cấp cứu', style: TextStyle(color: Colors.white, fontSize: 12)),
                  Text('• Sinh tồn: Mạch 115, SpO2 91%, HA 90/60', style: TextStyle(color: Colors.white, fontSize: 12)),
                  Text('• Cơ chế: Chấn thương kín đa vùng', style: TextStyle(color: Colors.white, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Hủy', style: TextStyle(color: Colors.white60)),
        ),
        ElevatedButton(
          onPressed: () async {
            final payload = TraumaPreAlertPayload(
              incidentId: 'INC_TRAUMA_999',
              targetHospitalName: _selectedHospital,
              priority: _priority,
              etaMinutes: 7,
              patientAgeGender: 'Nam, 24 tuổi',
              bloodType: 'O+',
              glasgowScore: 12,
              heartRateBpm: 115,
              spO2Percent: 91.0,
              systolicBp: 90,
              traumaMechanism: 'Chấn thương ngực kín do va chạm giao thông',
              contraindications: ['Dị ứng Penicillin'],
              timestamp: DateTime.now(),
            );
            await _service.dispatchPreAlert(payload);
            if (context.mounted) {
              Navigator.of(context).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: const Color(0xFF10B981),
                  content: Text('Đã truyền gói Pre-Alert tới $_selectedHospital thành công!'),
                ),
              );
            }
          },
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
          child: const Text('GỬI LỆNH PRE-ALERT'),
        ),
      ],
    );
  }

  Widget _priorityRadio(PreAlertPriority priority, String label, Color color) {
    final selected = _priority == priority;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _priority = priority),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? color.withOpacity(0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: selected ? color : Colors.white24),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: selected ? color : Colors.white60,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
