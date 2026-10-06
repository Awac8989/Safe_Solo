# CẨM NANG KHỞI ĐỘNG & KỊCH BẢN DEMO KHÓA LUẬN SAFESOLO
**Tác giả:** Đoàn Minh Quân — **MSSV:** 2224801030137  
**Đề tài:** SafeSolo - Hệ sinh thái An toàn Cá nhân & Cứu hộ Đơn độc Đa nền tảng  
**Thiết bị kiểm thử thực tế:** Samsung Galaxy A71 (Android) + Samsung Galaxy Watch 5 (Wear OS)  

---

## ⚡ PHẦN 1: KHỞI ĐỘNG 1-CLICK TỰ ĐỘNG (KHUYÊN DÙNG)

Mỗi khi bật máy tính lên để chuẩn bị demo cho Thầy/Hội đồng xem:

👉 **Nhấp đúp chuột vào file:**
```
c:\Users\Admin\SafeSolo\START_DEMO_KHOALUAN.bat
```
*(Hoặc vào thư mục `c:\Users\Admin\SafeSolo` nhấp đúp file `START_DEMO_KHOALUAN.bat`)*

File script này sẽ **tự động hoàn toàn 100%**:
1. ✅ Kiểm tra & khởi chạy **Cơ sở dữ liệu MongoDB**.
2. ✅ Bật **Backend Server (Node.js/Express) trên Port 4000**.
3. ✅ Kết nối ADB không dây với điện thoại Samsung Galaxy A71 (`192.168.1.8:5555`).
4. ✅ Thiết lập **Reverse Port 4000** (đảm bảo điện thoại gọi trực tiếp vào API máy tính mà không sợ tường lửa).
5. ✅ Tự động bật màn hình và mở ứng dụng **SafeSolo** trên điện thoại.

---

## 🛠️ PHẦN 2: CÁC CÂU LỆNH THỦ CÔNG (DỰ PHÒNG KHI CẦN)

Nếu bạn muốn tự gõ lệnh trong Terminal/PowerShell:

### 1. Khởi động Backend Server
```powershell
cd c:\Users\Admin\SafeSolo\backend
npm start
```
*(Server sẽ lắng nghe tại `http://localhost:4000`, database MongoDB kết nối tự động)*

### 2. Kết nối Điện thoại Samsung qua ADB Wi-Fi
```powershell
adb connect 192.168.1.8:5555
```

### 3. Thông tuyến Port 4000 vào điện thoại (RẤT QUAN TRỌNG)
```powershell
adb reverse tcp:4000 tcp:4000
```
> **Mẹo vàng khi lên phòng Hội đồng:** Nếu Wi-Fi của trường chặn kết nối nội bộ giữa điện thoại và máy tính, chỉ cần **cắm cáp sạc USB** từ điện thoại vào máy tính, sau đó chạy lệnh `adb reverse tcp:4000 tcp:4000`. Khi đó điện thoại sẽ gọi vào Backend máy tính qua dây cáp với tốc độ cực nhanh, ổn định 100% không cần Wi-Fi!

### 4. Mở ứng dụng SafeSolo trên điện thoại
```powershell
adb shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1
```

---

## 👥 PHẦN 3: TÀI KHOẢN DEMO ĐẶC QUYỀN (HỘI ĐỒNG KHÓA LUẬN)

Trên màn hình đăng nhập `AuthPage` đã tích hợp sẵn khu vực **"TÀI KHOẢN MẪU KHÓA LUẬN (1-CHẠM)"**:

| Vai trò | Họ tên & Thông tin | Số điện thoại | Mã OTP xác thực |
| :--- | :--- | :--- | :--- |
| **Hiệp sĩ Cứu hộ (Đã KYC)** | **Đoàn Minh Quân - MSSV: 2224801030137** | `0913843958` | `888888` (hoặc bấm nút "Điền 888888") |
| **Người dùng cá nhân** | Nguyễn Văn An (Đã có hồ sơ y tế) | `0908889999` | `888888` |
| **Người giám hộ / Bác sĩ** | Trần Thị Mai (Người thân 115) | `0901112222` | `888888` |

---

## 🎯 PHẦN 4: KỊCH BẢN 5 BƯỚC THUYẾT TRÌNH ĂN ĐIỂM TỐI ĐA

Khi Thầy/Hội đồng yêu cầu biểu diễn hệ thống, hãy thực hiện theo thứ tự sau:

### 🔹 Bước 1: Trình diễn Đăng nhập 1-chạm & Phân quyền bảo vệ
- Mở SafeSolo -> Giới thiệu giải pháp bảo vệ người sống đơn độc.
- Bấm vào tài khoản **Đoàn Minh Quân - MSSV: 2224801030137**.
- Nhấn nút xanh **"XÁC MINH & ĐĂNG NHẬP"** (hệ thống tự điền mã OTP `888888`).

### 🔹 Bước 2: Trang chủ SafeSolo, Dead-man's Switch & Bộ 7 Cơ chế Check-in Sinh tồn
- Chỉ vào vòng tròn lớn: **Đồng hồ đếm ngược an toàn** (Heartbeat timer).
- Nhấn chọn các trạng thái nhanh: *Bình an 😊, Tích cực 😇, Hơi mệt 😴*.
- **Nhấn nút "⭐ 7 Cơ chế Check-in" ngay trên thanh tác vụ Trang chủ** để mở bảng điều khiển trung tâm:
  * Trình bày cho Hội đồng: Thay vì phương thức điểm danh thụ động truyền thống chỉ dựa vào 1 nút bấm gây nhàm chán hoặc quên lãng, SafeSolo tiên phong xây dựng **Hệ sinh thái 4 Nhóm - 7 Cơ chế Check-in Đa tầng**:

  1. **NHÓM 1: CẢM BIẾN THỤ ĐỘNG ZERO-TOUCH (KHÔNG CẦN CHẠM)**
     * **Cơ chế 1 - Nhịp tim thức giấc (Sleep Wake-up Pulse):** Cảm biến PPG trên Samsung Galaxy Watch 5 giám sát nhịp tim khi ngủ (50-60 bpm). Khi người dùng thức dậy, nhịp tim sinh lý tăng (>75 bpm) kết hợp cử động gia tốc cổ tay -> Hệ thống tự động xác nhận an toàn buổi sáng (+24h) mà không cần với tay tìm điện thoại. Đặc biệt: nếu sau 9:30 sáng mà nhịp tim bất thường hoặc biến mất, hệ thống kích hoạt cảnh báo nguy cơ đột quỵ khi ngủ! *(Trên đồng hồ: Bấm nút "THỨC GIẤC" ở tab Sức khỏe hoặc bấm nút test trên điện thoại)*.
     * **Cơ chế 2 - Neo trạm sạc & Home Wi-Fi (Home Wi-Fi & Docking Anchor):** Khi về đến nhà (Geofence 50m / kết nối Home Wi-Fi) và cắm sạc điện thoại vào buổi tối -> Hệ thống tự động xác nhận về nhà an toàn, chuyển sang **Chế độ Giờ Nghỉ (Quiet Hours Mode)** không làm phiền giấc ngủ.

  2. **NHÓM 2: VI CỬ CHỈ & PHÍM CỨNG VẬT LÝ (TÌNH HUỐNG KHẨN)**
     * **Cơ chế 3 - Cử chỉ xoay cổ tay 2 nhịp (Double Wrist-Twist Gesture):** Khi người dùng đang nấu ăn dính dầu mỡ, tay ướt, hoặc đang lái xe máy ngoài đường -> Chỉ cần lắc/xoay cổ tay 2 nhịp nhanh. Galaxy Watch 5 rung xúc giác "Tack-tack" và chớp xanh màn hình, đồng bộ socket thời gian thực gia hạn an toàn tức thì. *(Trên đồng hồ: Bấm nút "Lắc cổ tay" ở tab Điểm danh)*.
     * **Cơ chế 4 - Tổ hợp phím cứng vật lý (Hardware Key Combo):** Trong tình huống màn hình bị rơi nứt vỡ, tay ướt nước mưa hoặc điện thoại nằm trong túi quần -> Bấm tổ hợp phím âm lượng/Home để điểm danh ngầm an toàn.

  3. **NHÓM 3: KHẨU LỆNH RẢNH TAY & MẬT MÃ NGỤY TRANG (VOICE & DURESS)**
     * **Cơ chế 5A - Khẩu lệnh an toàn (Voice Safe-phrase):** Nói câu *"SafeSolo, tôi an toàn"* khi đang bận hai tay -> Nhận diện giọng nói hoàn tất điểm danh.
     * **Cơ chế 5B - MẬT MÃ NGỤY TRANG GIẢI CỨU (Stealth Duress Coercion) — ĐIỂM SÁNG ĐỘT PHÁ:** Khi nạn nhân bị kẻ gian đột nhập hoặc khống chế ép buộc phải điểm danh, nạn nhân nói câu ngụy trang đã cài đặt trước: *"Tôi đang rất bận"* hoặc *"Hôm nay trời đẹp"*. Màn hình điện thoại **VẪN HIỆN TÍCH XANH HOÀN TẤT ĐIỂM DANH** để đánh lừa kẻ thủ ác, nhưng thực tế hệ thống ngầm **KÍCH HOẠT DURESS SOS KHẨN CẤP**, tự động ghi âm 30 giây môi trường xung quanh và gửi tọa độ GPS trực tiếp tới người thân & công an!

  4. **NHÓM 4: XÃ HỘI HỌC GIA ĐÌNH & TRÁCH NHIỆM SỨC KHỎE (BUDDY & HEALTH)**
     * **Cơ chế 6 - Điểm danh chéo Người thân / Cặp đôi (Buddy / Couple Cross Check-in):** Khi con cái điểm danh, điện thoại Mẹ nhận được tín hiệu thông báo nhẹ nhàng -> Mẹ nhấn 1-chạm *"Mẹ cũng an toàn"* để tự động gia hạn an toàn cho cả hai mẹ con.
     * **Cơ chế 7 - Điểm danh uống thuốc & AI Vision (Medication Vision Check-in):** Vào khung giờ 8:00 sáng/tối, hệ thống nhắc nhở uống thuốc định kỳ. Người dùng giơ vỉ thuốc quét camera hoặc bấm *"Đã uống thuốc"* -> Vừa hoàn thành điểm danh sinh tử, vừa tự động ghi nhận vào sổ nhật ký y tế.

- **Tính năng nâng cấp bổ sung — Check-in theo lộ trình (Journey Check-in - 30 đến 60 phút):**
  * Nhấn vào thẻ **"Check-in theo lộ trình (30–60p)"** ngay trên Trang chủ.
  * Chọn tình huống: *Đi làm ca đêm / Đoạn đường vắng / Đi taxi hoặc Grab đêm*.
  * Chọn thời gian: **30 phút** hoặc **60 phút** và bấm **"BẮT ĐẦU BẢO VỆ HÀNH TRÌNH"**.
  * Trình diễn cơ chế sinh tồn tối thượng: Nếu hết thời gian đếm ngược mà người dùng **KHÔNG bấm "Tôi đã về nhà an toàn"**, hệ thống sẽ **lập tức tự động phát tín hiệu SOS khẩn cấp kèm tọa độ GPS trực tiếp** gửi tới Telegram Bot người thân, Zalo ZNS và kích hoạt còi báo động cứu hộ!
- Giới thiệu danh sách Người bảo trợ đang trực tuyến (`Guardian 21A`, `Guardian 21B`) kèm mức pin thời gian thực.

### 🔹 Bước 3: Thẻ Cấp Cứu Màn Hình Khóa & Mã QR Y Tế 115 (Điểm sáng đồ án)
- Chọn tab **Cài đặt** (góc dưới bên phải) -> Nhấn vào mục **"Hồ sơ y tế khẩn cấp"**.
- Cho Thầy xem các thông tin quan trọng: *Họ tên, Năm sinh, CCCD, Nhóm máu (O+), Bệnh nền, Thuốc đang dùng, Số điện thoại khẩn cấp*.
- Nhấn nút **"Tạo QR"** trên góc phải: Mã QR được chuẩn hóa để y bác sĩ cấp cứu 115 có thể dùng bất kỳ camera điện thoại nào quét ngay lập tức để cứu chữa mà **không cần mở khóa điện thoại nạn nhân**.
- Nhấn vào banner **"Thẻ Cấp Cứu Màn Hình Khóa"** để xem giao diện y tế nền đen chuyên dụng (Clinical Dark Navy).

### 🔹 Bước 4: Vòng tròn bảo vệ Circle & Giám sát Live Radar
- Chuyển sang tab **Circle** và **Tin nhắn**:
- Trình bày tính năng liên lạc khẩn cấp PTT (Push-To-Talk) và cơ chế tự động gửi tin nhắn kèm tọa độ GPS trực tiếp tới người thân khi người dùng mất liên lạc quá thời gian an toàn.

### 🔹 Bước 5: Thoát hiểm thông minh (Fake Call & Stealth Mode)
- Trình diễn tính năng **Cuộc gọi ảo (Fake Call)**: Cung cấp cuộc gọi mô phỏng với giọng nói giả lập để người dùng có cớ rút lui an toàn khi bị bám đuôi hoặc rơi vào tình huống nguy hiểm nơi vắng vẻ.

### 🔹 Bước 6: Safe Solo Watch — Đột Quỵ Đối Xứng 2 Tay & Mốc Giờ Vàng (ĐỈNH CAO Y KHOA ĐỒ ÁN)
- **Kịch bản thực chứng lâm sàng:** Buổi chiều của ông Tư (Rót trà, tay phải lỏng dần rơi chén xuống sàn trong khi tay trái vẫn lật báo).
- **Cách thao tác biểu diễn:**
  * **Cách 1 (Trên Đồng Hồ):** Vuốt sang màn hình **"ĐỘT QUỴ 2 TAY" (Stroke Shield)** -> Nhấn nút tím **"DEMO: BUỔI CHIỀU ÔNG TƯ"**.
  * **Cách 2 (Trên Điện Thoại):** Vào Cài đặt -> **"Phòng Thí Nghiệm & Sandbox"** -> Tab Kịch bản khẩn cấp -> Nhấn **"🍵 Bắt Đầu Kịch Bản: Buổi Chiều Ông Tư"**.
- **Diễn biến các pha thuyết trình trước Hội đồng:**
  1. **Đối chiếu 2 cổ tay:** Tay trái (Watch) lật báo (dao động 1.8g) vs Tay phải (Vòng phụ) bất động chỉ chịu trọng lực tĩnh g -> BMAI vọt lên 88.5%.
  2. **Biểu đồ phân tán Poincaré Plot:** Xuất hiện rung nhĩ (AFib scatter) làm tăng nguy cơ đột quỵ gấp 5 lần.
  3. **Hỏi thăm 3 kênh:** Đồng hồ rung và hỏi *"Bác Tư có ổn không?"* với 3 phương thức phản hồi cho người liệt 1 tay (Chạm 1-chạm, Lắc cổ tay, Giọng nói).
  4. **Bài test phản xạ 10s (Pronator Drift):** Khi nghi ngờ lú lẫn bấm tắt nhầm, đồng hồ bắt nhắm mắt giơ 2 tay -> phát hiện tay phải trôi xuống góc -18° do mất trương lực cơ!
  5. **Mốc Giờ Vàng (4.5h rtPA):** Tự động phát lệnh gọi 115 và gửi SMS cho con gái ông Tư kèm mốc thời gian khởi phát chính xác (yếu tố quyết định cửa sổ tiêu sợi huyết não) và danh mục thuốc đang dùng.
  6. **3 Điểm giới hạn y khoa:** Nhấn nút `ℹ️ 3 Điểm giới hạn` để Hội đồng thấy tính khách quan, khoa học và chặt chẽ của đề tài.

---

## 💡 XỬ LÝ SỰ CỐ NHANH (NẾU CÓ)
- **Nếu điện thoại mất kết nối ADB Wi-Fi:** Cắm cáp USB vào máy tính, chạy lại `START_DEMO_KHOALUAN.bat`.
- **Nếu cần reset lại màn hình đăng nhập từ đầu:** 
  Chạy lệnh: `adb -s 192.168.1.8:5555 shell pm clear com.example.safesolo && adb shell monkey -p com.example.safesolo -c android.intent.category.LAUNCHER 1`.
- **Backend log:** Cửa sổ dòng lệnh Backend `SafeSolo Backend Server (Port 4000)` sẽ in log chi tiết từng lượt request, socket realtime và OTP để Thầy kiểm chứng kiến trúc backend.
