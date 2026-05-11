# SafeSolo

SafeSolo là hệ thống bảo vệ an toàn cá nhân gồm 3 phần chính:

- Ứng dụng Flutter cho người dùng cuối
- Backend Node.js/Express + MongoDB cho check-in, SOS, guardians, medical, chat, community
- Web Admin React/Vite để điều phối sự cố, theo dõi timeline cảnh báo và quản trị dữ liệu

Repo này đang được tổ chức như một mono-repo thực dụng: Flutter app, backend và web-admin cùng nằm trong một workspace để phát triển và test end-to-end dễ hơn.

## Kiến trúc tổng quan

### 1. Flutter mobile app

Thư mục: [c:\Users\Admin\SafeSolo\lib](c:/Users/Admin/SafeSolo/lib)

Chức năng chính:

- Onboarding -> Auth -> Permissions
- Check-in theo chu kỳ
- Dead-man switch
- SOS map / community radar
- Alive Circle
- Messenger
- Heroes
- Settings, Medical ID, Network, Vault, Stealth mode
- Song ngữ `Tiếng Việt / English`

Tech stack:

- Flutter
- `provider`
- `shared_preferences`
- `geolocator`
- `permission_handler`
- `google_maps_flutter`
- `url_launcher`
- `qr_flutter`

### 2. Backend API

Thư mục: [c:\Users\Admin\SafeSolo\backend](c:/Users/Admin/SafeSolo/backend)

Chức năng chính:

- Auth, profile, bootstrap
- User check-in
- Alert policy
- Interaction events
- Guardian CRUD
- Medical profile sync
- Automation settings
- Security settings
- Device signals
- Rescue incident / SOS / radar / volunteer response
- Chat room, messages, emergency memos
- KYC
- Admin safety overview, incidents, alerts, SMS logs
- Background workers cho dead-man switch và auto-wipe

Trạng thái hiện tại:

- Core runtime đã dùng MongoDB làm nguồn chính
- Mongo mặc định: `mongodb://127.0.0.1:27017/Safesolo`
- Một số module legacy vẫn còn trong repo để tương thích, nhưng luồng safety chính đã được migrate sang Mongo

### 3. Web Admin

Thư mục: [c:\Users\Admin\SafeSolo\web-admin](c:/Users/Admin/SafeSolo/web-admin)

Chức năng chính:

- Dashboard điều phối
- Danh sách người dùng app
- KYC queue
- Omnichannel / logs / revenue
- Export Excel
- Kết nối trực tiếp tới backend API

## Cấu trúc thư mục

```text
SafeSolo/
├─ lib/                 Flutter app
├─ android/             Android runner
├─ test/                Flutter tests
├─ backend/             Express API + Mongo models + workers
├─ web-admin/           React/Vite admin dashboard
├─ docs/                Product roadmap và tài liệu nội bộ
├─ web/                 Web build/output cũ
├─ mobile-app/          Legacy/experimental clients
└─ database/            SQL scripts / dữ liệu hỗ trợ cũ
```

## Yêu cầu hệ thống

### Mobile app

- Flutter SDK 3.9+
- Android Studio hoặc Android SDK
- Emulator Android hoặc thiết bị thật

### Backend

- Node.js 18+
- MongoDB chạy local hoặc remote
- Redis là tùy chọn

Ghi chú:

- API vẫn chạy nếu Redis chưa bật
- Nếu Redis tắt, worker BullMQ có thể log cảnh báo `ECONNREFUSED 127.0.0.1:6379`

### Web Admin

- Node.js 18+
- npm

## Cách chạy toàn bộ hệ thống

### 1. Chạy backend

```powershell
cd c:\Users\Admin\SafeSolo\backend
npm install
npm run dev
```

Backend mặc định chạy tại:

- [http://127.0.0.1:4000](http://127.0.0.1:4000)
- [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health)

### 2. Chạy Flutter app

```powershell
cd c:\Users\Admin\SafeSolo
flutter pub get
flutter run
```

Nếu dùng Android Emulator:

- `API_BASE_URL` nên là `http://10.0.2.2:4000/api`

Nếu dùng điện thoại thật:

- đổi sang IP LAN của máy, ví dụ `http://192.168.x.x:4000/api`

### 3. Chạy web-admin

```powershell
cd c:\Users\Admin\SafeSolo\web-admin
npm install
npm run dev
```

Web admin thường chạy tại:

- [http://localhost:8080](http://localhost:8080)

## Google Maps cấu hình thế nào

Flutter app đang dùng `google_maps_flutter`.

File liên quan:

- [c:\Users\Admin\SafeSolo\android\app\build.gradle.kts](c:/Users/Admin/SafeSolo/android/app/build.gradle.kts)
- [c:\Users\Admin\SafeSolo\android\app\src\main\AndroidManifest.xml](c:/Users/Admin/SafeSolo/android/app/src/main/AndroidManifest.xml)
- [c:\Users\Admin\SafeSolo\android\maps-api.properties.example](c:/Users/Admin/SafeSolo/android/maps-api.properties.example)

Cách cấu hình:

1. Tạo file `android/maps-api.properties`
2. Thêm:

```properties
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

3. Build lại app

## Luồng người dùng chính

### 1. Onboarding -> Auth -> Permissions

- User vào onboarding
- Đăng nhập/đăng ký
- Cấp quyền vị trí, micro, thông báo, danh bạ
- Vào shell chính 5 tab

### 2. Check-in

- User bấm nút tròn ở Home
- App hỏi cảm xúc
- Gửi check-in về backend
- Backend cập nhật `lastCheckinTime`, `nextDeadline`, interaction events

### 3. Dead-man switch

- Nếu user không check-in trong khoảng `graceHours`
- Worker backend sẽ nâng dần mức cảnh báo
- Tạo `alert_events`
- Ghi SMS dispatch logs
- Đẩy dữ liệu sang Web Admin

### 4. SOS / Radar / Rescue

- User hoặc duress flow tạo `RescueIncident`
- Volunteer chấp nhận cứu hộ
- Chat room được nối trực tiếp với incident
- Emergency memo và responder được đồng bộ trong room

### 5. Vault + Stealth

- `Stealth` bảo vệ user khi bị ép mở app
- `Vault` lưu dữ liệu nhạy cảm theo dead-man switch

## Những tính năng đã có

### Flutter app

- Check-in theo chu kỳ
- Mood prompt
- Nút check-in lớn có hiệu ứng
- Circle feed
- Reply và cheer trong Circle
- Messenger với text + voice note mock
- Call từ thread
- High contrast mode
- Language switch
- Stealth mode
- Vault
- Medical / Network / Achievements / Security / Settings

### Backend

- MongoDB connection
- User core models
- Check-in, alert policy, interaction events
- Guardian CRUD
- Medical profile sync
- Automation + security settings
- Device signals
- SOS / radar / rescue incident
- Chat room / message / emergency memo
- KYC queue
- Admin overview / incidents / alerts / SMS logs
- Bulk migrate SQLite -> Mongo
- Verify counts script

### Web Admin

- Dashboard điều phối
- Danh sách người dùng
- KYC
- Audit
- Omnichannel
- Revenue
- Export Excel
- Giao diện tiếng Việt

## Scripts quan trọng

### Root Flutter

```powershell
flutter pub get
flutter analyze
flutter test
flutter run
flutter build apk --debug
flutter build apk --release
```

### Backend

```powershell
npm run dev
npm run start
npm run seed:demo-users
npm run migrate:sqlite-to-mongo
npm run verify:mongo-counts
```

### Web Admin

```powershell
npm run dev
npm run build
```

## Seed dữ liệu demo

Backend có script seed user demo:

- [c:\Users\Admin\SafeSolo\backend\scripts\seedDemoUsers.js](c:/Users/Admin/SafeSolo/backend/scripts/seedDemoUsers.js)

Chạy:

```powershell
cd c:\Users\Admin\SafeSolo\backend
npm run seed:demo-users
```

## Kiểm tra nhanh hệ thống

### Backend health

```powershell
curl http://127.0.0.1:4000/api/health
```

### Flutter analyze

```powershell
cd c:\Users\Admin\SafeSolo
flutter analyze
```

### Flutter test

```powershell
flutter test
```

### Web Admin build

```powershell
cd c:\Users\Admin\SafeSolo\web-admin
npm run build
```

## Các file đáng chú ý

### Flutter

- [c:\Users\Admin\SafeSolo\lib\main.dart](c:/Users/Admin/SafeSolo/lib/main.dart)
- [c:\Users\Admin\SafeSolo\lib\core\providers\app_provider.dart](c:/Users/Admin/SafeSolo/lib/core/providers/app_provider.dart)
- [c:\Users\Admin\SafeSolo\lib\views\home\home_page.dart](c:/Users/Admin/SafeSolo/lib/views/home/home_page.dart)
- [c:\Users\Admin\SafeSolo\lib\views\circle\circle_page.dart](c:/Users/Admin/SafeSolo/lib/views/circle/circle_page.dart)
- [c:\Users\Admin\SafeSolo\lib\views\messenger\messenger_page.dart](c:/Users/Admin/SafeSolo/lib/views/messenger/messenger_page.dart)

### Backend

- [c:\Users\Admin\SafeSolo\backend\server.js](c:/Users/Admin/SafeSolo/backend/server.js)
- [c:\Users\Admin\SafeSolo\backend\src\config\database.js](c:/Users/Admin/SafeSolo/backend/src/config/database.js)
- [c:\Users\Admin\SafeSolo\backend\src\routes\index.js](c:/Users/Admin/SafeSolo/backend/src/routes/index.js)
- [c:\Users\Admin\SafeSolo\backend\src\controllers\userController.js](c:/Users/Admin/SafeSolo/backend/src/controllers/userController.js)
- [c:\Users\Admin\SafeSolo\backend\src\services\adminPortalService.js](c:/Users/Admin/SafeSolo/backend/src/services/adminPortalService.js)
- [c:\Users\Admin\SafeSolo\backend\src\workers\deadmanWorker.js](c:/Users/Admin/SafeSolo/backend/src/workers/deadmanWorker.js)
- [c:\Users\Admin\SafeSolo\backend\src\workers\duressWorker.js](c:/Users/Admin/SafeSolo/backend/src/workers/duressWorker.js)

### Web Admin

- [c:\Users\Admin\SafeSolo\web-admin\src\lib\api.ts](c:/Users/Admin/SafeSolo/web-admin/src/lib/api.ts)
- [c:\Users\Admin\SafeSolo\web-admin\src\routes\index.tsx](c:/Users/Admin/SafeSolo/web-admin/src/routes/index.tsx)
- [c:\Users\Admin\SafeSolo\web-admin\src\routes\users.tsx](c:/Users/Admin/SafeSolo/web-admin/src/routes/users.tsx)

## Ghi chú quan trọng

- File runtime như `backend/data/app-db.json` có thể thay đổi khi test backend. Không nên coi đó là thay đổi code cốt lõi.
- Một số thư mục legacy vẫn còn trong repo để tương thích và tham chiếu trong quá trình migrate.
- Nếu app không check-in được trên emulator, kiểm tra:
  - backend đang chạy chưa
  - đúng `API_BASE_URL` chưa
  - app có user đã đăng nhập chưa

## Hướng phát triển tiếp theo

- Chuẩn hóa toàn bộ text UI sang UTF-8 sạch hoàn toàn
- Ghi âm thật bằng file audio thay vì mock duration
- Push notification thật
- Background geofence / fall detection native
- Hoàn tất migrate các module legacy còn lại sang Mongo 100%

## License

Private project. Nội bộ SafeSolo.
