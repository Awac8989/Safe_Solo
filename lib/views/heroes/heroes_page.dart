import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';
import 'hero_workspace_page.dart';

enum _HeroesFilter { ranking, nearby }

class HeroesPage extends StatefulWidget {
  const HeroesPage({super.key});

  @override
  State<HeroesPage> createState() => _HeroesPageState();
}

class _HeroesPageState extends State<HeroesPage> {
  _HeroesFilter _filter = _HeroesFilter.ranking;

  Future<void> _showKycBottomSheet(BuildContext context) async {
    final picker = ImagePicker();
    XFile? frontImage;
    XFile? backImage;
    XFile? certImage;
    String selectedTier = 'TIER_1_BLS';
    final certNumberController = TextEditingController();
    final issuingOrgController = TextEditingController(text: 'Hội Chữ Thập Đỏ TP.HCM');
    bool scopeAgreed = true;
    bool examTaken = false;
    int examScore = 20;
    bool isSubmitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bottomSheetContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Color(0xFF1E293B),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        const Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 24),
                        const SizedBox(width: 8),
                        Text(
                          'Đăng ký Hiệp sĩ & Thẩm định Y tế',
                          style: AppTextStyles.h3.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Thẩm định 2 lớp: eKYC CCCD + Chứng chỉ Sơ cấp cứu Y tế theo Điều 87 Luật Khám bệnh, chữa bệnh 2023.',
                      style: AppTextStyles.body.copyWith(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 18),

                    // LỚP 1: CCCD 2 MẶT
                    const Text('1. ĐỊNH DANH CĂN CƯỚC CÔNG DÂN (eKYC)', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _buildImagePickerBox(
                      title: 'Mặt trước CCCD / Hộ chiếu',
                      image: frontImage,
                      onTap: () async {
                        final picked = await picker.pickImage(source: ImageSource.gallery);
                        if (picked != null) setModalState(() => frontImage = picked);
                      },
                    ),
                    const SizedBox(height: 10),
                    _buildImagePickerBox(
                      title: 'Mặt sau CCCD / Hộ chiếu',
                      image: backImage,
                      onTap: () async {
                        final picked = await picker.pickImage(source: ImageSource.gallery);
                        if (picked != null) setModalState(() => backImage = picked);
                      },
                    ),
                    const SizedBox(height: 16),

                    // LỚP 2: CHỨNG CHỈ SƠ CẤP CỨU Y TẾ
                    const Text('2. CHỨNG CHỈ SƠ CẤP CỨU Y TẾ (MEDICAL KYC)', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _buildImagePickerBox(
                      title: 'Ảnh Chứng chỉ Y tế (CPR / BLS / PHTLS)',
                      image: certImage,
                      onTap: () async {
                        final picked = await picker.pickImage(source: ImageSource.gallery);
                        if (picked != null) setModalState(() => certImage = picked);
                      },
                    ),
                    const SizedBox(height: 10),

                    // Số hiệu & Đơn vị cấp
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: certNumberController,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Số hiệu chứng chỉ',
                              labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                              hintText: 'VD: CC-BLS-2024/09',
                              hintStyle: const TextStyle(color: Colors.white30, fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF0F172A),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: issuingOrgController,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Cơ quan cấp chứng chỉ',
                              labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                              hintText: 'VD: Hội Chữ Thập Đỏ',
                              hintStyle: const TextStyle(color: Colors.white30, fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF0F172A),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Bậc chuyên môn đề xuất
                    DropdownButtonFormField<String>(
                      initialValue: selectedTier,
                      dropdownColor: const Color(0xFF0F172A),
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                      decoration: InputDecoration(
                        labelText: 'Bậc chuyên môn đề xuất',
                        labelStyle: const TextStyle(color: Colors.white60, fontSize: 11),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'TIER_1_BLS',
                          child: Text('Tier 1: Hiệp sĩ Cứu sinh cơ bản (BLS - CPR, Dị vật)'),
                        ),
                        DropdownMenuItem(
                          value: 'TIER_2_PHTLS',
                          child: Text('Tier 2: Hiệp sĩ Chấn thương ngoại viện (PHTLS - Nẹp, C-Spine)'),
                        ),
                        DropdownMenuItem(
                          value: 'TIER_3_MEDIC',
                          child: Text('Tier 3: Bác sĩ / Điều dưỡng phản ứng nhanh (Medic)'),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) setModalState(() => selectedTier = val);
                      },
                    ),
                    const SizedBox(height: 12),

                    // SÁT HẠCH LÝ THUYẾT LÂM SÀNG
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: examTaken ? const Color(0xFF10B981) : Colors.white12),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            examTaken ? Icons.check_circle_rounded : Icons.quiz_rounded,
                            color: examTaken ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                            size: 22,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  examTaken ? 'Sát hạch lý thuyết: ĐẠT ($examScore/20)' : 'Sát hạch lý thuyết lâm sàng (20 câu)',
                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  examTaken ? 'Đủ điều kiện chuyên môn sơ cấp cứu' : 'Quy định tối thiểu đạt ≥18/20 câu (≥90%)',
                                  style: const TextStyle(color: Colors.white54, fontSize: 10.5),
                                ),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () async {
                              final resultScore = await _showClinicalExamDialog(context);
                              if (resultScore != null) {
                                setModalState(() {
                                  examTaken = resultScore >= 18;
                                  examScore = resultScore;
                                });
                              }
                            },
                            child: Text(
                              examTaken ? 'THI LẠI' : 'LÀM BÀI',
                              style: TextStyle(
                                color: examTaken ? const Color(0xFF10B981) : const Color(0xFF38BDF8),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Cam kết Ranh giới đỏ
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: scopeAgreed,
                          activeColor: const Color(0xFF10B981),
                          onChanged: (val) => setModalState(() => scopeAgreed = val ?? false),
                        ),
                        const Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text(
                              'Tôi cam kết tuân thủ Giới hạn hành nghề (Scope of Practice) theo Điều 87 Luật Khám bệnh, chữa bệnh 2023: Không tiêm truyền, không cho thuốc bừa bãi, không can thiệp xâm lấn.',
                              style: TextStyle(color: Colors.white70, fontSize: 10.5, height: 1.3),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        onPressed: (isSubmitting || frontImage == null || backImage == null || !scopeAgreed)
                            ? null
                            : () async {
                                setModalState(() => isSubmitting = true);
                                final appProvider = context.read<AppProvider>();
                                if (examTaken) {
                                  await appProvider.submitClinicalExam(
                                        answers: List.filled(20, 1),
                                        scopeOfPracticeAgreed: scopeAgreed,
                                      );
                                }
                                final ok = await appProvider.submitKycDocuments(
                                      frontPath: frontImage!.path,
                                      backPath: backImage!.path,
                                      certificatePath: certImage?.path,
                                      certificateNumber: certNumberController.text.trim().isNotEmpty
                                          ? certNumberController.text.trim()
                                          : 'CERT-BLS-${DateTime.now().millisecondsSinceEpoch}',
                                      issuingOrganization: issuingOrgController.text.trim().isNotEmpty
                                          ? issuingOrgController.text.trim()
                                          : 'Hội Chữ Thập Đỏ',
                                      specialtyTier: selectedTier,
                                      scopeOfPracticeAgreed: scopeAgreed,
                                    );
                                if (!context.mounted) return;
                                setModalState(() => isSubmitting = false);
                                Navigator.of(bottomSheetContext).pop();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                                    content: Text(
                                      ok
                                          ? 'Hồ sơ Hiệp sĩ & Chứng chỉ Y tế đã gửi thành công! Cổng quản trị đang thẩm định.'
                                          : 'Gửi hồ sơ thất bại, vui lòng thử lại.',
                                    ),
                                  ),
                                );
                              },
                        child: isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'NỘP HỒ SƠ THẨM ĐỊNH HIỆP SĨ',
                                style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<int?> _showClinicalExamDialog(BuildContext context) async {
    const questions = [
      (
        q: '1. Tiếp cận hiện trường tai nạn, nguyên tắc đầu tiên (3S Scene Safety) là gì?',
        opts: [
          'Lao vào bế nạn nhân ra ngay lập tức',
          'Đảm bảo hiện trường an toàn (điện hở, cháy nổ, xe cộ), không biến mình thành nạn nhân thứ 2',
          'Chụp ảnh hiện trường đăng mạng xã hội',
          'Tìm ví tiền và điện thoại của nạn nhân',
        ],
        ans: 1,
        note: 'Nguyên tắc vàng: An toàn cho người cứu hộ là ưu tiên số 1.',
      ),
      (
        q: '2. Trình tự hồi sinh tim phổi quốc tế DRSABCD bắt đầu với các bước nào?',
        opts: [
          'Thổi ngạt 5 lần ngay',
          'Tiêm thuốc trợ tim Adrenaline',
          'Danger (Nguy hiểm) -> Response (Tri giác) -> Send for help (Gọi trợ giúp)',
          'Đo huyết áp và điện tim',
        ],
        ans: 2,
        note: 'DRSABCD là chuỗi sinh tồn quốc tế trong hồi sức cấp cứu ngoại viện.',
      ),
      (
        q: '3. Tần số ép tim lồng ngực người lớn theo khuyến cáo chuẩn AHA là:',
        opts: [
          '60 - 80 nhịp/phút',
          '100 - 120 nhịp/phút (chuẩn Metronome quốc tế)',
          '140 - 160 nhịp/phút',
          'Càng nhanh càng tốt không giới hạn',
        ],
        ans: 1,
        note: 'Tần số chuẩn 100-120 bpm duy trì lưu lượng tưới máu não và vành.',
      ),
      (
        q: '4. Độ sâu ép tim lồng ngực người lớn khuyến cáo là bao nhiêu?',
        opts: [
          '1 - 2 cm',
          '5 - 6 cm và để lồng ngực nở hoàn toàn sau mỗi lần ép',
          '8 - 10 cm',
          'Ấn nhẹ trên xương sườn',
        ],
        ans: 1,
        note: 'Ép sâu 5-6cm và để ngực nở hoàn toàn tạo chênh áp bơm máu.',
      ),
      (
        q: '5. Tỷ lệ ép tim và thổi ngạt chuẩn cho người cứu hộ đơn độc là:',
        opts: [
          '15 lần ép : 2 lần thổi',
          '30 lần ép : 2 lần thổi ngạt (chu kỳ 30:2)',
          '50 lần ép : 1 lần thổi',
          'Chỉ thổi ngạt không ép tim',
        ],
        ans: 1,
        note: 'Tỷ lệ vàng 30:2 áp dụng cho người lớn ngưng tuần hoàn hô hấp.',
      ),
      (
        q: '6. Nghi ngờ nạn nhân chấn thương cột sống cổ, mở đường thở đúng cách là:',
        opts: [
          'Ngửa cổ tối đa ra sau',
          'Lắc mạnh đầu kiểm tra',
          'Kỹ thuật ấn góc hàm (Jaw-thrust) giữ thẳng trục đầu cổ',
          'Kê gối cao dưới gáy',
        ],
        ans: 2,
        note: 'Kỹ thuật Jaw-thrust mở đường thở mà không làm di lệch cột sống cổ.',
      ),
      (
        q: '7. Khi nào được phép tháo mũ bảo hiểm của nạn nhân tai nạn xe máy?',
        opts: [
          'Tháo ngay khi vừa tiếp cận',
          'Chỉ khi đường thở tắc nghẽn/ngưng thở và có 2 người phối hợp giữ trục cổ',
          'Khi người dân xung quanh yêu cầu',
          'Tuyệt đối không bao giờ được tháo',
        ],
        ans: 1,
        note: 'Chỉ tháo mũ khi bất khả kháng và bắt buộc có 2 người phối hợp.',
      ),
      (
        q: '8. Chỉ định bắt buộc để đặt garô chèn động mạch (CAT Tourniquet) là:',
        opts: [
          'Trầy xước da chảy máu rỉ',
          'Chảy máu động mạch phun thành tia hoặc đứt lìa chi không cầm được bằng băng ép',
          'Bầm tím dưới da',
          'Gãy xương kín không chảy máu',
        ],
        ans: 1,
        note: 'Garô chỉ dùng trong chảy máu động mạch ồ ạt đe dọa tính mạng.',
      ),
      (
        q: '9. Vị trí đặt garô chuẩn so với mép vết thương chảy máu là:',
        opts: [
          'Ngay trên mép vết thương',
          'Cách 5 - 7 cm về phía tim, không đặt đè lên khớp',
          'Đặt ở cổ nạn nhân',
          'Đặt cách vết thương 30 cm',
        ],
        ans: 1,
        note: 'Đặt cách 5-7cm về phía gốc chi (phía tim) và tránh vị trí khớp.',
      ),
      (
        q: '10. Khoảng thời gian nới garô khuyến cáo tránh hoại tử chi khi di chuyển xa:',
        opts: [
          'Mỗi 5 phút nới 1 lần',
          'Mỗi 60 phút nới 1-2 phút nếu thời gian vận chuyển kéo dài',
          'Không bao giờ nới cho đến khi vào phòng mổ',
          'Nới liên tục',
        ],
        ans: 1,
        note: 'Ghi rõ giờ đặt garô và cảnh báo nới mỗi 60 phút tránh hoại tử mô.',
      ),
      (
        q: '11. Nguyên tắc cố định gãy xương chi bằng nẹp chuyên dụng là:',
        opts: [
          'Bất động qua 2 khớp: 1 khớp trên và 1 khớp dưới ổ gãy',
          'Nắn chỉnh kéo thẳng xương đâm lòi ra ngoài',
          'Chỉ bó chặt ngay ổ gãy',
          'Cho nạn nhân đứng dậy đi thử',
        ],
        ans: 0,
        note: 'Bắt buộc cố định trên 1 khớp và dưới 1 khớp để ổ gãy không di lệch.',
      ),
      (
        q: '12. Khi dùng máy khử rung tim tự động AED, thao tác bắt buộc trước khi nhấn nút sốc là:',
        opts: [
          'Ôm chặt lấy nạn nhân',
          'Hô to "Tránh xa nạn nhân" và đảm bảo không ai chạm vào nạn nhân',
          'Đổ nước lên ngực nạn nhân',
          'Tắt kết nối mạng',
        ],
        ans: 1,
        note: 'Tuyệt đối không ai chạm vào nạn nhân khi AED phóng điện sốc.',
      ),
      (
        q: '13. Xử trí nạn nhân bất tỉnh nhưng còn tự thở đều và có mạch đập:',
        opts: [
          'Ép tim CPR liên tục',
          'Cho uống nước đường nóng',
          'Đặt nằm nghiêng an toàn (Recovery position) thông thoáng đường thở',
          'Dốc ngược đầu xuống đất',
        ],
        ans: 2,
        note: 'Tư thế nằm nghiêng an toàn chống tụt lưỡi và chống sặc dịch dạ dày.',
      ),
      (
        q: '14. Ép tim cho trẻ em từ 1 đến 8 tuổi chuẩn là:',
        opts: [
          'Ép bằng 1 gót bàn tay, độ sâu 4-5 cm (1/3 lồng ngực)',
          'Ép bằng 2 tay dùng hết sức như người lớn',
          'Không được ép tim cho trẻ em',
          'Chỉ xoa bóp bụng',
        ],
        ans: 0,
        note: 'Trẻ em dùng 1 gót bàn tay với lực vừa phải tránh gãy xương sườn.',
      ),
      (
        q: '15. Ép tim cho trẻ sơ sinh (< 1 tuổi) chuẩn là:',
        opts: [
          'Dùng cả bàn tay ấn mạnh',
          'Dùng 2 ngón tay hoặc kỹ thuật 2 ngón cái ôm lồng ngực, sâu 3-4 cm',
          'Cầm chân dốc ngược vỗ lưng',
          'Chỉ thổi ngạt',
        ],
        ans: 1,
        note: 'Trẻ sơ sinh chỉ dùng 2 ngón tay hoặc 2 ngón cái ôm quanh ngực.',
      ),
      (
        q: '16. Thủ thuật Heimlich tống dị vật đường thở cho người lớn tỉnh táo thực hiện ở đâu:',
        opts: [
          'Vỗ mạnh vào vùng thái dương',
          'Đặt nắm đấm trên rốn, dưới mũi xương ức, giật mạnh vào trong và lên trên',
          'Đấm sau lưng khi đang nằm',
          'Cho uống nhiều nước',
        ],
        ans: 1,
        note: 'Tạo luồng khí đẩy dị vật từ khí quản ra ngoài.',
      ),
      (
        q: '17. Nạn nhân co giật sùi bọt mép, hành động nào TUYỆT ĐỐI BỊ CẤM:',
        opts: [
          'Kê gối mềm dưới đầu',
          'Nghiêng đầu sang bên cho thoát đờm dãi',
          'Nhét thìa, đũa hoặc ngón tay vào miệng nạn nhân',
          'Nới lỏng cổ áo và thắt lưng',
        ],
        ans: 2,
        note: 'Cấm nhét vật cứng vào miệng vì có thể gãy răng gây hít sặc tắc thở.',
      ),
      (
        q: '18. Theo Điều 87 Luật Khám bệnh, chữa bệnh 2023, ranh giới đỏ đối với Hiệp sĩ sơ cứu là:',
        opts: [
          'Không tiêm truyền, không kê đơn dùng thuốc, không can thiệp phẫu thuật xâm lấn',
          'Không được ép tim CPR',
          'Không được gọi cấp cứu 115',
          'Không được băng bó vết thương',
        ],
        ans: 0,
        note: 'Hiệp sĩ cộng đồng tuyệt đối tuân thủ giới hạn hành nghề sơ cấp cứu.',
      ),
      (
        q: '19. Vết thương có dị vật cắm sâu (dao, thanh sắt), xử trí đúng là:',
        opts: [
          'Rút phắt dị vật ra ngay lập tức',
          'Giữ nguyên dị vật, chèn gạc/vải cố định xung quanh và băng ép cố định',
          'Rửa cồn đỏ trực tiếp vào vết đâm',
          'Xoay tròn dị vật kiểm tra độ sâu',
        ],
        ans: 1,
        note: 'Rút dị vật sâu sẽ gây chảy máu ồ ạt không thể kiểm soát ngoài viện.',
      ),
      (
        q: '20. Khi bàn giao cho kíp cấp cứu 115, cấu trúc báo cáo y tế chuẩn SBAR gồm:',
        opts: [
          'S (Tình huống), B (Tiền sử), A (Đánh giá lâm sàng), R (Xử trí & Đề xuất)',
          'Tên, Tuổi, Quê quán, Nghề nghiệp',
          'Số điện thoại người nhà và địa chỉ nhà',
          'Rời đi ngay không cần bàn giao',
        ],
        ans: 0,
        note: 'SBAR là chuẩn bàn giao thông tin lâm sàng bất biến trong y khoa.',
      ),
    ];

    final userAnswers = List<int?>.filled(questions.length, null);

    return showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (examCtx) {
        return StatefulBuilder(
          builder: (context, setExamState) {
            final answeredCount = userAnswers.where((a) => a != null).length;

            return Container(
              height: MediaQuery.of(context).size.height * 0.92,
              padding: const EdgeInsets.only(top: 16, left: 16, right: 16, bottom: 24),
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A),
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.quiz_rounded, color: Color(0xFF38BDF8), size: 24),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'SÁT HẠCH LÂM SÀNG Y TẾ',
                                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                              Text(
                                'Điều 87 Luật Khám bệnh, chữa bệnh · 20 câu hỏi',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 10),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF38BDF8).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF38BDF8).withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          '$answeredCount / 20 câu',
                          style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: answeredCount / 20.0,
                      backgroundColor: Colors.white10,
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF38BDF8)),
                      minHeight: 4,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // DANH SÁCH 20 CÂU HỎI
                  Expanded(
                    child: ListView.separated(
                      itemCount: questions.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 14),
                      itemBuilder: (context, idx) {
                        final item = questions[idx];
                        final selected = userAnswers[idx];

                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selected != null ? const Color(0xFF38BDF8).withValues(alpha: 0.5) : Colors.white12,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.q,
                                style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.bold, height: 1.3),
                              ),
                              const SizedBox(height: 10),
                              ...List.generate(item.opts.length, (optIdx) {
                                final isChosen = selected == optIdx;
                                return InkWell(
                                  onTap: () {
                                    setExamState(() => userAnswers[idx] = optIdx);
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 6),
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                    decoration: BoxDecoration(
                                      color: isChosen
                                          ? const Color(0xFF0284C7).withValues(alpha: 0.25)
                                          : const Color(0xFF0F172A),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: isChosen ? const Color(0xFF38BDF8) : Colors.white10,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          isChosen ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                                          color: isChosen ? const Color(0xFF38BDF8) : Colors.white30,
                                          size: 16,
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            item.opts[optIdx],
                                            style: TextStyle(
                                              color: isChosen ? Colors.white : Colors.white70,
                                              fontSize: 11.5,
                                              fontWeight: isChosen ? FontWeight.w600 : FontWeight.normal,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),

                  // NÚT NỘP BÀI THI
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: answeredCount == 20 ? const Color(0xFF10B981) : Colors.white24,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: answeredCount < 20
                          ? null
                          : () async {
                              int score = 0;
                              final answersList = <Map<String, dynamic>>[];
                              for (int i = 0; i < questions.length; i++) {
                                final isCorrect = userAnswers[i] == questions[i].ans;
                                if (isCorrect) score++;
                                answersList.add({
                                  'questionIndex': i,
                                  'selectedIndex': userAnswers[i],
                                  'correctIndex': questions[i].ans,
                                  'isCorrect': isCorrect,
                                });
                              }

                              final isPassed = score >= 18;
                              // Gửi kết quả thi lên server
                              try {
                                await context.read<AppProvider>().submitClinicalExam(
                                  answers: userAnswers.map((a) => a ?? 0).toList(),
                                  scopeOfPracticeAgreed: true,
                                );
                              } catch (_) {}

                              if (!context.mounted) return;
                              Navigator.pop(examCtx, score);

                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: isPassed ? const Color(0xFF059669) : const Color(0xFFDC2626),
                                  content: Text(
                                    isPassed
                                        ? 'Chúc mừng! Bạn đạt $score/20 câu (≥90%) - Đủ điều kiện cấp chứng chỉ Hiệp Sĩ!'
                                        : 'Bạn đạt $score/20 câu (chưa đạt yêu cầu ≥18/20). Vui lòng ôn luyện và thi lại!',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ),
                              );
                            },
                      child: Text(
                        answeredCount < 20 ? 'VUI LÒNG HOÀN TẤT 20 CÂU ($answeredCount/20)' : 'NỘP BÀI THI LÂM SÀNG',
                        style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildImagePickerBox({
    required String title,
    required XFile? image,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: image != null ? const Color(0xFF38BDF8) : Colors.white24,
            width: image != null ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            if (image != null && !kIsWeb)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(
                  File(image.path),
                  width: 50,
                  height: 50,
                  fit: BoxFit.cover,
                ),
              )
            else
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white10,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  image != null ? Icons.check_circle_rounded : Icons.camera_alt_outlined,
                  color: image != null ? const Color(0xFF38BDF8) : Colors.white60,
                ),
              ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    image != null ? 'Đã chọn: ${image.name}' : 'Nhấn để chọn ảnh từ thiết bị',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: image != null ? const Color(0xFF38BDF8) : Colors.white38,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              image != null ? Icons.check_circle_rounded : Icons.file_upload_outlined,
              color: image != null ? const Color(0xFF10B981) : Colors.white38,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showThankYouDialog(BuildContext context, HeroProfile hero) async {
    int selectedRating = 5;
    final textController = TextEditingController(
      text: 'Cảm ơn bạn rất nhiều vì đã kịp thời hỗ trợ tôi khi gặp tình huống khẩn cấp!',
    );
    bool isSending = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.favorite_rounded, color: Color(0xFFF43F5E), size: 24),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Cảm ơn & Đánh giá',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hiệp sĩ: ${hero.name} · ${hero.location}',
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Chất lượng hỗ trợ:',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          iconSize: 32,
                          icon: Icon(
                            star <= selectedRating ? Icons.star_rounded : Icons.star_outline_rounded,
                            color: const Color(0xFFFBBF24),
                          ),
                          onPressed: () => setDialogState(() => selectedRating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: textController,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Nhập lời nhắn cảm ơn gửi tới Hiệp sĩ...',
                        hintStyle: const TextStyle(color: Colors.white38),
                        filled: true,
                        fillColor: const Color(0xFF0F172A),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Colors.white24),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Colors.white24),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF38BDF8)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Đóng', style: TextStyle(color: Colors.white60)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF43F5E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isSending
                      ? null
                      : () async {
                          setDialogState(() => isSending = true);
                          final ok = await context.read<AppProvider>().sendHeroThankYou(
                                heroId: hero.effectiveId,
                                rating: selectedRating,
                                message: textController.text.trim(),
                              );
                          setDialogState(() => isSending = false);
                          if (!context.mounted) return;
                          Navigator.of(dialogContext).pop();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: ok ? const Color(0xFF059669) : Colors.red,
                              content: Text(
                                ok
                                    ? 'Đã gửi lời cảm ơn và đánh giá $selectedRating sao tới ${hero.name}!'
                                    : 'Gửi đánh giá thất bại, vui lòng thử lại.',
                              ),
                            ),
                          );
                        },
                  child: isSending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('GỬI LỜI CẢM ƠN', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final provider = context.watch<AppProvider>();
    final user = provider.user;
    final isKycVerified = user?.isKycVerified ?? false;
    final heroes = provider.heroes;
    final rows = _filter == _HeroesFilter.ranking
        ? ([...heroes]..sort((a, b) => b.rescues.compareTo(a.rescues)))
        : ([...heroes]..sort((a, b) => a.distanceKm.compareTo(b.distanceKm)));

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 18, bottom: 24),
        children: [
          Row(
            children: [
              const Icon(
                Icons.workspace_premium_outlined,
                color: AppColors.warning,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text(strings.text('Hiệp sĩ', 'Heroes'), style: AppTextStyles.h2.copyWith(fontSize: 28)),
              const Spacer(),
              const AppRoundIconButton(icon: Icons.shield_outlined),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            strings.text(
              'Bảng xếp hạng tình nguyện viên và những người có thể hỗ trợ quanh bạn.',
              'Ranking of volunteers and people who can help nearby.',
            ),
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 16),

          // Card Đăng ký Tình nguyện viên Hiệp sĩ & KYC
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isKycVerified ? const Color(0xFF10B981) : const Color(0xFF0284C7).withValues(alpha: 0.5),
                width: 1.5,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isKycVerified
                        ? const Color(0xFF10B981).withValues(alpha: 0.2)
                        : const Color(0xFF0284C7).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isKycVerified ? Icons.verified_user_rounded : Icons.shield_outlined,
                    color: isKycVerified ? const Color(0xFF10B981) : const Color(0xFF38BDF8),
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isKycVerified ? 'Hiệp sĩ đã xác thực danh tính' : 'Đăng ký làm Hiệp sĩ Cứu hộ',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        isKycVerified
                            ? 'Tài khoản đã định danh đầy đủ, sẵn sàng nhận ca điều phối.'
                            : 'Xác minh CCCD/Passport để tham gia mạng lưới cứu hộ.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isKycVerified) ...[
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _showKycBottomSheet(context),
                    child: const Text('Nộp KYC', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ] else ...[
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute<void>(builder: (_) => const HeroWorkspacePage()),
                      );
                    },
                    icon: const Icon(Icons.radar_rounded, size: 14),
                    label: const Text('BÀN TÁC CHIẾN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ],
            ),
          ),

          // NÚT KHỞI ĐỘNG TÁC CHIẾN HIỆP SĨ (CHỈ XUẤT HIỆN KHI ĐÃ KYC)
          if (isKycVerified) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute<void>(builder: (_) => const HeroWorkspacePage()),
                );
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF064E3B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF10B981), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF10B981).withValues(alpha: 0.25),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF10B981), width: 1.2),
                      ),
                      child: const Icon(Icons.bolt_rounded, color: Color(0xFF10B981), size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'CHẾ ĐỘ TÁC CHIẾN HIỆP SĨ [SẴN SÀNG]',
                            style: TextStyle(
                              color: Color(0xFF34D399),
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Radar SOS · HUD cứu hộ hiện trường · Bộ đàm PTT · Thẻ định danh & Ví quỹ',
                            style: TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF34D399), size: 16),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: 18),
          if (rows.isNotEmpty)
            AppCard(
              child: Column(
                children: [
                  Row(
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: const BoxDecoration(
                              color: AppColors.primarySoft,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              rows.first.name.substring(0, 1).toUpperCase(),
                              style: AppTextStyles.h3.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          if (rows.first.verified)
                            Positioned(
                              right: -2,
                              bottom: -2,
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(
                                  Icons.verified_outlined,
                                  size: 14,
                                  color: Color(0xFF3A7AFE),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(rows.first.name, style: AppTextStyles.title),
                            const SizedBox(height: 4),
                            Text(
                              '${rows.first.location} · ${rows.first.rescues} lần hỗ trợ',
                              style: AppTextStyles.bodyStrong.copyWith(
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.star_rounded,
                                size: 18,
                                color: AppColors.warning,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                rows.first.rating.toStringAsFixed(1),
                                style: AppTextStyles.title.copyWith(
                                  color: AppColors.warning,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text('${rows.first.distanceKm} km', style: AppTextStyles.caption),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFF43F5E),
                        side: const BorderSide(color: Color(0xFFF43F5E)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.favorite_rounded, size: 16),
                      label: const Text('Gửi lời cảm ơn & Đánh giá', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      onPressed: () => _showThankYouDialog(context, rows.first),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 18),
          AppSegmentedControl<_HeroesFilter>(
            value: _filter,
            items: const [
              AppSegmentItem(
                value: _HeroesFilter.ranking,
                label: 'Bảng vàng',
                icon: Icons.workspace_premium_outlined,
              ),
              AppSegmentItem(
                value: _HeroesFilter.nearby,
                label: 'Gần bạn',
                icon: Icons.map_outlined,
              ),
            ],
            onChanged: (value) => setState(() => _filter = value),
          ),
          const SizedBox(height: 18),
          for (var index = 0; index < rows.length; index++) ...[
            _HeroListRow(
              hero: rows[index],
              rank: index + 1,
              nearby: _filter == _HeroesFilter.nearby,
              onThankYou: () => _showThankYouDialog(context, rows[index]),
            ),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

class _HeroListRow extends StatelessWidget {
  const _HeroListRow({
    required this.hero,
    required this.rank,
    required this.nearby,
    required this.onThankYou,
  });

  final HeroProfile hero;
  final int rank;
  final bool nearby;
  final VoidCallback onThankYou;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: rank == 1 ? const Color(0xFFFFF1D7) : AppColors.accent,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Text(
                  '$rank',
                  style: AppTextStyles.title.copyWith(
                    color: rank == 1 ? AppColors.warning : AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            hero.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.title,
                          ),
                        ),
                        if (hero.verified) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.verified_outlined,
                            size: 16,
                            color: Color(0xFF3A7AFE),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      nearby
                          ? 'Cách bạn ${hero.distanceKm.toStringAsFixed(1)} km'
                          : '${hero.location} · ${hero.rescues} lần cứu',
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Row(
                children: [
                  const Icon(
                    Icons.star_rounded,
                    color: AppColors.warning,
                    size: 18,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    hero.rating.toStringAsFixed(1),
                    style: AppTextStyles.title.copyWith(color: AppColors.warning),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFFF43F5E),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              icon: const Icon(Icons.favorite_outline_rounded, size: 14),
              label: const Text('Cảm ơn & Đánh giá', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              onPressed: onThankYou,
            ),
          ),
        ],
      ),
    );
  }
}
