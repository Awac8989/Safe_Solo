# SafeSolo Backend

Backend hiện tại của SafeSolo là API `Node.js + Express + MongoDB` phục vụ:

- Flutter mobile app
- Web Admin
- Luồng an toàn: check-in, dead-man switch, SOS, guardians, medical, chat, radar

## Trạng thái hiện tại

- MongoDB là nguồn dữ liệu duy nhất cho runtime backend.
- Database mặc định: `Safesolo`
- Default connection string: `mongodb://127.0.0.1:27017/Safesolo`
- Các nhánh Prisma, PostgreSQL, SQLite runtime và JSON store cũ đã được loại khỏi code path chính.

## Tech stack

- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.IO
- BullMQ
- ioredis
- Joi
- JWT
- Multer

## Cấu trúc chính

```text
backend/
├─ scripts/                 Seed và script kiểm tra
├─ src/
│  ├─ config/               MongoDB config
│  ├─ controllers/          HTTP controllers
│  ├─ middleware/           Auth, validation, error handling
│  ├─ models/               Mongoose models
│  ├─ routes/               API routes
│  ├─ services/             Business logic
│  ├─ sockets/              Socket.IO server
│  └─ workers/              Dead-man / duress workers
├─ package.json
└─ server.js
```

## Cài đặt và chạy

### 1. Cài dependency

```powershell
cd c:\Users\Admin\SafeSolo\backend
npm install
```

### 2. Bật MongoDB

Local mặc định:

```text
mongodb://127.0.0.1:27017/Safesolo
```

Bạn có thể override bằng biến môi trường:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/Safesolo
MONGODB_DB_NAME=Safesolo
PORT=4000
JWT_SECRET=your-secret
```

### 3. Chạy API

```powershell
npm run dev
```

Hoặc:

```powershell
npm start
```

Health endpoint:

- [http://127.0.0.1:4000/health](http://127.0.0.1:4000/health)
- [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health)

## Redis có bắt buộc không

Không bắt buộc để API cơ bản hoạt động.

- Nếu Redis chưa bật, API chính vẫn chạy.
- BullMQ worker có thể log `ECONNREFUSED 127.0.0.1:6379`.

Nếu muốn worker realtime ổn định hơn, hãy bật Redis local.

## Scripts hiện có

```powershell
npm run dev
npm start
npm run seed:demo-users
```

### Seed user demo

```powershell
npm run seed:demo-users
```

## Nhóm API chính

### Health

- `GET /health`
- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-otp`
- `POST /api/auth/google-mock`
- `GET /api/auth/profile`
- `PATCH /api/auth/profile`
- `PATCH /api/auth/settings`
- `GET /api/auth/bootstrap`

### User core / Flutter contract

- `POST /api/users/register`
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users/:id/checkin`
- `PATCH /api/users/:id/timer`
- `PATCH /api/users/:id/location`
- `PATCH /api/users/:id/preferences`
- `PATCH /api/users/:id/sleep-mode`

### Alert policy / interactions

- `GET /api/users/:id/alert-policy`
- `PATCH /api/users/:id/alert-policy`
- `GET /api/users/:id/interactions`
- `POST /api/users/:id/interactions`

### Guardians

- `GET /api/guardians`
- `GET /api/guardians/search?q=...`
- `POST /api/guardians/request`
- `POST /api/guardians/respond`
- `DELETE /api/guardians/:relationshipId`
- `GET /api/users/:id/guardians`
- `POST /api/users/:id/guardians`
- `DELETE /api/users/:id/guardians/:phone`

### Medical

- `GET /api/medical`
- `PUT /api/medical`
- `GET /api/users/:id/medical-profile`
- `PUT /api/users/:id/medical-profile`

### Automation / Security / Device signals

- `GET /api/users/:id/automation-settings`
- `PATCH /api/users/:id/automation-settings`
- `GET /api/users/:id/security-settings`
- `PATCH /api/users/:id/security-settings`
- `GET /api/users/:id/device-signals`
- `POST /api/users/:id/device-signals`

### Radar / Rescue

- `POST /api/radar/broadcast`
- `GET /api/radar/nearby`
- `POST /api/radar/:incidentId/accept`
- `GET /api/radar/:incidentId`
- `PUT /api/radar/:incidentId/resolve`

### Chat

- `GET /api/chat/:roomId/messages`
- `POST /api/chat/:roomId/messages`

### Feed / Community

- `POST /api/feed/status`
- `GET /api/feed/circle`
- `GET /api/community/heroes`
- `GET /api/community/heroes/:id`
- `POST /api/community/heroes/:id/thank-you`

### KYC

- `POST /api/kyc/upload`
- `GET /api/admin/kyc`
- `PATCH /api/admin/kyc/:id`

### Admin safety

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/incidents`
- `PATCH /api/admin/incidents/:id/resolve`
- `GET /api/admin/incidents/:id/sms-logs`
- `GET /api/admin/alerts`
- `GET /api/admin/emergencies`
- `PATCH /api/admin/emergencies/:id/resolve`
- `GET /api/admin/emergencies/:id/sms-logs`

## Mongoose models chính

### Core safety

- `User`
- `CheckInHistory`
- `EmergencyLog`
- `AlertEvent`
- `InteractionEvent`
- `AlertPolicy`
- `MedicalProfile`
- `AutomationSetting`
- `SecuritySetting`
- `DeviceSignal`
- `SmsDispatchLog`

### Rescue / chat / community

- `RescueIncident`
- `VolunteerResponse`
- `EmergencyMemo`
- `ChatRoom`
- `Message`
- `DailyStatus`
- `ThankYouNote`
- `SystemLog`

### Other

- `GuardianRelationship`
- `Vault`
- `KYCDocument`

## Luồng chính

### Check-in

1. Mobile gọi `POST /api/users/:id/checkin`
2. Backend cập nhật `lastCheckinTime`, `nextDeadline`
3. Ghi interaction event
4. Web Admin đọc timeline từ Mongo

### Dead-man switch

1. Worker quét user quá hạn
2. Tạo `AlertEvent`
3. Gửi SMS theo escalation khi cần
4. Ghi `SmsDispatchLog`
5. Đẩy dữ liệu cho admin timeline

### Silent SOS / duress

1. User kích hoạt duress flow
2. Backend tạo `RescueIncident`
3. Chat room được nối với incident
4. Volunteer accept sẽ được thêm vào room responders
5. Resolve incident sẽ đóng room sang `READ_ONLY`

### Auto-wipe

1. Worker quét user có `autoWipeDays`
2. Khi đủ điều kiện, dữ liệu nhạy cảm được cập nhật theo policy
3. Ghi `SystemLog`

## File quan trọng nên đọc trước

- [c:\Users\Admin\SafeSolo\backend\server.js](c:/Users/Admin/SafeSolo/backend/server.js)
- [c:\Users\Admin\SafeSolo\backend\src\config\database.js](c:/Users/Admin/SafeSolo/backend/src/config/database.js)
- [c:\Users\Admin\SafeSolo\backend\src\routes\index.js](c:/Users/Admin/SafeSolo/backend/src/routes/index.js)
- [c:\Users\Admin\SafeSolo\backend\src\controllers\userController.js](c:/Users/Admin/SafeSolo/backend/src/controllers/userController.js)
- [c:\Users\Admin\SafeSolo\backend\src\services\authService.js](c:/Users/Admin/SafeSolo/backend/src/services/authService.js)
- [c:\Users\Admin\SafeSolo\backend\src\services\adminPortalService.js](c:/Users/Admin/SafeSolo/backend/src/services/adminPortalService.js)
- [c:\Users\Admin\SafeSolo\backend\src\workers\deadmanWorker.js](c:/Users/Admin/SafeSolo/backend/src/workers/deadmanWorker.js)
- [c:\Users\Admin\SafeSolo\backend\src\workers\duressWorker.js](c:/Users/Admin/SafeSolo/backend/src/workers/duressWorker.js)

## Test nhanh

### Health

```powershell
curl http://127.0.0.1:4000/api/health
```

### List users

```powershell
curl http://127.0.0.1:4000/api/users
```

### Admin overview

```powershell
curl http://127.0.0.1:4000/api/admin/overview
```

## Lưu ý khi commit

Không nên commit:

- `.env`
- secret keys
- token thật
- file runtime phát sinh khi test nếu không cần thiết

## License

Private project. Nội bộ SafeSolo.
