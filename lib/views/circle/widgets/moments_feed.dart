import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../../core/app_theme.dart';
import '../../../core/constants.dart';
import '../../../core/providers/app_provider.dart';
import '../../../models/safe_moment.dart';
import '../../../services/api_service.dart';
import '../../../services/chat_service.dart';
import '../../../services/widget_service.dart';

class MomentsFeed extends StatefulWidget {
  const MomentsFeed({super.key});

  @override
  State<MomentsFeed> createState() => _MomentsFeedState();
}

class _MomentsFeedState extends State<MomentsFeed> {
  final ImagePicker _picker = ImagePicker();
  List<SafeMoment> _moments = [];
  bool _isLoading = true;
  bool _isUploading = false;

  @override
  void initState() {
    super.initState();
    _fetchMoments();
    ChatService.instance.addMomentListener(_onNewMoment);
  }

  @override
  void dispose() {
    ChatService.instance.removeMomentListener(_onNewMoment);
    super.dispose();
  }

  void _onNewMoment(Map<String, dynamic> data) {
    if (!mounted) return;
    setState(() {
      final newMoment = SafeMoment.fromJson(data);
      _moments.insert(0, newMoment); // Add to beginning
      
      WidgetService.updateLocketWidget(
        author: newMoment.authorName,
        caption: newMoment.caption,
        imageUrl: newMoment.photoUrl != null ? '${AppConstants.backendBaseUrl}${newMoment.photoUrl}' : null,
      );
    });
  }

  Future<void> _fetchMoments() async {
    try {
      final data = await ApiService.instance.getMoments();
      setState(() {
        _moments = data.map((e) => SafeMoment.fromJson(e)).toList();
        _isLoading = false;
        
        if (_moments.isNotEmpty) {
          final top = _moments.first;
          WidgetService.updateLocketWidget(
            author: top.authorName,
            caption: top.caption,
            imageUrl: top.photoUrl != null ? '${AppConstants.backendBaseUrl}${top.photoUrl}' : null,
          );
        } else {
          WidgetService.updateLocketWidget(
            author: 'SafeSolo Circle',
            caption: 'Chạm để cập nhật ảnh',
            imageUrl: null,
          );
        }
      });
    } catch (e) {
      debugPrint('Error fetching moments: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _captureMoment(AppProvider appProvider) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt, color: AppColors.primary),
              title: const Text('Chụp ảnh ngay (Camera)'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library, color: AppColors.primary),
              title: const Text('Chọn từ bộ sưu tập (Gallery)'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );

    if (source == null) return;

    final XFile? photo = await _picker.pickImage(
      source: source,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 70,
    );
    
    if (photo != null && mounted) {
      String selectedCaption = 'Tôi đang rất ổn ✨';
      final captionResult = await showDialog<String>(
        context: context,
        builder: (ctx) {
          final textCtrl = TextEditingController(text: selectedCaption);
          final quickOptions = [
            'Tôi đang rất ổn ✨',
            'Đang trên đường về 🛵',
            'Đã đến nơi an toàn 🏠',
            'Đang ở trường / chỗ làm 🏢',
          ];
          return AlertDialog(
            title: const Text('Gửi khoảnh khắc Locket'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: textCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Lời nhắn kèm ảnh',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                const Text('Gợi ý nhanh:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: quickOptions.map((opt) => ActionChip(
                    label: Text(opt, style: const TextStyle(fontSize: 11)),
                    onPressed: () => textCtrl.text = opt,
                  )).toList(),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, null),
                child: const Text('Hủy'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, textCtrl.text.trim()),
                child: const Text('Gửi Locket'),
              ),
            ],
          );
        },
      );

      if (captionResult == null) return;

      setState(() => _isUploading = true);
      try {
        final userId = appProvider.user?.id ?? 'guest_user';
        await ApiService.instance.uploadMoment(
          userId: userId,
          caption: captionResult.isNotEmpty ? captionResult : 'Tôi đang rất ổn!',
          mood: appProvider.mood?.name,
          filePath: photo.path,
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('🎉 Đã cập nhật khoảnh khắc Locket!')),
          );
        }
        await _fetchMoments();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi tải ảnh: $e')),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _isUploading = false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appProvider = context.watch<AppProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Khoảnh khắc Locket',
                style: AppTextStyles.h3.copyWith(
                  color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                ),
              ),
              IconButton(
                onPressed: _isUploading ? null : () => _captureMoment(appProvider),
                icon: _isUploading 
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(Icons.camera_alt, color: AppColors.primary),
              )
            ],
          ),
        ),
        SizedBox(
          height: 180,
          child: _moments.isEmpty
            ? InkWell(
                onTap: _isUploading ? null : () => _captureMoment(appProvider),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: isDark ? AppDarkColors.surfaceElevated : AppColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_alt_rounded, size: 38, color: AppColors.primary),
                        const SizedBox(height: 8),
                        Text(
                          'Chưa có khoảnh khắc nào',
                          style: AppTextStyles.bodyStrong.copyWith(
                            color: isDark ? AppDarkColors.textPrimary : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Chạm vào đây để chụp ảnh gửi người thân',
                          style: AppTextStyles.caption.copyWith(
                            color: isDark ? AppDarkColors.textSecondary : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            : ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: _moments.length,
                itemBuilder: (context, index) {
                  final moment = _moments[index];
                  final url = moment.photoUrl != null 
                    ? '${AppConstants.backendBaseUrl}${moment.photoUrl}'
                    : null;

                  return Container(
                    width: 140,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: isDark ? AppDarkColors.surfaceElevated : AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        )
                      ]
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (url != null)
                            Image.network(
                              url, 
                              fit: BoxFit.cover,
                              errorBuilder: (c, e, s) => const Icon(Icons.broken_image, color: Colors.grey),
                            )
                          else
                            const Icon(Icons.image, color: Colors.grey, size: 50),
                            
                          // Overlay
                          Positioned(
                            bottom: 0, left: 0, right: 0,
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Colors.black.withOpacity(0.8), Colors.transparent],
                                  begin: Alignment.bottomCenter,
                                  end: Alignment.topCenter,
                                )
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    moment.authorName,
                                    style: AppTextStyles.bodyStrong.copyWith(color: Colors.white, fontSize: 12),
                                    maxLines: 1, overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    moment.caption,
                                    style: AppTextStyles.body.copyWith(color: Colors.white70, fontSize: 11),
                                    maxLines: 2, overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          )
                        ],
                      ),
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }
}
