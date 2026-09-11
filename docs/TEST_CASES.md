# 📋 BỘ TÀI LIỆU TEST CASES TOÀN DIỆN NỀN TẢNG SAFESOLO
> **Dự án:** SafeSolo - Giải pháp an toàn cá nhân & giám sát sinh tồn cho người sống độc thân  
> **Phiên bản:** 1.0.0 RC (Hội đồng Đồ án Tốt nghiệp 2026)  
> **Tác giả:** Đoàn Minh Quân (MSSV: 2224801030137 - Lớp KTPM03)  
> **Tổng số Test Cases:** **97 Test Cases** (38 Web Admin + 39 Mobile App + 20 Galaxy Watch 5)

---

## 📑 MỤC LỤC
1. [PHẦN I: MA TRẬN TỔNG THỂ KIỂM THỬ](#phần-i-ma-trận-tổng-thể-kiểm-thử)
2. [PHẦN II: TEST CASES TRUNG TÂM ĐIỀU PHỐI WEB ADMIN (38 TCs)](#phần-ii-test-cases-trung-tâm-điều-phối-web-admin)
3. [PHẦN III: TEST CASES ỨNG DỤNG DI ĐỘNG MOBILE APP (39 TCs)](#phần-iii-test-cases-ứng-dụng-di-động-mobile-app)
4. [PHẦN IV: TEST CASES ĐỒNG HỒ GALAXY WATCH 5 / WEAR OS (20 TCs)](#phần-iv-test-cases-đồng-hồ-galaxy-watch-5--wear-os)
5. [PHẦN V: HƯỚNG DẪN CHẠY TEST TỰ ĐỘNG (AUTOMATION TESTING)](#phần-v-hướng-dẫn-chạy-test-tự-động)

---

# PHẦN I: MA TRẬN TỔNG THỂ KIỂM THỬ

| Phân hệ hệ thống | Tổng số TCs | P1 (Nghiêm trọng - Critical) | P2 (Quan trọng - High) | P3 (Trung bình - Medium) |
| :--- | :---: | :---: | :---: | :---: |
| **1. Web Admin Portal** | **38** | 17 | 16 | 5 |
| **2. Mobile App SafeSolo** | **39** | 25 | 11 | 3 |
| **3. Galaxy Watch 5 (Wear OS)** | **20** | 16 | 4 | 0 |
| **TỔNG CỘNG** | **97** | **58 (59.8%)** | **31 (32.0%)** | **8 (8.2%)** |

---

# PHẦN II: TEST CASES TRUNG TÂM ĐIỀU PHỐI WEB ADMIN

### 1. Khung giao diện & Điều hướng (App Shell & Topbar)
* **TC_ADM_SH_01 [P3]:** Thu gọn / Mở rộng AppSidebar (Chuyển đổi linh hoạt giữa icon và nhãn văn bản đầy đủ).
* **TC_ADM_SH_02 [P1]:** Điều hướng 6 phân hệ chính (`/`, `/users`, `/kyc`, `/omnichannel`, `/revenue`, `/audit`) hiển thị active tab chính xác.
* **TC_ADM_SH_03 [P3]:** Topbar hiển thị đồng hồ thời gian thực (nhảy giây chuẩn `vi-VN`), profile điều phối viên Ca A, chuông báo động nhấp nháy `pulse-sos`.
* **TC_ADM_SH_04 [P2]:** Xử lý trang lỗi 404 và component bắt lỗi runtime, hỗ trợ nút "Thử lại" tự động invalidate query.

### 2. Trung tâm điều phối trực tiếp (`/`)
* **TC_ADM_DP_01 [P1]:** Hiển thị 4 thẻ KPI chỉ số: Tổng người dùng, Hiệp sĩ đã duyệt, Sự cố đang mở, Cảnh báo hôm nay.
* **TC_ADM_DP_02 [P1]:** Bản đồ nhiệt MapLibre GL phân loại màu marker: SOS đỏ (`#ff4d4f`), Duress hồng tím (`#ff3ea5`), Medical cam (`#ffb347`) kèm hiệu ứng phát xung `animate-ping`.
* **TC_ADM_DP_03 [P2]:** Fallback cảnh báo trang nhã khi chưa thiết lập `VITE_MAPTILER_API_KEY`.
* **TC_ADM_DP_04 [P1]:** Danh sách sự cố tự động polling ngầm 10 giây một lần (`refetchInterval: 10000`).
* **TC_ADM_DP_05 [P3]:** Bật/Tắt âm thanh cảnh báo phòng trực điều hành (Mute / Unmute toggle).
* **TC_ADM_DP_06 [P1]:** Modal chi tiết sự cố hiển thị thông số sinh tồn nạn nhân từ Samsung Galaxy Watch 5: SpO2, BPM nhịp tim, pin thiết bị và mức độ nguy cấp.
* **TC_ADM_DP_07 [P1]:** Thao tác "Đánh dấu đã xử lý" sự cố (`PATCH /api/admin/incidents/:id/resolve`), tự động đóng modal và xóa sự cố khỏi hàng đợi.
* **TC_ADM_DP_08 [P2]:** Tương tác nút gọi người thân và điều phối xe cứu thương.
* **TC_ADM_DP_09 [P2]:** Xuất dữ liệu điều phối ra file Excel (`safesolo-admin-dispatch.xlsx`) gồm 2 sheet: "Thống kê" và "Sự cố".

### 3. Quản lý Người dùng ứng dụng (`/users`)
* **TC_ADM_USR_01 [P1]:** Liệt kê danh sách người dùng, phân loại nguồn (MongoDB, SQLite, Legacy Store) và hiển thị huy hiệu Hiệp sĩ tích xanh.
* **TC_ADM_USR_02 [P2]:** Bộ lọc tìm kiếm nhanh người dùng theo Họ tên, Số điện thoại, Trạng thái (Safe/Warning/SOS).
* **TC_ADM_USR_03 [P1]:** Bảng chi tiết hồ sơ người dùng hiển thị danh sách Guardian (Tên, mối quan hệ, SĐT) và chu kỳ check-in.
* **TC_ADM_USR_04 [P2]:** Xuất danh sách người dùng ra file Excel (`safesolo-admin-users.xlsx`).

### 4. Thẩm định hồ sơ & Xác minh KYC Hiệp sĩ (`/kyc`)
* **TC_ADM_KYC_01 [P1]:** Hiển thị hàng chờ thẩm định hồ sơ đăng ký Hiệp sĩ cộng đồng.
* **TC_ADM_KYC_02 [P1]:** Đối chiếu hình ảnh sinh trắc học: Ảnh chân dung selfie, CCCD mặt trước, CCCD mặt sau chuẩn URL.
* **TC_ADM_KYC_03 [P1]:** Hiển thị phân tích AI: % Khớp khuôn mặt, Điểm tin cậy Trust Score, Liveness check và số lần đã tham gia cứu hộ.
* **TC_ADM_KYC_04 [P1]:** Phê duyệt cấp quyền Hiệp sĩ (`APPROVE`), tài khoản được gắn tích xanh và quyền nhận nhiệm vụ SOS lân cận.
* **TC_ADM_KYC_05 [P1]:** Từ chối hồ sơ không đạt yêu cầu (`REJECT`).
* **TC_ADM_KYC_06 [P2]:** Xuất danh sách thẩm định KYC ra Excel (`safesolo-admin-kyc.xlsx`).

### 5. Giám sát Kênh liên lạc & Định tuyến dự phòng (`/omnichannel`)
* **TC_ADM_OMN_01 [P1]:** Giám sát thời gian thực 6 kênh truyền tin: SMS Provider, SMS Fallback, Zalo ZNS, Telegram Bot, Gmail SMTP, Voice Auto-Call.
* **TC_ADM_OMN_02 [P2]:** Hiển thị sơ đồ luồng chính sách dự phòng tự động (Fallback Routing Policy) với mũi tên nối tiếp.
* **TC_ADM_OMN_03 [P3]:** Xuất báo cáo trạng thái kênh và policy ra Excel (`safesolo-admin-channels.xlsx`).

### 6. Doanh thu AdMob & Đối tác cấp cứu (`/revenue`)
* **TC_ADM_REV_01 [P2]:** 3 thẻ KPI tài chính: Doanh thu AdMob 30 ngày (USD), Hoa hồng điều xe chưa thanh toán (VND), Bệnh viện đối tác hoạt động.
* **TC_ADM_REV_02 [P3]:** Đồ thị Sparkline SVG xu hướng doanh thu 30 ngày gần nhất.
* **TC_ADM_REV_03 [P2]:** Bảng danh sách bệnh viện đối tác điều xe và nút "Yêu cầu thanh toán".
* **TC_ADM_REV_04 [P2]:** Xuất dữ liệu tài chính ra file Excel (`safesolo-admin-revenue.xlsx`) gồm 3 sheet.

### 7. Nhật ký hệ thống & Kiểm toán bất biến (`/audit`)
* **TC_ADM_AUD_01 [P1]:** Bảng Audit Logs hiển thị chuỗi mã băm toàn vẹn SHA-256 chống chỉnh sửa dữ liệu.
* **TC_ADM_AUD_02 [P2]:** Lọc nhật ký theo 5 danh mục: Tất cả, Điều phối, KYC, Hệ thống, Tài chính.
* **TC_ADM_AUD_03 [P2]:** Tìm kiếm nhanh theo người thực hiện hoặc mã sự cố.
* **TC_ADM_AUD_04 [P2]:** Xuất nhật ký kiểm toán ra file Excel (`safesolo-admin-audit.xlsx`).

---

# PHẦN III: TEST CASES ỨNG DỤNG DI ĐỘNG MOBILE APP

### 1. Khởi động, Cấp quyền & Xác thực
* **TC_APP_AUTH_01 [P2]:** Luồng Onboarding 3 slide giới thiệu tính năng Điểm danh, Két sắt và Mạng lưới Hiệp sĩ.
* **TC_APP_AUTH_02 [P1]:** Cấp quyền hệ thống bắt buộc: Vị trí nền ("Allow all the time"), Hoạt động thể chất (Pedometer), Bluetooth, Thông báo, Micro.
* **TC_APP_AUTH_03 [P1]:** Đăng ký / Đăng nhập OTP và lưu token đăng nhập tự động.

### 2. Trang chủ & Điểm danh sinh tồn (Alive? Check-in)
* **TC_APP_CHK_01 [P1]:** Đồng hồ đếm lùi Deadline thời gian thực kèm vòng tròn tiến trình sinh tồn.
* **TC_APP_CHK_02 [P1]:** Điểm danh 1 chạm kèm chọn cảm xúc (Mood: Bình yên, Vui vẻ, Mệt mỏi, Ốm, Bất an), reset deadline và đồng bộ lên server.
* **TC_APP_CHK_03 [P2]:** Gia hạn thêm giờ điểm danh (Extend Timer: +1h, +2h, +4h).
* **TC_APP_CHK_04 [P1]:** Chế độ Giờ yên tĩnh (Quiet Hours): Không báo động giả trong khung giờ ngủ đã cài đặt (23:00 - 07:00).

### 3. Kích nổ & Điều phối SOS khẩn cấp
* **TC_APP_SOS_01 [P1]:** Giữ nút tròn đỏ 3 giây (Hold-to-SOS) có hiệu ứng nén và rung phản hồi để kích nổ cứu nạn.
* **TC_APP_SOS_02 [P1]:** Màn hình cứu nạn thời gian thực `SosMapPage` hiển thị tọa độ GPS nạn nhân, vị trí Người bảo hộ di chuyển và ETA.
* **TC_APP_SOS_03 [P1]:** Hủy báo động SOS bắt buộc nhập đúng mã PIN chính (Real PIN).
* **TC_APP_SOS_04 [P1]:** Cơ chế chuyển hướng tin nhắn SMS Fallback tự động khi mất sóng 4G/Wifi.

### 4. Vòng tròn An toàn & Người giám hộ (Circle)
* **TC_APP_CIR_01 [P1]:** Thêm mới Người giám hộ khẩn cấp có phân cấp mức ưu tiên (Priority 1, 2, 3).
* **TC_APP_CIR_02 [P2]:** Tính năng gửi chuông thông báo thử nghiệm (Test Alert) đến điện thoại người thân.
* **TC_APP_CIR_03 [P3]:** Đăng trạng thái và ghi âm voice note chia sẻ trong Vòng tròn gia đình.

### 5. Tin nhắn khẩn cấp & Bộ đàm PTT
* **TC_APP_MSG_01 [P2]:** Quản lý 3 luồng hộp thư riêng biệt: Gia đình, Hiệp sĩ cứu hộ, Cộng đồng an ninh.
* **TC_APP_MSG_02 [P1]:** Bộ đàm khẩn cấp Push-To-Talk (PTT) một chạm gửi đoạn âm thanh hiện trường tức thời dạng sóng âm.

### 6. Mạng lưới Hiệp sĩ & Radar cứu hộ
* **TC_APP_HERO_01 [P1]:** Chụp và gửi ảnh 2 mặt CCCD đăng ký tình nguyện viên cứu nạn SafeSolo.
* **TC_APP_HERO_02 [P1]:** Radar quét sự cố SOS lân cận (`CommunityRadarPage`) trong bán kính 1-5km.
* **TC_APP_HERO_03 [P1]:** Nhận nhiệm vụ cứu nạn và mở điều hướng 1-chạm qua Google Maps hoặc Waze Navigation.

### 7. Trung tâm Sức khỏe & Chỉ số sinh tồn (Health Hub)
* **TC_APP_HLT_01 [P2]:** Vòng vận động 3 lớp đồng tâm (Bước chân, Calo, Quãng đường) kết nối cảm biến Pedometer.
* **TC_APP_HLT_02 [P1]:** Ma trận sinh tồn hiển thị trực tiếp Nhịp tim (BPM) và Nồng độ oxy trong máu (SpO2), cảnh báo đỏ khi SpO2 < 92%.
* **TC_APP_HLT_03 [P2]:** Bộ lọc xem báo cáo sức khỏe theo chu kỳ Hôm nay / Tuần này / Tháng này.
* **TC_APP_HLT_04 [P2]:** Xuất báo cáo y tế sinh tồn ra file PDF / Excel phục vụ hội chẩn y khoa.

### 8. Hồ sơ Y tế khẩn cấp & Mã QR cứu nạn
* **TC_APP_MED_01 [P1]:** Cập nhật hồ sơ bệnh án: Nhóm máu, dị ứng thuốc, bệnh nền mãn tính, số điện thoại cấp cứu 115.
* **TC_APP_MED_02 [P1]:** Tạo mã QR Y tế khẩn cấp ngoại tuyến để nhân viên cấp cứu quét trực tiếp từ màn hình khóa.

### 9. Bảo mật, Ngụy trang & Két sắt sinh tử
* **TC_APP_SEC_01 [P1]:** Thiết lập đồng thời mã PIN thật và mã PIN nguy hiểm ngụy trang (Duress PIN).
* **TC_APP_SEC_02 [P1]:** Máy tính ngụy trang (Stealth Calculator): Tính toán như máy tính thật; gõ Duress PIN sẽ âm thầm gửi Silent SOS mà kẻ xấu không phát hiện.
* **TC_APP_SEC_03 [P1]:** Két sắt sinh tử (Dead Man's Switch Vault): Chỉ mở bằng Real PIN, lưu trữ di chúc số và mật khẩu an toàn.

### 10. Cài đặt hệ thống & Chẩn đoán mạng
* **TC_APP_SET_01 [P2]:** Thanh trượt điều chỉnh thời gian ân hạn điểm danh từ 1 giờ đến 72 giờ.
* **TC_APP_SET_02 [P2]:** Bật chế độ Nghỉ phép (Vacation Mode) tạm dừng điểm danh khi đi du lịch.
* **TC_APP_SET_03 [P3]:** Bật chế độ Tương phản cao (High Contrast Mode) cho người lớn tuổi.
* **TC_APP_SET_04 [P3]:** Chẩn đoán kết nối mạng, đo độ trễ Ping máy chủ và trạng thái cổng SMS Gateway.

---

# PHẦN IV: TEST CASES ĐỒNG HỒ GALAXY WATCH 5 / WEAR OS

### 1. 7 Màn hình chuẩn 1:1 theo mẫu thiết kế phần cứng
* **TC_W5_01 [P1]:** Màn hình **Watch Face**: Đồng hồ số thể thao, nhịp tim BPM, pin %, nút tròn lớn "TÔI AN TOÀN" và mốc giờ đến hạn.
* **TC_W5_02 [P1]:** Thao tác 1 chạm "TÔI AN TOÀN" trên Watch Face: Rung xúc giác Haptic và reset bộ đếm deadline.
* **TC_W5_03 [P1]:** Màn hình **Dashboard**: Vòng cung tiến trình Arc đếm ngược thời gian và nút kích nổ "SOS KHẨN".
* **TC_W5_04 [P2]:** Màn hình **Mood Check-in**: 4 thẻ cảm xúc lớn (Tuyệt vời, Bình thường, Mệt mỏi, Bất an) dễ chạm bằng ngón tay.
* **TC_W5_05 [P2]:** Luồng chọn cảm xúc và tự động quay về (Auto-return sau 1.5s).
* **TC_W5_06 [P1]:** Màn hình **Alert Warning**: Chớp nháy cảnh báo vàng đếm lùi 45 giây trước khi tự động nổ SOS.
* **TC_W5_07 [P1]:** Lựa chọn "TÔI ỔN" để tắt cảnh báo vs "KÍCH HOẠT SOS NGAY" để gọi cứu hộ tức thì.
* **TC_W5_08 [P1]:** Màn hình **Active SOS**: Chớp đỏ toàn phần, hiển thị tọa độ GPS đã chốt, danh sách điều phối và nút "Hủy báo động (cần PIN)".
* **TC_W5_09 [P1]:** Bàn phím số PIN Pad mini trên mặt tròn: Nhập sai PIN tiếp tục báo động, nhập đúng PIN thật mới tắt còi.
* **TC_W5_10 [P1]:** Màn hình **Health Monitor**: Đo trực tiếp nhịp tim BPM (có hiệu ứng tim đập) và vẽ biểu đồ sóng xung Sparkline 15 điểm đo gần nhất.
* **TC_W5_11 [P1]:** Đo nồng độ oxy máu SpO2: Nhận diện ngưỡng bình thường (>= 92%) và cảnh báo đỏ thiếu oxy cấp (< 92%).
* **TC_W5_12 [P1]:** Màn hình **Medical ID**: Thẻ y tế khẩn cấp ghi rõ nhóm máu và số điện thoại người bảo hộ.
* **TC_W5_13 [P1]:** Hiển thị mã QR cứu sinh ngoại tuyến trên cổ tay nạn nhân.

### 2. Giao thức truyền tin SSWP & Tự động phát hiện té ngã
* **TC_W5_14 [P1]:** Đóng gói và giải mã gói tin chuẩn `SAFESOLO_WATCH_V1` qua stream dữ liệu không độ trễ.
* **TC_W5_15 [P1]:** Quy trình ghép đôi đồng hồ qua mã 6 số `XXX-XXX` (Pairing Code).
* **TC_W5_16 [P1]:** Phát hiện té ngã tự động (Fall Detection SVM > 3.5g và góc nghiêng > 60°), kích hoạt chuông báo động cứu nạn.
* **TC_W5_17 [P2]:** Tính năng Tìm đồng hồ hai chiều (Find Watch Ping): Điện thoại gửi lệnh, đồng hồ rung theo nhịp xác định.

### 3. Tương tác phần cứng & Hiển thị viền tròn
* **TC_W5_18 [P2]:** Hỗ trợ thao tác xoay viền Bezel vật lý để chuyển mượt qua lại giữa 7 màn hình.
* **TC_W5_19 [P1]:** Nhận diện phần cứng tại Frame 0 (Wear OS Hardware Gate) mở thẳng màn hình đồng hồ không qua giao diện điện thoại.
* **TC_W5_20 [P1]:** Kích nổ SOS phần cứng bằng cách bấm liên tục 5 lần nút nguồn đồng hồ.

---

# PHẦN V: HƯỚNG DẪN CHẠY TEST TỰ ĐỘNG

Dự án SafeSolo tích hợp sẵn các bộ kiểm thử tự động (Unit Test & Widget Test) có thể chạy trực tiếp từ dòng lệnh:

### 1. Kiểm thử Giao diện 7 Màn hình Galaxy Watch 5:
```bash
flutter test test/galaxy_watch5_interface_test.dart
```

### 2. Kiểm thử Giao thức SSWP & Đồng bộ WatchSyncManager:
```bash
flutter test test/watch_sync_manager_test.dart
```

### 3. Kiểm thử Thuật toán Xử lý Tín hiệu Sinh tồn & AI:
```bash
flutter test test/ai_signal_processor_test.dart
```

---
*Bản quyền tài liệu thuộc về Nhóm tác giả Đồ án SafeSolo - Khoa CNTT.*
