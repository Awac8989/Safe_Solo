import 'package:flutter/material.dart';
import '../../core/app_theme.dart';
import '../../core/widgets/top_toast.dart';
import '../../models/hazard_report_model.dart';

class CreateHazardSheet extends StatefulWidget {
  const CreateHazardSheet({super.key, this.onCreated});

  final void Function(HazardReportModel report)? onCreated;

  static Future<void> show(BuildContext context, {void Function(HazardReportModel report)? onCreated}) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CreateHazardSheet(onCreated: onCreated),
    );
  }

  @override
  State<CreateHazardSheet> createState() => _CreateHazardSheetState();
}

class _CreateHazardSheetState extends State<CreateHazardSheet> {
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descController = TextEditingController();
  HazardCategory _category = HazardCategory.darkRoad;
  bool _isAnonymous = false;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      TopToast.show(context, message: 'Vui lòng nhập tiêu đề cảnh báo', icon: Icons.error_outline_rounded);
      return;
    }

    setState(() => _isSubmitting = true);

    final report = HazardReportModel(
      id: 'hazard_${DateTime.now().millisecondsSinceEpoch}',
      authorName: _isAnonymous ? 'Hiệp sĩ ẩn danh' : 'Bạn',
      title: title,
      description: _descController.text.trim(),
      category: _category,
      lat: 10.7769,
      lng: 106.7009,
      address: 'Vị trí hiện tại của bạn',
      distanceKm: 0.1,
      confirmCount: 1,
      createdAt: DateTime.now(),
      isAnonymous: _isAnonymous,
    );

    widget.onCreated?.call(report);

    Navigator.pop(context);
    TopToast.show(context, message: 'Đã gửi cảnh báo nguy cơ lên cộng đồng radar!');
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 24 + bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.destructive.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.warning_rounded, color: AppColors.destructive, size: 22),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Báo cáo Nguy cơ Lân cận',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                    Text(
                      'Cảnh báo sớm cho người đi đêm và phụ nữ một mình',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          const Text('Loại nguy cơ:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          DropdownButtonFormField<HazardCategory>(
            value: _category,
            borderRadius: BorderRadius.circular(14),
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.background,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
            ),
            items: HazardCategory.values.map((cat) {
              final dummy = HazardReportModel(
                id: '',
                authorName: '',
                title: '',
                category: cat,
                lat: 0,
                lng: 0,
                createdAt: DateTime.now(),
              );
              return DropdownMenuItem(
                value: cat,
                child: Row(
                  children: [
                    Icon(dummy.categoryIcon, size: 18, color: dummy.categoryColor),
                    const SizedBox(width: 10),
                    Text(dummy.categoryLabel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  ],
                ),
              );
            }).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _category = val);
            },
          ),
          const SizedBox(height: 16),

          const Text('Tiêu đề cảnh báo:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _titleController,
            decoration: InputDecoration(
              hintText: 'Ví dụ: Đoạn ngõ 12 mất đèn đường rất tối...',
              filled: true,
              fillColor: AppColors.background,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
            ),
          ),
          const SizedBox(height: 16),

          const Text('Mô tả thêm (Tùy chọn):', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _descController,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'Chi tiết thêm để mọi người cẩn trọng...',
              filled: true,
              fillColor: AppColors.background,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
            ),
          ),
          const SizedBox(height: 14),

          Row(
            children: [
              Checkbox(
                value: _isAnonymous,
                activeColor: AppColors.primary,
                onChanged: (v) => setState(() => _isAnonymous = v ?? false),
              ),
              const Expanded(
                child: Text('Đăng ẩn danh (Bảo vệ thông tin cá nhân của bạn)', style: TextStyle(fontSize: 13)),
              ),
            ],
          ),
          const SizedBox(height: 18),

          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _submit,
              icon: const Icon(Icons.send_rounded, color: Colors.white),
              label: const Text(
                'PHÁT CẢNH BÁO LÊN CỘNG ĐỒNG RADAR',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.destructive,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
