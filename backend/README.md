# SafeSolo Backend

Backend của SafeSolo là API `Node.js + Express + MongoDB` phục vụ:

- ứng dụng Flutter cho người dùng cuối
- web-admin điều phối
- luồng an toàn như check-in, SOS, rescue, guardians, medical, chat, KYC

## 1. Công nghệ sử dụng

- Node.js
- Express
- MongoDB + Mongoose
- Socket.IO
- BullMQ
- ioredis
- Joi
- JWT
- Multer

## 2. Kết nối dữ liệu

Database mặc định:

```text
mongodb://127.0.0.1:27017/Safesolo
```

Tên database mặc định:

```text
Safesolo
```

Biến môi trường hỗ trợ:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/Safesolo
MONGODB_DB_NAME=Safesolo
JWT_SECRET=change-me
MAPTILER_KEY=your-key
```

## 3. Cấu trúc thư mục

```text
backend/
├─ scripts/               Seed và script hỗ trợ
├─ src/
│  ├─ config/             Mongo config, Redis config
│  ├─ controllers/        HTTP controllers
│  ├─ lib/                Helper và hạ tầng
│  ├─ middleware/         Auth, validation, error handling
│  ├─ models/             Mongoose models
│  ├─ routes/             API routes
│  ├─ services/           Business logic
│  ├─ sockets/            Socket.IO
│  └─ workers/            Dead-man worker, duress worker
├─ package.json
└─ server.js
```

## 4. Collections chính

| Collection | Vai trò |
| --- | --- |
| `users` | Hồ sơ người dùng và trạng thái check-in |
| `checkinhistories` | Lịch sử điểm danh |
| `alertevents` | Timeline cảnh báo theo cấp |
| `alertpolicies` | Rule thời gian cho reminder, alarm, SOS |
| `interactionevents` | Các tương tác như check-in, mood, status |
| `guardianrelationships` | Liên hệ khẩn cấp / guardians |
| `medicalprofiles` | Hồ sơ y tế và dữ liệu QR |
| `automationsettings` | Reminder, fall detection, shake SOS, geofence |
| `securitysettings` | Stealth, auto-wipe, encryption |
| `devicesignals` | Tín hiệu từ cảm biến và vị trí |
| `emergencylogs` | Nhật ký SOS và sự cố |
| `rescueincidents` | Ca cứu hộ cộng đồng |
| `volunteerresponses` | Người tình nguyện đã nhận ca |
| `chatrooms` | Phòng chat gia đình, cộng đồng, cứu hộ |
| `messages` | Tin nhắn văn bản và voice note |
| `emergencymemos` | Memo khẩn cấp, voice note, toạ độ |
| `smsdispatchlogs` | Nhật ký gửi SMS |
| `systemlogs` | Audit log hệ thống |
| `kycdocuments` | Dữ liệu KYC volunteer |
| `vaults` | Két sinh tử |
| `dailystatuses` | Status feed / Alive Circle |
| `thankyounotes` | Lời cảm ơn gửi hiệp sĩ |

## 5. Nhóm API

### Core / user

Tập trung trong `src/routes/index.js`:

- `GET /api/health`
- `GET /api/users`
- `POST /api/users/register`
- `POST /api/users/:id/checkin`
- `GET /api/users/:id/interactions`
- `GET /api/users/:id/alert-policy`
- `PATCH /api/users/:id/alert-policy`
- `GET /api/users/:id/medical-profile`
- `PUT /api/users/:id/medical-profile`
- `GET /api/users/:id/automation-settings`
- `PATCH /api/users/:id/automation-settings`
- `GET /api/users/:id/security-settings`
- `PATCH /api/users/:id/security-settings`
- `GET /api/users/:id/device-signals`
- `POST /api/users/:id/device-signals`

### Auth

`src/routes/authRoutes.js`

- đăng nhập
- xác thực token
- bootstrap session

### Guardians / Medical / Location

- `guardianRoutes.js`
- `medicalRoutes.js`
- `locationRoutes.js`

### Emergency / Radar / Community

- `emergencyRoutes.js`
- `radarRoutes.js`
- `communityRoutes.js`
- `feedRoutes.js`

Các nhóm này xử lý:

- broadcast sự cố
- rescue incident
- volunteer response
- feed cộng đồng
- status nhanh
- heroes / bảng xếp hạng hỗ trợ

### Chat

`chatRoutes.js`

- tạo phòng chat
- đọc tin nhắn
- gửi tin nhắn
- gửi voice note

### KYC

`kycRoutes.js`

- gửi hồ sơ KYC
- duyệt / từ chối
- phục vụ volunteer onboarding

### Admin

`adminPortalRoutes.js`

- overview
- users
- incidents
- alerts
- SMS logs
- audit / admin timeline
- export / dữ liệu điều phối

## 6. Workers nền

### Dead-man worker

File: `src/workers/deadmanWorker.js`

Nhiệm vụ:

- kiểm tra thời gian check-in của user
- đánh dấu reminder / warning / SOS
- tạo `AlertEvent`
- hỗ trợ auto-wipe theo policy

### Duress worker

File: `src/workers/duressWorker.js`

Nhiệm vụ:

- xử lý luồng PIN giả / SOS ngầm
- hỗ trợ escalation không hiển thị trên client

## 7. Cài đặt và chạy

### Cài dependency

```powershell
cd c:\Users\Admin\SafeSolo\backend
npm install
```

### Chạy dev

```powershell
npm run dev
```

### Chạy production

```powershell
npm start
```

### Health check

```text
http://127.0.0.1:4000/api/health
```

## 8. Seed dữ liệu demo

Tạo user demo:

```powershell
npm run seed:demo-users
```

Script này dùng để:

- seed người dùng mẫu
- tạo dữ liệu đủ cho app và admin test

## 9. Socket và realtime

Backend có hỗ trợ realtime qua Socket.IO cho:

- timeline sự cố
- thay đổi trạng thái rescue
- cập nhật chat room
- các tín hiệu admin dashboard

## 10. Ghi chú vận hành

- Redis không bắt buộc để `health` API hoạt động, nhưng một số queue/log realtime sẽ báo cảnh báo nếu Redis chưa bật
- khi test máy thật Android, backend phải mở qua IP LAN thay vì `10.0.2.2`
- key bản đồ không nên hardcode; dùng `.env` hoặc config local

## 11. File quan trọng nên đọc đầu tiên

- `server.js`
- `src/config/database.js`
- `src/routes/index.js`
- `src/controllers/userController.js`
- `src/services/adminPortalService.js`
- `src/services/emergencyService.js`
- `src/services/chatService.js`
- `src/workers/deadmanWorker.js`

## 12. Mục tiêu hiện tại của backend

Backend được tổ chức để phục vụ 3 lớp:

1. `Safety core`
   - check-in
   - alert policies
   - escalation

2. `Rescue & community`
   - rescue incident
   - volunteer response
   - chat / feed / heroes

3. `Admin orchestration`
   - dashboard
   - incident handling
   - audit
   - user management
