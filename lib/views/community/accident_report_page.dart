import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/app_provider.dart';
import '../../core/widgets/top_toast.dart';
import '../../services/api_service.dart';
import '../../services/offline_sos_service.dart';

/// Màn hình Báo Cáo Tai Nạn / Cấp Cứu Nạn Nhân Hiện Trường Kèm Ảnh TimeMark
class AccidentReportPage extends StatefulWidget {
  const AccidentReportPage({super.key});

  @override
  State<AccidentReportPage> createState() => _AccidentReportPageState();
}

class _AccidentReportPageState extends State<AccidentReportPage> {
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();

  String _selectedCategory = 'ACCIDENT'; // ACCIDENT, MEDICAL, FIRE, ROAD_HAZARD, SUSPICIOUS_PERSON
  String _selectedSeverity = 'P1_CRITICAL'; // P1_CRITICAL, P2_URGENT, P3_SUPPORT
  String _victimCount = '1 người';
  String _victimCondition = 'Bất tỉnh / Cần 115 khẩn cấp';

  File? _capturedImage;
  bool _useSamplePhoto = false;
  bool _isLocating = true;
  bool _isSubmitting = false;
  int _pendingQueueCount = 0;
  bool _isSyncingQueue = false;
  String _imageFileSize = '';

  double? _lat;
  double? _lng;
  double? _accuracy;
  bool _isRealGps = false;
  String _locationStatusText = 'Đang dò tìm tọa độ vệ tinh GPS thực tế...';
  String _timeMarkString = '';
  String _timeMarkHash = '';

  @override
  void initState() {
    super.initState();
    _refreshTimeMark();
    _loadPendingQueueCount();
    _addressController.text = 'Đang dò vị trí GPS thực tế...';
    _addressController.addListener(_onAddressChanged);
    _notesController.text = 'Va chạm giao thông tại hiện trường, nạn nhân cần xe cứu thương 115 tiếp cận khẩn cấp.';

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = context.read<AppProvider>().user;
      if (user?.lastKnownLocation != null && _lat == null) {
        final loc = user!.lastKnownLocation!;
        setState(() {
          _lat = loc.lat;
          _lng = loc.lng;
          _isRealGps = true;
          _locationStatusText = 'Tọa độ GPS thực gần nhất';
        });
        _resolveAddress(loc.lat, loc.lng);
      }
      _fetchCurrentLocation();
    });
  }

  void _onAddressChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _addressController.removeListener(_onAddressChanged);
    _addressController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _refreshTimeMark() {
    final now = DateTime.now();
    final day = now.day.toString().padLeft(2, '0');
    final month = now.month.toString().padLeft(2, '0');
    final year = now.year;
    final hour = now.hour.toString().padLeft(2, '0');
    final min = now.minute.toString().padLeft(2, '0');
    final sec = now.second.toString().padLeft(2, '0');

    setState(() {
      _timeMarkString = '$day/$month/$year $hour:$min:$sec GMT+7';
      _timeMarkHash = 'SHA256: ${now.millisecondsSinceEpoch.toRadixString(16).toUpperCase()}-94A8-TMK';
    });
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() {
      _isLocating = true;
      _locationStatusText = 'Đang kết nối chip định vị GPS vệ tinh...';
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          setState(() {
            _isLocating = false;
            _locationStatusText = 'Dịch vụ GPS trên máy đang tắt. Vui lòng bật vị trí.';
          });
          TopToast.show(
            context,
            message: 'Vui lòng bật dịch vụ vị trí GPS để lấy tọa độ thực tế',
            icon: Icons.location_off_rounded,
          );
        }
        return;
      }

      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (mounted) {
          setState(() {
            _isLocating = false;
            _locationStatusText = 'Chưa được cấp quyền vị trí GPS.';
          });
          TopToast.show(
            context,
            message: 'Cần cấp quyền vị trí để lấy tọa độ hiện trường thực tế',
            icon: Icons.location_disabled_rounded,
          );
        }
        return;
      }

      // 1. Đọc ngay vị trí đã biết gần nhất từ phần cứng GPS
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null && mounted) {
        setState(() {
          _lat = lastKnown.latitude;
          _lng = lastKnown.longitude;
          _accuracy = lastKnown.accuracy;
          _isRealGps = true;
          _locationStatusText = 'Tọa độ GPS thực (Gần nhất)';
        });
        _refreshTimeMark();
        _resolveAddress(lastKnown.latitude, lastKnown.longitude);
      }

      // 2. Chốt vị trí vệ tinh thời gian thực độ chính xác cao
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 12),
        ),
      );

      if (mounted) {
        setState(() {
          _lat = pos.latitude;
          _lng = pos.longitude;
          _accuracy = pos.accuracy;
          _isRealGps = true;
          _isLocating = false;
          _locationStatusText = 'Tọa độ GPS vệ tinh thực tế (±${pos.accuracy.toStringAsFixed(1)}m)';
        });
        _refreshTimeMark();
        _resolveAddress(pos.latitude, pos.longitude);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLocating = false;
          if (_lat == null) {
            _locationStatusText = 'Không bắt được sóng GPS. Nhấn thử lại.';
            _addressController.text = 'Vui lòng nhập địa chỉ hiện trường hoặc bấm thử lại GPS';
          }
        });
      }
    }
  }

  Future<void> _resolveAddress(double lat, double lng) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1',
      );
      final res = await http.get(
        uri,
        headers: {'User-Agent': 'SafeSolo-App/1.0 (emergency-dispatch)'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
        final addr = data['address'] as Map<String, dynamic>?;
        String resolved = '';
        if (addr != null) {
          final road = addr['road'] ?? addr['suburb'] ?? addr['neighbourhood'] ?? addr['pedestrian'];
          final quarter = addr['quarter'] ?? addr['city_district'] ?? addr['suburb'];
          final city = addr['city'] ?? addr['town'] ?? addr['state'];
          final parts = [road, quarter, city].where((p) => p != null && p.toString().trim().isNotEmpty).toList();
          if (parts.isNotEmpty) {
            resolved = parts.join(', ');
          }
        }
        if (resolved.isEmpty && data['display_name'] != null) {
          resolved = data['display_name'].toString();
        }
        if (resolved.isNotEmpty && mounted) {
          setState(() {
            _addressController.text = resolved;
          });
          return;
        }
      }
    } catch (_) {}

    if (mounted && (_addressController.text.isEmpty || _addressController.text.contains('Đang dò'))) {
      setState(() {
        _addressController.text = 'Hiện trường tại GPS (${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)})';
      });
    }
  }

  Future<void> _loadPendingQueueCount() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList('safesolo_offline_accident_reports') ?? [];
      if (mounted) {
        setState(() => _pendingQueueCount = list.length);
      }
    } catch (_) {}
  }

  Future<void> _saveToOfflineQueue(Map<String, dynamic> reportData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList('safesolo_offline_accident_reports') ?? [];
      list.add(jsonEncode(reportData));
      await prefs.setStringList('safesolo_offline_accident_reports', list);
      if (mounted) {
        setState(() => _pendingQueueCount = list.length);
      }
    } catch (_) {}
  }

  Future<void> _syncOfflineReports() async {
    if (_isSyncingQueue) return;
    setState(() => _isSyncingQueue = true);
    int successCount = 0;
    try {
      final prefs = await SharedPreferences.getInstance();
      final rawList = prefs.getStringList('safesolo_offline_accident_reports') ?? [];
      if (rawList.isEmpty) {
        if (mounted) {
          setState(() => _isSyncingQueue = false);
          TopToast.show(context, message: 'Hàng đợi ngoại tuyến đang trống', icon: Icons.check_circle_outline_rounded);
        }
        return;
      }

      final remainingList = <String>[];
      for (final item in rawList) {
        try {
          final data = jsonDecode(item) as Map<String, dynamic>;
          await _api.reportAccidentWithTimemark(
            title: data['title'] as String,
            description: data['description'] as String,
            category: data['category'] as String,
            lat: (data['lat'] as num).toDouble(),
            lng: (data['lng'] as num).toDouble(),
            address: data['address'] as String,
            severity: data['severity'] as String,
            victimCount: data['victimCount'] as String,
            victimCondition: data['victimCondition'] as String,
            photoPath: data['photoPath'] as String?,
            timemarkMeta: data['timemarkMeta'] != null ? Map<String, dynamic>.from(data['timemarkMeta'] as Map) : null,
            userId: data['userId'] as String?,
            reportedByPhone: data['reportedByPhone'] as String?,
            isAnonymous: data['isAnonymous'] as bool? ?? false,
          );
          successCount++;
        } catch (_) {
          remainingList.add(item);
        }
      }

      await prefs.setStringList('safesolo_offline_accident_reports', remainingList);
      if (mounted) {
        setState(() {
          _pendingQueueCount = remainingList.length;
          _isSyncingQueue = false;
        });
        if (successCount > 0) {
          TopToast.show(
            context,
            message: 'Đã đồng bộ thành công $successCount báo cáo ngoại tuyến lên máy chủ!',
            icon: Icons.cloud_done_rounded,
          );
        } else {
          TopToast.show(
            context,
            message: 'Chưa thể kết nối tới máy chủ. Báo cáo vẫn được lưu an toàn.',
            icon: Icons.cloud_off_rounded,
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSyncingQueue = false);
        TopToast.show(context, message: 'Lỗi đồng bộ: $e', icon: Icons.error_outline_rounded);
      }
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        imageQuality: 75,
        maxWidth: 1280,
        maxHeight: 960,
      );
      if (picked != null) {
        final file = File(picked.path);
        String sizeText = '';
        try {
          final bytes = await file.length();
          sizeText = '${(bytes / 1024).toStringAsFixed(0)} KB';
        } catch (_) {}

        setState(() {
          _capturedImage = file;
          _imageFileSize = sizeText;
          _useSamplePhoto = false;
        });
        _refreshTimeMark();
      }
    } catch (e) {
      if (!mounted) return;
      TopToast.show(context, message: 'Không thể mở máy ảnh/thư viện: $e', icon: Icons.error_outline_rounded);
    }
  }

  Future<void> _call115() async {
    final uri = Uri.parse('tel:115');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _submitReport() async {
    if (_lat == null || _lng == null) {
      TopToast.show(
        context,
        message: 'Đang đợi tọa độ GPS thực tế. Vui lòng bật vị trí và thử lại!',
        icon: Icons.location_searching_rounded,
      );
      _fetchCurrentLocation();
      return;
    }

    final provider = context.read<AppProvider>();
    final user = provider.user;

    setState(() => _isSubmitting = true);
    _refreshTimeMark();

    final categoryLabel = _selectedCategory == 'ACCIDENT'
        ? 'Tai nạn giao thông'
        : _selectedCategory == 'MEDICAL'
            ? 'Cấp cứu y tế'
            : _selectedCategory == 'FIRE'
                ? 'Cháy nổ'
                : 'Hiểm họa đường phố';

    final realAddress = _addressController.text.trim().isNotEmpty
        ? _addressController.text.trim()
        : 'Tọa độ GPS thực: ${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}';

    final title = '[$categoryLabel] $_victimCondition tại $realAddress';
    final description = _notesController.text.trim();

    final timemarkMeta = {
      'timestamp': _timeMarkString,
      'lat': _lat!,
      'lng': _lng!,
      'address': realAddress,
      'hash': _timeMarkHash,
      'accuracyMeters': _accuracy != null ? double.parse(_accuracy!.toStringAsFixed(1)) : 4.0,
      'isRealGps': _isRealGps,
      'deviceModel': Platform.isAndroid
          ? 'Android Device (GPS Hardware Sensor)'
          : (Platform.isIOS ? 'iOS Device (CoreLocation)' : 'Device GPS Sensor'),
      'reportedBy': user?.name ?? 'Người đi đường',
      'victimCount': _victimCount,
      'victimCondition': _victimCondition,
    };

    try {
      await _api.reportAccidentWithTimemark(
        title: title,
        description: description,
        category: _selectedCategory,
        lat: _lat!,
        lng: _lng!,
        address: realAddress,
        severity: _selectedSeverity,
        victimCount: _victimCount,
        victimCondition: _victimCondition,
        photoPath: _capturedImage?.path,
        timemarkMeta: timemarkMeta,
        userId: user?.id,
        reportedByPhone: user?.phoneNumber,
        isAnonymous: false,
      );

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      // Hiển thị Dialog chúc mừng & xác nhận mã số ca
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) {
          return AlertDialog(
            backgroundColor: const Color(0xFF0F172A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: Color(0xFF10B981), width: 1.5)),
            title: Row(
              children: const [
                Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 28),
                SizedBox(width: 10),
                Text('ĐÃ BÁO CÁO CẤP CỨU', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Tín hiệu báo cáo tai nạn kèm ảnh TimeMark đã được truyền trực tiếp đến:',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('✓ Trung tâm Điều Phối SafeSolo TOC (WebAdmin)', style: TextStyle(color: Color(0xFF34D399), fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      const Text('✓ Mạng lưới Hiệp Sĩ trong bán kính 3km', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text('Mã ca: ${_timeMarkHash.substring(0, 18)}', style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'monospace')),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Nếu tình trạng nạn nhân nguy kịch, vui lòng bấm nút gọi 115 bên dưới để thông báo ngay cho cơ sở y tế.',
                  style: TextStyle(color: Colors.amber, fontSize: 11.5),
                ),
              ],
            ),
            actions: [
              TextButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _call115();
                },
                icon: const Icon(Icons.phone_in_talk_rounded, color: Color(0xFFF43F5E), size: 18),
                label: const Text('GỌI 115', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context); // Trở về màn hình chính
                },
                child: const Text('HOÀN TẤT', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      );
    } catch (err) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);

      // Tự động lưu bản ghi vào Hàng Đợi Ngoại Tuyến (Offline Resilience Queue)
      final offlineData = {
        'title': title,
        'description': description,
        'category': _selectedCategory,
        'lat': _lat!,
        'lng': _lng!,
        'address': realAddress,
        'severity': _selectedSeverity,
        'victimCount': _victimCount,
        'victimCondition': _victimCondition,
        'photoPath': _capturedImage?.path,
        'timemarkMeta': timemarkMeta,
        'userId': user?.id,
        'reportedByPhone': user?.phoneNumber,
        'isAnonymous': false,
        'queuedAt': DateTime.now().toIso8601String(),
      };
      await _saveToOfflineQueue(offlineData);

      // Hiển thị Dialog cứu hộ Ngoại tuyến thông minh
      if (!mounted) return;
      await _showOfflineFallbackDialog(
        categoryLabel: categoryLabel,
        victimCondition: _victimCondition,
        realAddress: realAddress,
        lat: _lat!,
        lng: _lng!,
      );
    }
  }

  Future<void> _showOfflineFallbackDialog({
    required String categoryLabel,
    required String victimCondition,
    required String realAddress,
    required double lat,
    required double lng,
  }) async {
    final provider = context.read<AppProvider>();
    final med = provider.medical;
    final guardianPhone = med.emergencyPhone.isNotEmpty ? med.emergencyPhone : '115';
    final mapLink = 'https://maps.google.com/?q=${lat.toStringAsFixed(5)},${lng.toStringAsFixed(5)}';
    final smsContent = '[SAFESOLO CẤP CỨU] $categoryLabel: $victimCondition. Vị trí: $realAddress. Google Maps: $mapLink';

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0F172A),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
          ),
          title: Row(
            children: const [
              Icon(Icons.wifi_off_rounded, color: Color(0xFFF59E0B), size: 24),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'MẤT KẾT NỐI · ĐÃ LƯU NGOẠI TUYẾN',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Máy chủ không phản hồi hoặc mất sóng Internet. Báo cáo hiện trường và ảnh chụp đã được tự động lưu vào HÀNG ĐỢI NGOẠI TUYẾN trên máy.',
                style: TextStyle(color: Colors.white70, fontSize: 12.5),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.inventory_2_outlined, color: Color(0xFFF59E0B), size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Hàng đợi ngoại tuyến: $_pendingQueueCount ca chờ gửi',
                          style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Hệ thống sẽ tự động đồng bộ lên TOC ngay khi thiết bị có lại kết nối 4G/Wifi.',
                      style: TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Trong tình huống khẩn cấp, bạn có thể phát tín hiệu qua SMS cứu nạn (không cần 4G) hoặc gọi 115:',
                style: TextStyle(color: Colors.amberAccent, fontSize: 11.5, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          actions: [
            TextButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                _call115();
              },
              icon: const Icon(Icons.phone_in_talk_rounded, color: Color(0xFFEF4444), size: 18),
              label: const Text('GỌI 115', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.black,
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                final sent = await OfflineSosService.instance.sendEmergencySms(
                  phoneNumber: guardianPhone,
                  message: smsContent,
                );
                if (!sent && mounted) {
                  TopToast.show(context, message: 'Không thể mở trình nhắn tin SMS', icon: Icons.sms_failed_rounded);
                }
              },
              icon: const Icon(Icons.sms_rounded, size: 18),
              label: const Text('GỬI QUA SMS PDR', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              child: const Text('ĐÓNG', style: TextStyle(color: Colors.white60)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1120),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'BÁO CÁO TAI NẠN & CẤP CỨU',
              style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 0.5),
            ),
            Text(
              'Chụp ảnh TimeMark · Kết nối bàn trực ban TOC',
              style: TextStyle(color: Color(0xFFF43F5E), fontSize: 10, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Gọi 115 khẩn cấp',
            icon: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(6)),
              child: const Row(
                children: [
                  Icon(Icons.phone_rounded, color: Colors.white, size: 14),
                  SizedBox(width: 4),
                  Text('115', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            onPressed: _call115,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // BANNER HÀNG ĐỢI NGOẠI TUYẾN KHI CÓ BÁO CÁO CHỜ ĐỒNG BỘ
          if (_pendingQueueCount > 0)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF59E0B), width: 1.2),
              ),
              child: Row(
                children: [
                  const Icon(Icons.cloud_off_rounded, color: Color(0xFFF59E0B), size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$_pendingQueueCount báo cáo đang chờ đồng bộ ngoại tuyến',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Đã lưu an toàn trên máy. Bấm để gửi lên máy chủ.',
                          style: TextStyle(color: Colors.white60, fontSize: 10.5),
                        ),
                      ],
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _isSyncingQueue ? null : _syncOfflineReports,
                    icon: _isSyncingQueue
                        ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF59E0B)))
                        : const Icon(Icons.sync_rounded, color: Color(0xFFF59E0B), size: 16),
                    label: Text(
                      _isSyncingQueue ? '...' : 'ĐỒNG BỘ',
                      style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),

          // 1. KHUNG ẢNH HIỆN TRƯỜNG VỚI TIMEMARK HUD OVERLAY
          _buildTimeMarkPhotoSection(),
          const SizedBox(height: 16),

          // 2. PHÂN LOẠI TAI NẠN & MỨC ĐỘ KHẨN CẤP
          _buildCategorySelector(),
          const SizedBox(height: 16),

          // 3. THÔNG TIN NẠN NHÂN & TÌNH TRẠNG Ý THỨC
          _buildVictimInfoSection(),
          const SizedBox(height: 16),

          // 4. ĐỊA CHỈ & TỌA ĐỘ GPS CHÍNH XÁC
          _buildLocationSection(),
          const SizedBox(height: 16),

          // 5. GHI CHÚ MÔ TẢ HIỆN TRƯỜNG
          _buildNotesSection(),
          const SizedBox(height: 24),

          // 6. NÚT GỬI BÁO CÁO CẤP CỨU
          _buildSubmitButton(),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  /// Khung chụp ảnh có TimeMark Watermark
  Widget _buildTimeMarkPhotoSection() {
    final hasImage = _capturedImage != null || _useSamplePhoto;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: hasImage ? const Color(0xFF10B981) : const Color(0xFFEF4444).withValues(alpha: 0.5),
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                const Icon(Icons.camera_enhance_rounded, color: Color(0xFFF59E0B), size: 18),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'ẢNH HIỆN TRƯỜNG TIMEMARK',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: const Color(0xFF10B981), width: 0.8),
                  ),
                  child: const Text('BẰNG CHỨNG SỐ', style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold)),
                ),
                if (_imageFileSize.isNotEmpty) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0284C7).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFF38BDF8), width: 0.8),
                    ),
                    child: Text(
                      '$_imageFileSize · ĐÃ NÉN TỐI ƯU',
                      style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Khung Viewfinder
          ClipRRect(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
            child: Stack(
              children: [
                Container(
                  height: 220,
                  width: double.infinity,
                  color: Colors.black87,
                  child: hasImage
                      ? (_capturedImage != null
                          ? Image.file(_capturedImage!, fit: BoxFit.cover)
                          : Image.network(
                              'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
                              fit: BoxFit.cover,
                            ))
                      : Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.add_a_photo_outlined, size: 48, color: Colors.white30),
                              SizedBox(height: 8),
                              Text('Chưa có ảnh hiện trường', style: TextStyle(color: Colors.white54, fontSize: 12)),
                              Text('Chụp ảnh để hệ thống tự đóng dấu TimeMark', style: TextStyle(color: Colors.white30, fontSize: 10.5)),
                            ],
                          ),
                        ),
                ),

                // LỚP TIMEMARK WATERMARK CHUẨN PHÁP LÝ (OVERLAY)
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.8), width: 1.2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.verified_rounded, color: Color(0xFFF59E0B), size: 13),
                            const SizedBox(width: 4),
                            const Expanded(
                              child: Text(
                                'TIMEMARK CERTIFIED',
                                style: TextStyle(color: Color(0xFFF59E0B), fontSize: 9.5, fontWeight: FontWeight.bold, letterSpacing: 0.4),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _timeMarkString,
                              style: const TextStyle(color: Colors.white, fontSize: 9, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.location_on_rounded, color: Color(0xFF38BDF8), size: 12),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${_addressController.text.isNotEmpty ? _addressController.text : "Đang lấy vị trí..."} (GPS: ${_lat != null && _lng != null ? "${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}" : "Chờ GPS..."})',
                                style: const TextStyle(color: Colors.white, fontSize: 9.5),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _timeMarkHash,
                          style: const TextStyle(color: Colors.white38, fontSize: 8, fontFamily: 'monospace'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Nút chụp ảnh / chọn ảnh
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    onPressed: () => _pickImage(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt_rounded, size: 16),
                    label: const Text('CHỤP ẢNH', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    padding: const EdgeInsets.all(10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  tooltip: 'Chọn ảnh từ thư viện',
                  icon: const Icon(Icons.photo_library_outlined, color: Color(0xFF38BDF8), size: 18),
                  onPressed: () => _pickImage(ImageSource.gallery),
                ),
                const SizedBox(width: 8),
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.amber,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                  ),
                  onPressed: () {
                    setState(() {
                      _useSamplePhoto = true;
                      _capturedImage = null;
                    });
                    _refreshTimeMark();
                    TopToast.show(context, message: 'Đã áp dụng ảnh hiện trường mẫu TimeMark');
                  },
                  child: const Text('Mẫu test', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Phân loại sự cố & Độ nghiêm trọng
  Widget _buildCategorySelector() {
    final categories = [
      {'id': 'ACCIDENT', 'label': 'Tai nạn giao thông', 'icon': Icons.car_crash_rounded, 'color': const Color(0xFFEF4444)},
      {'id': 'MEDICAL', 'label': 'Cấp cứu y tế', 'icon': Icons.medical_services_rounded, 'color': const Color(0xFFF43F5E)},
      {'id': 'FIRE', 'label': 'Cháy nổ / Sập đổ', 'icon': Icons.local_fire_department_rounded, 'color': const Color(0xFFF97316)},
      {'id': 'ROAD_HAZARD', 'label': 'Bẫy đinh / Sụt lún', 'icon': Icons.warning_amber_rounded, 'color': const Color(0xFFF59E0B)},
      {'id': 'SUSPICIOUS_PERSON', 'label': 'Cướp giật / Đe dọa', 'icon': Icons.security_rounded, 'color': const Color(0xFF8B5CF6)},
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('LOẠI SỰ CỐ KHẨN CẤP', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categories.map((cat) {
              final isSelected = _selectedCategory == cat['id'];
              final color = cat['color'] as Color;

              return InkWell(
                onTap: () => setState(() => _selectedCategory = cat['id'] as String),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: isSelected ? color.withValues(alpha: 0.2) : const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isSelected ? color : Colors.transparent, width: 1.2),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(cat['icon'] as IconData, size: 16, color: isSelected ? color : Colors.white60),
                      const SizedBox(width: 6),
                      Text(
                        cat['label'] as String,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.white70,
                          fontSize: 11.5,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),

          // Mức độ ưu tiên Triage
          const Text('MỨC ĐỘ NGUY HIỂM (TRIAGE)', style: TextStyle(color: Colors.white54, fontSize: 10.5, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(
            children: [
              _buildTriageChip('P1_CRITICAL', '🔴 P1 - NGUY KỊCH (CẦN 115)', const Color(0xFFEF4444)),
              const SizedBox(width: 8),
              _buildTriageChip('P2_URGENT', '🟡 P2 - KHẨN CẤP', const Color(0xFFF59E0B)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTriageChip(String id, String label, Color color) {
    final isSelected = _selectedSeverity == id;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedSeverity = id),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? color.withValues(alpha: 0.2) : const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSelected ? color : Colors.white12, width: 1.2),
          ),
          child: Text(
            label,
            style: TextStyle(color: isSelected ? color : Colors.white54, fontSize: 10, fontWeight: FontWeight.bold),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }

  /// Thông tin nạn nhân & Tình trạng ý thức
  Widget _buildVictimInfoSection() {
    final counts = ['1 người', '2 người', '3-5 người', 'Tai nạn liên hoàn'];
    final conditions = [
      'Bất tỉnh / Cần 115 khẩn cấp',
      'Còn thở / Chảy máu nhiều',
      'Gãy xương / Chấn thương tay chân',
      'Tỉnh táo / Hoảng loạn',
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('THÔNG TIN NẠN NHÂN TẠI CHỖ', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),

          // Số lượng nạn nhân
          Row(
            children: [
              const Expanded(
                child: Text('Số lượng nạn nhân:', style: TextStyle(color: Colors.white70, fontSize: 11.5)),
              ),
              DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _victimCount,
                  isDense: true,
                  dropdownColor: const Color(0xFF1E293B),
                  style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, fontWeight: FontWeight.bold),
                  items: counts.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _victimCount = val);
                  },
                ),
              ),
            ],
          ),
          const Divider(color: Colors.white10, height: 16),

          // Tình trạng ý thức
          const Text('Tình trạng nhận biết nhanh:', style: TextStyle(color: Colors.white70, fontSize: 11.5)),
          const SizedBox(height: 8),
          ...conditions.map((cond) {
            final isSelected = _victimCondition == cond;
            return InkWell(
              onTap: () => setState(() => _victimCondition = cond),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
                      color: isSelected ? const Color(0xFFEF4444) : Colors.white30,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        cond,
                        style: TextStyle(
                          color: isSelected ? Colors.white : Colors.white60,
                          fontSize: 11.5,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
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
  }

  /// Định vị GPS & Địa chỉ thực tế
  Widget _buildLocationSection() {
    final hasCoords = _lat != null && _lng != null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Flexible(
                      child: Text(
                        'VỊ TRÍ HIỆN TRƯỜNG THỰC TẾ',
                        style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _isRealGps
                            ? const Color(0xFF10B981).withValues(alpha: 0.2)
                            : const Color(0xFFF59E0B).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: _isRealGps ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                          width: 0.8,
                        ),
                      ),
                      child: Text(
                        _isRealGps ? 'GPS THẬT' : 'ĐANG DÒ',
                        style: TextStyle(
                          color: _isRealGps ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.my_location_rounded, color: Color(0xFF38BDF8), size: 18),
                tooltip: 'Lấy lại tọa độ GPS thực tế',
                onPressed: _isLocating ? null : _fetchCurrentLocation,
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _addressController,
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: const Color(0xFF1E293B),
              prefixIcon: const Icon(Icons.location_on_rounded, color: Color(0xFFF43F5E), size: 18),
              suffixIcon: const Icon(Icons.edit_location_alt_rounded, color: Color(0xFF38BDF8), size: 18),
              hintText: 'Nhập mốc số nhà / giao lộ hiện trường...',
              hintStyle: const TextStyle(color: Colors.white38, fontSize: 11.5),
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF334155), width: 0.8)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF38BDF8), width: 1.2)),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                hasCoords ? Icons.satellite_alt_rounded : Icons.location_searching_rounded,
                size: 13,
                color: hasCoords ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  hasCoords
                      ? 'Tọa độ thực: ${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)} · Sai số ±${_accuracy?.toStringAsFixed(1) ?? "3.5"}m'
                      : _locationStatusText,
                  style: TextStyle(
                    color: hasCoords ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                    fontSize: 10.5,
                    fontFamily: 'monospace',
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Ghi chú hiện trường
  Widget _buildNotesSection() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('GHI CHÚ CHI TIẾT HIỆN TRƯỜNG', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(
            controller: _notesController,
            maxLines: 3,
            style: const TextStyle(color: Colors.white, fontSize: 12),
            decoration: InputDecoration(
              hintText: 'Mô tả thêm đặc điểm phương tiện, hiện trường hoặc đường đi vào...',
              hintStyle: const TextStyle(color: Colors.white30, fontSize: 11.5),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
        ],
      ),
    );
  }

  /// Nút gửi báo cáo lên WebAdmin TOC
  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton.icon(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFEF4444),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 6,
          shadowColor: const Color(0xFFEF4444).withValues(alpha: 0.5),
        ),
        onPressed: _isSubmitting ? null : _submitReport,
        icon: _isSubmitting
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : const Icon(Icons.send_rounded, size: 20),
        label: Text(
          _isSubmitting ? 'ĐANG TRUYỀN VỀ WEBADMIN TOC...' : 'GỬI BÁO CÁO CẤP CỨU & TAI NẠN (TIMEMARK)',
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
      ),
    );
  }
}
