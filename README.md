# 🛡️ SAFESOLO - HỆ THỐNG CẢNH BÁO KHẨN CẤP TỰ ĐỘNG & ĐIỀU PHỐI CỨU HỘ THỜI GIAN THỰC
> **Autonomous Emergency Alert & Real-time Rescue Dispatch Ecosystem**  
> *Hệ sinh thái Cứu hộ Đa nền tảng: Flutter Mobile (Android/iOS) • Samsung Galaxy Watch 5 (Wear OS 4.0) • Web Admin Dispatch Portal • Cloud Backend Node.js / MongoDB • SoloCare AI & DSP Signal Processing*

<p align="center">
  <img src="https://img.shields.io/badge/Flutter-3.24+-02569B?style=for-the-badge&logo=flutter&logoColor=white" alt="Flutter" />
  <img src="https://img.shields.io/badge/Wear_OS-4.0_OneUI-4285F4?style=for-the-badge&logo=wear-os&logoColor=white" alt="Wear OS" />
  <img src="https://img.shields.io/badge/Node.js-18.x_%2F_20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas_%2F_Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.IO-4.8.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/React_18-Vite_%2B_TanStack-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Vite" />
  <img src="https://img.shields.io/badge/AI_Engine-SoloCare_AI_24%2F7-10B981?style=for-the-badge&logo=openai&logoColor=white" alt="SoloCare AI" />
  <img src="https://img.shields.io/badge/Tests_Passing-100%25_All_Passed-brightgreen?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Tests Passing" />
  <img src="https://img.shields.io/badge/Code_Analysis-0_Errors_0_Warnings-blue?style=for-the-badge" alt="Code Analysis" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

---

## 📌 THÔNG TIN ĐỒ ÁN TỐT NGHIỆP
* **Tên đề tài:** Thiết kế và xây dựng hệ thống cảnh báo khẩn cấp tự động và điều phối cứu hộ thời gian thực - SafeSolo
* **Sinh viên thực hiện:** **Đoàn Minh Quân**
* **Mã số sinh viên:** **2224801030137**
* **Lớp:** **KTPM03**
* **Chuyên ngành:** Kỹ thuật Phần mềm (Software Engineering)
* **Khóa học:** 2022 - 2026

---

## 📑 MỤC LỤC
1. [Tổng quan Hệ thống & Giá trị Thực tiễn](#-tổng-quan-hệ-thống--giá-trị-thực-tiễn)
2. [Kiến trúc Tổng thể Hệ thống (System Architecture)](#-kiến-trúc-tổng-thể-hệ-thống-system-architecture)
3. [Chi tiết 5 Phân hệ Giao diện & Tính năng Ứng dụng Di động](#-chi-tiết-5-phân-hệ-giao-diện--tính-năng-ứng-dụng-di-động)
   - [3.1. Tab 1: Giao diện Điểm danh & Quả cầu An toàn (Safety Orb)](#31-tab-1-giao-diện-điểm-danh--quả-cầu-an-toàn-safety-orb)
   - [3.2. Tab 2: Quỹ đạo Thân yêu Alive Circle (The Orbit & Night Shield)](#32-tab-2-quỹ-đạo-thân-yêu-alive-circle-the-orbit--night-shield)
   - [3.3. Tab 3: Hộp thư Tin nhắn & Bộ đàm Cứu nguy (Messenger & PTT)](#33-tab-3-hộp-thư-tin-nhắn--bộ-đàm-cứu-nguy-messenger--ptt)
   - [3.4. Tab 4: Mạng lưới Hiệp sĩ Cứu hộ Cộng đồng (Heroes Network)](#34-tab-4-mạng-lưới-hiệp-sĩ-cứu-hộ-cộng-đồng-heroes-network)
   - [3.5. Tab 5: Cài đặt Hệ thống & Thiết bị Đeo Thông minh (Settings)](#35-tab-5-cài-đặt-hệ-thống--thiết-bị-đeo-thông-minh-settings)
4. [Các Phân hệ Nền tảng Mở rộng trong Hệ sinh thái](#-các-phân-hệ-nền-tảng-mở-rộng-trong-hệ-sinh-thái)
   - [4.1. Thiết bị Đeo Thông minh Wear OS (Samsung Galaxy Watch 5)](#41-thiết-bị-đeo-thông-minh-wear-os-samsung-galaxy-watch-5)
   - [4.2. Cloud Backend & Micro-Workers Engine (Node.js / Express / MongoDB)](#42-cloud-backend--micro-workers-engine-nodejs--express--mongodb)
   - [4.3. Trung tâm Điều phối Web Admin (React 18 / Vite / TanStack)](#43-trung-tâm-điều-phối-web-admin-react-18--vite--tanstack)
5. [Trợ lý Khẩn cấp SoloCare AI & Bộ Công cụ Liên lạc Tác chiến](#-trợ-lý-khẩn-cấp-solocare-ai--bộ-công-cụ-liên-lạc-tác-chiến)
   - [SoloCare AI First Aid Companion](#solocare-ai-first-aid-companion)
   - [Walkie-Talkie Push-to-Talk (PTT)](#walkie-talkie-push-to-talk-ptt)
   - [Cuộc gọi Thoát hiểm Giả lập (Fake Escape Call)](#cuộc-gọi-thoát-hiểm-giả-lập-fake-escape-call)
   - [Tổng đài Khẩn cấp 115 & SMS Tức thời](#tổng-đài-khẩn-cấp-115--sms-tức-thời)
6. [Giải pháp Vận hành 24/24 & Báo cáo 1 Tháng trên 5 Thiết bị Đa Mạng](#-giải-pháp-vận-hành-2424--báo-cáo-1-tháng-trên-5-thiết-bị-đa-mạng)
7. [13 Thuật toán AI, DSP & Toán học Cốt lõi](#-13-thuật-toán-ai-dsp--toán-học-cốt-lõi)
8. [Cơ chế Điều phối Cứu hộ Đa kênh (Omnichannel Dispatch)](#-cơ-chế-điều-phối-cứu-hộ-đa-kênh-omnichannel-dispatch)
9. [Cấu trúc Cơ sở Dữ liệu (MongoDB Collections)](#-cấu-trúc-cơ-sở-dữ-liệu-mongodb-collections)
10. [Bộ sưu tập Ảnh Chụp Thực tế Chức năng (Demo Screenshots Gallery)](#-bộ-sưu-tập-ảnh-chụp-thực-tế-chức-năng-demo-screenshots-gallery)
11. [Hướng dẫn Cài đặt & Vận hành Từng bước](#-hướng-dẫn-cài-đặt--vận-hành-từng-bước)
12. [Hệ thống Kiểm thử Tự động & Chất lượng Mã nguồn](#-hệ-thống-kiểm-thử-tự-động--chất-lượng-mã-nguồn)
13. [Cấu trúc Mã nguồn Dự án](#-cấu-trúc-mã-nguồn-dự-án)
14. [Tác giả & Bản quyền](#-tác-giả--bản-quyền)

---

## 🌟 TỔNG QUAN HỆ THỐNG & GIÁ TRỊ THỰC TIỄN

Trong kỷ nguyên đô thị hóa và xu hướng sống độc thân (solo living) gia tăng nhanh chóng, các rủi ro sức khỏe bất ngờ (đột quỵ, nhồi máu cơ tim, trượt ngã trong nhà tắm dẫn đến bất tỉnh) hoặc các tình huống khẩn cấp an ninh (bị khống chế, cướp giật, theo dõi ban đêm) thường dẫn tới những hậu quả thương tâm do nạn nhân **mất hoàn toàn khả năng với tay lấy điện thoại bấm gọi cứu hộ**.

**SafeSolo** ra đời nhằm giải quyết triệt để bài toán này thông qua triết lý kiến trúc:
> **"Edge-First Autonomous Detection + Cloud Real-time Omnichannel Dispatch + Community Hero Radar + Alive Family Circle"**  
*(Phát hiện tự động tại thiết bị biên ngay cả khi ngắt mạng • Điều phối cứu hộ đám mây đa kênh thời gian thực • Mạng lưới Hiệp sĩ cứu trợ cộng đồng • Quỹ đạo gắn kết an tâm gia đình)*

### Điểm nổi bật vượt trội của SafeSolo:
1. **Phát hiện Sinh tồn Bất thường Tự động:** Giám sát liên tục tín hiệu quang học PPG BioActive và cảm biến gia tốc kế 3 trục IMU từ đồng hồ Samsung Galaxy Watch 5. Tự động nhận diện nhịp tim bất thường ($BPM < 45$ hoặc $> 130$), thiếu oxy máu ($SpO_2 < 90\%$), và té ngã mạnh ($SVM > 2.5g$ kết hợp nghiêng cơ thể $\theta > 60^\circ$).
2. **Cơ chế Điểm danh Sinh tồn (Dead-man's Switch):** Thiết lập chu kỳ hẹn giờ an toàn (1h - 72h). Nếu người dùng trễ hạn điểm danh và không phản hồi chuông báo thức tỉnh, hệ thống tự động kích hoạt tiến trình cứu hộ khẩn cấp.
3. **Quỹ đạo Gia đình Alive Circle (The Orbit):** Trực quan hóa mối liên kết an tâm giữa các thành viên qua bản đồ vệ tinh chuyển động quanh người dùng, tích hợp Chế độ Khóa đêm và Buồng lái hộ tống ảo giám sát lộ trình di chuyển trực tiếp.
4. **Kích hoạt Khẩn cấp Đa phương thức:** Nhấn SOS 1-chạm, giật mạnh lắc máy liên tục khi bị khống chế (*Shake-to-SOS*), khẩu lệnh kêu cứu rảnh tay (*Keyword Spotting*), hoặc nhập mật mã cưỡng bức ngụy trang (*Duress PIN*) trong ứng dụng máy tính bỏ túi giả lập (*Fake Calculator*).
5. **Trợ lý Sơ cứu SoloCare AI Thuần Việt:** Ứng dụng mô hình trí tuệ nhân tạo tốc độ cao hỗ trợ tức thời (sơ cứu vết thương, bỏng, dị ứng thuốc, trấn an tâm lý, luyện thở 4-7-8, ép tim CPR với âm nhịp metronome chuẩn 100-120 BPM, và gọi nhanh 115).
6. **Mạng lưới Hiệp sĩ Cứu trợ (Community Hero Radar):** Quét định vị trắc địa Haversine tìm kiếm các tình nguyện viên đã xác thực danh tính trong bán kính $1 - 5\text{ km}$, tích hợp 1-chạm dẫn đường tức thì qua **Waze Navigation** và **Google Maps**.
7. **Điều phối Cứu hộ Đa kênh Đồng thời (Omnichannel Dispatch):** Bắn tin đồng thời qua 4 kênh: Telegram Bot Webhook, Zalo ZNS Template, Twilio SMS Gateway và Cuộc gọi tổng đài tự động đọc giọng nói (*Voice Auto-Call Level 4*).
8. **Vận hành Bền bỉ 24/24:** Cấu hình Android Foreground Service, vượt qua giới hạn tiết kiệm pin Android Doze mode (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), hỗ trợ đổi Server URL linh hoạt để chạy kiểm thử liên tục suốt 1 tháng trên 5 thiết bị khác nhau qua mạng 4G/Wi-Fi.

---

## 🏗️ KIẾN TRÚC TỔNG THỂ HỆ THỐNG (SYSTEM ARCHITECTURE)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             THIẾT BỊ BIÊN (EDGE DEVICES TIER)                          │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│ 📱 FLUTTER MOBILE APP (Android 8.0 - 14+)  │ ⌚ SAMSUNG GALAXY WATCH 5 (Wear OS 4.0)    │
│ • Safety Orb & Dead-man's Check-in Loop   │ • PPG BioActive Optical Sensor             │
│ • Alive Circle: The Orbit & Night Shield  │ • 3-Axis IMU Sensor (Acc X/Y/Z, Gyro)      │
│ • Live Safety Cockpit & AI Safety Capsule │ • Thuật toán té ngã (SVM & Tilt Kinematics)│
│ • Stealth Mode (Fake Calculator / Duress) │ • 7 Màn hình One UI Watch độc lập          │
│ • Shake-to-SOS & Keyword Spotting         │ • SafeSolo Smartwatch Protocol (SSWP v1.0) │
│ • SoloCare AI & CPR Metronome (100 BPM)   │ • Rung cảnh báo Haptic Feedback            │
│ • Walkie-Talkie PTT & Fake Escape Call    │ • Hardware SOS & Two-way Find Device       │
│ • 24/7 Foreground Service & Battery Keep  │ • Trực tiếp điểm danh từ cổ tay            │
└─────────────────────┬─────────────────────┴──────────────────────┬─────────────────────┘
                      │                                            │
                      │ RESTful API (HTTPS) / Socket.IO Duplex     │ POST /api/users/device-signal
                      ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   CLOUD BACKEND & WORKER ENGINE (Node.js • Express • MongoDB)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Authentication Hub (Phone OTP, Google OAuth / Gmail OTP, Telegram Bot Pairing)       │
│ • Real-time Socket.IO Duplex Telemetry Streaming                                       │
│ • Deadman Background Worker: Tự động quét và phát hiện trễ hạn điểm danh               │
│ • Duress & Stealth Worker: Giải mã báo động câm và kích hoạt điều phối ngầm            │
│ • Geospatial Haversine Radar: Truy vấn bán kính Hiệp sĩ 1 - 5 km                       │
│ • Disaster Alert & Geofence Service: Quản lý và phát tin thiên tai khẩn cấp            │
│ • AES-256 GCM Cryptographic Engine: Mã hóa tuyệt đối dữ liệu y tế và CCCD             │
└─────────────────────┬────────────────────────────────────────────┬─────────────────────┘
                      │ Webhook / API Dispatch                     │ Socket.IO Events / GeoJSON
                      ▼                                            ▼
┌───────────────────────────────────────────┐ ┌──────────────────────────────────────────┐
│   ĐIỀU PHỐI ĐA KÊNH (OMNICHANNEL ENGINE)  │ │  TRUNG TÂM ĐIỀU PHỐI WEB ADMIN DISPATCH  │
├───────────────────────────────────────────┤ ├──────────────────────────────────────────┤
│ 🤖 1. Telegram Emergency Bot Webhook      │ │ 🗺️ Live SOS Map: Giám sát tọa độ cứu hộ  │
│ 💬 2. Zalo ZNS Official API Notification   │ │ 🪪 KYC Manager: Duyệt CCCD 2 mặt         │
│ 📱 3. Twilio SMS Gateway (GSM fallback)   │ │ 📡 Omnichannel Console: Giám sát phát tin│
│ 📞 4. Voice Auto-Call Level 4 (TTS Speech)│ │ 📢 Disaster Broadcast: Phát tin bão lũ   │
│                                           │ │ 📈 30-Day Health & Incident Analytics    │
└───────────────────────────────────────────┘ └──────────────────────────────────────────┘
```

---

## 📱 CHI TIẾT 5 PHÂN HỆ GIAO DIỆN & TÍNH NĂNG ỨNG DỤNG DI ĐỘNG

Ứng dụng di động SafeSolo được phát triển hoàn chỉnh trên nền tảng **Flutter**, thiết kế theo tiêu chuẩn công thái học cao cấp với ngôn ngữ hoàn toàn **Thuần Việt**, gần gũi và ấm áp:

### 3.1. Tab 1: Giao diện Điểm danh & Quả cầu An toàn (Safety Orb)
* **Quả cầu An toàn Tương tác (Safety Orb):** Vòng hào quang phát sáng đổi màu sinh động theo thời gian thực (Xanh ngọc: Đang an toàn; Vàng: Sắp tới hạn; Đỏ: Quá hạn điểm danh). Chạm vào Quả cầu mở hộp thoại điểm danh kèm 4 mức tâm trạng (*Vui vẻ, Bình an, Hơi mệt, Cần lưu ý*).
* **Đồng hồ Đếm ngược Sinh tồn (Dead-man's Countdown):** Đếm ngược định dạng `HH:mm:ss` tới hạn chót an toàn, hiển thị giờ điểm danh cuối cùng và biểu tượng cảm xúc.
* **Tác vụ Thói quen Nhanh (Routine Quick Actions):**
  - `⏰ Hoãn 30p`: Cho phép lùi thời gian điểm danh thêm 30 phút khi đang bận công việc hoặc nghỉ ngơi.
  - `📷 Khoảnh khắc`: Gửi nhanh thông điệp an tâm và ghi chú ngắn kèm trạng thái bình an.
  - `💊 Đã uống thuốc`: Ghi nhận thói quen dùng thuốc đúng giờ và cập nhật trạng thái an toàn.
* **Thẻ Người bảo hộ Trực tuyến:** Hiển thị trực quan người giám hộ đại diện gia đình (`Mẹ Lan - Người thân`), kèm phần trăm pin thiết bị và trạng thái kết nối mạng thời gian thực.
* **Bản tin Thiên tai Khẩn cấp Trực tiếp (Live Disaster Alert):** Tự động nhận diện vị trí và hiển thị bản tin cảnh báo thời gian thực từ Ban chỉ huy 115/114 (Ví dụ: Cảnh báo sạt lở đất đá & lũ quét Đèo Prenn KM 226), cung cấp lộ trình di chuyển an toàn và nút mở bản đồ sơ tán.
* **Thẻ Trợ lý SoloCare AI 24/7:** Truy cập nhanh trợ lý sơ cứu khẩn cấp với mô tả thuần Việt *"Sơ cứu · Dùng thuốc · Trấn an tức thì"*.

---

### 3.2. Tab 2: Quỹ đạo Thân yêu Alive Circle (The Orbit & Night Shield)
* **Nghi thức Bình an & Khóa đêm (Night Shield):** Thanh công cụ kích hoạt rào chắn bảo vệ ban đêm chỉ với 1 chạm trước khi đi ngủ, tự động chuyển điện thoại vào khung giờ yên tĩnh và kích hoạt cảm biến giám sát ngầm.
* **Bản đồ Quỹ đạo An tâm (The Orbit Visualizer):** Mô phỏng mối gắn kết gia đình dưới dạng hệ quỹ đạo vũ trụ sinh động: người dùng đứng ở trung tâm, các thành viên thân yêu xoay quanh theo từng quỹ đạo riêng biệt với trạng thái sinh tồn cụ thể (*Ở nhà, Đi đường, Đang ngủ, Chạm để đồng điệu*).
* **Buồng lái Hộ tống Ảo (Live Safety Cockpit):** Giám sát trực tiếp lộ trình của người thân đang di chuyển ngoài đường:
  - Hiển thị điểm đến (Ví dụ: *Phòng trọ Linh Cầu Giấy*), thời gian dự kiến đến và khoảng cách còn lại.
  - 3 chỉ số buồng lái thời gian thực: Độ ồn môi trường (`42 dB`), Mức pin an toàn (`38%`), Vận tốc phương tiện (`26 km/h`).
  - Phím gọi `Bộ đàm nhanh` và chế độ `Cùng ngắm nhìn` đồng hành từ xa.
* **Bưu thiếp Bình an 24h (AI Safety Capsule):** Bưu thiếp tóm tắt hành trình sống an toàn mỗi ngày, ghi nhận số bước chân, trạng thái sinh tồn và gửi năng lượng bình an cho người thân.

---

### 3.3. Tab 3: Hộp thư Tin nhắn & Bộ đàm Cứu nguy (Messenger & PTT)
* **Phím tắt Cứu nguy Đầu trang:**
  - `Bộ đàm PTT`: Kênh thoại tức thì kết nối trực tiếp hai chiều như máy bộ đàm chuyên dụng.
  - `Gọi thoát hiểm`: Kích hoạt cuộc gọi ngụy trang để thoát khỏi các tình huống khẩn cấp, bị đeo bám hoặc quấy rối.
* **Phân luồng Hộp thư Thông minh:**
  - `GIA ĐÌNH`: Luồng cập nhật thông báo điểm danh và trò chuyện an tâm thường nhật.
  - `HIỆP SĨ HỖ TRỢ`: Kênh liên lạc trực tiếp với tình nguyện viên cứu hộ, hiển thị mức pin và phím gọi 115.
  - `CỘNG ĐỒNG ALIVE CIRCLE`: Nơi tiếp nhận các lời chúc bình an và tin tức an toàn khu vực.

---

### 3.4. Tab 4: Mạng lưới Hiệp sĩ Cứu hộ Cộng đồng (Heroes Network)
* **Thẻ Hiệp sĩ Đã Xác thực Danh tính:** Xác nhận tài khoản đã được kiểm chứng thông tin định danh đầy đủ, mở quyền truy cập vào **BÀN TÁC CHIẾN**.
* **Chế độ Tác chiến Hiệp sĩ [SẴN SÀNG]:** Tích hợp Radar quét tọa độ SOS trong bán kính 3km, HUD cứu hộ dẫn đường hiện trường, Bộ đàm PTT và Thẻ định danh cứu hộ.
* **Thẻ Hiệp sĩ Tiêu biểu & Bảng vàng Vinh danh:** Xếp hạng các tình nguyện viên hỗ trợ tích cực nhất trong khu vực, hiển thị số lần cứu trợ, điểm đánh giá uy tín (4.9⭐) và khoảng cách địa lý. Cho phép nạn nhân gửi lời cảm ơn và đánh giá sau khi tiếp cứu thành công.

---

### 3.5. Tab 5: Cài đặt Hệ thống & Thiết bị Đeo Thông minh (Settings)
* **Hạn Điểm Danh An Toàn:** Thanh trượt trực quan cho phép tùy chỉnh chu kỳ đếm ngược từ 1 giờ đến 72 giờ (mặc định 12h/lần).
* **Khung giờ Yên tĩnh (Quiet Hours):** Cấu hình khung giờ ngủ (23:00 - 06:00) để không làm phiền ban đêm.
* **Chế độ Nghỉ phép (Vacation Mode):** Tạm dừng đếm ngược khi đi du lịch hoặc có người thân ở bên cạnh.
* **Cảm biến & Tự động hóa:** Tích hợp đếm bước chân, tính lượng calo tiêu hao, phát hiện té ngã và kết nối đồng hồ thông minh Wear OS.
* **Cấu hình Địa chỉ Máy chủ Linh hoạt:** Cho phép chuyển đổi URL máy chủ khi kiểm thử thực tế trên nhiều mạng khác nhau.

---

## ⌚ CÁC PHÂN HỆ NỀN TẢNG MỞ RỘNG TRONG HỆ SINH THÁI

### 4.1. Thiết bị Đeo Thông minh Wear OS (Samsung Galaxy Watch 5)
* **Giao thức Chuẩn hóa SafeSolo Smartwatch Protocol (SSWP v1.0):** Giao tiếp hai chiều với điện thoại qua Bluetooth LE / Wi-Fi Socket, độ trễ $< 200\text{ ms}$.
* **7 Màn hình Tròn One UI Watch Độc lập:**
  1. `WatchScreen.dashboard`: Màn hình chính hiển thị giờ, nhịp tim, SpO2, bước chân và trạng thái kết nối.
  2. `WatchScreen.checkin`: Chạm 1 chạm để điểm danh an toàn tức thì từ cổ tay.
  3. `WatchScreen.warning`: Cảnh báo tiền báo động rung phản hồi khi phát hiện chỉ số bất thường.
  4. `WatchScreen.sos`: Màn hình đếm ngược 30 giây hủy báo động trước khi tự động bắn tin cứu hộ.
  5. `WatchScreen.health`: Ma trận chỉ số PPG và IMU thời gian thực.
  6. `WatchScreen.medical`: Hiển thị nhóm máu và thông tin cấp cứu trực quan trên mặt đồng hồ.
  7. `WatchScreen.settings`: Điều chỉnh độ nhạy té ngã, ngưỡng nhịp tim và rung xúc giác.
* **Phím cứng Hardware SOS & Tìm thiết bị hai chiều:** Nhấn giữ phím vật lý trên đồng hồ để phát báo động khẩn cấp; hỗ trợ rung chuông tìm đồng hồ từ điện thoại và ngược lại.

---

### 4.2. Cloud Backend & Micro-Workers Engine (Node.js • Express • MongoDB)
* **Xác thực Đa phương thức:** Đăng nhập an toàn qua Số điện thoại OTP, Google OAuth / Gmail OTP, và liên kết tài khoản Telegram Bot cá nhân.
* **Động cơ Socket.IO Đa kênh:** Đồng bộ tức thời vị trí GPS, nhịp tim, sự kiện té ngã giữa Mobile App, Smartwatch và Web Admin Portal.
* **Deadman Background Worker:** Lập trình định kỳ quét kiểm tra hạn điểm danh của từng người dùng; tự động kích hoạt cảnh báo cấp độ 1 (nhắc nhở qua Push/SMS) và cấp độ 2 (phát tin cứu hộ) khi quá hạn.
* **Duress & Stealth Worker:** Phân tích mã PIN ngụy trang, kích hoạt quy trình cứu hộ âm thầm mà không hiển thị bất kỳ dấu hiệu nào trên màn hình nạn nhân.
* **Truy vấn Trắc địa Haversine:** Tìm kiếm và xếp hạng các Hiệp sĩ cứu hộ lân cận nạn nhân trong phạm vi $1 - 5\text{ km}$ theo thời gian thực.
* **Bảo mật AES-256 GCM:** Mã hóa toàn bộ dữ liệu thẻ Căn cước công dân và hồ sơ y tế nhạy cảm trước khi lưu vào MongoDB.

---

### 4.3. Trung tâm Điều phối Web Admin (React 18 / Vite / TanStack) & Động cơ Bán Tự Động HITL
* **Hệ thống Điều phối Bán Tự Động HITL (Human-in-the-Loop Semi-Autonomous Dispatch Engine):**
  - **Tự động hóa phản ứng mili-giây:** Phân loại nguy cơ khẩn cấp (P1 Critical, P2 Urgent, P3 Monitoring), quét 3 Hiệp sĩ SafeSolo lân cận trong bán kính $< 1\text{ km}$, và gợi ý bệnh viện cấp cứu gần nhất.
  - **Bộ đếm ngược an toàn (Grace Period 30s Countdown):** Khi có sự cố nguy kịch P1, màn hình chớp đỏ và đếm ngược 30 giây:
    + 🔴 `[HỦY / BÁO ĐỘNG GIẢ]`: Chặn phát lệnh tức thì, lưu lý do và mã băm SHA-256 để chống lãng phí nguồn lực công.
    + 🟢 `[DUYỆT ĐIỀU PHỐI NGAY]`: Bỏ qua thời gian chờ 30 giây, phát lệnh tức thì đến đội cứu hộ.
    + 🟡 `[TẠM DỪNG / TIẾP TỤC]`: Đóng băng bộ đếm ngược để xác minh thêm hoặc đổi đội cứu hộ.
    + ⚡ `[FAIL-SAFE AUTO-ESCALATION]`: Nếu hết 30 giây không phản hồi, hệ thống tự động kích hoạt cứu hộ Tier 2 gửi tin khẩn cấp.
* **Phát sóng Cảnh báo Thiên tai & Vùng nguy hiểm (Disaster Broadcast & Danger Geofence):** Cho phép ban chỉ huy vẽ vùng nguy hiểm và phát sóng cảnh báo lũ lụt, sạt lở trực tiếp đến toàn bộ cư dân trong khu vực.
* **Bản đồ Cứu hộ Thời gian thực (Live SOS Map):** Tương tác cao qua MapLibre GL, hiển thị tâm chấn vụ việc, lộ trình di chuyển của nạn nhân và vị trí các hiệp sĩ phản ứng nhanh.
* **Bảng điều khiển Giám sát Đa kênh (Omnichannel Live Console):** Theo dõi 4 luồng tin cứu hộ đồng thời: Telegram, Zalo ZNS, Twilio SMS và Voice Auto-Call.
* **Hộp đen Kiểm toán Bất biến (Cryptographic SHA-256 Audit Trail):** Lưu vết toàn bộ lịch sử thao tác của AI và Điều phối viên không thể tẩy xóa phục vụ đối soát pháp lý.

---

## 🤖 TRỢ LÝ KHẨN CẤP SOLOCARE AI & BỘ CÔNG CỤ LIÊN LẠC TÁC CHIẾN

### SoloCare AI First Aid Companion
* **Mô hình Trí tuệ Nhân tạo Siêu tốc:** Tích hợp mô hình ngôn ngữ lớn tốc độ cao trên nền tảng đám mây Groq Cloud với thời gian phản hồi cực nhanh ($< 1\text{ giây}$).
* **Giao diện Thuần Việt Thân thiện:** Đóng vai trò là *"Trợ lý 24/7"* chuyên trách sơ cứu, hỗ trợ vết thương, dị ứng thuốc và trấn an tâm lý khẩn cấp mà không lộ các thông số kỹ thuật khô cứng.
* **Kịch bản Sơ cứu Tức thời 1-Chạm:** Các thẻ gợi ý thông dụng cho người sống một mình:
  - 🩹 **Đứt tay chảy máu**: Quy trình cầm máu và băng bó chuẩn vô trùng.
  - 🔥 **Bỏng bô xe máy / Bỏng nhiệt**: Hạ nhiệt bằng nước mát, chống phồng rộp.
  - 💊 **Đau bụng / Sốt cao / Dị ứng thuốc**: Kiểm tra phản ứng phụ và liều dùng thông thường.
  - 🧘 **Trấn an hoảng loạn (Luyện thở 4-7-8)**: Hướng dẫn thở sâu điều hòa nhịp tim.
* **Metronome Ép tim CPR Chuẩn Y khoa:** Nhịp đếm âm thanh và rung haptic tần số $100 - 120\text{ BPM}$ theo tiêu chuẩn AHA, hướng dẫn duy trì tốc độ ép tim chuẩn xác khi sơ cứu ngừng tim.
* **Nút Quay số Khẩn cấp 115:** Tích hợp trực tiếp trên thanh tiêu đề của bảng trợ lý.

### Walkie-Talkie Push-to-Talk (PTT)
* **Bộ đàm Giọng nói Bán song công (Half-Duplex):** Nhấn giữ phím PTT để thu âm và phát tin nhắn giọng nói tức thì đến người bảo hộ; buông tay để tự động gửi đi.
* **Tối ưu Băng thông:** Nén âm thanh siêu nhẹ, hoạt động ổn định ngay cả trên mạng 3G/4G yếu hoặc chập chờn.

### Cuộc gọi Thoát hiểm Giả lập (Fake Escape Call)
* **Kịch bản Giải cứu Tinh vi:** Cho phép lên lịch cuộc gọi giả tới máy mình sau 0s (tức thì), 10s, 30s hoặc 1 phút để lịch sự rời khỏi cuộc họp khó chịu, buổi hẹn hò nguy hiểm hoặc tình huống bị đeo bám.
* **Giao diện & Âm thanh Chân thực:** Mô phỏng hoàn hảo cuộc gọi đến của Android/iOS, phát chuông rung haptic liên tục kèm kịch bản âm thanh đối thoại tự động (*Sếp gọi gấp, Bác sĩ gọi báo kết quả, Bạn trọ nhờ mở cửa*).

---

## ⚡ GIẢI PHÁP VẬN HÀNH 24/24 & BÁO CÁO 1 THÁNG TRÊN 5 THIẾT BỊ ĐA MẠNG

Để thực hiện kiểm thử và ghi nhận báo cáo thực nghiệm liên tục trong **30 ngày (1 tháng)** trên **5 thiết bị điện thoại thật** sử dụng **nhiều mạng khác nhau** (4G Viettel, 4G VinaPhone, 4G MobiFone, Wi-Fi gia đình, Wi-Fi cơ quan):

```
                      ┌────────────────────────────────────────┐
                      │    CLOUD BACKEND / PUBLIC HTTPS IP     │
                      │  (VPS Cloud / Cloudflare Tunnel / VPN) │
                      └───────────────────▲────────────────────┘
                                          │
       ┌──────────────────┬───────────────┴──────────────┬──────────────────┐
       │                  │                              │                  │
 📱 Máy 1: Viettel 4G  📱 Máy 2: VinaPhone 4G     📱 Máy 3: Wi-Fi Nhà   📱 Máy 4, 5: Công ty
 ├── Foreground Service 24/7 (Sticky Ongoing Notification)
 ├── Quyền Ignore Battery Optimizations (Bypass Android Doze)
 ├── Cấu hình Server URL linh hoạt qua UI Cài đặt
 └── Tự động lưu trữ ngoại tuyến và đồng bộ dữ liệu khi có sóng trở lại
```

1. **Dịch vụ Tiền cảnh Bất tử (Android Foreground Service):** Khởi chạy tiến trình chạy ngầm với thông báo ghim cố định, ngăn Android giải phóng bộ nhớ khi tắt màn hình.
2. **Vượt qua Chế độ Ngủ sâu (Bypass Android Doze Mode):** Tích hợp quyền `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, cấp quyền không giới hạn pin chỉ với 1 chạm.
3. **Cấu hình Máy chủ Linh hoạt (Multi-Network Server Config):** Trường cấu hình máy chủ trực tiếp trong màn hình Cài đặt cho phép trỏ ứng dụng về Domain HTTPS, Cloudflare Tunnel hoặc ngrok khi thử nghiệm ngoài đời thực.
4. **Cơ chế Xuất Báo cáo Thực nghiệm 1 Tháng (30-Day Export):** Dịch vụ `HealthReportExportService` trích xuất nhịp tim trung bình, nồng độ oxy $SpO_2$, số bước chân, số ca kích hoạt cảnh báo và tỷ lệ tuân thủ điểm danh ra định dạng **Excel (.xlsx)**, **PDF** và **CSV**.

---

## 🧮 13 THUẬT TOÁN AI, DSP & TOÁN HỌC CỐT LÕI

| STT | Thuật toán | Vị trí cài đặt mã nguồn | Mục đích & Ý nghĩa Kỹ thuật | Công thức Toán học & Ngưỡng Kích hoạt |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Bộ lọc thông dải Butterworth bậc 2** | `AiSignalProcessor.aiFilterPPG` | Khử trôi đường nền và triệt tiêu nhiễu điện lưới trên tín hiệu PPG | Dải thông $0.5 - 5.0\text{ Hz}$ ($30 - 300\text{ BPM}$):<br>$$H(s) = \frac{1}{1 + \sqrt{2}\left(\frac{s}{\omega_c}\right) + \left(\frac{s}{\omega_c}\right)^2}$$ |
| **2** | **Bộ lọc Trung bình Trượt (Moving Average)** | `AiSignalProcessor.smoothPPG` | Làm mượt dao động ngẫu nhiên tần số cao | Cửa sổ trượt $N = 5$ mẫu:<br>$$y[n] = \frac{1}{N} \sum_{k=0}^{N-1} x[n-k]$$ |
| **3** | **Dò đỉnh Thích nghi Động học (Adaptive Peak Detect)** | `AiSignalProcessor.detectHeartRate` | Tính nhịp tim BPM chính xác, chống đếm trùng sóng phản xạ | Ngưỡng động $V_{th} = \mu + 0.6\sigma$; Thời gian trơ sinh học $T_{refractory} = 320\text{ ms}$ |
| **4** | **Tỷ số Quang học Beer-Lambert (Ratio-of-Ratios)** | `AiSignalProcessor.calculateSpO2` | Đo nồng độ oxy bão hòa trong máu mao mạch không xâm lấn | $$R = \frac{AC_{red}/DC_{red}}{AC_{ir}/DC_{ir}},\quad SpO_2 = 110 - 25R$$ |
| **5** | **Vector Gia tốc Tổng hợp (Kinematic SVM)** | `AiSignalProcessor.calculateSVM` | Bất biến với góc xoay thiết bị, nhận diện va đập chấn thương | $$SVM = \sqrt{a_x^2 + a_y^2 + a_z^2} > 2.5g$$ |
| **6** | **Góc Nghiêng Cơ thể (Body Tilt Angle)** | `AiSignalProcessor.calculateTiltAngle` | Xác định tư thế nằm bất động trên mặt sàn sau cú ngã | $$\theta = \arccos\left(\frac{a_z}{SVM}\right) \times \frac{180^\circ}{\pi} > 60^\circ$$ |
| **7** | **Bộ phân loại SVM Tuyến tính (Linear SVM)** | `AiSignalProcessor.classifyFallSVM` | Phân biệt cú ngã thật với các hoạt động thường ngày | Hàm quyết định siêu phẳng:<br>$$f(\vec{x}) = \text{sign}(\mathbf{w}^T \vec{x} + b)$$ |
| **8** | **Chuỗi Thời gian Lắc máy Khẩn cấp (Shake-to-SOS)** | `AiSignalProcessor.detectShakeGesture` | Kích hoạt báo động ngầm khi bị cướp giật hoặc khống chế | Cửa sổ trượt $2.0\text{s}$, ghi nhận $\ge 4$ lần đảo chiều gia tốc biên độ $> 18\text{ m/s}^2$ |
| **9** | **Điểm Rủi ro Sinh tồn Đa biến (Survival Risk Score)** | `AiSignalProcessor.calculateSurvivalRiskScore` | Đánh giá mức độ nguy kịch để phân luồng xe cấp cứu | Thang điểm phi tuyến tính $0 - 100$ kết hợp BPM, $SpO_2$, mức pin và thời gian bất động |
| **10** | **Khoảng cách Trắc địa Haversine** | `backend/src/lib/utils.js` | Tìm kiếm Hiệp sĩ cứu hộ gần nhất trên bề mặt hình cầu Trái đất | $$d = 2R \arcsin\left(\sqrt{\sin^2\frac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\frac{\Delta\lambda}{2}}\right)$$ |
| **11** | **Nhận diện Khẩu lệnh Kêu cứu (Keyword Spotting)** | `AiSignalProcessor.evaluateVoiceDistress` | Phát hiện tiếng kêu cứu rảnh tay (*"Cứu tôi với"*) khi kẹt tay | Trích xuất 13 dải phổ tần MFCC kết hợp mô hình phân loại Tiny-CNN on-device |
| **12** | **Bộ lọc Biến thiên Khí áp (Barometer Altitude)** | Sensor Fusion Engine | Phát hiện độ cao rơi tự do khi gặp tai nạn nhà cao tầng | Vận tốc thẳng đứng $v_z = \frac{dh}{dt} > 5\text{ m/s}$ kết hợp $SVM > 3.0g$ |
| **13** | **Biến thiên Nhịp tim (HRV) & Dự đoán Đột quỵ / AFib Sớm** | `AiSignalProcessor.calculateHrvMetrics` & `evaluateStrokeCardiacRisk` | Phân tích biến thiên R-R IBI, dự đoán sớm nguy cơ đột quỵ và rung nhĩ trước 15-30 phút | $$RMSSD = \sqrt{\frac{1}{N-1}\sum \Delta RR_i^2},\quad pNN50 > 30\% \land SDNN < 25\text{ ms}$$ |

---

## 📡 CƠ CHẾ ĐIỀU PHỐI CỨU HỘ ĐA KÊNH (OMNICHANNEL DISPATCH)

```
                               ┌───────────────────┐
                               │   SOS ACTIVATED   │
                               └─────────┬─────────┘
                                         │
        ┌──────────────────┬─────────────┴─────────────┬──────────────────┐
        ▼                  ▼                           ▼                  ▼
┌───────────────┐  ┌───────────────┐           ┌───────────────┐  ┌───────────────┐
│  TELEGRAM BOT │  │   ZALO ZNS    │           │  TWILIO SMS   │  │ VOICE CALL L4 │
├───────────────┤  ├───────────────┤           ├───────────────┤  ├───────────────┤
│ Gửi tin định  │  │ Gửi tin nhắn  │           │ Bắn SMS văn   │  │ Gọi điện trực │
│ dạng Markdown │  │ chăm sóc ZNS  │           │ bản tới danh  │  │ tiếp tới máy  │
│ kèm link Live │  │ chính thức có │           │ bạ bảo hộ     │  │ người thân và │
│ Google Maps & │  │ tích xanh qua │           │ qua cổng GSM  │  │ phát giọng đọc│
│ chỉ số y tế   │  │ số điện thoại │           │ quốc tế       │  │ vị trí tức thì│
└───────────────┘  └───────────────┘           └───────────────┘  └───────────────┘
```

1. **Telegram Emergency Bot Webhook:** Bắn bản tin cứu hộ kèm nút bấm mở trực tiếp Google Maps tọa độ nạn nhân vào Group Cứu hộ tác chiến.
2. **Zalo ZNS (Zalo Notification Service):** Gửi thông báo khẩn cấp có bản quyền qua số điện thoại Zalo của Người bảo hộ.
3. **Twilio SMS Gateway:** Phát tin nhắn SMS truyền thống đến toàn bộ số điện thoại trong danh bạ bảo hộ ngay cả khi người nhận không có Internet.
4. **Voice Auto-Call Level 4 (Tổng đài Gọi Tự động):** Tự động gọi điện thoại khẩn cấp tới Người bảo hộ Ưu tiên 1 và phát giọng đọc Text-to-Speech (TTS) thông báo vị trí và loại sự cố của nạn nhân.

---

## 🗄️ CẤU TRÚC CƠ SỞ DỮ LIỆU (MONGODB COLLECTIONS)

* **`users`:** Thông tin tài khoản, mật mã băm bcrypt, tọa độ địa lý mới nhất (GeoJSON Point), trạng thái KYC, danh sách Người bảo hộ phân cấp ưu tiên, cấu hình Khung giờ yên tĩnh (*quietHoursStart / quietHoursEnd*).
* **`emergencylogs`:** Nhật ký các ca SOS, mức độ nghiêm trọng, kinh độ/vĩ độ, trạng thái ca cứu hộ (*pending, assigned, resolved*), danh sách Hiệp sĩ đã tiếp nhận.
* **`devicesignals`:** Lưu trữ lịch sử chuỗi thời gian dữ liệu cảm biến từ Samsung Galaxy Watch 5 ($SpO_2$, $BPM$, $SVM$, gia tốc 3 trục X/Y/Z).
* **`alertevents`:** Sự kiện cảnh báo phát sinh (té ngã chấn thương, trễ hạn check-in, còi hú báo động, ngụy trang cưỡng bức Duress).
* **`checkins` / `checkinhistories`:** Lịch sử các lần điểm danh an toàn, chỉ số tâm trạng (*mood*), loại hình thói quen, tệp ghi âm giọng nói đính kèm.
* **`disasteralerts`:** Dữ liệu bản tin thiên tai, bão lũ, sạt lở đất đá được ban hành từ Ban chỉ huy cứu hộ khẩn cấp 115/114.
* **`hazardreports`:** Báo cáo hiểm họa, tai nạn giao thông và sự cố hạ tầng do cộng đồng người dùng gửi lên.
* **`chats` & `messages`:** Tin nhắn trao đổi, hình ảnh hiện trường, tệp âm thanh Walkie-Talkie giữa nạn nhân, người bảo hộ và hiệp sĩ cứu trợ.
* **`kycrequests`:** Dữ liệu duyệt thẻ Căn cước công dân (ảnh CCCD mặt trước, mặt sau, số định danh, ngày cấp, trạng thái duyệt).
* **`auditlogs`:** Dấu vết kiểm toán an toàn thông tin toàn hệ thống (ghi nhận nhật ký truy cập bất biến phục vụ đối soát).

---

## 📸 BỘ SƯU TẬP ẢNH CHỤP THỰC TẾ CHỨC NĂNG (DEMO SCREENSHOTS GALLERY)

> 💡 Toàn bộ ảnh chụp thực tế đã được chuẩn hóa độ phân giải cao và lưu trữ trong thư mục `docs/screenshots/`.

### A. Giao diện Ứng dụng Di động SafeSolo (Flutter Mobile App)

| 1. Điểm danh & Quả cầu An toàn | 2. Quỹ đạo Alive Circle | 3. Hộp thư & Bộ đàm PTT |
| :---: | :---: | :---: |
| <img src="docs/screenshots/app_13_home_health_glance.png" width="240px" alt="Check-in Home" /> | <img src="docs/screenshots/app_11_health_vitals_hub.png" width="240px" alt="Alive Circle" /> | <img src="docs/screenshots/app_06_guardian_network.png" width="240px" alt="Messenger" /> |

| 4. Bàn Tác chiến Hiệp sĩ | 5. Cài đặt & Hạn điểm danh | 6. Trợ lý Sơ cứu SoloCare AI |
| :---: | :---: | :---: |
| <img src="docs/screenshots/app_10_achievements.png" width="240px" alt="Heroes" /> | <img src="docs/screenshots/app_05_settings_quiet_hours.png" width="240px" alt="Settings" /> | <img src="docs/screenshots/app_07_medical_id.png" width="240px" alt="SoloCare AI" /> |

---

### B. Giao diện Trung tâm Điều phối Web Admin (Web Admin Dispatch Portal)

| 1. Bản đồ Cứu hộ Thời gian thực (Live Map SOS) | 2. Điều phối Cứu hộ Đa kênh (Omnichannel Console) |
| :---: | :---: |
| <img src="docs/screenshots/01_live_map_dispatch.png" width="480px" alt="Live Map" /> | <img src="docs/screenshots/03_omnichannel_dispatch.png" width="480px" alt="Omnichannel" /> |

| 3. Quản lý & Phê duyệt Danh tính KYC CCCD | 4. Thống kê & Phân tích Sự cố 30 Ngày |
| :---: | :---: |
| <img src="docs/screenshots/04_kyc_verification.png" width="480px" alt="KYC" /> | <img src="docs/screenshots/06_analytics_revenue.png" width="480px" alt="Analytics" /> |

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH TỪNG BƯỚC

### 1. Chuẩn bị Môi trường
* **Flutter SDK:** Version $\ge 3.24.0$ (kênh stable)
* **Node.js:** Version $\ge 18.x$ hoặc $20.x$ (LTS khuyến nghị)
* **MongoDB:** Bản cài đặt cục bộ (cổng 27017) hoặc chuỗi kết nối MongoDB Atlas URI
* **Android Studio & SDK:** Android SDK Platform API 34+ (hỗ trợ Android 8.0 đến Android 14+)

---

### 2. Khởi chạy Nhanh qua Docker Compose
```bash
# Khởi chạy trọn gói Backend + MongoDB + Redis thông qua file script tiện ích:
run_docker_backend.bat

# Hoặc khởi chạy thủ công bằng Docker Compose:
cd backend
docker-compose up -d --build
```

---

### 3. Khởi chạy Thủ công Từng Phân hệ

#### A. Khởi chạy Backend Server (Node.js • Express • MongoDB)
```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Cài đặt các thư viện phụ thuộc
npm install

# 3. Tạo file cấu hình môi trường .env (sao chép từ .env.example)
copy .env.example .env

# 4. Khởi động máy chủ backend (lắng nghe trên cổng 4000)
npm start
# Hoặc chế độ dev tự reload:
npm run dev

# Máy chủ backend sẵn sàng tại: http://localhost:4000
```

> [!IMPORTANT]
> **Lưu ý quan trọng cho Máy ảo Android Emulator:**
> Để ứng dụng trên máy ảo Android kết nối trực tiếp đến backend máy tính mà không bị tường lửa chặn, bạn hãy mở một terminal và chạy lệnh:
> ```bash
> adb reverse tcp:4000 tcp:4000
> ```
> Ứng dụng đã được tích hợp sẵn quyền `android:usesCleartextTraffic="true"` và `<uses-permission android:name="android.permission.INTERNET" />` để liên lạc thông suốt.

#### B. Khởi chạy Trung tâm Điều phối Web Admin (React 18 • Vite)
```bash
cd web-admin
npm install
npm run dev

# Cổng truy cập Web Admin: http://localhost:8080
```

#### C. Khởi chạy Ứng dụng Di động SafeSolo (Flutter Mobile)
```bash
flutter pub get
flutter run -d android
# Hoặc chạy script tự động:
run_safesolo_android.bat
```

#### D. Khởi chạy Ứng dụng Đồng hồ Samsung Galaxy Watch 5 (Wear OS)
```bash
flutter run -d <wear-os-device-id> --route /wear-os
```

---

## 🧪 HỆ THỐNG KIỂM THỬ TỰ ĐỘNG & CHẤT LƯỢNG MÃ NGUỒN

Dự án được bảo chứng chất lượng nghiêm ngặt với bộ kiểm thử tự động toàn diện:

### 1. Kết quả Kiểm thử Tự động (Flutter Test Suite)
```bash
flutter test
```
* **Toàn bộ 100% Tests ĐẠT (PASS)** trên toàn bộ các bộ kiểm thử:
  - `circle_orbit_and_shield_test.dart`: Kiểm thử Quỹ đạo Orbit, Thanh Khóa đêm, Buồng lái hộ tống ảo, Bưu thiếp AI Capsule và trang Alive Circle.
  - `home_checkin_comprehensive_test.dart`: Kiểm thử Quả cầu an toàn, Bộ đếm giờ Dead-man, Thẻ người bảo hộ online, Các phím chọn tâm trạng và thẻ sức khỏe.
  - `disaster_alert_test.dart`: Kiểm thử tiếp nhận và render banner cảnh báo thiên tai khẩn cấp.
  - `accident_report_page_test.dart`: Kiểm thử bố cục và luồng gửi tin báo sự cố tai nạn.
  - `auth_portal_redesign_test.dart`: Kiểm thử chọn tài khoản Google/Telegram và hoàn tất hồ sơ an toàn.
  - `ai_signal_processor_test.dart`: Kiểm thử lọc Butterworth, dò đỉnh BPM, tính SpO2, gia tốc SVM và Shake-to-SOS.
  - `hrv_stroke_test.dart`: Kiểm thử phân tích biến thiên nhịp tim HRV và mô hình dự đoán đột quỵ / AFib.
  - `solocare_ai_test.dart`: Kiểm thử khởi tạo trợ lý SoloCare AI và nhịp metronome CPR.
  - `walkie_talkie_test.dart`: Kiểm thử bộ đàm Push-to-Talk và luồng âm thanh khẩn cấp.
  - `fake_call_test.dart`: Kiểm thử bộ đếm giây và kịch bản cuộc gọi thoát hiểm.
  - `watch_sync_manager_test.dart`: Kiểm thử giao thức SSWP v1.0 và đồng bộ hóa hai chiều.
  - `galaxy_watch5_interface_test.dart`: Kiểm thử 7 màn hình tròn Wear OS One UI Watch.
  - `defense_demo_sandbox_test.dart`: Kiểm thử Hộp cát Trình diễn Hội đồng (Defense Demo Sandbox), ma trận viễn thám HUD, 4 kịch bản bơm sự kiện khẩn cấp và bảng số liệu khoa học.
  - `lockscreen_medical_and_offline_sos_test.dart`: Kiểm thử Thẻ Y tế Cấp cứu Màn hình Khóa chuẩn ICE, Mã QR Cấp cứu 115 độ tương phản cao, và cơ chế phát SMS GSM Ngoại tuyến khi mất mạng.

### 2. Phân tích Chất lượng Mã nguồn Tĩnh (Static Code Analysis)
```bash
flutter analyze lib/
```
```
Analyzing lib...
No issues found! (ran in 48.9s)
```
* **0 Lỗi cú pháp (Errors)**, **0 Cảnh báo (Warnings)**, tuân thủ tuyệt đối quy chuẩn mã nguồn Dart & Flutter Linter.

---

## 📂 CẤU TRÚC MÃ NGUỒN DỰ ÁN

```
SafeSolo/
├── android/                         # Cấu hình Gradle, quyền hệ thống và mã nguồn gốc Android
│   └── app/src/main/AndroidManifest.xml  # Khai báo quyền 24/7, Doze bypass, cleartext & intents
├── assets/                          # Âm thanh còi hú, kịch bản Fake Call, âm metronome CPR, icon
├── backend/                         # Máy chủ điều phối Node.js Express REST API & Socket.IO
│   ├── docker-compose.yml           # Cấu hình triển khai nhanh Docker Compose
│   ├── Dockerfile                   # Docker image tiêu chuẩn sản xuất
│   ├── scripts/                     # Kịch bản nạp dữ liệu demo và kiểm thử API
│   ├── src/
│   │   ├── controllers/             # Bộ điều khiển SOS, Auth, User, KYC, Admin Portal, Hazard
│   │   ├── models/                  # Mongoose Schemas (User, EmergencyLog, DisasterAlert, ...)
│   │   ├── routes/                  # Định tuyến REST APIs
│   │   ├── services/                # sosService, notificationService, heroRadarService, ...
│   │   └── workers/                 # deadmanWorker, duressWorker
│   └── server.js                    # Điểm khởi chạy máy chủ Backend (Port 4000)
├── docs/                            # Tài liệu đặc tả kỹ thuật và học thuật đồ án
│   ├── screenshots/                 # 22+ ảnh chụp thực tế màn hình Mobile App & Web Admin
│   ├── TEST_CASES.md                # Ma trận kiểm thử toàn diện hệ thống
│   └── thuat-toan-ai-chi-tiet.md    # Đặc tả chi tiết 13 thuật toán AI & DSP
├── lib/                             # Toàn bộ mã nguồn ứng dụng đa nền tảng Flutter
│   ├── core/                        # Theme giao diện, hằng số cấu hình, AppProvider quản lý trạng thái
│   ├── models/                      # User, Contact, DisasterAlert, CircleOrbitMember, SSWP protocol
│   ├── services/                    # Tầng dịch vụ nghiệp vụ (AI, API, PTT, Smartwatch, Export)
│   └── views/                       # 5 Tab chính và các màn hình vệ tinh:
│       ├── home/                    # Tab 1: Điểm danh, Safety Orb, Banner thiên tai Prenn KM 226
│       ├── circle/                  # Tab 2: Quỹ đạo The Orbit, Khóa đêm, Buồng lái hộ tống ảo
│       ├── messenger/               # Tab 3: Hộp thư, Bộ đàm PTT, Cuộc gọi thoát hiểm
│       ├── heroes/                  # Tab 4: Mạng lưới Hiệp sĩ, Bàn tác chiến, Bảng vàng vinh danh
│       ├── settings/                # Tab 5: Cài đặt, Hạn điểm danh an toàn, Khung giờ yên tĩnh
│       ├── emergency/               # Bảng trợ lý sơ cứu SoloCare AI Thuần Việt 24/7
│       ├── auth/                    # Đăng nhập & Thiết lập hồ sơ an toàn ban đầu
│       ├── community/               # Báo cáo tai nạn & dòng sự kiện hiểm họa
│       └── wear_os/                 # 7 màn hình tròn Wear OS Samsung Galaxy Watch 5
├── test/                            # Bộ kiểm thử tự động toàn diện (Unit & Widget tests)
├── web-admin/                       # Trung tâm điều phối Web Admin Portal (React 18 + Vite)
├── run_docker_backend.bat           # Script 1-click khởi chạy Backend Docker
├── run_safesolo_android.bat         # Script 1-click khởi chạy Flutter Mobile App
└── README.md                        # Tài liệu hướng dẫn toàn diện hệ thống (File này)
```

---

## 👨‍💻 TÁC GIẢ & BẢN QUYỀN

* **Sinh viên thực hiện:** **Đoàn Minh Quân**
* **Mã số sinh viên:** **2224801030137**
* **Lớp:** **KTPM03**
* **Khoa:** Khoa Công nghệ Thông tin - Chuyên ngành Kỹ thuật Phần mềm
* **Phiên bản:** **1.0.0 (Release Candidate)**
* **Năm hoàn thành:** **2026**
* **Giấy phép:** Bản quyền mã nguồn mở theo giấy phép [MIT License](LICENSE).
