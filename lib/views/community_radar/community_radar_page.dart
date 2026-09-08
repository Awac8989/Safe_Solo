import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/maptiler_tile_provider.dart';
import '../../core/providers/app_provider.dart';
import '../../services/api_service.dart';

class CommunityRadarPage extends StatefulWidget {
  const CommunityRadarPage({
    super.key,
    this.reason = 'Cấp cứu y tế',
    this.note = 'Người cao tuổi đang cần hỗ trợ gấp',
  });

  final String reason;
  final String note;

  @override
  State<CommunityRadarPage> createState() => _CommunityRadarPageState();
}

class _CommunityRadarPageState extends State<CommunityRadarPage>
    with SingleTickerProviderStateMixin {
  bool _accepted = false;
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();

  // Destination coordinates for rescue
  final double _targetLat = 10.7769;
  final double _targetLng = 106.7009;

  AppStrings _strings(BuildContext context) =>
      AppStrings(context.read<AppProvider>().language);
  late final AnimationController _blink = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _blink.dispose();
    super.dispose();
  }

  Future<void> _openExternalNav({required bool isWaze}) async {
    final strings = _strings(context);
    final url = isWaze
        ? 'https://www.waze.com/ul?ll=$_targetLat,$_targetLng&navigate=yes'
        : 'https://www.google.com/maps/dir/?api=1&destination=$_targetLat,$_targetLng';
    final uri = Uri.parse(url);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(strings.text('Không thể mở ứng dụng bản đồ', 'Cannot open navigation app'))),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi: $e')),
      );
    }
  }

  void _showNavigationOptions() {
    final strings = _strings(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                strings.text('Chỉ đường khẩn cấp tới hiện trường', 'Emergency Navigation'),
                style: AppTextStyles.title,
              ),
              const SizedBox(height: 6),
              Text(
                strings.text('Chọn ứng dụng bản đồ để điều hướng nhanh nhất:', 'Select navigation app:'),
                style: AppTextStyles.body.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF33CCFF).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.navigation_rounded, color: Color(0xFF00A3FF)),
                ),
                title: const Text('Waze Navigation', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Tối ưu tránh kẹt xe và cảnh báo tức thời'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(ctx);
                  _openExternalNav(isWaze: true);
                },
              ),
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.map_rounded, color: Colors.green),
                ),
                title: const Text('Google Maps', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Dẫn đường chỉ lối mặc định hệ điều hành'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.pop(ctx);
                  _openExternalNav(isWaze: false);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Future<File?> _pickImageWithPrompt(BuildContext context, {required bool isFront}) async {
    final strings = _strings(context);
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isFront
                    ? strings.text('Chọn ảnh mặt trước CCCD', 'Select Front ID Photo')
                    : strings.text('Chọn ảnh mặt sau CCCD', 'Select Back ID Photo'),
                style: AppTextStyles.title,
              ),
              const SizedBox(height: 14),
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFE0F2FE),
                  child: Icon(Icons.camera_alt_rounded, color: Color(0xFF0284C7)),
                ),
                title: Text(strings.text('Chụp ảnh mới bằng Camera', 'Take photo with Camera')),
                subtitle: Text(strings.text('Căn chỉnh rõ nét góc cạnh CCCD', 'Align ID card clearly')),
                onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
              ),
              const Divider(),
              ListTile(
                leading: const CircleAvatar(
                  backgroundColor: Color(0xFFF3E8FF),
                  child: Icon(Icons.photo_library_rounded, color: Color(0xFF9333EA)),
                ),
                title: Text(strings.text('Chọn từ Thư viện ảnh', 'Choose from Photo Gallery')),
                subtitle: Text(strings.text('Tải file ảnh có sẵn trên máy', 'Upload existing photo file')),
                onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );

    if (source != null) {
      final picked = await _picker.pickImage(source: source, imageQuality: 88);
      if (picked != null) {
        return File(picked.path);
      }
    }
    return null;
  }

  Future<void> _showKycUploadModal() async {
    final strings = _strings(context);
    final user = context.read<AppProvider>().user;
    File? frontImage;
    File? backImage;
    bool isUploading = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (bottomSheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.verified_user_rounded, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.text('Xác minh danh tính Hiệp sĩ (KYC)', 'Volunteer KYC Verification'),
                            style: AppTextStyles.title,
                          ),
                          Text(
                            strings.text('Tải lên ảnh 2 mặt CCCD / Passport', 'Upload front & back ID photos'),
                            style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _IdCardBox(
                        title: strings.text('Mặt trước CCCD', 'Front ID Card'),
                        file: frontImage,
                        onTap: () async {
                          final file = await _pickImageWithPrompt(ctx, isFront: true);
                          if (file != null) {
                            setModalState(() => frontImage = file);
                          }
                        },
                        onClear: () => setModalState(() => frontImage = null),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _IdCardBox(
                        title: strings.text('Mặt sau CCCD', 'Back ID Card'),
                        file: backImage,
                        onTap: () async {
                          final file = await _pickImageWithPrompt(ctx, isFront: false);
                          if (file != null) {
                            setModalState(() => backImage = file);
                          }
                        },
                        onClear: () => setModalState(() => backImage = null),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: (frontImage == null || backImage == null || isUploading)
                        ? null
                        : () async {
                            setModalState(() => isUploading = true);
                            try {
                              await _api.uploadKycDocuments(
                                frontPath: frontImage!.path,
                                backPath: backImage!.path,
                                userId: user?.id,
                              );
                              if (ctx.mounted) {
                                Navigator.pop(ctx);
                              }
                              if (mounted) {
                                setState(() => _accepted = true);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: Colors.green.shade700,
                                    content: Text(
                                      strings.text(
                                        'Hồ sơ KYC đã được gửi thành công! Đã cấp quyền nhận ca cứu hộ.',
                                        'KYC submitted successfully! Rescue access granted.',
                                      ),
                                    ),
                                  ),
                                );
                              }
                            } catch (e) {
                              setModalState(() => isUploading = false);
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  SnackBar(content: Text('Lỗi tải KYC: $e')),
                                );
                              }
                            }
                          },
                    child: isUploading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(strings.text('GỬI HỒ SƠ KYC XÁC MINH', 'SUBMIT KYC DOCUMENTS')),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = _strings(context);
    final target = LatLng(_targetLat, _targetLng);

    return Scaffold(
      appBar: AppBar(
        title: Text(strings.text('Mạng cứu hộ cộng đồng', 'Rescue radar')),
        actions: [
          IconButton(
            tooltip: strings.text('Xác thực KYC', 'KYC Verification'),
            icon: const Icon(Icons.badge_outlined),
            onPressed: _showKycUploadModal,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  GoogleMap(
                    initialCameraPosition: CameraPosition(target: target, zoom: 14.5),
                    markers: {
                      Marker(
                        markerId: const MarkerId('incident'),
                        position: target,
                        infoWindow: InfoWindow(
                          title: widget.reason,
                          snippet: widget.note,
                        ),
                      ),
                      if (_accepted)
                        Marker(
                          markerId: const MarkerId('volunteer'),
                          position: const LatLng(10.7810, 106.6980),
                          icon: BitmapDescriptor.defaultMarkerWithHue(
                            BitmapDescriptor.hueCyan,
                          ),
                        ),
                    },
                    tileOverlays: {
                      const TileOverlay(
                        tileOverlayId: TileOverlayId('maptiler_base'),
                        tileProvider: MapTilerTileProvider(),
                      ),
                    },
                  ),
                  Positioned(
                    top: 14,
                    left: 14,
                    right: 14,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.card.withValues(alpha: 0.94),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          FadeTransition(
                            opacity: _blink,
                            child: const Icon(Icons.circle, color: AppColors.destructive, size: 12),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${widget.reason} · Cách bạn 850m',
                              style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _accepted
                        ? '123 Nguyễn Hữu Thọ, Q.7, TP.HCM'
                        : strings.text(
                            'Khu vực: Bán kính 1km (Bảo mật vị trí)',
                            'Area: 1km radius (Location protected)',
                          ),
                    style: AppTextStyles.title,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _accepted
                        ? strings.text(
                            'Trạng thái: Đang trên đường · ETA 6 phút (Đã xác minh KYC)',
                            'Status: On the way · ETA 6 mins (KYC Verified)',
                          )
                        : strings.text(
                            'Địa chỉ chính xác chỉ mở sau khi xác minh KYC và nhận lời.',
                            'Exact address revealed after KYC verification and acceptance.',
                          ),
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_accepted) ...[
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF00A3FF),
                              side: const BorderSide(color: Color(0xFF00A3FF)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.navigation_rounded, size: 18),
                            label: const Text('Waze', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () => _openExternalNav(isWaze: true),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.green,
                              side: const BorderSide(color: Colors.green),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            icon: const Icon(Icons.map_rounded, size: 18),
                            label: const Text('Google Maps', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () => _openExternalNav(isWaze: false),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                  ],
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      icon: Icon(_accepted ? Icons.directions_run_rounded : Icons.shield_rounded),
                      onPressed: _accepted
                          ? _showNavigationOptions
                          : _showKycUploadModal,
                      label: Text(
                        _accepted
                            ? strings.text('CHỈ ĐƯỜNG KHẨN CẤP', 'OPEN NAVIGATION')
                            : strings.text('XÁC MINH KYC & ĐI CỨU', 'VERIFY KYC & RESPOND'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IdCardBox extends StatelessWidget {
  const _IdCardBox({
    required this.title,
    required this.file,
    required this.onTap,
    this.onClear,
  });

  final String title;
  final File? file;
  final VoidCallback onTap;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 125,
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: file != null ? const Color(0xFF10B981) : AppColors.border,
          width: file != null ? 1.8 : 1,
        ),
        boxShadow: file != null
            ? [
                BoxShadow(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                )
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(15),
        child: Stack(
          children: [
            Positioned.fill(
              child: file != null
                  ? Image.file(file!, fit: BoxFit.cover)
                  : InkWell(
                      onTap: onTap,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.add_a_photo_rounded, color: AppColors.primary, size: 24),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            title,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 3),
                          const Text(
                            'Camera / Thư viện',
                            style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
            ),
            if (file != null) ...[
              Positioned(
                top: 6,
                right: 6,
                child: Row(
                  children: [
                    InkWell(
                      onTap: onTap,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.65),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.refresh_rounded, color: Colors.white, size: 16),
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (onClear != null)
                      InkWell(
                        onTap: onClear,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.8),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close_rounded, color: Colors.white, size: 16),
                        ),
                      ),
                  ],
                ),
              ),
              Positioned(
                bottom: 6,
                left: 6,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 12),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
