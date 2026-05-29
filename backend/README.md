# SafeSolo Backend

Backend của SafeSolo dùng `Node.js + Express + MongoDB` để phục vụ:

- ứng dụng Flutter cho người dùng cuối
- web admin điều phối
- các worker an toàn như `dead-man switch`, SOS, rescue, KYC và chat

## Công nghệ

- Node.js
- Express
- MongoDB + Mongoose
- Socket.IO
- Joi
- JWT
- BullMQ / Redis (tùy chọn)

## Cách chạy

```powershell
cd c:\Users\Admin\SafeSolo\backend
npm install
npm run dev
```

Health check:

- [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health)

## Biến môi trường

Ví dụ trong `.env`:

```env
PORT=4000
NODE_ENV=development

MONGODB_URI=mongodb://127.0.0.1:27017/Safesolo
MONGODB_DB_NAME=Safesolo

JWT_SECRET=change-me
JWT_EXPIRE=7d

DATA_ENCRYPTION_KEY_ID=primary
DATA_ENCRYPTION_KEY=replace-with-a-long-random-secret
# DATA_ENCRYPTION_KEYS=primary=current-secret;legacy-2025=older-secret

CORS_ORIGIN=http://127.0.0.1:4173
```

## Cơ sở dữ liệu

Database chính:

```text
mongodb://127.0.0.1:27017/Safesolo
```

Collection chính:

- `users`
- `checkinhistories`
- `alertpolicies`
- `alertevents`
- `interactionevents`
- `medicalprofiles`
- `automationsettings`
- `securitysettings`
- `devicesignals`
- `emergencylogs`
- `rescueincidents`
- `volunteerresponses`
- `chatrooms`
- `messages`
- `emergencymemos`
- `smsdispatchlogs`
- `systemlogs`
- `kycdocuments`
- `vaults`
- `dailystatuses`
- `thankyounotes`

## Kiến trúc mã hóa hiện tại

Backend hiện có lớp mã hóa thật cho dữ liệu nhạy cảm. Cơ chế dùng:

- `AES-256-GCM` cho payload nhạy cảm
- `bcrypt` cho `realPin` và `duressPin`
- `kid` (key id) để hỗ trợ rotate encryption key

### Dữ liệu đang được mã hóa

1. `medicalprofiles`
- lưu payload nhạy cảm trong `encryptedProfile`
- dữ liệu đọc ra API được tự giải mã

2. `vaults`
- `vault.content` được mã hóa bằng `AES-256-GCM`

3. `users`
- `medicalNotes`
- `approxAddress`
- `emergencyContacts`

Các trường này được chuyển vào `users.encryptedSensitive`.  
Để vẫn hỗ trợ truy vấn guardian/feed theo số điện thoại, hệ thống giữ thêm chỉ mục:

- `users.emergencyContactPhones`

4. `messages`
- `content`
- `metadata`

Dữ liệu thật nằm trong `messages.encryptedPayload`.

5. `emergencymemos`
- `victimName`
- `approxAddress`
- `contentUrl`
- `transcript`

Dữ liệu thật nằm trong `emergencymemos.encryptedPayload`.

6. `PIN`
- `users.realPin`
- `users.duressPin`

Hai giá trị này được lưu dạng hash `bcrypt`, không trả ngược plaintext từ backend.

## Rotate encryption key

Backend hỗ trợ cơ chế rotate key bằng hai cách:

### Cách đơn giản

```env
DATA_ENCRYPTION_KEY_ID=primary
DATA_ENCRYPTION_KEY=current-secret
```

### Cách có nhiều key

```env
DATA_ENCRYPTION_KEYS=primary=current-secret;legacy-2025=older-secret
```

Quy tắc:

- key đầu tiên là key hiện tại để mã hóa mới
- payload đã mã hóa sẽ mang theo `kid`
- khi giải mã, backend ưu tiên key theo `kid`, sau đó fallback sang key khác trong keyring

## Script migrate dữ liệu nhạy cảm

Khi đổi key hoặc khi còn dữ liệu cũ chưa mã hóa, dùng:

```powershell
cd c:\Users\Admin\SafeSolo\backend
npm run migrate:encrypt-sensitive
```

Script này sẽ:

- mã hóa lại `medicalprofiles`
- mã hóa lại `vaults`
- hash lại PIN cũ nếu còn plaintext
- mã hóa `users.encryptedSensitive`
- mã hóa lại `messages.encryptedPayload`
- mã hóa lại `emergencymemos.encryptedPayload`

Script cũng dùng được để **re-encrypt sang key mới** sau khi đổi `DATA_ENCRYPTION_KEY_ID` hoặc `DATA_ENCRYPTION_KEYS`.

## Nhóm API chính

### Core user

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

### Rescue / community

- `POST /api/radar/broadcast`
- `GET /api/radar/nearby`
- `POST /api/radar/:incidentId/accept`
- `GET /api/radar/:incidentId`
- `PATCH /api/radar/:incidentId/resolve`

### Chat

- `GET /api/chat/:roomId/messages`
- `POST /api/chat/:roomId/messages`

### Admin

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/incidents`
- `GET /api/admin/alerts`
- `GET /api/admin/incidents/:id/sms-logs`

## Worker nền

### `deadmanWorker`

File:

- `src/workers/deadmanWorker.js`

Nhiệm vụ:

- kiểm tra check-in quá hạn
- nâng cấp trạng thái `SAFE -> REMINDER -> WARNING -> SOS`
- tạo `AlertEvent`
- hỗ trợ auto-wipe theo policy

### `duressWorker`

File:

- `src/workers/duressWorker.js`

Nhiệm vụ:

- xử lý PIN giả / SOS ngầm
- escalation kín

## Tài liệu nên đọc trước

- `server.js`
- `src/config/database.js`
- `src/routes/index.js`
- `src/controllers/userController.js`
- `src/services/authService.js`
- `src/services/chatService.js`
- `src/services/emergencyService.js`
- `src/services/adminPortalService.js`
- `src/workers/deadmanWorker.js`
