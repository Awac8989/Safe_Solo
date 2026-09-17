# 🛡️ SAFESOLO - HỆ THỐNG CẢNH BÁO KHẨN CẤP TỰ ĐỘNG & ĐIỀU PHỐI CỨU HỘ THỜI GIAN THỰC
> **Autonomous Emergency Alert & Real-time Rescue Dispatch Ecosystem**  
> *Hệ sinh thái Cứu hộ Đa nền tảng: Flutter Mobile (Android/iOS) • Samsung Galaxy Watch 5 (Wear OS 4.0) • Web Admin Dispatch Portal • Cloud Backend Node.js / MongoDB • SoloCare AI & DSP Signal Processing*

<p align="center">
  <img src="https://img.shields.io/badge/Flutter-3.24+-02569B?style=for-the-badge&logo=flutter&logoColor=white" alt="Flutter" />
  <img src="https://img.shields.io/badge/Wear_OS-4.0_OneUI-4285F4?style=for-the-badge&logo=wear-os&logoColor=white" alt="Wear OS" />
  <img src="https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas_%2F_Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.IO-4.8.x-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/React_18-Vite_%2B_TanStack-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Vite" />
  <img src="https://img.shields.io/badge/AI_Engine-Groq_Qwen_2.5-F55036?style=for-the-badge&logo=openai&logoColor=white" alt="Groq AI" />
  <img src="https://img.shields.io/badge/Tests_Passing-84%2F84_Tests_100%25-brightgreen?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Tests Passing" />
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
3. [Chi tiết 4 Phân hệ Nền tảng trong Hệ sinh thái](#-chi-tiết-4-phân-hệ-nền-tảng-trong-hệ-sinh-thái)
   - [3.1. Ứng dụng Di động SafeSolo (Flutter Android / iOS)](#31-ứng-dụng-di-động-safesolo-flutter-android--ios)
   - [3.2. Thiết bị Đeo Thông minh Wear OS (Samsung Galaxy Watch 5)](#32-thiết-bị-đeo-thông-minh-wear-os-samsung-galaxy-watch-5)
   - [3.3. Cloud Backend & Micro-Workers Engine (Node.js / Express / MongoDB)](#33-cloud-backend--micro-workers-engine-nodejs--express--mongodb)
   - [3.4. Trung tâm Điều phối Web Admin (React 18 / Vite / TanStack)](#34-trung-tâm-điều-phối-web-admin-react-18--vite--tanstack)
4. [Trợ lý Khẩn cấp SoloCare AI & Bộ Công cụ Liên lạc Tác chiến](#-trợ-lý-khẩn-cấp-solocare-ai--bộ-công-cụ-liên-lạc-tác-chiến)
   - [SoloCare AI First Aid Companion](#solocare-ai-first-aid-companion)
   - [Walkie-Talkie Push-to-Talk (PTT)](#walkie-talkie-push-to-talk-ptt)
   - [Cuộc gọi Thoát hiểm Giả lập (Fake Escape Call)](#cuộc-gọi-thoát-hiểm-giả-lập-fake-escape-call)
   - [Tổng đài Khẩn cấp 115 & SMS Tức thời](#tổng-đài-khẩn-cấp-115--sms-tức-thời)
5. [Giải pháp Vận hành 24/24 & Báo cáo 1 Tháng trên 5 Thiết bị Đa Mạng](#-giải-pháp-vận-hành-2424--báo-cáo-1-tháng-trên-5-thiết-bị-đa-mạng)
6. [12 Thuật toán AI, DSP & Toán học Cốt lõi](#-12-thuật-toán-ai-dsp--toán-học-cốt-lõi)
7. [Cơ chế Điều phối Cứu hộ Đa kênh (Omnichannel Dispatch)](#-cơ-chế-điều-phối-cứu-hộ-đa-kênh-omnichannel-dispatch)
8. [Cấu trúc Cơ sở Dữ liệu (MongoDB Collections)](#-cấu-trúc-cơ-sở-dữ-liệu-mongodb-collections)
9. [Bộ sưu tập Ảnh Chụp Thực tế Chức năng (Demo Screenshots Gallery)](#-bộ-sưu-tập-ảnh-chụp-thực-tế-chức-năng-demo-screenshots-gallery)
10. [Hướng dẫn Cài đặt & Vận hành Từng bước](#-hướng-dẫn-cài-đặt--vận-hành-từng-bước)
11. [Hệ thống Kiểm thử Tự động & Ma trận 97 Test Cases](#-hệ-thống-kiểm-thử-tự-động--ma-trận-97-test-cases)
12. [Cấu trúc Mã nguồn Dự án](#-cấu-trúc-mã-nguồn-dự-án)
13. [Tác giả & Bản quyền](#-tác-giả--bản-quyền)

---

## 🌟 TỔNG QUAN HỆ THỐNG & GIÁ TRỊ THỰC TIỄN

Trong kỷ nguyên đô thị hóa và xu hướng sống độc thân (solo living) gia tăng nhanh chóng, các rủi ro sức khỏe bất ngờ (đột quỵ, nhồi máu cơ tim, trượt ngã trong nhà tắm dẫn đến bất tỉnh) hoặc các tình huống khẩn cấp an ninh (bị khống chế, cướp giật, theo dõi ban đêm) thường dẫn tới những hậu quả thương tâm do nạn nhân **mất hoàn toàn khả năng với tay lấy điện thoại bấm gọi cứu hộ**.

**SafeSolo** ra đời nhằm giải quyết triệt để bài toán này thông qua triết lý kiến trúc:
> **"Edge-First Autonomous Detection + Cloud Real-time Omnichannel Dispatch + Community Hero Radar"**  
*(Phát hiện tự động tại thiết bị biên ngay cả khi ngắt mạng • Điều phối cứu hộ đám mây đa kênh thời gian thực • Mạng lưới Hiệp sĩ cứu trợ cộng đồng)*

### Điểm nổi bật vượt trội của SafeSolo:
1. **Phát hiện Sinh tồn Bất thường Tự động:** Giám sát liên tục tín hiệu quang học PPG BioActive và cảm biến gia tốc kế 3 trục IMU từ đồng hồ Samsung Galaxy Watch 5. Tự động nhận diện nhịp tim bất thường ($BPM < 45$ hoặc $> 130$), thiếu oxy máu ($SpO_2 < 90\%$), và té ngã mạnh ($SVM > 2.5g$ kết hợp nghiêng cơ thể $\theta > 60^\circ$).
2. **Cơ chế Điểm danh Sinh tồn (Dead-man's Switch):** Thiết lập chu kỳ hẹn giờ an toàn (3h, 6h, 12h, 24h). Nếu người dùng trễ hạn điểm danh và không phản hồi chuông báo thức tỉnh, hệ thống tự động kích hoạt tiến trình cứu hộ khẩn cấp.
3. **Kích hoạt Khẩn cấp Đa phương thức:** Nhấn SOS 1-chạm, giật mạnh lắc máy liên tục khi bị khống chế (*Shake-to-SOS*), khẩu lệnh kêu cứu rảnh tay (*Keyword Spotting*), hoặc nhập mật mã cưỡng bức ngụy trang (*Duress PIN*) trong ứng dụng máy tính bỏ túi giả lập (*Fake Calculator*).
4. **Trợ lý Y tế Khẩn cấp SoloCare AI:** Ứng dụng mô hình ngôn ngữ lớn (LLM Qwen 2.5 trên nền tảng Groq Cloud siêu tốc) hướng dẫn sơ cứu tức thời (ngừng thở, bỏng, đột quỵ, chảy máu, ép tim CPR với âm nhịp metronome chuẩn 100-120 BPM, bài tập thở xoa dịu hoảng loạn, và gọi nhanh 115).
5. **Mạng lưới Hiệp sĩ Cứu trợ (Community Hero Radar):** Quét định vị trắc địa Haversine tìm kiếm các tình nguyện viên đã xác minh danh tính Căn cước công dân (KYC) trong bán kính $1 - 5\text{ km}$, tích hợp 1-chạm dẫn đường tức thì qua **Waze Navigation** và **Google Maps**.
6. **Điều phối Cứu hộ Đa kênh Đồng thời (Omnichannel Dispatch):** Bắn tin đồng thời qua 4 kênh: Telegram Bot Webhook, Zalo ZNS Template, Twilio SMS Gateway và Cuộc gọi tổng đài tự động đọc giọng nói (*Voice Auto-Call Level 4*).
7. **Vận hành Bền bỉ 24/24:** Cấu hình Android Foreground Service, vượt qua giới hạn tiết kiệm pin Android Doze mode (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), hỗ trợ đổi Server URL linh hoạt để chạy kiểm thử liên tục suốt 1 tháng trên 5 thiết bị khác nhau qua mạng 4G/Wi-Fi.

---

## 🏗️ KIẾN TRÚC TỔNG THỂ HỆ THỐNG (SYSTEM ARCHITECTURE)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             THIẾT BỊ BIÊN (EDGE DEVICES TIER)                          │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│ 📱 FLUTTER MOBILE APP (Android 8.0 - 14+)  │ ⌚ SAMSUNG GALAXY WATCH 5 (Wear OS 4.0)    │
│ • Dead-man's Switch & Check-in Loop       │ • PPG BioActive Optical Sensor             │
│ • Stealth Mode (Fake Calculator / Duress) │ • 3-Axis IMU Sensor (Acc X/Y/Z, Gyro)      │
│ • Shake-to-SOS & Keyword Spotting         │ • Thuật toán té ngã (SVM & Tilt Kinematics)│
│ • SoloCare AI & CPR Metronome (100 BPM)   │ • 7 Màn hình One UI Watch độc lập          │
│ • Walkie-Talkie PTT & Fake Escape Call    │ • SafeSolo Smartwatch Protocol (SSWP v1.0) │
│ • 24/7 Foreground Service & Battery Keep  │ • Rung cảnh báo Haptic Feedback            │
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
│ • Geospatial Haversine Radar: Truy vấn bán kính Hiệp sĩ $1 - 5\text{ km}$             │
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
│ 📞 4. Voice Auto-Call Level 4 (TTS Speech)│ │ 📈 30-Day Health & Incident Analytics    │
└───────────────────────────────────────────┘ └──────────────────────────────────────────┘
```

---

## 📱 CHI TIẾT 4 PHÂN HỆ NỀN TẢNG TRONG HỆ SINH THÁI

### 3.1. Ứng dụng Di động SafeSolo (Flutter Android / iOS)
* **Vòng tròn Điểm danh Sinh tồn (Home Screen & Check-in Circle):** Hiển thị thời gian đếm ngược trực quan tới hạn chót điểm danh, đo mức pin, chọn tâm trạng sinh hoạt (*Mood Prompt*) và lưu ghi chú bằng giọng nói.
* **Thanh Trực thám Đồng hồ Trực tiếp (Home Live Health Glance):** Nằm ngay dưới thanh chào đầu ngày, hiển thị trực quan trạng thái kết nối Galaxy Watch 5, mức pin %, nhịp tim BPM, $SpO_2$, số bước chân và trạng thái cảm biến chống té ngã.
* **Trung tâm Sức khỏe & Sinh tồn Toàn diện (Health & Vitals Hub):**
  - **Vòng tròn Hoạt động 3 Lớp Đồng tâm (Concentric Activity Rings):** Trực quan hóa tiến độ Bước chân (*Cyan*), Calo tiêu hao (*Orange*) và Quãng đường (*Emerald Green*) lấy cảm hứng từ Apple Fitness và Samsung Health.
  - **Ma trận Sinh tồn (Biometrics Matrix):** Điểm số An toàn SafeSolo Health & Safety Score (0-100), biểu đồ sóng điện tim ECG Waveform thời gian thực, đồng hồ nồng độ oxy $SpO_2$ và trạng thái IMU chống té ngã.
  - **Xuất Báo cáo Y tế 1 Tháng (Health Report Export):** Xuất toàn bộ dữ liệu sinh tồn, lịch sử điểm danh và sự cố trong 30 ngày qua định dạng Excel `.xlsx`, PDF và CSV.
* **Chế độ Khung giờ Yên tĩnh (Quiet Hours):** Cấu hình tự động giảm mức chuông từ 23:00 - 06:00 sáng hôm sau, tránh làm phiền giấc ngủ nhưng vẫn giữ nguyên giám sát ngầm.
* **Mạng lưới Người bảo hộ Phân cấp (Guardian Network):** Quản lý tối đa 3 người thân với 3 mức ưu tiên rõ ràng (Ưu tiên 1 - Người nhận SMS & Cuộc gọi đầu tiên; Ưu tiên 2, 3) kèm phím gọi trực tiếp.
* **Chế độ Ngụy trang Máy tính Bỏ túi (Stealth Calculator):** Màn hình máy tính bỏ túi tính toán cộng trừ nhân chia hoàn toàn bình thường. Khi gõ mật khẩu ngụy trang (*Duress PIN*), hệ thống phát báo động câm và truyền tọa độ ngầm.
* **Két sắt Sinh tử (Safety Vault & Dead-man's Switch):** Két mã hóa chuẩn AES-256 chứa mật khẩu, tài sản số và tâm thư dặn dò; tự động mở gửi cho người bảo hộ sau 72 giờ mất liên lạc hoàn toàn.
* **Hồ sơ Y tế Khẩn cấp & QR Code:** Nhóm máu, tiền sử bệnh nền, thuốc dị ứng hiển thị ngay ngoài màn hình khóa cho sơ cứu viên.

---

### 3.2. Thiết bị Đeo Thông minh Wear OS (Samsung Galaxy Watch 5)
* **Giao thức Chuẩn hóa SafeSolo Smartwatch Protocol (SSWP v1.0):** Giao tiếp hai chiều với điện thoại qua Bluetooth LE / Wi-Fi Socket, đảm bảo độ trễ $< 200\text{ ms}$.
* **7 Màn hình Tròn One UI Watch Độc lập:**
  1. `WatchScreen.dashboard`: Màn hình chính hiển thị giờ, nhịp tim, SpO2, bước chân và trạng thái kết nối.
  2. `WatchScreen.checkin`: Chạm 1 chạm để điểm danh an toàn tức thì từ cổ tay.
  3. `WatchScreen.warning`: Cảnh báo tiền báo động rung phản hồi khi phát hiện chỉ số bất thường.
  4. `WatchScreen.sos`: Màn hình đếm ngược 30 giây hủy báo động trước khi tự động bắn tin cứu hộ.
  5. `WatchScreen.health`: Ma trận chỉ số PPG và IMU thời gian thực.
  6. `WatchScreen.medical`: Hiển thị nhóm máu và thông tin cấp cứu trực quan trên mặt đồng hồ.
  7. `WatchScreen.settings`: Điều chỉnh độ nhạy té ngã, ngưỡng nhịp tim và rung xúc giác.
* **Cảm biến Quang học PPG BioActive & Cảm biến Gia tốc IMU:**
  - Lọc dải nhịp tim $0.5 - 5.0\text{ Hz}$ bằng bộ lọc Butterworth bậc 2, loại bỏ nhiễu rung lắc cơ học.
  - Tính $SpO_2$ theo tỷ số hấp thụ quang học Beer-Lambert.
  - Vector gia tốc $SVM > 2.5g$ kết hợp góc nghiêng $\theta > 60^\circ$ kích hoạt còi báo té ngã.
* **Phím cứng Hardware SOS & Tìm thiết bị hai chiều:** Nhấn giữ phím vật lý trên đồng hồ để phát báo động khẩn cấp; hỗ trợ rung chuông tìm đồng hồ từ điện thoại và ngược lại.

---

### 3.3. Cloud Backend & Micro-Workers Engine (Node.js • Express • MongoDB)
* **Xác thực Đa phương thức:** Đăng nhập an toàn qua Số điện thoại OTP, Google OAuth / Gmail OTP, và liên kết tài khoản Telegram Bot cá nhân.
* **Động cơ Socket.IO Đa kênh:** Đồng bộ tức thời vị trí GPS, nhịp tim, sự kiện té ngã giữa Mobile App, Smartwatch và Web Admin Portal.
* **Deadman Background Worker:** Lập trình định kỳ quét kiểm tra hạn điểm danh của từng người dùng; tự động kích hoạt cảnh báo cấp độ 1 (nhắc nhở qua Push/SMS) và cấp độ 2 (phát tin cứu hộ) khi quá hạn.
* **Duress & Stealth Worker:** Phân tích mã PIN ngụy trang, kích hoạt quy trình cứu hộ âm thầm mà không hiển thị bất kỳ dấu hiệu nào trên màn hình điện thoại của nạn nhân.
* **Truy vấn Trắc địa Haversine:** Tìm kiếm và xếp hạng các Hiệp sĩ cứu hộ lân cận nạn nhân trong phạm vi $1 - 5\text{ km}$ theo thời gian thực.
* **Bảo mật AES-256 GCM:** Mã hóa toàn bộ dữ liệu thẻ Căn cước công dân và hồ sơ y tế nhạy cảm trước khi lưu vào MongoDB.

---

### 3.4. Trung tâm Điều phối Web Admin (React 18 / Vite / TanStack)
* **Bản đồ Cứu hộ Thời gian thực (Live Map SOS Dispatch):** Bản đồ Leaflet tương tác cao, hiển thị tâm chấn vụ việc, bán kính ảnh hưởng 5km, lộ trình di chuyển của nạn nhân và vị trí các Hiệp sĩ phản ứng nhanh.
* **Bảng điều khiển Giám sát Đa kênh (Omnichannel Live Console):** Theo dõi tức thời trạng thái gửi và nhận của 4 luồng tin cứu hộ: Telegram, Zalo ZNS, Twilio SMS và Voice Auto-Call.
* **Quản trị & Phê duyệt Danh tính KYC (KYC Management):** So chiếu ảnh chân dung và ảnh chụp 2 mặt Căn cước công dân, phê duyệt cấp huy hiệu Hiệp sĩ tin cậy (*Trust Score*).
* **Báo cáo Thống kê & Phân tích Sự cố 30 Ngày (30-Day Analytics):** Thống kê số ca cứu hộ thành công, thời gian tiếp cận trung bình, phân bổ mật độ rủi ro theo khu vực địa lý.
* **Nhật ký Kiểm toán Hệ thống (Audit Trail & Telemetry):** Lưu trữ toàn bộ lịch sử thao tác không thể thay đổi theo tiêu chuẩn bảo mật thông tin y tế.

---

## 🤖 TRỢ LÝ KHẨN CẤP SOLOCARE AI & BỘ CÔNG CỤ LIÊN LẠC TÁC CHIẾN

SafeSolo tích hợp bộ công cụ liên lạc và trợ giúp tác chiến chuyên sâu hỗ trợ người dùng ứng phó tức thì trong mọi kịch bản hiểm nghèo:

### SoloCare AI First Aid Companion
* **Mô hình Trí tuệ Nhân tạo:** Tích hợp mô hình ngôn ngữ lớn **Qwen-2.5-32b-instruct / Qwen 3.8-27b** thông qua nền tảng đám mây **Groq Cloud API** với độ trễ phản hồi siêu nhanh ($< 1\text{ giây}$).
* **Chế độ Ngoại tuyến Tự hành (Offline Fallback):** Tự động chuyển đổi sang bộ tri thức cấp cứu ngoại tuyến tích hợp sẵn (quy tắc sơ cứu ngừng tim, bỏng nhiệt, gãy xương, nghẹn dị vật đường thở) khi điện thoại mất hoàn toàn kết nối Internet.
* **Metronome Ép tim CPR Chuẩn Y khoa:** Tích hợp nhịp đếm âm thanh và rung haptic tần số $100 - 120\text{ BPM}$ theo tiêu chuẩn của Hiệp hội Tim mạch Hoa Kỳ (AHA), hướng dẫn người dùng duy trì tốc độ ép tim chính xác khi sơ cứu nạn nhân đột quỵ.
* **Bài tập Thở Ổn định Tâm lý (Panic Attack Breathing):** Hướng dẫn nhịp thở trực quan 4-4-4 (*Box Breathing*) giúp người dùng bình tĩnh khi gặp khủng hoảng tâm lý hoặc bị đe dọa.

### Walkie-Talkie Push-to-Talk (PTT)
* **Bộ đàm Giọng nói Bán song công (Half-Duplex):** Nhấn giữ phím PTT để thu âm và phát tin nhắn giọng nói tức thì đến người bảo hộ; buông tay để tự động gửi đi.
* **Tối ưu Băng thông:** Mã hóa luồng âm thanh nén siêu nhẹ, hoạt động ổn định ngay cả trên đường truyền sóng 3G/4G yếu hoặc chập chờn.

### Cuộc gọi Thoát hiểm Giả lập (Fake Escape Call)
* **Kịch bản Giải cứu Tinh vi:** Cho phép người dùng lên lịch cuộc gọi giả tới máy mình sau 0s (tức thì), 10s, 30s hoặc 1 phút để lịch sự rời khỏi cuộc họp khó chịu, buổi hẹn hò nguy hiểm hoặc tình huống bị đeo bám.
* **Giao diện & Âm thanh Chân thực:** Mô phỏng hoàn hảo giao diện cuộc gọi đến của Android/iOS, phát chuông rung haptic liên tục, kèm kịch bản âm thanh đối thoại tự động (Sếp gọi gấp, Bác sĩ gọi báo kết quả, Bạn trọ nhờ mở cửa).
* **Đồng hồ Đếm giây & Cơ chế Safe Pop:** Hiển thị thời lượng cuộc gọi thực tế và ngăn ngừa hoàn toàn lỗi đóng màn hình trùng lặp (*double pop*).

### Tổng đài Khẩn cấp 115 & SMS Tức thời
* **Gọi Cấp cứu 1-Chạm:** Tích hợp phím quay số nhanh tới Tổng đài Cấp cứu 115, Cảnh sát 113 và Cứu hỏa 114.
* **Tương thích Tuyệt đối Android 11 - 14+:** Bổ sung cấu hình khai báo Intent `<queries>` cho các scheme `tel:` và `sms:`, loại bỏ triệt để hiện tượng hệ điều hành chặn mở ứng dụng gọi điện mặc định.

---

## ⚡ GIẢI PHÁP VẬN HÀNH 24/24 & BÁO CÁO 1 THÁNG TRÊN 5 THIẾT BỊ ĐA MẠNG

Để thực hiện kiểm thử và ghi nhận báo cáo thực nghiệm liên tục trong **30 ngày (1 tháng)** trên **5 thiết bị điện thoại thật** sử dụng **nhiều mạng khác nhau** (4G Viettel, 4G VinaPhone, 4G MobiFone, Wi-Fi gia đình, Wi-Fi cơ quan), SafeSolo đã triển khai giải pháp kỹ thuật toàn diện:

```
                      ┌────────────────────────────────────────┐
                      │    CLOUD BACKEND / PUBLIC HTTPS IP     │
                      │  (VPS Cloud / Cloudflare Tunnel / VPN) │
                      └───────────────────▲────────────────────┘
                                          │
       ┌──────────────────┬───────────────┴──────────────┬──────────────────┐
       │                  │                              │                  │
 📱 Máy 1: Viettel 4G  📱 Máy 2: VinaPhone 4G     📱 Máy 3: Wi-Fi Nhà   📱 Máy 4, 5: Công ty
 [tester_01]        [tester_02]                 [tester_03]           [tester_04, 05]
 ├── Foreground Service 24/7 (Sticky Notification)
 ├── Quyền Ignore Battery Optimizations (Không bị Android Doze kill)
 ├── Cấu hình Server URL linh hoạt qua UI Cài đặt
 └── Tự động lưu trữ ngoại tuyến và đồng bộ dữ liệu khi sóng chập chờn
```

### 1. Kiến trúc Chạy ngầm Liên tục 24/7 (Background Safety Service)
* **Dịch vụ Tiền cảnh Bất tử (Android Foreground Service):** Khởi chạy tiến trình chạy ngầm với thông báo ghim cố định (*Ongoing Sticky Notification*), ngăn hệ điều hành Android tự ý giải phóng bộ nhớ khi tắt màn hình.
* **Vượt qua Chế độ Ngủ sâu (Bypass Android Doze Mode):** Tích hợp quyền `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Ứng dụng cung cấp thẻ giao diện chuyên dụng tại trang Cấp quyền (`PermissionsPage`) hướng dẫn người dùng cấp quyền không giới hạn pin chỉ với 1 chạm.
* **Cơ chế Giữ Đánh thức (Wakelock & Heartbeat Periodic Worker):** Duy trì nhịp gửi gói tin định kỳ (mỗi 60 giây) về máy chủ để cập nhật trạng thái sống còn của thiết bị.

### 2. Cấu hình Máy chủ Linh hoạt cho Thiết bị Thực tế (Multi-Network Server Config)
* **Vấn đề Thực tế:** Khi mang 5 máy ra các môi trường mạng 4G/Wi-Fi khác nhau ngoài đời thực, ứng dụng không thể trỏ về địa chỉ nội bộ cục bộ `http://10.0.2.2:4000` hay `http://192.168.x.x:4000`.
* **Giải pháp Kỹ thuật:**
  - Bổ sung trường cấu hình **"Máy chủ & Kết nối 24/7"** trực tiếp trong màn hình Cài đặt (`SettingsPage`).
  - Cho phép người thử nghiệm nhập trực tiếp URL máy chủ công khai (Domain HTTPS, Cloudflare Tunnel hoặc ngrok URL).
  - Dữ liệu cấu hình được lưu bền vững vào `SharedPreferences`, tự động áp dụng cho toàn bộ các dịch vụ API, Socket.IO và dịch vụ chạy ngầm của ứng dụng.

### 3. Hướng dẫn Tắt Tối ưu Pin cho Từng Dòng Máy (OEM Battery Whitelisting)
Để đảm bảo ứng dụng không bị các trình quản lý pin tùy biến của nhà sản xuất tắt ngang:
* **Samsung (One UI):** Cài đặt $\rightarrow$ Ứng dụng $\rightarrow$ SafeSolo $\rightarrow$ Pin $\rightarrow$ Chọn **"Không hạn chế" (Unrestricted)**.
* **Xiaomi / Redmi (MIUI / HyperOS):** Cài đặt $\rightarrow$ Ứng dụng $\rightarrow$ Quản lý ứng dụng $\rightarrow$ SafeSolo $\rightarrow$ Bật **"Tự khởi chạy" (Autostart)** và Tiết kiệm pin $\rightarrow$ Chọn **"Không hạn chế"**.
* **OPPO / Realme (ColorOS):** Cài đặt $\rightarrow$ Pin $\rightarrow$ Quản lý pin cho ứng dụng $\rightarrow$ SafeSolo $\rightarrow$ Cho phép chạy ngầm và cho phép tự khởi động.
* **Khóa Ứng dụng trong Đa nhiệm (Lock in Recent Apps):** Mở màn hình đa nhiệm $\rightarrow$ Giữ biểu tượng SafeSolo $\rightarrow$ Nhấn biểu tượng Ổ khóa 🔒.

### 4. Cơ chế Xuất Báo cáo Thực nghiệm 1 Tháng (30-Day Export)
* Tại màn hình Lịch sử Sức khỏe (`HealthHistoryPage`), chọn tab **30 ngày** và nhấn nút **Xuất báo cáo**.
* Dịch vụ `HealthReportExportService` tự động trích xuất toàn bộ dữ liệu: nhịp tim trung bình, nồng độ oxy $SpO_2$, số bước chân hàng ngày, số ca kích hoạt cảnh báo và tỷ lệ tuân thủ điểm danh an toàn ra định dạng **Excel (.xlsx)**, **PDF** và **CSV**.

---

## 🧮 12 THUẬT TOÁN AI, DSP & TOÁN HỌC CỐT LÕI

Dưới đây là chi tiết 12 thuật toán xử lý tín hiệu số (DSP), trí tuệ nhân tạo (AI) và trắc địa toán học được cài đặt hoàn chỉnh trong dự án:

| STT | Thuật toán | Vị trí cài đặt mã nguồn | Mục đích & Ý nghĩa Kỹ thuật | Công thức Toán học & Ngưỡng Kích hoạt |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Bộ lọc thông dải Butterworth bậc 2** | `AiSignalProcessor.aiFilterPPG` | Khử trôi đường nền (baseline wander) và triệt tiêu nhiễu điện lưới trên tín hiệu PPG | Dải thông $0.5 - 5.0\text{ Hz}$ ($30 - 300\text{ BPM}$):<br>$$H(s) = \frac{1}{1 + \sqrt{2}\left(\frac{s}{\omega_c}\right) + \left(\frac{s}{\omega_c}\right)^2}$$ |
| **2** | **Bộ lọc Trung bình Trượt (Moving Average)** | `AiSignalProcessor.smoothPPG` | Làm mượt dao động ngẫu nhiên tần số cao | Cửa sổ trượt $N = 5$ mẫu:<br>$$y[n] = \frac{1}{N} \sum_{k=0}^{N-1} x[n-k]$$ |
| **3** | **Dò đỉnh Thích nghi Động học (Adaptive Peak Detect)** | `AiSignalProcessor.detectHeartRate` | Tính nhịp tim BPM chính xác, chống đếm trùng sóng phản xạ | Ngưỡng động $V_{th} = \mu + 0.6\sigma$; Thời gian trơ sinh học $T_{refractory} = 320\text{ ms}$ |
| **4** | **Tỷ số Quang học Beer-Lambert (Ratio-of-Ratios)** | `AiSignalProcessor.calculateSpO2` | Đo nồng độ oxy bão hòa trong máu mao mạch không xâm lấn | $$R = \frac{AC_{red}/DC_{red}}{AC_{ir}/DC_{ir}},\quad SpO_2 = 110 - 25R$$ |
| **5** | **Vector Gia tốc Tổng hợp (Kinematic SVM)** | `AiSignalProcessor.calculateSVM` | Bất biến với góc xoay thiết bị, nhận diện va đập chấn thương | $$SVM = \sqrt{a_x^2 + a_y^2 + a_z^2} > 2.5g$$ |
| **6** | **Góc Nghiêng Cơ thể (Body Tilt Angle)** | `AiSignalProcessor.calculateTiltAngle` | Xác định tư thế nằm bất động trên mặt sàn sau cú ngã | $$\theta = \arccos\left(\frac{a_z}{SVM}\right) \times \frac{180^\circ}{\pi} > 60^\circ$$ |
| **7** | **Bộ phân loại SVM Tuyến tính (Linear SVM)** | `AiSignalProcessor.classifyFallSVM` | Phân biệt cú ngã thật với các hoạt động thường ngày (ngồi phịch, nhảy dây) | Hàm quyết định siêu phẳng:<br>$$f(\vec{x}) = \text{sign}(\mathbf{w}^T \vec{x} + b)$$ |
| **8** | **Chuỗi Thời gian Lắc máy Khẩn cấp (Shake-to-SOS)** | `AiSignalProcessor.detectShakeGesture` | Kích hoạt báo động ngầm khi bị cướp giật hoặc khống chế | Cửa sổ trượt $2.0\text{s}$, ghi nhận $\ge 4$ lần đảo chiều gia tốc biên độ $> 18\text{ m/s}^2$ |
| **9** | **Điểm Rủi ro Sinh tồn Đa biến (Survival Risk Score)** | `AiSignalProcessor.calculateSurvivalRiskScore` | Đánh giá mức độ nguy kịch để phân luồng xe cấp cứu | Thang điểm phi tuyến tính $0 - 100$ kết hợp BPM, $SpO_2$, mức pin và thời gian bất động |
| **10** | **Khoảng cách Trắc địa Haversine** | `backend/src/lib/utils.js` | Tìm kiếm Hiệp sĩ cứu hộ gần nhất trên bề mặt hình cầu Trái đất | $$d = 2R \arcsin\left(\sqrt{\sin^2\frac{\Delta\phi}{2} + \cos\phi_1\cos\phi_2\sin^2\frac{\Delta\lambda}{2}}\right)$$ |
| **11** | **Nhận diện Khẩu lệnh Kêu cứu (Keyword Spotting)** | `AiSignalProcessor.evaluateVoiceDistress` | Phát hiện tiếng kêu cứu rảnh tay (*"Cứu tôi với"*) khi kẹt tay | Trích xuất 13 dải phổ tần MFCC kết hợp mô hình phân loại Tiny-CNN on-device |
| **12** | **Bộ lọc Biến thiên Khí áp (Barometer Altitude)** | Sensor Fusion Engine | Phát hiện độ cao rơi tự do khi gặp tai nạn nhà cao tầng | Vận tốc thẳng đứng $v_z = \frac{dh}{dt} > 5\text{ m/s}$ kết hợp $SVM > 3.0g$ |

---

## 📡 CƠ CHẾ ĐIỀU PHỐI CỨU HỘ ĐA KÊNH (OMNICHANNEL DISPATCH)

Khi trạng thái báo động khẩn cấp được kích hoạt, máy chủ SafeSolo đồng thời kích hoạt quy trình phát tán thông tin qua **4 kênh độc lập song song**:

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
3. **Twilio SMS Gateway:** Phát tin nhắn SMS truyền thống đến toàn bộ số điện thoại trong danh bạ bảo hộ ngay cả khi người nhận không có kết nối mạng Internet.
4. **Voice Auto-Call Level 4 (Tổng đài Gọi Tự động):** Tự động thực hiện cuộc gọi khẩn cấp tới Người bảo hộ Ưu tiên 1 và phát giọng đọc Text-to-Speech (TTS) thông báo danh tính, vị trí và loại sự cố của nạn nhân.

---

## 🗄️ CẤU TRÚC CƠ SỞ DỮ LIỆU (MONGODB COLLECTIONS)

* **`users`:** Thông tin tài khoản, mật mã băm bcrypt, tọa độ địa lý mới nhất (GeoJSON Point), trạng thái KYC, danh sách Người bảo hộ phân cấp ưu tiên, cấu hình Khung giờ yên tĩnh (*quietHoursStart / quietHoursEnd*).
* **`emergencylogs`:** Nhật ký các ca SOS, mức độ nghiêm trọng, kinh độ/vĩ độ, trạng thái ca cứu hộ (*pending, assigned, resolved*), danh sách Hiệp sĩ đã tiếp nhận.
* **`devicesignals`:** Lưu trữ lịch sử chuỗi thời gian dữ liệu cảm biến từ Samsung Galaxy Watch 5 ($SpO_2$, $BPM$, $SVM$, gia tốc 3 trục X/Y/Z).
* **`alertevents`:** Sự kiện cảnh báo phát sinh (té ngã chấn thương, trễ hạn check-in, còi hú báo động, ngụy trang cưỡng bức Duress).
* **`checkins`:** Lịch sử các lần điểm danh an toàn, chỉ số tâm trạng (*mood*), tệp ghi âm giọng nói đính kèm.
* **`chats` & `messages`:** Tin nhắn trao đổi, hình ảnh hiện trường, tệp âm thanh Walkie-Talkie giữa nạn nhân, người bảo hộ và hiệp sĩ cứu trợ.
* **`kycrequests`:** Dữ liệu duyệt thẻ Căn cước công dân (ảnh CCCD mặt trước, mặt sau, số định danh, ngày cấp, trạng thái duyệt).
* **`auditlogs`:** Dấu vết kiểm toán an toàn thông tin toàn hệ thống (ghi nhận nhật ký truy cập không thể sửa xóa).

---

## 📸 BỘ SƯU TẬP ẢNH CHỤP THỰC TẾ CHỨC NĂNG (DEMO SCREENSHOTS GALLERY)

> 💡 **Mẹo xem ảnh trên GitHub:** Toàn bộ ảnh chụp thực tế đã được chuẩn hóa độ phân giải cao và lưu trữ trong thư mục `docs/screenshots/`. Bấm trực tiếp vào từng ảnh để phóng to chi tiết.

### A. Giao diện Ứng dụng Di động SafeSolo (Flutter Mobile App)

| 1. Giới thiệu Onboarding | 2. Cấp quyền Hệ thống & 24/7 | 3. Đăng nhập & Hồ sơ |
| :---: | :---: | :---: |
| <img src="docs/screenshots/app_01_onboarding.png" width="240px" alt="Onboarding" /> | <img src="docs/screenshots/app_02_permissions.png" width="240px" alt="Permissions" /> | <img src="docs/screenshots/app_03_auth_login.png" width="240px" alt="Auth Login" /> |

| 4. Quản lý Galaxy Watch 5 | 5. Cài đặt Khung giờ Yên tĩnh | 6. Mạng lưới Người bảo hộ |
| :---: | :---: | :---: |
| <img src="docs/screenshots/app_04_watch_simulator.png" width="240px" alt="Watch Simulator" /> | <img src="docs/screenshots/app_05_settings_quiet_hours.png" width="240px" alt="Quiet Hours" /> | <img src="docs/screenshots/app_06_guardian_network.png" width="240px" alt="Guardian Network" /> |

| 7. Hồ sơ Y tế & Mã QR | 8. Bảo mật & PIN Duress | 9. Két sắt Sinh tử AES-256 |
| :---: | :---: | :---: |
| <img src="docs/screenshots/app_07_medical_id.png" width="240px" alt="Medical ID" /> | <img src="docs/screenshots/app_08_security_stealth.png" width="240px" alt="Stealth Mode" /> | <img src="docs/screenshots/app_09_safety_vault.png" width="240px" alt="Safety Vault" /> |

| 10. Huy hiệu An toàn | 11. Trung tâm Sức khỏe Vitals Hub | 12. Quản lý Đồng hồ 3-Tab |
| :---: | :---: | :---: |
| <img src="docs/screenshots/app_10_achievements.png" width="240px" alt="Achievements" /> | <img src="docs/screenshots/app_11_health_vitals_hub.png" width="240px" alt="Health Vitals Hub" /> | <img src="docs/screenshots/app_12_smartwatch_companion.png" width="240px" alt="Smartwatch 3-Tab" /> |

<p align="center">
  <b>13. Thẻ Trực thám Sức khỏe & Đồng hồ Trực tiếp tại Trang chủ (Home Live Health Glance):</b><br/>
  <img src="docs/screenshots/app_13_home_health_glance.png" width="360px" alt="Home Live Health Glance" style="border-radius: 16px; border: 2px solid #10b981; margin-top: 8px;" />
</p>

---

### B. Giao diện Trung tâm Điều phối Web Admin (Web Admin Dispatch Portal)

#### 1. Bản đồ Cứu hộ Thời gian thực (Live Map SOS Dispatch)
* **Tuyến đường:** `/` (Web Admin)
* **Chức năng:** Giám sát trực quan tọa độ các ca SOS khẩn cấp, hiển thị bán kính cảnh báo 5km, chỉ số sinh tồn ($SpO_2$, $BPM$, pin thiết bị) và các Hiệp sĩ cứu hộ lân cận.
<p align="center">
  <img src="docs/screenshots/01_live_map_dispatch.png" width="95%" alt="Live Map SOS Dispatch" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

#### 2. Điều phối Cứu hộ Đa kênh (Omnichannel Emergency Dispatch)
* **Tuyến đường:** `/omnichannel` (Web Admin)
* **Chức năng:** Giám sát 4 luồng phát tin khẩn cấp đồng thời: Telegram Bot Webhook, Zalo ZNS, Twilio SMS và Voice Auto-Call Level 4.
<p align="center">
  <img src="docs/screenshots/03_omnichannel_dispatch.png" width="95%" alt="Omnichannel Dispatch" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

#### 3. Quản lý & Phê duyệt Xác minh Danh tính CCCD (KYC Verification)
* **Tuyến đường:** `/kyc` (Web Admin)
* **Chức năng:** Tiếp nhận ảnh chụp 2 mặt Căn cước công dân do người dùng tải lên từ camera điện thoại, phê duyệt và cấp huy hiệu Hiệp sĩ tin cậy.
<p align="center">
  <img src="docs/screenshots/04_kyc_verification.png" width="95%" alt="KYC Verification" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

#### 4. Thống kê Ca cứu hộ & Báo cáo Doanh thu (Analytics & Revenue)
* **Tuyến đường:** `/revenue` (Web Admin)
* **Chức năng:** Biểu đồ trực quan thống kê số ca cứu hộ thành công, thời gian tiếp cứu trung bình và phân bổ địa bàn hoạt động.
<p align="center">
  <img src="docs/screenshots/06_analytics_revenue.png" width="95%" alt="Analytics and Revenue" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

#### 5. Nhật ký Kiểm toán Hệ thống & An toàn Dữ liệu (Audit Log)
* **Tuyến đường:** `/audit` (Web Admin)
* **Chức năng:** Lưu vết không thể sửa xóa (*audit trail*) đối với mọi thao tác SOS, phân quyền và dữ liệu y tế theo chuẩn an toàn thông tin.
<p align="center">
  <img src="docs/screenshots/07_system_audit.png" width="95%" alt="System Audit Log" style="border-radius: 10px; border: 1px solid #334155;" />
</p>

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH TỪNG BƯỚC

### 1. Chuẩn bị Môi trường
* **Flutter SDK:** Version $\ge 3.24.0$ (kênh stable)
* **Node.js:** Version $\ge 18.x$ (LTS khuyến nghị)
* **MongoDB:** Bản cài đặt cục bộ (cổng 27017) hoặc chuỗi kết nối MongoDB Atlas URI
* **Android Studio & SDK:** Android SDK Platform API 34+ (hỗ trợ Android 8.0 đến Android 14+)
* **Docker & Docker Compose (Tùy chọn):** Khởi chạy trọn bộ backend chỉ với 1 lệnh

---

### 2. Khởi chạy Nhanh qua Docker Compose (Khuyến nghị)
Hệ thống đã chuẩn bị sẵn cấu hình Docker hoàn chỉnh trong thư mục `backend/`:
```bash
# Khởi chạy trọn gói Backend + MongoDB + Redis thông qua file script tiện ích:
run_docker_backend.bat

# Hoặc khởi chạy thủ công bằng Docker Compose:
cd backend
docker-compose up -d --build
```

---

### 3. Cài đặt & Khởi chạy Thủ công Từng Phân hệ

#### A. Khởi chạy Backend Server (Node.js • MongoDB)
```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Cài đặt các thư viện phụ thuộc
npm install

# 3. Tạo file cấu hình môi trường .env (sao chép từ .env.example)
copy .env.example .env

# 4. Khởi động máy chủ backend ở chế độ phát triển
npm run dev

# Máy chủ backend sẵn sàng tại: http://localhost:4000
```

#### B. Khởi chạy Trung tâm Điều phối Web Admin (React 18 • Vite)
```bash
# 1. Mở cửa sổ dòng lệnh mới và di chuyển vào thư mục web-admin
cd web-admin

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ giao diện
npm run dev

# Cổng truy cập Web Admin: http://localhost:8080
```

#### C. Khởi chạy Ứng dụng Di động SafeSolo (Flutter Mobile)
```bash
# 1. Kiểm tra thiết bị kết nối (điện thoại thật cắm cáp USB hoặc máy ảo)
flutter devices

# 2. Tải toàn bộ packages Flutter
flutter pub get

# 3. Chạy ứng dụng trên thiết bị Android
flutter run -d android

# Hoặc sử dụng file chạy tự động có sẵn trong thư mục gốc:
run_safesolo_android.bat
```

#### D. Khởi chạy Ứng dụng Đồng hồ Samsung Galaxy Watch 5 (Wear OS)
```bash
# Khởi chạy trực tiếp màn hình Wear OS trên máy ảo hoặc đồng hồ thật kết nối qua Wi-Fi ADB:
flutter run -d <wear-os-device-id> --route /wear-os
```

---

## 🧪 HỆ THỐNG KIỂM THỬ TỰ ĐỘNG & MA TRẬN 97 TEST CASES

Dự án được bảo chứng chất lượng nghiêm ngặt với bộ kiểm thử tự động toàn diện và ma trận **97 Test Cases** đặc tả chi tiết:

### 1. Kết quả Kiểm thử Tự động (Flutter Test Suite)
```bash
flutter test
```
```
00:07 +84: All tests passed!
```
* **84/84 Unit & Widget Tests ĐẠT 100%**, bao gồm:
  - `ai_signal_processor_test.dart`: Kiểm thử lọc Butterworth, dò đỉnh BPM, tính SpO2, gia tốc SVM và nhận diện lắc máy Shake-to-SOS.
  - `solocare_ai_test.dart`: Kiểm thử khởi tạo trợ lý SoloCare AI, kịch bản sơ cứu khẩn cấp và nhịp metronome CPR.
  - `walkie_talkie_test.dart`: Kiểm thử bộ đàm Push-to-Talk và luồng âm thanh khẩn cấp.
  - `fake_call_test.dart`: Kiểm thử bộ đếm giây, kịch bản cuộc gọi thoát hiểm và chuyển trạng thái âm thanh.
  - `watch_sync_manager_test.dart`: Kiểm thử giao thức SSWP v1.0 và đồng bộ hóa hai chiều.
  - `galaxy_watch5_interface_test.dart`: Kiểm thử 7 màn hình tròn Wear OS One UI Watch.
  - `telegram_and_gmail_auth_test.dart`: Kiểm thử xác thực đa phương thức Phone / Gmail OTP / Telegram Bot.
  - `health_and_smartwatch_ui_test.dart`: Kiểm thử vòng tròn hoạt động đồng tâm và thẻ tóm tắt sinh tồn.

### 2. Kiểm tra Chất lượng Mã nguồn (Static Code Analysis)
```bash
flutter analyze lib/
```
```
Analyzing lib/...
No issues found! (ran in 4.2s)
```
* **0 Lỗi cú pháp (Errors)**, **0 Cảnh báo (Warnings)**, tuân thủ tuyệt đối quy chuẩn mã nguồn Dart & Flutter Linter.

### 3. Ma trận 97 Test Cases Toàn diện Hệ thống
Bảo đảm tính toàn vẹn nghiệp vụ qua 3 cấp độ ưu tiên:
* **P1 (Critical - Sinh tử):** 58 Test Cases (59.8%)
* **P2 (High - Nghiệp vụ cốt lõi):** 31 Test Cases (32.0%)
* **P3 (Medium - Tiện ích mở rộng):** 8 Test Cases (8.2%)

> 📖 **Xem toàn văn 97 Test Cases chi tiết tại tài liệu:** [docs/TEST_CASES.md](docs/TEST_CASES.md)

---

## 📂 CẤU TRÚC MÃ NGUỒN DỰ ÁN

```
SafeSolo/
├── android/                         # Cấu hình Gradle, quyền hệ thống và mã nguồn gốc Android
│   └── app/src/main/AndroidManifest.xml  # Khai báo quyền 24/7, Doze bypass & <queries> intents
├── assets/                          # Âm thanh còi hú, kịch bản Fake Call, âm metronome CPR, icon
├── backend/                         # Máy chủ điều phối Node.js Express REST API & Socket.IO
│   ├── docker-compose.yml           # Cấu hình triển khai nhanh Docker Compose
│   ├── Dockerfile                   # Docker image tiêu chuẩn sản xuất
│   ├── scripts/                     # Kịch bản kiểm thử tích hợp API tự động
│   ├── src/
│   │   ├── controllers/             # Bộ điều khiển SOS, Auth, User, KYC, Admin Portal
│   │   ├── models/                  # Mongoose Schemas (User, EmergencyLog, DeviceSignal, ...)
│   │   ├── routes/                  # Định tuyến REST APIs
│   │   ├── services/                # sosService, notificationService, heroRadarService, ...
│   │   └── workers/                 # deadmanWorker, duressWorker
│   └── server.js                    # Điểm khởi chạy máy chủ Backend
├── docs/                            # Tài liệu đặc tả kỹ thuật và học thuật đồ án
│   ├── screenshots/                 # 22 ảnh chụp thực tế màn hình Mobile App & Web Admin
│   ├── TEST_CASES.md                # Ma trận 97 Test Cases kiểm thử toàn diện hệ thống
│   ├── co-so-du-lieu-chi-tiet.txt   # Thiết kế chi tiết Cơ sở dữ liệu MongoDB
│   └── thuat-toan-ai-chi-tiet.md    # Đặc tả chi tiết 12 thuật toán AI & DSP
├── lib/                             # Toàn bộ mã nguồn ứng dụng đa nền tảng Flutter
│   ├── core/                        # Theme giao diện, hằng số cấu hình, AppProvider quản lý trạng thái
│   ├── models/                      # User, Contact, EmergencyEvent, watch_protocol (SSWP)
│   ├── services/                    # Tầng dịch vụ nghiệp vụ:
│   │   ├── ai_signal_processor.dart # 12 thuật toán AI, DSP & trắc địa
│   │   ├── ai_solocare_service.dart # SoloCare AI Groq LLM & CPR metronome
│   │   ├── api_service.dart         # REST client kết nối Backend
│   │   ├── background_safety_service.dart # Dịch vụ chạy ngầm 24/7
│   │   ├── fake_call_service.dart   # Dịch vụ cuộc gọi thoát hiểm giả lập
│   │   ├── health_report_export_service.dart # Xuất báo cáo y tế 30 ngày (Excel/PDF/CSV)
│   │   ├── walkie_talkie_service.dart # Bộ đàm PTT thời gian thực
│   │   ├── watch_sync_manager.dart  # Điều phối kết nối đồng hồ SSWP v1.0
│   │   └── wear_os_service.dart     # Dịch vụ điều khiển đồng hồ Wear OS
│   └── views/                       # Giao diện màn hình ứng dụng:
│       ├── audio/                   # Màn hình Cuộc gọi thoát hiểm giả lập (Fake Call)
│       ├── auth/                    # Đăng nhập SĐT OTP, Gmail OTP, Telegram Bot
│       ├── community_radar/         # Radar Hiệp sĩ, Duyệt KYC CCCD, Dẫn đường Waze/Maps
│       ├── emergency/               # Màn hình SOS khẩn cấp, SoloCare AI Sheet
│       ├── health/                  # Lịch sử sinh tồn, Vòng tròn hoạt động 3 lớp
│       ├── messenger/               # Chat văn bản, tin nhắn thoại, gọi điện khẩn cấp
│       ├── network/                 # Quản lý danh bạ Người bảo hộ 3 cấp ưu tiên
│       ├── permissions/             # Xin quyền hệ thống & Bỏ qua tối ưu pin 24/7
│       ├── settings/                # Khung giờ yên tĩnh, Cấu hình Server URL đa mạng
│       ├── watch/                   # Quản lý Smartwatch Companion 3-Tab
│       └── wear_os/                 # 7 màn hình tròn Wear OS Samsung Galaxy Watch 5
├── test/                            # Bộ kiểm thử tự động 84 bài test đơn vị & giao diện
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
