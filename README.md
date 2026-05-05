# SafeSolo

Hệ thống giám sát an toàn cá nhân theo cơ chế **Dead Man's Switch** gồm 3 thành phần:

- `mobile app` Flutter cho người dùng check-in và gửi GPS.
- `backend` Node.js + SQLite chạy timer trên server, cảnh báo leo thang và phát SOS.
- `web-admin` React + Socket.IO nhận cảnh báo realtime cho đơn vị quản lý.

## 1) Kiến trúc tổng quát

1. Người dùng check-in từ app.
2. Backend cập nhật `lastCheckinTime` + `nextDeadline`.
3. Worker trên backend quét user mỗi phút:

   - Trước deadline: phát `CHECKIN_REMINDER`.
   - Quá hạn 5 phút: phát `CHECKIN_WARNING`.
   - Quá hạn 15 phút: kích hoạt `EMERGENCY_SOS`, ghi log và gửi SMS (mock).

4. Web Admin nhận sự kiện realtime qua Socket.IO, hiển thị và xử lý sự cố.

## 2) Cấu trúc chính

- `backend/`: API, models, worker, socket.
- `lib/`: Flutter app (`register` + `home/check-in`).
- `web-admin/`: Dashboard realtime cho quản trị.

## 3) Cài đặt & chạy backend

Yêu cầu: Node.js 18+.

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

API backend mặc định: `http://localhost:4000/api`

Database mặc định: `backend/data/safesolo.db` (tự tạo khi chạy server).

### Endpoint chính

- `POST /api/users/register`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users/:id/checkin`
- `PATCH /api/users/:id/timer`
- `PATCH /api/users/:id/location`
- `PATCH /api/users/:id/preferences`
- `PATCH /api/users/:id/sleep-mode`
- `GET /api/admin/emergencies?status=open|resolved`
- `PATCH /api/admin/emergencies/:id/resolve`
- `GET /api/admin/emergencies/:id/sms-logs`
- `GET /api/admin/alerts?userId=<id>&page=1&limit=50`

Ví dụ payload Sprint 2:

- `PATCH /api/users/:id/preferences`
   `{ "quietHoursStart": "22:30", "quietHoursEnd": "06:30", "falseAlertGraceMinutes": 7 }`
- `PATCH /api/users/:id/sleep-mode`
   `{ "minutes": 60 }` (đặt `0` để tắt)

## 4) Cài đặt & chạy mobile app (Flutter)

```bash
flutter pub get
flutter run
```

Lưu ý:

- Trên Android Emulator, app gọi backend qua `http://10.0.2.2:4000/api` (đã cấu hình trong `lib/core/constants.dart`).
- Nếu chạy trên thiết bị thật, đổi `backendBaseUrl` sang IP LAN máy chạy server.

## 5) Cài đặt & chạy web-admin

```bash
cd web-admin
npm install
npm run dev
```

Biến môi trường tuỳ chọn (Vite):

- `VITE_BACKEND_URL` (mặc định `http://localhost:4000/api`)
- `VITE_SOCKET_URL` (mặc định `http://localhost:4000`)

## 6) Giao diện app mới

Giao diện người dùng mới đã được thêm vào thư mục `web-app/`.

```bash
cd web-app
npm install --legacy-peer-deps
npm run dev
```

File `.env` trong `web-app/` chứa cấu hình Supabase, và bạn có thể thêm:

```env
VITE_BACKEND_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

## 7) Luồng demo nhanh

1. Chạy backend.
2. Mở web-admin.
3. Mở app Flutter, đăng ký user và check-in.
4. Giảm `timerIntervalMinutes` (ví dụ 30 phút) và chỉnh ngưỡng trong `.env` cho demo nhanh:

   - `ESCALATION_WARNING_MINUTES=1`
   - `ESCALATION_SOS_MINUTES=2`

5. Chờ quá hạn để thấy web-admin nhận `EMERGENCY_SOS` realtime.

## 7) Trạng thái triển khai hiện tại

Đã hoàn thành MVP end-to-end:

- Timer chạy **trên server** (không phụ thuộc app chạy ngầm).
- Check-in có GPS từ mobile.
- SOS có log + emit realtime + mock SMS.
- Web Admin theo dõi user và xử lý sự cố.

Đã hoàn thành Sprint 2 (giảm báo động giả):

- `Quiet hours`: tạm hoãn escalation trong khung giờ nghỉ.
- `Sleep mode`: tạm dừng cảnh báo theo số phút người dùng chọn.
- `False-alert grace`: cộng thêm thời gian đệm trước khi chuyển WARNING/SOS.

Đã hoàn thành Sprint 3 (SMS retry + fallback):

- Provider chain: `SMS_PRIMARY_PROVIDER` -> `SMS_FALLBACK_PROVIDER`.
- Hỗ trợ provider `mock` và `webhook` (tích hợp nhanh với gateway nội địa qua HTTP bridge).
- Retry policy: `SMS_MAX_RETRIES`, `SMS_RETRY_DELAY_MS`, `SMS_REQUEST_TIMEOUT_MS`.
- Lưu nhật ký gửi SMS theo từng attempt vào SQLite (`sms_dispatch_logs`).

Phần mở rộng đề xuất tiếp theo:

- Tích hợp SMS Gateway thật (eSMS/SpeedSMS/Twilio).
- Tích hợp FCM push notification.
- Auth/JWT + phân quyền admin đầy đủ.
- Dashboard bản đồ Google Maps và báo cáo chi tiết.

## 8) Roadmap mở rộng tính năng

- Chi tiết roadmap sản phẩm (multi-level alert, cá nhân hóa theo nhóm người dùng, privacy, sprint plan):
   [docs/product-roadmap.md](docs/product-roadmap.md)
