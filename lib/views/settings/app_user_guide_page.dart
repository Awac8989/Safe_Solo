import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_strings.dart';
import '../../core/app_theme.dart';
import '../../core/widgets/top_toast.dart';

class GuideItem {
  const GuideItem({
    required this.id,
    required this.category,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    required this.steps,
    this.tip,
    this.actionRoute,
    this.actionLabel,
  });

  final String id;
  final String category; // 'checkin', 'circle', 'sos', 'stealth', 'firstaid', 'faq'
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final List<String> steps;
  final String? tip;
  final String? actionRoute;
  final String? actionLabel;
}

class AppUserGuidePage extends StatefulWidget {
  const AppUserGuidePage({super.key});

  @override
  State<AppUserGuidePage> createState() => _AppUserGuidePageState();
}

class _AppUserGuidePageState extends State<AppUserGuidePage> {
  String _selectedCategory = 'all';
  String _searchQuery = '';
  final Set<String> _expandedIds = {'overview-concept', 'checkin-orb'};

  final List<GuideItem> _allGuides = const [
    // 1. TỔNG QUAN
    GuideItem(
      id: 'overview-concept',
      category: 'checkin',
      title: 'SafeSolo là gì? Cơ chế Công tắc An toàn',
      subtitle: 'Lá chắn số cá nhân hóa cho người sống độc lập & người cao tuổi',
      icon: Icons.shield_rounded,
      accentColor: AppColors.primary,
      steps: [
        'SafeSolo hoạt động theo nguyên lý "Công tắc an toàn" (Dead-man switch): Bạn chỉ cần xác nhận mình vẫn bình an định kỳ qua Quả cầu an toàn.',
        'Nếu quá thời gian chờ điểm danh mà bạn không phản hồi, hệ thống sẽ tự động kích hoạt chu trình bảo vệ đa tầng: gửi tin nhắn SMS, gọi người thân và phát tín hiệu định vị cứu hộ.',
        'Hệ sinh thái liên kết chặt chẽ: Điện thoại cá nhân, Đồng hồ thông minh trên cổ tay, Người bảo hộ thân cận và Mạng lưới Hiệp sĩ cứu trợ khu vực.',
        'Mọi dữ liệu sinh trắc, vị trí và y tế của bạn đều được mã hóa chuẩn quân đội AES-256 trực tiếp trên máy, không chia sẻ cho bên thứ ba.',
      ],
      tip: 'Hãy thiết lập ít nhất 1-2 Người bảo hộ thân cận và cấp quyền chạy ngầm không giới hạn để SafeSolo luôn sẵn sàng bảo vệ bạn.',
      actionRoute: '/network',
      actionLabel: 'Cài đặt Người bảo hộ',
    ),

    // 2. ĐIỂM DANH & QUẢ CẦU
    GuideItem(
      id: 'checkin-orb',
      category: 'checkin',
      title: 'Quả cầu An toàn & Ý nghĩa các màu sắc',
      subtitle: 'Biểu tượng trung tâm thể hiện tình trạng sinh tồn của bạn',
      icon: Icons.lens_blur_rounded,
      accentColor: Color(0xFF10B981),
      steps: [
        '🟢 Màu Xanh lá (An toàn): Bạn vừa điểm danh gần đây, trạng thái hoàn toàn ổn định và an tâm.',
        '🟡 Màu Vàng (Nhắc nhở): Thời hạn điểm danh sắp đến (còn dưới 2 giờ) hoặc có lịch uống thuốc. Hãy bấm vào quả cầu để điểm danh ngay.',
        '🔴 Màu Đỏ (Báo động SOS): Đã quá hạn điểm danh an toàn hoặc kích hoạt khẩn cấp, hệ thống đang tiến hành chu trình báo động và cứu nạn.',
        'Đồng hồ đếm ngược hiển thị chính xác thời gian còn lại trước khi chu trình nhắc nhở bắt đầu.',
      ],
      tip: 'Chạm nhẹ vào Quả cầu hoặc vuốt lên để mở bảng điểm danh nhanh, kèm chọn tâm trạng và gửi ảnh khoảnh khắc cho người thân.',
    ),

    GuideItem(
      id: 'checkin-how',
      category: 'checkin',
      title: 'Cách Điểm danh & Nút "Hoãn 30 phút"',
      subtitle: 'Thao tác chỉ mất 2 giây mỗi ngày, linh hoạt khi bận việc',
      icon: Icons.touch_app_rounded,
      accentColor: Color(0xFF10B981),
      steps: [
        '1. Bấm nút "Điểm danh ngay" hoặc chạm trực tiếp vào Quả cầu ở màn hình chính.',
        '2. Chọn trạng thái tâm trạng (Khỏe mạnh, Vui vẻ, Hơi mệt, Cần lưu ý) để người thân nắm bắt sức khỏe của bạn.',
        '3. Bạn có thể gõ thêm lời nhắn ngắn hoặc chụp một bức ảnh khoảnh khắc ấm áp gửi cho người thân.',
        '4. Nút "Hoãn 30 phút": Khi bạn đang họp quan trọng, đang lái xe trên đường hoặc bận việc đột xuất chưa tiện điểm danh, hãy bấm nút này để tạm hoãn chuông nhắc 30 phút.',
        '5. Nhắc uống thuốc: Bấm nút viên thuốc để đánh dấu đã uống thuốc đúng giờ, lưu vào nhật ký sức khỏe.',
      ],
      tip: 'Bạn có thể tùy chỉnh hạn điểm danh an toàn từ 1 đến 72 giờ trong Cài đặt tùy theo lịch trình sinh hoạt cá nhân.',
    ),

    // 3. VÒNG TRÒN ALIVE CIRCLE & HỘ TỐNG
    GuideItem(
      id: 'circle-members',
      category: 'circle',
      title: 'Vòng tròn Thân yêu (Alive Circle)',
      subtitle: 'Gắn kết gia đình, bạn bè và người sống cùng tòa nhà',
      icon: Icons.group_work_rounded,
      accentColor: Color(0xFF0284C7),
      steps: [
        '1. Thêm người thân vào Vòng tròn bằng mã mời hoặc số điện thoại danh bạ.',
        '2. Xem trạng thái trực tiếp của từng thành viên: Mức pin điện thoại, khoảng cách địa lý và thời gian hoạt động an toàn gần nhất.',
        '3. Khi một thành viên gặp nạn hoặc phát tín hiệu SOS, toàn bộ thành viên trong Vòng tròn sẽ nhận chuông báo động khẩn cấp kèm định vị GPS.',
        '4. Gửi lời quan tâm 1 chạm: Bấm gửi tim hoặc tin nhắn nhắc nhở để động viên người thân.',
      ],
      tip: 'Nên thêm từ 2 đến 3 người đáng tin cậy sống gần bạn nhất vào Vòng tròn để được hỗ trợ nhanh nhất.',
      actionRoute: '/network',
      actionLabel: 'Mở Vòng tròn Thân yêu',
    ),

    GuideItem(
      id: 'circle-journey',
      category: 'circle',
      title: 'Hộ tống Ảo theo thời gian thực (Live Journey)',
      subtitle: 'Bảo vệ khi đi làm về khuya, đi đường vắng hoặc đi xe taxi',
      icon: Icons.navigation_rounded,
      accentColor: Color(0xFF0284C7),
      steps: [
        '1. Trước khi lên xe công nghệ hoặc đi qua đoạn đường vắng, mở tab Vòng tròn và bấm "Bắt đầu Hộ tống".',
        '2. Nhập điểm đến dự kiến và thời gian di chuyển ước tính (ví dụ 25 phút).',
        '3. Người bảo hộ của bạn có thể mở bản đồ để theo dõi từng mét lộ trình di chuyển trực tiếp của bạn.',
        '4. Nếu xe dừng lại bất thường quá 5 phút ở nơi hoang vắng hoặc đi chệch khỏi tuyến đường, SafeSolo sẽ tự động gửi cảnh báo khẩn cấp đến người thân.',
        '5. Khi đã về tới nhà an toàn, bấm nút "Đã về đến nơi an toàn" để kết thúc hành trình.',
      ],
      tip: 'Chuyến đi trực tiếp có nút khẩn cấp 1 chạm để bạn gọi ngay cho người thân hoặc kích hoạt còi hú nếu tài xế có biểu hiện xấu.',
      actionRoute: '/live-journey',
      actionLabel: 'Mở Bản đồ Hộ tống',
    ),

    GuideItem(
      id: 'circle-nightlock',
      category: 'circle',
      title: 'Rào chắn Ban đêm & Khóa Không gian Ngủ',
      subtitle: 'Tự động giám sát phòng ngủ an toàn từ 23:00 đến 06:00',
      icon: Icons.bedtime_rounded,
      accentColor: Color(0xFF6366F1),
      steps: [
        '1. Trước khi đi ngủ, bật công tắc "Rào chắn ban đêm" trong màn hình Vòng tròn hoặc Cài đặt.',
        '2. Ứng dụng sẽ thiết lập một hàng rào địa lý an toàn bán kính 50 mét xung quanh vị trí nhà bạn.',
        '3. Nếu điện thoại của bạn đột ngột di chuyển ra khỏi nhà vào ban đêm (ví dụ bị trộm mang đi, hoặc người cao tuổi mộng du ra đường), chuông báo động cực đại sẽ hú lên.',
        '4. Tin nhắn khẩn cấp kèm vị trí di chuyển sẽ được gửi tức thì đến các thành viên trong gia đình.',
      ],
      tip: 'Tính năng này rất hữu ích cho phụ nữ sống một mình trong khu trọ hoặc gia đình có người lớn tuổi hay quên.',
    ),

    GuideItem(
      id: 'circle-walkie',
      category: 'circle',
      title: 'Bộ đàm PTT Tức thì (Walkie-Talkie)',
      subtitle: 'Nói chuyện trực tiếp với người thân chỉ với 1 nút bấm',
      icon: Icons.radio_rounded,
      accentColor: Color(0xFF0D9488),
      steps: [
        '1. Vào màn hình Vòng tròn thân yêu, chọn nút Bộ đàm (PTT).',
        '2. Nhấn và GIỮ nút biểu tượng Micro tròn lớn để bắt đầu nói.',
        '3. Thả tay ra để gửi tức thì. Âm thanh đàm thoại sẽ tự động phát to rõ ràng trên điện thoại người bảo hộ mà không cần họ phải bấm nút nhận cuộc gọi.',
        '4. Giúp bạn truyền tải thông điệp nhanh hơn gấp 10 lần so với việc gõ bàn phím nhắn tin.',
      ],
      tip: 'Rất hữu ích khi bạn đang nấu ăn bận tay, đang cảm thấy bất an hoặc cần hỗ trợ nhanh từ phòng bên cạnh.',
    ),

    // 4. SOS KHẨN CẤP & BÀN TÁC CHIẾN
    GuideItem(
      id: 'sos-trigger',
      category: 'sos',
      title: '3 Cách Kích hoạt SOS & Còi Hú Cứu Nạn',
      subtitle: 'Cấp cứu tức thì khi bị tấn công, cướp giật, hỏa hoạn hoặc đột quỵ',
      icon: Icons.sos_rounded,
      accentColor: Color(0xFFEF4444),
      steps: [
        'Cách 1 (Màn hình chính): Nhấn và GIỮ nút SOS màu đỏ ở chính giữa thanh điều hướng trong 3 giây.',
        'Cách 2 (Lắc điện thoại): Lắc mạnh điện thoại 3 lần liên tiếp (nếu đã bật Cảm biến lắc SOS trong Cài đặt).',
        'Cách 3 (Phát hiện té ngã): Tự động kích hoạt khi cảm biến gia tốc trên máy hoặc đồng hồ Galaxy Watch phát hiện cú rơi ngã mạnh kèm bất động.',
        'Quy trình cứu nạn: Màn hình đếm ngược 5 giây kèm rung mạnh (bạn có thể bấm HỦY nếu vô tình chạm nhầm).',
        'Hết 5 giây: Còi hú cứu hộ 115dB âm lượng tối đa sẽ phát ra xua đuổi kẻ gian; SMS và thông báo đẩy kèm tọa độ GPS chính xác được gửi ngay tới Người bảo hộ và mạng lưới Hiệp sĩ gần nhất.',
      ],
      tip: 'Ngay cả khi điện thoại không có kết nối 4G hay Wifi, SafeSolo vẫn tự động chuyển sang gửi tin nhắn SMS cứu hộ ngoại tuyến.',
    ),

    GuideItem(
      id: 'sos-hero',
      category: 'sos',
      title: 'Bàn Tác Chiến Hiệp Sĩ & Báo Cáo Sự Cố',
      subtitle: 'Mạng lưới tương trợ cứu hộ cộng đồng trong bán kính 2-5km',
      icon: Icons.volunteer_activism_rounded,
      accentColor: Color(0xFFEA580C),
      steps: [
        '1. Bất kỳ ai cũng có thể bật chế độ "Hiệp sĩ sẵn sàng" để tương trợ những người xung quanh khi họ gặp nạn.',
        '2. Khi có nạn nhân phát SOS trong khu vực, Bàn tác chiến Hiệp sĩ sẽ reo chuông và hiển thị vị trí, mức độ khẩn cấp.',
        '3. Hiệp sĩ bấm "Nhận ứng cứu" để mở bản đồ định vị chỉ đường nhanh nhất tới hiện trường giải cứu.',
        '4. Báo cáo sự cố cộng đồng: Khi gặp điểm ngập nước sâu, công trường nguy hiểm, kẻ khả nghi hay tai nạn giao thông, bạn có thể gửi báo cáo kèm ảnh để cảnh báo mọi người xung quanh tránh xa.',
      ],
      tip: 'Mỗi lần tham gia ứng cứu hoặc đóng góp cảnh báo chính xác, bạn sẽ tích lũy Điểm nghĩa hiệp và nhận Huy hiệu vinh danh.',
      actionRoute: '/hero-workspace',
      actionLabel: 'Mở Bàn tác chiến Hiệp sĩ',
    ),

    // 5. THOÁT HIỂM & BẢO MẬT
    GuideItem(
      id: 'stealth-fakecall',
      category: 'stealth',
      title: 'Cuộc gọi Thoát hiểm Giả lập (Fake Call)',
      subtitle: 'Cớ hoàn hảo để rời khỏi cuộc hẹn khó chịu hoặc tình huống quấy rối',
      icon: Icons.phone_in_talk_rounded,
      accentColor: Color(0xFF8B5CF6),
      steps: [
        '1. Mở tính năng Cuộc gọi thoát hiểm từ menu hoặc lối tắt nhanh.',
        '2. Chọn thời gian chuông reo: Sau 10 giây, 30 giây, 1 phút hoặc Đổ chuông ngay lập tức.',
        '3. Chọn danh tính người gọi đến: "Sếp gọi họp gấp", "Mẹ yêu", "Bạn cùng phòng", hoặc tự đặt tên tùy ý.',
        '4. Điện thoại sẽ rung và phát nhạc chuông đến y hệt một cuộc gọi thật từ hệ điều hành.',
        '5. Khi bạn bấm nghe máy, giọng nói thoại mẫu sẽ phát ra ở loa tai nghe để bạn đối đáp tự nhiên và xin phép ra về một cách lịch sự, không làm phật lòng ai.',
      ],
      tip: 'Bạn có thể bấm nút âm lượng để kích hoạt đếm ngược cuộc gọi giả bí mật trong túi áo mà không cần mở sáng màn hình.',
      actionRoute: '/fake-call',
      actionLabel: 'Thử Cuộc gọi Thoát hiểm',
    ),

    GuideItem(
      id: 'stealth-pins',
      category: 'stealth',
      title: 'Mã PIN Chống Cưỡng Ép & Ngụy Trang Máy Tính',
      subtitle: 'Bảo vệ tính mạng và bí mật khi bị kẻ xấu ép mở khóa',
      icon: Icons.lock_outline_rounded,
      accentColor: Color(0xFF64748B),
      steps: [
        '1. Bạn có thể thiết lập 2 mã PIN riêng biệt: PIN Thật và PIN Cưỡng ép (PIN giả).',
        '2. Nhập PIN Thật: Ứng dụng mở ra Két sắt sinh tử với đầy đủ thông tin y tế, tài liệu bảo mật cá nhân.',
        '3. Nhập PIN Cưỡng ép: Dùng khi bị kẻ gian đe dọa ép mở khóa máy. Ứng dụng sẽ mở ra giao diện giả mạo trống trơn, vô hại.',
        '4. Đồng thời, hệ thống âm thầm kích hoạt tín hiệu cầu cứu im lặng và gửi định vị GPS đến người thân mà kẻ gian hoàn toàn không hay biết.',
        '5. Chế độ Ngụy trang máy tính bỏ túi (Calculator Stealth): Đổi biểu tượng và giao diện app thành máy tính Casio. Phải gõ đúng mã số bí mật mới vào được SafeSolo.',
      ],
      tip: 'Thiết lập mã PIN thật và PIN giả trong mục Cài đặt -> Bảo mật nâng cao.',
      actionRoute: '/security',
      actionLabel: 'Cài đặt Mã PIN Bảo mật',
    ),

    // 6. SƠ CỨU & SỨC KHỎE
    GuideItem(
      id: 'firstaid-cpr',
      category: 'firstaid',
      title: 'Trợ lý Sơ cứu Khẩn cấp & Ép tim CPR',
      subtitle: 'Máy đánh nhịp Metronome chuẩn 100-120 BPM của Hội Tim mạch',
      icon: Icons.healing_rounded,
      accentColor: Color(0xFFDC2626),
      steps: [
        '1. Khi phát hiện người ngưng tim hoặc bất tỉnh: Gọi ngay 115 trước tiên.',
        '2. Mở tính năng Ép tim CPR: Bật máy đánh nhịp âm thanh Metronome tích tắc chuẩn 100-120 lần/phút.',
        '3. Đặt gót bàn tay vào chính giữa xương ức ngực nạn nhân, đan hai tay vào nhau, giữ thẳng khuỷu tay.',
        '4. Nhấn sâu 5-6 cm theo từng tiếng gõ nhịp tích tắc, không để tay rời khỏi lồng ngực.',
        '5. Tỷ lệ chuẩn: 30 lần ép tim lồng ngực kết hợp 2 lần thổi ngạt cứu sinh.',
      ],
      tip: 'Bấm nút "Cẩm nang sơ cứu" để xem đầy đủ hướng dẫn xử lý Đột quỵ FAST, hóc dị vật Heimlich và cầm máu vết thương.',
      actionRoute: '/first-aid',
      actionLabel: 'Mở Cẩm nang Sơ cứu',
    ),

    GuideItem(
      id: 'firstaid-breathe',
      category: 'firstaid',
      title: 'Bài tập Hít thở 4-7-8 Giảm Hoảng Loạn',
      subtitle: 'Ổn định nhịp tim và huyết áp tức thì khi lo âu hoặc sợ hãi',
      icon: Icons.air_rounded,
      accentColor: Color(0xFF059669),
      steps: [
        '1. Ngồi thẳng lưng, thả lỏng hai vai và đặt một tay lên ngực, một tay lên bụng.',
        '2. HÍT VÀO từ từ bằng mũi trong 4 giây, cảm nhận lồng ngực mở rộng.',
        '3. NÍN THỞ và giữ hơi trong 7 giây để oxy thẩm thấu sâu vào tế bào não.',
        '4. THỞ RA chậm rãi qua miệng trong 8 giây với tiếng thở nhẹ đều.',
        '5. Lặp lại 4 chu kỳ liên tục: Nhịp tim sẽ đập chậm lại, cơn hoảng loạn và run rẩy sẽ hoàn toàn biến mất.',
      ],
      tip: 'Rất hữu ích khi bạn nghe thấy tiếng động lạ ban đêm, trước bài thuyết trình quan trọng hoặc khi khó ngủ.',
    ),

    GuideItem(
      id: 'firstaid-smartwatch',
      category: 'firstaid',
      title: 'Đồng hồ Thông minh Wear OS & Đo Sức khỏe',
      subtitle: 'Bảo vệ toàn diện 24/7 ngay trên cổ tay của bạn',
      icon: Icons.watch_rounded,
      accentColor: Color(0xFF4F46E5),
      steps: [
        '1. Kết nối đồng hồ thông minh (Galaxy Watch 4/5/6, Pixel Watch) qua Bluetooth trong mục Cài đặt.',
        '2. Điểm danh 1 chạm ngay trên cổ tay mà không cần lấy điện thoại ra khỏi túi.',
        '3. Tự động đo nhịp tim liên tục, nồng độ oxy trong máu SpO2 và đếm bước chân mỗi ngày.',
        '4. Tự động phát hiện va chạm ngã quỵ: Nếu bạn bị ngã trong nhà tắm hoặc phòng ngủ, đồng hồ sẽ tự rung cảnh báo đếm ngược và phát SOS cứu hộ.',
      ],
      tip: 'Giao diện đồng hồ được thiết kế nền đen tối ưu, tiết kiệm pin tối đa cho cả ngày dài hoạt động.',
      actionRoute: '/smartwatch',
      actionLabel: 'Cài đặt Thiết bị Đeo',
    ),

    // 7. HỎI ĐÁP & HOTLINE
    GuideItem(
      id: 'faq-tips',
      category: 'faq',
      title: 'Hỏi đáp Thường gặp (FAQ)',
      subtitle: 'Các thắc mắc phổ biến về pin, định vị và quyền chạy ngầm',
      icon: Icons.help_outline_rounded,
      accentColor: Color(0xFFD97706),
      steps: [
        'Hỏi: Ứng dụng chạy ngầm 24/7 có làm nhanh hết pin điện thoại không?\nĐáp: Không! SafeSolo sử dụng cơ chế lắng nghe cảm biến tiết kiệm năng lượng, trung bình chỉ tiêu hao từ 1.5% đến 2.5% pin cho cả ngày hoạt động.',
        'Hỏi: Tại sao tôi cần tắt "Tối ưu hóa pin" cho SafeSolo?\nĐáp: Một số dòng máy Android có cơ chế tự động tắt các ứng dụng ngầm sau vài giờ không mở. Tắt tối ưu pin giúp SafeSolo luôn sẵn sàng nhận tín hiệu SOS và đếm giờ điểm danh chuẩn xác.',
        'Hỏi: Nếu tôi ngủ quên quá giờ điểm danh thì sao?\nĐáp: Trước khi phát cảnh báo cho người thân, SafeSolo sẽ phát chuông nhắc nhở nhẹ nhàng trước 15 phút để đánh thức bạn xác nhận an toàn.',
        'Hỏi: Tôi có cần kết nối Internet để gọi SOS không?\nĐáp: Không! Ngay cả khi mất sóng 4G/Wifi, hệ thống vẫn gửi SMS cứu hộ và phát còi báo động âm học 115dB bình thường.',
      ],
      tip: 'Nếu gặp bất kỳ vấn đề gì, bạn có thể vào Cài đặt -> Tối ưu pin nền 24/7 để kiểm tra quyền chạy ngầm.',
    ),
  ];

  List<GuideItem> get _filteredGuides {
    return _allGuides.where((guide) {
      final matchesCategory = _selectedCategory == 'all' || guide.category == _selectedCategory;
      if (!matchesCategory) return false;

      if (_searchQuery.trim().isEmpty) return true;

      final q = _searchQuery.toLowerCase();
      final titleMatch = guide.title.toLowerCase().contains(q);
      final subtitleMatch = guide.subtitle.toLowerCase().contains(q);
      final stepsMatch = guide.steps.any((s) => s.toLowerCase().contains(q));
      final tipMatch = guide.tip?.toLowerCase().contains(q) ?? false;

      return titleMatch || subtitleMatch || stepsMatch || tipMatch;
    }).toList();
  }

  void _toggleExpand(String id) {
    setState(() {
      if (_expandedIds.contains(id)) {
        _expandedIds.remove(id);
      } else {
        _expandedIds.add(id);
      }
    });
  }

  Future<void> _makeCall(String phoneNumber) async {
    final uri = Uri.parse('tel:$phoneNumber');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        if (mounted) {
          TopToast.show(context, message: 'Không thể mở trình quay số gọi $phoneNumber', icon: Icons.error_outline_rounded);
        }
      }
    } catch (_) {
      if (mounted) {
        TopToast.show(context, message: 'Không thể thực hiện cuộc gọi $phoneNumber', icon: Icons.phone_disabled_rounded);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          strings.text('Hướng dẫn sử dụng SafeSolo', 'SafeSolo User Guide'),
          style: AppTextStyles.h3.copyWith(fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        children: [
          // Banner Giới thiệu
          _buildHeroBanner(strings),
          const SizedBox(height: 16),

          // Thanh tìm kiếm
          _buildSearchBar(strings),
          const SizedBox(height: 14),

          // Bộ lọc danh mục
          _buildCategoryChips(strings),
          const SizedBox(height: 18),

          // Tiêu đề danh sách
          Row(
            children: [
              Text(
                strings.text('Cẩm nang & Thao tác chi tiết', 'Guides & Step-by-Step'),
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              Text(
                '${_filteredGuides.length} ${strings.text('chủ đề', 'topics')}',
                style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Danh sách các mục hướng dẫn
          if (_filteredGuides.isEmpty)
            _buildEmptyState(strings)
          else
            ..._filteredGuides.map((guide) => _buildGuideCard(guide, strings)),

          const SizedBox(height: 24),

          // Đường dây nóng khẩn cấp
          _buildEmergencyHotlinesCard(strings),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildHeroBanner(AppStrings strings) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary,
            AppColors.primary.withValues(alpha: 0.82),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.menu_book_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  strings.text('Sổ tay Hướng dẫn SafeSolo', 'SafeSolo Handbook'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  strings.text(
                    'Làm chủ 6 tính năng bảo vệ sự sống dành cho người sống một mình.',
                    'Master all 6 life protection features for solo living.',
                  ),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(AppStrings strings) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: TextField(
        onChanged: (val) => setState(() => _searchQuery = val),
        decoration: InputDecoration(
          hintText: strings.text(
            'Tìm kiếm: điểm danh, còi hú, máy tính, sơ cứu...',
            'Search: check-in, siren, calculator, first aid...',
          ),
          hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textSecondary, size: 22),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                  onPressed: () => setState(() => _searchQuery = ''),
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  Widget _buildCategoryChips(AppStrings strings) {
    final categories = [
      {'key': 'all', 'label': strings.text('Tất cả', 'All'), 'icon': Icons.apps_rounded},
      {'key': 'checkin', 'label': strings.text('Điểm danh & Quả cầu', 'Check-in & Orb'), 'icon': Icons.lens_blur_rounded},
      {'key': 'circle', 'label': strings.text('Vòng tròn & Hộ tống', 'Circle & Escort'), 'icon': Icons.group_work_rounded},
      {'key': 'sos', 'label': strings.text('SOS & Hiệp sĩ', 'SOS & Heroes'), 'icon': Icons.sos_rounded},
      {'key': 'stealth', 'label': strings.text('Thoát hiểm & Bảo mật', 'Escape & Stealth'), 'icon': Icons.lock_outline_rounded},
      {'key': 'firstaid', 'label': strings.text('Sơ cứu & Đồng hồ', 'First Aid & Watch'), 'icon': Icons.healing_rounded},
      {'key': 'faq', 'label': strings.text('Hỏi đáp', 'FAQ'), 'icon': Icons.help_outline_rounded},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: categories.map((cat) {
          final isSelected = _selectedCategory == cat['key'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              avatar: Icon(
                cat['icon'] as IconData,
                size: 16,
                color: isSelected ? Colors.white : AppColors.textSecondary,
              ),
              label: Text(cat['label'] as String),
              selected: isSelected,
              onSelected: (val) {
                setState(() => _selectedCategory = cat['key'] as String);
              },
              backgroundColor: Colors.white,
              selectedColor: AppColors.primary,
              labelStyle: TextStyle(
                fontSize: 12.5,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.border,
                ),
              ),
              showCheckmark: false,
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildGuideCard(GuideItem guide, AppStrings strings) {
    final isExpanded = _expandedIds.contains(guide.id);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: AppShadows.card,
        border: Border.all(
          color: isExpanded ? guide.accentColor.withValues(alpha: 0.35) : AppColors.border.withValues(alpha: 0.6),
          width: isExpanded ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        children: [
          // Header bấm để thu gọn / mở rộng
          InkWell(
            onTap: () => _toggleExpand(guide.id),
            borderRadius: BorderRadius.circular(18),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: guide.accentColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(guide.icon, color: guide.accentColor, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          guide.title,
                          style: AppTextStyles.title.copyWith(fontSize: 15, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          guide.subtitle,
                          style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textMuted, size: 24),
                  ),
                ],
              ),
            ),
          ),

          // Nội dung chi tiết mở rộng
          if (isExpanded) ...[
            const Divider(height: 1, color: AppColors.border),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Danh sách các bước
                  ...guide.steps.asMap().entries.map((entry) {
                    final index = entry.key;
                    final stepText = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            margin: const EdgeInsets.only(top: 2),
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: guide.accentColor.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                '${index + 1}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: guide.accentColor,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              stepText,
                              style: AppTextStyles.body.copyWith(
                                fontSize: 13.5,
                                color: AppColors.textPrimary,
                                height: 1.45,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),

                  // Hộp Mẹo An Toàn (Tip)
                  if (guide.tip != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7).withValues(alpha: 0.6),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.lightbulb_rounded, color: Color(0xFFD97706), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              guide.tip!,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: Color(0xFF92400E),
                                height: 1.4,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Nút hành động trực tiếp
                  if (guide.actionRoute != null && guide.actionLabel != null) ...[
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.pushNamed(context, guide.actionRoute!),
                        icon: Icon(Icons.arrow_forward_rounded, size: 16, color: guide.accentColor),
                        label: Text(
                          guide.actionLabel!,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: guide.accentColor,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: guide.accentColor.withValues(alpha: 0.5)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState(AppStrings strings) {
    return Container(
      padding: const EdgeInsets.all(32),
      alignment: Alignment.center,
      child: Column(
        children: [
          const Icon(Icons.search_off_rounded, size: 48, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text(
            strings.text('Không tìm thấy hướng dẫn phù hợp', 'No matching guide found'),
            style: AppTextStyles.title.copyWith(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 6),
          Text(
            strings.text('Hãy thử tìm với từ khóa khác như "điểm danh", "còi hú", "sos"', 'Try searching for "check-in", "siren", "sos"'),
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildEmergencyHotlinesCard(AppStrings strings) {
    final hotlines = [
      {'number': '115', 'name': strings.text('Cấp cứu Y tế', 'Ambulance'), 'color': const Color(0xFFDC2626), 'icon': Icons.medical_services_rounded},
      {'number': '113', 'name': strings.text('Cảnh sát / Công an', 'Police'), 'color': const Color(0xFF2563EB), 'icon': Icons.local_police_rounded},
      {'number': '114', 'name': strings.text('Cứu hỏa / Cứu nạn', 'Fire & Rescue'), 'color': const Color(0xFFEA580C), 'icon': Icons.local_fire_department_rounded},
      {'number': '111', 'name': strings.text('Bảo vệ Trẻ em', 'Child Protection'), 'color': const Color(0xFF0D9488), 'icon': Icons.child_care_rounded},
      {'number': '112', 'name': strings.text('Tìm kiếm cứu nạn', 'National Search'), 'color': const Color(0xFF7C3AED), 'icon': Icons.campaign_rounded},
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppShadows.card,
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.destructive.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.destructive, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('Đường dây nóng Khẩn cấp Quốc gia', 'National Emergency Hotlines'),
                      style: AppTextStyles.title.copyWith(fontSize: 16),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      strings.text('Bấm trực tiếp để gọi ngay khi gặp nguy hiểm tính mạng', 'Tap directly to dial during emergencies'),
                      style: AppTextStyles.caption.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: hotlines.map((item) {
              final number = item['number'] as String;
              final name = item['name'] as String;
              final color = item['color'] as Color;
              final icon = item['icon'] as IconData;

              return InkWell(
                onTap: () => _makeCall(number),
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: color.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, color: color, size: 18),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            number,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: color,
                            ),
                          ),
                          Text(
                            name,
                            style: TextStyle(
                              fontSize: 11,
                              color: color.withValues(alpha: 0.85),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
