# SafeSolo Product Roadmap (v2)

Tài liệu này chuyển các ý tưởng sản phẩm thành backlog kỹ thuật có thể triển khai theo sprint.

## 1) Mục tiêu sản phẩm

- Giảm báo động giả nhưng vẫn giữ phản ứng nhanh khi người dùng mất tương tác.
- Cá nhân hóa trải nghiệm cho 4 nhóm: người bệnh, người cao tuổi, người trẻ độc thân, solo traveler.
- Bảo vệ quyền riêng tư: chỉ nâng cấp thu thập dữ liệu vị trí khi bước vào trạng thái cảnh báo.

## 2) Luồng cảnh báo đa tầng (chuẩn hóa)

1. `LEVEL_1_REMINDER` (quá hạn tương tác): push + rung nhẹ.
2. `LEVEL_2_ALARM` (sau 15 phút): còi local cường độ cao.
3. `LEVEL_3_SOS` (sau 5 phút): gửi SMS + emit realtime cho Web Admin.
4. `LEVEL_4_RESCUE_CALL` (khẩn cấp): auto-call với thông điệp ghi âm.

Ghi chú triển khai:

- Backend là nơi quyết định trạng thái cuối cùng.
- Mobile xử lý phần local UX (rung/còi/voice prompt).
- Web Admin hiển thị timeline cảnh báo theo từng cấp.

## 3) Core interaction (điểm danh thông minh)

### 3.1. Kênh check-in

- Thông báo “Chào buổi sáng” + nút `Đã xem`.
- Widget lớn `Chạm để ổn` (2–3 lần/ngày).
- Check-in ngầm theo hoạt động thiết bị (mở khóa/mở app whitelist) cho nhóm người trẻ.

### 3.2. Rule không làm phiền

- Cấu hình `quiet_hours` và `sleep_mode`.
- Nếu user bật chế độ “Đi tắm/Đi ngủ”, tạm dừng escalation trong khoảng cho phép.

## 4) Thiết kế theo từng nhóm người dùng

### 4.1 Người bệnh

- Trigger bổ sung từ lịch uống thuốc.
- Kết hợp wearable signals (`HR`, `SpO2`) để tăng mức cảnh báo ngay lập tức.
- Tạo gói dữ liệu cấp cứu: hồ sơ thuốc + bệnh nền.

### 4.2 Người cao tuổi

- Home screen chỉ có các thao tác lớn, tương phản cao.
- Fall-detection (gia tốc + bất động sau va chạm).
- Tương tác giọng nói đơn giản: “Tôi ổn”, “Tôi cần giúp”.

### 4.3 Người trẻ độc thân

- Check-in theo ngữ cảnh “đã về nhà”.
- Nút hủy báo động có mã giả (duress code).
- Ưu tiên quyền riêng tư: chế độ chỉ theo dõi khi vào khung giờ nguy cơ.

### 4.4 Solo traveler

- Chuyến đi có `route window` và mốc check-in offline.
- Last known location bắt buộc gửi khi pin thấp nghiêm trọng.
- Cho phép người thân xem vị trí theo điều kiện (conditional sharing).

## 5) Kiến trúc kỹ thuật đề xuất

### Mobile (Flutter)

- State: `provider` hoặc `riverpod`.
- Background: `workmanager` (Android), background fetch/task (iOS).
- Local alarm: `flutter_local_notifications` + `audioplayers`.
- Sensor: `geolocator`, accelerometer plugin.

### Backend (Node.js + SQLite hiện tại)

- Worker theo nhịp 1 phút đã có.
- Bổ sung `alert_policies`, `interaction_events`, `device_signals`.
- Event stream nội bộ cho audit timeline.

### Web Admin (React)

- Dashboard realtime Socket.IO.
- Bản đồ + lịch sử escalation theo user.
- Màn hình “điều phối xử lý sự cố” có SLA phản hồi.

## 6) Database extension (SQLite)

Các bảng cần thêm:

- `interaction_events`
  - `id`, `user_id`, `type`, `source`, `created_at`, `meta_json`
- `alert_events`
  - `id`, `user_id`, `level`, `status`, `triggered_at`, `resolved_at`, `meta_json`
- `alert_policies`
  - `id`, `user_id`, `level1_minutes`, `level2_minutes`, `level3_minutes`, `level4_enabled`
- `medical_profiles`
  - `user_id`, `blood_type`, `allergies_json`, `conditions_json`, `medications_json`
- `trusted_circle`
  - `id`, `user_id`, `contact_name`, `contact_phone`, `role`, `priority`

## 7) Lộ trình triển khai 6 sprint

### Sprint 1 (1 tuần)

- Chuẩn hóa level cảnh báo trong backend + web admin timeline.
- Thêm `alert_events` và API query log theo user.

### Sprint 2 (1 tuần)

- Widget `Chạm để ổn` + quiet hours + sleep mode.
- Rule engine tránh báo động giả ở backend.

### Sprint 3 (1 tuần)

- Tích hợp SMS thật (provider VN) + retry policy.
- Cơ chế fallback push nếu SMS fail.

### Sprint 4 (1 tuần)

- Fall detection cơ bản + alert escalation mapping.
- Medical ID trên app + payload cho SOS.

### Sprint 5 (1 tuần)

- Circle of trust + phân quyền xử lý trên web-admin.
- SLA dashboard: thời gian từ SOS đến xác nhận xử lý.

### Sprint 6 (1 tuần)

- Chế độ traveler (offline window, pin thấp, conditional sharing).
- Kiểm thử tải và kiểm thử tình huống mất mạng.

## 8) Privacy & UX guardrails

- Mặc định không thu GPS liên tục; chỉ lấy ở check-in hoặc khi escalated.
- Cung cấp nhật ký “dữ liệu nào đã gửi đi” cho người dùng.
- Tông giao diện thân thiện, không tạo cảm giác “giám sát cưỡng ép”.

## 9) KPI theo dõi

- `False Alert Rate` < 10% sau 4 tuần pilot.
- `SOS Dispatch Delay` < 30 giây ở mức backend.
- `User Daily Check-in Completion` > 85% cho nhóm người cao tuổi.
