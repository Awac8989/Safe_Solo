# SafeSolo Backend

A comprehensive backend API for the SafeSolo personal safety application, built with Node.js, Express, and PostgreSQL.

## Features

- **Passwordless Authentication**: OTP-based authentication via email
- **User Management**: Complete user profile management
- **Medical Profiles**: Emergency medical information storage
- **Guardian Network**: Connect with emergency contacts and guardians
- **JWT Authorization**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse
- **Clean Architecture**: Well-structured codebase with separation of concerns

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + OTP
- **Validation**: Joi
- **Rate Limiting**: express-rate-limit

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/safesolo_db"
   JWT_SECRET="your-super-secret-jwt-key"
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run database migrations
   npx prisma migrate dev --name init

   # (Optional) Seed database
   npx prisma db seed
   ```

5. **Start the server**
   ```bash
   npm run dev  # Development with nodemon
   # or
   npm start    # Production
   ```

The API will be available at `http://localhost:4000`

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE"
}
```

#### Login (Send OTP)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

### Medical Profile Endpoints

#### Create Medical Profile
```http
POST /api/medical
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "bloodType": "A_POSITIVE",
  "allergies": ["Peanuts", "Penicillin"],
  "medications": ["Lisinopril 10mg"],
  "medicalConditions": ["Hypertension"],
  "emergencyContact": {
    "name": "Jane Doe",
    "phone": "+1234567890",
    "relationship": "Spouse"
  },
  "insuranceInfo": {
    "provider": "Blue Cross",
    "policyNumber": "POL123456",
    "groupNumber": "GRP789"
  }
}
```

### Guardian Network Endpoints

#### Send Guardian Request
```http
POST /api/guardians/request
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "guardianId": "user_id_here",
  "message": "I'd like to add you as my emergency contact"
}
```

#### Get Guardians and Proteges
```http
GET /api/guardians
Authorization: Bearer <jwt_token>
```

#### Search Users
```http
GET /api/guardians/search?q=john&limit=10
Authorization: Bearer <jwt_token>
```

## Community Radar & Spatial Query APIs

### Location Endpoints

#### Update User Location
```http
POST /api/location
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "lat": 21.0285,
  "lng": 105.8542
}
```

#### Get User Location
```http
GET /api/location
Authorization: Bearer <jwt_token>
```

### Radar Endpoints

#### Broadcast SOS
```http
POST /api/radar/broadcast
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "incidentType": "medical_emergency",
  "lat": 21.0285,
  "lng": 105.8542
}
```

#### Get Nearby Incidents (Volunteers)
```http
GET /api/radar/nearby?lat=21.0285&lng=105.8542
Authorization: Bearer <jwt_token>
```

#### Accept Rescue Mission
```http
POST /api/radar/:incident_id/accept
Authorization: Bearer <jwt_token>
```

#### Get Incident Details
```http
GET /api/radar/:incident_id
Authorization: Bearer <jwt_token>
```

#### Resolve Incident (Victim Only)
```http
PUT /api/radar/:incident_id/resolve
Authorization: Bearer <jwt_token>
```

## Emergency Chat & Voice APIs

### Chat Endpoints

#### Upload Voice Message
```http
POST /api/chat/:room_id/upload-voice
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

Form Data:
- voice: File (audio/mpeg, audio/wav, audio/m4a, max 5MB)
```

Response:
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "message_id",
      "roomId": "room_id",
      "senderId": "user_id",
      "messageType": "AUDIO",
      "content": "/uploads/voices/filename.mp3",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "sender": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "avatar_url"
      }
    },
    "fileUrl": "/uploads/voices/filename.mp3"
  }
}
```

#### Get Chat Messages
```http
GET /api/chat/:room_id/messages
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "message_id",
        "roomId": "room_id",
        "senderId": "user_id",
        "messageType": "TEXT|AUDIO|SYSTEM|LOCATION",
        "content": "message content or file URL",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "sender": {
          "id": "user_id",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "avatar_url"
        }
      }
    ]
  }
}
```

### Real-time Communication (Socket.io)

#### Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

#### Join Chat Room
```javascript
socket.emit('join_rescue_room', roomId);

// Listen for join confirmation
socket.on('joined_room', (data) => {
  console.log('Joined room:', data.roomId);
});

// Listen for errors
socket.on('error', (error) => {
  console.error('Socket error:', error.message);
});
```

#### Send Message
```javascript
socket.emit('send_message', {
  roomId: 'room_id',
  messageType: 'TEXT', // TEXT, AUDIO, SYSTEM, LOCATION
  content: 'Hello world!'
});

// Listen for sent confirmation
socket.on('message_sent', (message) => {
  console.log('Message sent:', message);
});

// Listen for new messages from others
socket.on('new_message', (message) => {
  console.log('New message:', message);
});
```

#### Leave Chat Room
```javascript
socket.emit('leave_rescue_room', roomId);
```

## Alive Circle & Community APIs

### Feed Endpoints

#### Create Daily Status
```http
POST /api/feed/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "mood_emoji": "😊",
  "audio_url": "https://example.com/audio.mp3" // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "status_id",
    "userId": "user_id",
    "mood_emoji": "😊",
    "audio_url": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "avatar_url",
      "is_kyc_verified": true
    }
  }
}
```

#### Get Alive Circle Feed
```http
GET /api/feed/circle?limit=20&offset=0
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "statuses": [
      {
        "id": "status_id",
        "userId": "user_id",
        "mood_emoji": "😊",
        "audio_url": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "user": {
          "id": "user_id",
          "firstName": "John",
          "lastName": "Doe",
          "avatar": "avatar_url",
          "is_kyc_verified": true
        }
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "count": 1
    }
  }
}
```

### Community Endpoints

#### Get Hero Profile
```http
GET /api/community/heroes/:id
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "hero_id",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "avatar_url",
    "trust_score": 4.8,
    "rescues_count": 15,
    "is_kyc_verified": true,
    "receivedThankYouNotes": [
      {
        "id": "note_id",
        "content": "Thank you for saving my life!",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "author": {
          "id": "author_id",
          "firstName": "Jane",
          "lastName": "Smith",
          "avatar": "avatar_url"
        }
      }
    ]
  }
}
```

#### Post Thank You Note
```http
POST /api/community/heroes/:id/thank-you
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "Thank you for your bravery and kindness!",
  "rating": 5 // optional, 1-5
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "note_id",
    "volunteerId": "hero_id",
    "authorId": "user_id",
    "content": "Thank you for your bravery and kindness!",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "author": {
      "id": "user_id",
      "firstName": "Jane",
      "lastName": "Smith",
      "avatar": "avatar_url"
    }
  }
}
```

### KYC Endpoints

#### Upload KYC Documents
```http
POST /api/kyc/upload
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

Form Data:
- front_image: File (JPG, JPEG, PNG, max 5MB)
- back_image: File (JPG, JPEG, PNG, max 5MB)
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "kyc_id",
    "userId": "user_id",
    "front_image_url": "/uploads/kyc/front-image.jpg",
    "back_image_url": "/uploads/kyc/back-image.jpg",
    "status": "PENDING",
    "submitted_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## Database Schema

### User Model
- `id`: String (CUID)
- `email`: String (unique)
- `phone`: String (optional, unique)
- `firstName`: String
- `lastName`: String
- `dateOfBirth`: DateTime (optional)
- `gender`: Enum (optional)
- `avatar`: String (optional)
- `isActive`: Boolean (default: true)
- `isVerified`: Boolean (default: false)
- `otpCode`: String (hashed)
- `otpExpiresAt`: DateTime
- `lastLoginAt`: DateTime
- `createdAt`: DateTime
- `updatedAt`: DateTime

### MedicalProfile Model
- `id`: String (CUID)
- `userId`: String (unique, foreign key)
- `bloodType`: Enum (optional)
- `allergies`: String[] (array)
- `medications`: String[] (array)
- `medicalConditions`: String[] (array)
- `emergencyContact`: JSON (optional)
- `insuranceInfo`: JSON (optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### GuardianRelationship Model
- `id`: String (CUID)
- `requesterId`: String (foreign key)
- `guardianId`: String (foreign key)
- `status`: Enum (PENDING, ACCEPTED, REJECTED, BLOCKED)
- `message`: String (optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### ChatRoom Model
- `id`: String (CUID)
- `incidentId`: String (unique, foreign key to RescueIncident)
- `status`: Enum (ACTIVE, READ_ONLY)
- `createdAt`: DateTime
- `closedAt`: DateTime (optional)

### Message Model
- `id`: String (CUID)
- `roomId`: String (foreign key to ChatRoom)
- `senderId`: String (optional, foreign key to User, null for system messages)
- `messageType`: Enum (TEXT, AUDIO, SYSTEM, LOCATION)
- `content`: String (text content or file URL)
- `createdAt`: DateTime

### DailyStatus Model
- `id`: String (CUID)
- `userId`: String (foreign key to User)
- `mood_emoji`: String
- `audio_url`: String (optional)
- `createdAt`: DateTime

### ThankYouNote Model
- `id`: String (CUID)
- `volunteerId`: String (foreign key to User)
- `authorId`: String (foreign key to User)
- `content`: String
- `createdAt`: DateTime

### KYCDocument Model
- `id`: String (CUID)
- `userId`: String (unique, foreign key to User)
- `front_image_url`: String
- `back_image_url`: String
- `status`: Enum (PENDING, APPROVED, REJECTED)
- `submitted_at`: DateTime

## Development

### Available Scripts

- `npm run dev`: Start development server with nodemon
- `npm start`: Start production server
- `npm test`: Run tests (when implemented)

### Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── config/
│   │   └── database.js        # Prisma client setup
│   ├── controllers/           # Route handlers
│   ├── middleware/            # Custom middleware
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   └── utils/                # Utility functions
├── .env.example              # Environment variables template
├── package.json
├── server.js                 # Application entry point
└── README.md
```

## System Logic and Data Flow

### Silent SOS / Duress Code

- Khi người dùng nhập mã PIN giả, frontend gọi `POST /api/emergency/silent-sos`.
- Backend trả ngay `200 { success: true, message: 'Alarm disabled' }` trước khi thực hiện bất kỳ thao tác nặng nào.
- Sau đó, hàm xử lý background tạo một `RescueIncident` mới với:
  - `status = 'ACTIVE'`
  - `incidentType = 'silent_sos'`
  - `severity = 3`
- Backend cũng ghi một dòng `SystemLog` để câu chuyện có thể audit.
- Sau khi incident được tạo, hệ thống phát sự kiện Socket `ADMIN_SILENT_SOS` để Web Admin hoặc tổng đài viên can thiệp.

### Dead Man's Switch (Grace Period)

- Trường dữ liệu `next_checkin_deadline` được lưu trong bảng `User`.
- Worker BullMQ/Redis chạy mỗi phút và quét các user:
  - `next_checkin_deadline < now`
  - không có `RescueIncident` nào đang mở (`ACTIVE`).
- Worker kiểm tra lock Redis để tránh chạy trùng nhiều server.
- Nếu user quá hạn mà chưa có cảnh báo, worker gửi cảnh báo cho guardian cấp 1 (`escalationLevel = 1`).
- Hệ thống cập nhật:
  - `deadmanStage = 1`
  - `deadmanEscalationTriggeredAt`
- Worker đẩy một job delay 5 phút (`escalate-user`) để kiểm tra lại.
- Sau 5 phút, nếu user vẫn chưa check-in và vẫn chưa có incident mở, worker gửi cảnh báo tiếp cho guardian cấp 2.
- Mọi bước đều ghi `SystemLog` để theo dõi và tránh loop gửi tin rác.

### Auto-Wipe / Dead Man's Delete

- Model `Vault` chứa dữ liệu nhạy cảm của user.
- User bật `is_auto_wipe_enabled = true` và cấu hình `auto_wipe_days`.
- Job hàng đêm chạy vào `00:00` bằng BullMQ repeatable job `auto-wipe`.
- Job quét user có `is_auto_wipe_enabled = true` và `auto_wipe_days` khác null.
- Nếu `next_checkin_deadline` của user đã quá hạn hơn `auto_wipe_days`, hệ thống:
  - mã hóa rác hoặc gán `content: { shredded: true }`
  - cập nhật `shreddedAt`
- Job cũng ghi `SystemLog` với hành vi `AUTO_WIPE_EXECUTED`.

## Dữ liệu được lưu như thế nào

### Bảng chính và ý nghĩa

- `users`: thông tin profile, auth, check-in, duress, auto-wipe.
- `rescue_incidents`: các sự kiện cứu hộ khẩn cấp, bao gồm Silent SOS.
- `guardian_relationships`: mạng guardian và cấp độ cảnh báo.
- `chat_rooms` / `messages`: lưu chat thoại và tin nhắn emergencies.
- `system_logs`: nhật ký audit cho automation và cảnh báo.
- `vaults`: dữ liệu nhạy cảm cần xóa hoặc shred.
- `kyc_documents`: hình KYC front/back và trạng thái duyệt.

### Cách lưu file upload

- Voice/audio chat được lưu trong thư mục `backend/uploads/voices`.
- URL file được lưu vào trường `content` của `Message` dưới dạng đường dẫn nội bộ.
- KYC image được lưu trong `backend/uploads/kyc` và đường dẫn lưu vào `KYCDocument`.

### Cơ chế phối hợp giữa API và worker

- API `silent-sos`: ghi `RescueIncident`, kích hoạt socket và audit log.
- Worker `monitor-checkins`: quét user, gửi SMS/Zalo, tạo job delay, update trạng thái user.
- Worker `auto-wipe`: quét vault, shred dữ liệu nhạy cảm, log hành động.

## Deploy and GitHub Push

### 1. Cập nhật code

```bash
cd backend
npm install
```

### 2. Kiểm tra thay đổi

```bash
git status
```

### 3. Thêm thay đổi vào stage

```bash
git add .
```

### 4. Commit với thông điệp rõ ràng

```bash
git commit -m "Add silent SOS duress worker, dead man switch, auto-wipe, and audit logging"
```

### 5. Push lên GitHub

```bash
git push origin <ten-nhanh>
```

### 6. Nếu chưa có nhánh remote

```bash
git checkout -b <ten-nhanh>
git push -u origin <ten-nhanh>
```

### 7. Kiểm tra remote

```bash
git remote -v
```

> Lưu ý: trước khi push, hãy đảm bảo `.env` không được add vào Git và chỉ giữ file cấu hình môi trường cục bộ.

## Security Features

- **JWT Authentication**: Secure token-based auth with 7-day expiration
- **OTP Verification**: 6-digit OTP with 10-minute expiration
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Joi schema validation for all inputs
- **SQL Injection Protection**: Prisma ORM prevents SQL injection
- **CORS**: Configured CORS for cross-origin requests

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "details": ["Validation error details"] // optional
}
```

Common HTTP status codes:

| Status Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation errors) |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `409` | Conflict (duplicate data) |
| `500` | Internal Server Error |

## Contributing

1. Follow the existing code structure and naming conventions
2. Add proper validation for new endpoints
3. Include error handling for all operations
4. Update this README for API changes
5. Test your changes thoroughly

## License

This project is part of the SafeSolo application.
