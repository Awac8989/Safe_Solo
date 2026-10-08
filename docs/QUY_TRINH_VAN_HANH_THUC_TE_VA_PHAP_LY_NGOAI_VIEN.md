# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ VẬN HÀNH THỰC TẾ & PHÁP LÝ NGOẠI VIỆN SAFESOLO
## (CĂN CỨ PHÁP LÝ VIỆT NAM • TÂM LÝ CON NGƯỜI • TÍNH CẤP THIẾT SINH TỒN NGOẠI ĐỜI THẬT)

> **Phiên bản:** 3.0 - Operational Reality & Legal Framework  
> **Áp dụng cho:** Flutter App (Client Nạn nhân & Hiệp sĩ) | Node.js Backend Engine | Web Admin Điều phối & Thẩm định Y tế | Mạng lưới Cứu hộ Đa kênh  
> **Căn cứ Pháp lý & Y tế:**  
> - **Luật Khám bệnh, chữa bệnh 2023 (Điều 87):** Quy định về sơ cứu ban đầu tại cộng đồng và cơ chế miễn trừ trách nhiệm nghề nghiệp.  
> - **Bộ luật Hình sự 2015 (sửa đổi 2017):** Điều 132 (Tội không cứu giúp người đang trong tình trạng nguy hiểm tính mạng) và Điều 23 (Tình thế cấp thiết).  
> - **Bộ luật Dân sự 2015:** Điều 584 và Điều 595 (Miễn trừ bồi thường thiệt hại dân sự trong tình thế cấp thiết và cứu trợ không vụ lợi).  
> - **Nghị định 13/2023/NĐ-CP:** Bảo vệ dữ liệu cá nhân (chia sẻ vị trí và hồ sơ y tế trong tình huống khẩn cấp).  
> - **Thông tư 19/2016/TT-BYT & Quyết định 1904/QĐ-BYT:** Quy chuẩn kỹ thuật sơ cấp cứu ban đầu tại cộng đồng.  

---

## MỤC LỤC
1. [HỆ QUY CHIẾU PHÁP LÝ VIỆT NAM VÀ BẢO VỆ CON NGƯỜI](#1-hệ-quy-chiếu-pháp-lý-việt-nam-và-bảo-vệ-con-người)
2. [CHÂN DUNG VÀ RÀO CẢN TÂM LÝ CỦA 5 NHÓM ĐỐI TƯỢNG NGOẠI ĐỜI THỰC](#2-chân-dung-và-rào-cản-tâm-lý-của-5-nhóm-đối-tượng-ngoại-đời-thực)
3. [ĐẶC TẢ CHI TIẾT 6 LUỒNG HOẠT ĐỘNG CHUẨN THỰC CHIẾN](#3-đặc-tả-chi-tiết-6-luồng-hoạt-động-chuẩn-thực-chiến)
   - [Luồng 1: Điểm danh Sinh tồn Hàng ngày & Xử lý Quá hạn (Dead-man Switch Escalation)](#luồng-1-điểm-danh-sinh-tồn-hàng-ngày--xử-lý-quá-hạn)
   - [Luồng 2: Kích hoạt SOS Cấp cứu & Xử lý Bị khống chế (Dual-PIN Duress Defense)](#luồng-2-kích-hoạt-sos-cấp-cứu--xử-lý-bị-khống-chế)
   - [Luồng 3: Tác chiến Gia đình & Phòng thủ Nghẽn mạng (Guardian War-Room)](#luồng-3-tác-chiến-gia-đình--phòng-thủ-nghẽn-mạng)
   - [Luồng 4: Điều động Hiệp sĩ & Tiếp cận An toàn (Anti-Ambush & Scene Access)](#luồng-4-điều-động-hiệp-sĩ--tiếp-cận-an-toàn)
   - [Luồng 5: Tác chiến Hiện trường Chuẩn Y khoa & Ranh giới Đỏ Hành nghề](#luồng-5-tác-chiến-hiện-trường-chuẩn-y-khoa--ranh-giới-đỏ-hành-nghề)
   - [Luồng 6: Bàn giao Y tế SBAR Cho Kíp 115 & Kích hoạt Hộp đen Pháp lý](#luồng-6-bàn-giao-y-tế-sbar-cho-kíp-115--kích-hoạt-hộp-đen-pháp-lý)
4. [MA TRẬN XỬ LÝ 4 GÓC CHẾT KHỦNG HOẢNG NGOÀI HIỆN TRƯỜNG](#4-ma-trận-xử-lý-4-góc-chết-khủng-hoảng-ngoài-hiện-trường)
5. [CÁC PHÂN HỆ VỆ TINH MỞ RỘNG (OPEN-AED, SAFETAG, SAFEBLOOD, HEROSHIELD)](#5-các-phân-hệ-vệ-tinh-mở-rộng)

---

## 1. HỆ QUY CHIẾU PHÁP LÝ VIỆT NAM VÀ BẢO VỆ CON NGƯỜI

```
┌────────────────────────────────┬────────────────────────────────────────────────────────┐
│ CĂN CỨ PHÁP LÝ BẤT BIẾN        │ ĐIỀU KHOẢN VÀ Ý NGHĨA THỰC TIỄN CHO SAFESOLO           │
├────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. Luật Khám bệnh, chữa bệnh   │ Điều 87: Quy định về sơ cứu ban đầu tại cộng đồng.     │
│    2023 (Hiệu lực từ 01/01/2024│ Người không phải nhân viên y tế ĐƯỢC PHÉP sơ cứu       │
│                                │ theo khả năng được tập huấn và ĐƯỢC MIỄN TRƯ TRÁCH     │
│                                │ NHIỆM khi hành động thiện chí cứu người khẩn cấp.       │
├────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 2. Bộ luật Hình sự 2015        │ Điều 132: Tội không cứu giúp người đang ở trong tình   │
│    (Sửa đổi, bổ sung 2017)     │ trạng nguy hiểm đến tính mạng (nghĩa vụ của công dân). │
│                                │ Điều 23: Tình thế cấp thiết (hành vi gây thiệt hại nhỏ │
│                                │ hơn để ngăn chặn thiệt hại tính mạng KHÔNG phải tội).  │
├────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3. Bộ luật Dân sự 2015         │ Điều 584 & Điều 595: Miễn trừ nghĩa vụ bồi thường thiệt│
│                                │ hại dân sự trong tình thế cấp thiết và cứu nạn tự nguyện│
│                                │ không vụ lợi (Good Samaritan Shield).                  │
├────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 4. Nghị định 13/2023/NĐ-CP     │ Bảo vệ dữ liệu cá nhân: Dữ liệu y tế và GPS là nhạy cảm│
│    về Bảo vệ Dữ liệu Cá nhân   │ Chỉ giải mã và chia sẻ khi chủ thể rơi vào nguy kịch   │
│                                │ (Điều 17 - Xử lý dữ liệu trong tình huống khẩn cấp).   │
├────────────────────────────────┼────────────────────────────────────────────────────────┤
│ 5. Thông tư 19/2016/TT-BYT &   │ Quy chuẩn kỹ thuật sơ cấp cứu ban đầu: Giới hạn danh mục│
│    Quyết định 1904/QĐ-BYT      │ thao tác được làm ngoài viện (CPR, nẹp, garô cầm máu). │
└────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. CHÂN DUNG VÀ RÀO CẢN TÂM LÝ CỦA 5 NHÓM ĐỐI TƯỢNG NGOẠI ĐỜI THỰC

1. **Nạn nhân / Người sống độc lập (Victim):**
   * *Tâm lý:* E ngại bị ứng dụng theo dõi GPS 24/7 gây mất tự do cá nhân; khi đột quỵ hay hạ đường huyết thì tay chân run rẩy, bất tỉnh, không thể bấm máy; khi bị đe dọa vũ lực thì nếu còi hú to sẽ bị kẻ cướp hành hung dã man hơn.
2. **Người bảo trợ / Gia đình ruột thịt (Guardian):**
   * *Tâm lý:* Ban đêm ngủ say để chế độ Không làm phiền (Do Not Disturb); khi nhận tin dữ thì hoảng loạn gọi điện thoại liên tục gây nghẽn sóng và tụt pin máy nạn nhân; bố mẹ lớn tuổi không biết thao tác ứng dụng phức tạp.
3. **Hiệp sĩ Cứu hộ Tình nguyện (First Responder):**
   * *Tâm lý:* Sợ bị bẫy dàn cảnh cướp xe máy lúc nửa đêm; sợ bị người nhà nạn nhân đánh oan vì tưởng là người đâm xe; sợ bị kiện tụng hoặc công an giữ xe khi nạn nhân tử vong; sợ phơi nhiễm dịch thể (máu/HIV).
4. **Điều phối viên Trung tâm & Bác sĩ Cố vấn (Dispatcher & Medical Board):**
   * *Trách nhiệm:* Chịu áp lực thời gian tính bằng giây; cần bộ lọc chống báo động giả tuyệt đối; chỉ điều phối người có kỹ năng phù hợp vào đúng tổn thương.
5. **Kíp Cấp cứu 115 & Công an Cơ sở (Professional EMS & Police):**
   * *Thực tế:* Xe 115 thường mất 15-30 phút mới đến nơi do kẹt xe và đường hẻm; bác sĩ chỉ có 15 giây để tiếp nhận thông tin lâm sàng tóm tắt (SBAR), cần thông tin súc tích chuẩn y khoa.

---

## 3. ĐẶC TẢ CHI TIẾT 6 LUỒNG HOẠT ĐỘNG CHUẨN THỰC CHIẾN

### Luồng 1: Điểm danh Sinh tồn Hàng ngày & Xử lý Quá hạn (Dead-man Switch Escalation)
```
[MỨC 0: SINH HOẠT THƯỜNG]
Người dùng sinh hoạt bình thường. Hệ thống KHÔNG BẬT GPS liên tục (Tiết kiệm pin & Bảo vệ riêng tư).
  │
  ├─ Tự động Check-in ngầm: Mở khóa màn hình, bước chân máy đếm (Wear OS), sạc pin -> Hẹn giờ tự reset.
  │
[HẾT HẠN CHECK-IN TỰ ĐỘNG - T+0 phút]
Quá thời gian cam kết an toàn (ví dụ: 12 tiếng không có bất kỳ tương tác nào trên điện thoại/đồng hồ).
  │
  ▼
[CẤP ĐỘ 1: NHẮC NHỞ DỊU DÀNG (T+0m -> T+15m)]
  ├── Điện thoại rung nhẹ, phát tiếng chuông êm dịu: "Bạn có khỏe không? Chạm để xác nhận an toàn".
  ├── Màn hình hiện nút lớn "TÔI ỔN" (Một chạm là tắt).
  │   ├── [Bấm Tôi Ổn] ──> Reset chu kỳ 12h tiếp theo. (Kết thúc)
  │   └── [Bận đi tắm / Ngủ tiếp] ──> Bấm nút "Báo lại sau 30 phút".
  │
  ▼ (Không phản hồi sau 15 phút)
[CẤP ĐỘ 2: CẢNH BÁO NỘI BỘ MẠNH (T+15m -> T+30m)]
  ├── Đồng hồ thông minh rung giật ngắt quãng trên cổ tay.
  ├── Điện thoại bật âm lượng 100%, còi hụ ngắt quãng: "SafeSolo cảnh báo: Vui lòng chạm vào màn hình!".
  ├── Màn hình sáng đèn Flash LED liên tục để đánh thức nếu người dùng ngủ say hoặc say rượu.
  │   └── [Người dùng tỉnh dậy tắt máy] ──> Ghi log ngủ quên, reset hệ thống.
  │
  ▼ (Vẫn bất động hoàn toàn sau 30 phút -> Nghi ngờ bất tỉnh/đột quỵ)
[CẤP ĐỘ 3: KÍCH HOẠT VÒNG TRÒN THÂN YÊU (T+30m -> T+45m)]
  ├── Server tự động giải mã tọa độ GPS gần nhất (Last Known Location).
  ├── Tự động gọi điện thoại AI (Voice Call) tới Người bảo trợ 1:
  │   "SafeSolo thông báo: Người thân [Tên] đã 12 tiếng 30 phút không tương tác và không tắt báo động. Vui lòng kiểm tra ngay!"
  ├── Bật màn hình War-Room trên app của Người bảo trợ để người nhà bấm nút gọi trực tiếp.
  │
  ▼ (Người nhà gọi không nghe máy + Xác nhận không liên lạc được)
[CẤP ĐỘ 4: KÍCH HOẠT HIỆP SĨ KIỂM TRA TẬN NƠI (WELLNESS CHECK - T+45m+)]
  ├── Điều phối Hiệp sĩ Tier 1 gần nhất đến địa chỉ phòng trọ / nhà riêng.
  ├── Hiệp sĩ đến gõ cửa, gọi chủ nhà trọ / tổ trưởng dân phố cùng chứng kiến.
  └── Nếu phát hiện nạn nhân nằm bất tỉnh bên trong ──> Kích hoạt ngay LUỒNG CỨU NẠN KHẨN CẤP.
```

### Luồng 2: Kích hoạt SOS Cấp cứu & Xử lý Bị khống chế (Dual-PIN Duress Defense)
1. **Phát hiện sự cố:** IMU nhận diện va đập mạnh $> 25\text{ m/s}^2$ + bất động $> 10$ giây, hoặc bấm giữ SOS 3 giây.
2. **Xác minh tại chỗ 15 giây:** Đèn Flash chớp, còi hụ to, đếm ngược tiếng Việt: 15... 14... 13...
3. **Phân nhánh 3 kịch bản:**
   - *Rơi máy (Báo động giả):* Bấm "Tôi an toàn" và nhập **PIN Thật** $\to$ Hủy ca an toàn.
   - *Bị kẻ xấu khống chế:* Nhập **Duress PIN (Mã Cưỡng Bức)** $\to$ Màn hình giả vờ tắt còi, hiện chữ "Đã hủy", nhưng dưới nền âm thầm bật **Silent SOS (P0)**, truyền GPS cho Công an và ghi âm môi trường 5 phút.
   - *Bất tỉnh / Hết 15s:* Tự động kích hoạt **Báo động Đỏ P1**, khóa màn hình hiện thẻ ICE và đẩy vào Radar điều phối.

### Luồng 3: Tác chiến Gia đình & Phòng thủ Nghẽn mạng (Guardian War-Room)
1. **AI Voice Call:** Gọi thẳng SIM số điện thoại của người thân, phá vỡ chế độ im lặng ban đêm.
2. **Zero-Install Web Tracking:** Gửi SMS chứa đường dẫn trực tiếp mở bản đồ xem ngay lộ trình của Hiệp sĩ mà không cần cài app hay đăng nhập.
3. **Chống bão cuộc gọi:** Mọi cuộc gọi đến máy nạn nhân được điều hướng vào phòng tác chiến ảo (War-Room) với bộ đàm Walkie-talkie và kênh chat với Hiệp sĩ, ngăn chặn nguy cơ hết pin máy nạn nhân hoặc kẻ xấu phát hiện tiếng chuông.

### Luồng 4: Điều động Hiệp sĩ & Tiếp cận An toàn (Anti-Ambush & Scene Access)
1. **Skill-Based Dispatch:** Quét trong bán kính 1.2km, chỉ điều phối Hiệp sĩ có chứng chỉ y tế còn hạn và đúng kỹ năng ca yêu cầu (Score 4 biến).
2. **Khóa nguyên tử (Atomic Lock):** Hiệp sĩ vuốt nhận ca trong 30 giây; chỉ 1 người được gán, người sau nhận thông báo cảm ơn và tích điểm sẵn sàng.
3. **Buddy System (Chống bẫy cướp):** Tại vùng vắng từ 23h - 5h sáng, bắt buộc tối thiểu 2 Hiệp sĩ cùng chấp nhận mới giải mã tọa độ chính xác; 2 Hiệp sĩ hẹn gặp nhau tại ngã tư đèn đường cách 200m trước khi cùng tiến vào.
4. **Còi tầm gần (Proximity Beacon):** Khi cách $< 25\text{m}$, Hiệp sĩ bấm nút kích hoạt còi flash trên máy nạn nhân để tìm kiếm trong hẻm sâu, nhà trọ kín.

### Luồng 5: Tác chiến Hiện trường Chuẩn Y khoa & Ranh giới Đỏ Hành nghề
1. **3S Scene Safety:** Quan sát 3 giây (Hiện trường có điện hở, cháy nổ, bạo lực không?). Đeo găng tay y tế Nitrile bảo vệ bản thân (BSI).
2. **Khảo sát DRSABCD & Thang tri giác AVPU:**
   - D (Danger) $\to$ R (Response - AVPU) $\to$ S (Send for help) $\to$ A (Airway) $\to$ B (Breathing) $\to$ C (CPR 100-120 bpm với Metronome) $\to$ D (Defibrillation - AED).
3. **Bảng Ranh giới Đỏ Hành nghề:**
   - *ĐƯỢC LÀM:* CPR ép tim, nẹp cố định chi ở tư thế gãy, đặt garô CAT khi đứt động mạch phun tia (ghi giờ lên trán), giữ trục thẳng đầu cổ (C-spine in-line), hỗ trợ nạn nhân xịt bình xịt hen của chính họ.
   - *CẤM LÀM:* Tự ý rút dị vật cắm sâu (dao, cọc sắt); nắn chỉnh kéo thẳng xương gãy lòi ra ngoài; bế xốc nách gập lưng nạn nhân nghi chấn thương cổ; cho nạn nhân hôn mê uống nước hoặc uống thuốc hạ sốt (nguy cơ sặc ngạt phổi tử vong); tiêm truyền thuốc khi không có bác sĩ 115.

### Luồng 6: Bàn giao Y tế SBAR Cho Kíp 115 & Kích hoạt Hộp đen Pháp lý
1. **Báo cáo 15 giây chuẩn SBAR:**
   - **S (Situation):** Nạn nhân, cơ chế chấn thương, thời gian ngưng tim.
   - **B (Background):** Nhóm máu, tiền sử bệnh, dị ứng thuốc trích từ Medical Snapshot.
   - **A (Assessment):** Đánh giá tri giác AVPU, nhịp thở, chấn thương quan sát được.
   - **R (Recommendation):** Các can thiệp đã làm (phút ép tim, vị trí garô, số lần sốc điện).
2. **Quét mã QR bàn giao:** Bác sĩ 115 quét mã QR trên app Hiệp sĩ để nhập toàn bộ dữ liệu vào phần mềm bệnh viện.
3. **Hộp đen Kỹ thuật số (Immutable Digital Black Box):**
   - Đóng gói Audit Trail: Tọa độ ban đầu của Hiệp sĩ (cách 1.5km), thời gian tiếp cận, ghi âm hiện trường 60s, đồ thị CPR.
   - Dẫn chiếu Điều 87 Luật Khám bệnh, chữa bệnh 2023, Điều 132 BLHS và Điều 584 BLDS bảo vệ toàn diện Hiệp sĩ trước mọi khiếu nại.

---

## 4. MA TRẬN XỬ LÝ 4 GÓC CHẾT KHỦNG HOẢNG NGOÀI HIỆN TRƯỜNG

| Góc chết thực tế | Biểu hiện khủng hoảng | Cách xử lý đúng pháp luật & bảo vệ con người |
| :--- | :--- | :--- |
| **1. Phòng trọ khóa trái cửa ban đêm** | Nạn nhân đột quỵ trong phòng kín, cửa khóa chốt trong. | • Hiệp sĩ **không phá cửa một mình**.<br>• Gọi Chủ trọ / Tổ trưởng dân phố / Công an phường + 2 người làm chứng.<br>• Bật camera quay bằng chứng số.<br>• Phá khóa theo **Điều 23 BLHS (Tình thế cấp thiết)**: Hoàn toàn miễn trừ trách nhiệm. |
| **2. Người nhà hoảng loạn đòi đánh Hiệp sĩ** | Người nhà đến thấy máu me, tưởng Hiệp sĩ đâm xe, lao vào đấm. | • Hiệp sĩ mặc áo phản quang SafeSolo, đeo thẻ cứu hộ QR trước ngực.<br>• Loa ngoài điện thoại phát to: *"Đây là Hiệp sĩ SafeSolo đang sơ cứu theo điều phối GPS"*, trích xuất lộ trình di chuyển.<br>• App người nhà rung chuông xác nhận danh tính người cứu hộ. |
| **3. Tai nạn ở vùng mất sóng hoàn toàn** | Nạn nhân ngã dưới hầm B3 hoặc đèo dốc không có 4G. | • Timeout quá 4 giây tự chuyển sang **SMS GSM 2G**.<br>• Nếu mất cả sóng di động: App bật **Còi âm học khẩn cấp 115dB mã Morse (S-O-S)** và chớp Flash LED định vị. |
| **4. Kẻ xấu dàn cảnh cướp xe Hiệp sĩ** | SOS giả mạo ở bãi đất hoang lúc 1h sáng để dụ Hiệp sĩ đến cướp. | • Lọc tài khoản: Bắt buộc eKYC CCCD mới được kích hoạt mạng lưới Hiệp sĩ.<br>• Kích hoạt **Buddy System**: Bắt buộc 2 Hiệp sĩ cùng nhận lệnh, điểm hẹn cách 200m trước khi cùng tiến vào. |

---

## 5. CÁC PHÂN HỆ VỆ TINH MỞ RỘNG
1. **OpenAED & SafePoint Network:** Định vị máy sốc điện AED công cộng, điều hướng Hiệp sĩ ghé lấy AED (Waypoint Routing) trên đường tiếp cận nạn nhân ngừng tim.
2. **SafeTag Offline ICE Tag:** Vòng tay / thẻ NFC vật lý laser QR không phụ thuộc pin và sóng điện thoại, cơ chế bảo mật 2 tầng (Tầng 1 công khai, Tầng 2 chuyên sâu cho bác sĩ).
3. **SafeBlood Urgent Relay:** Điều phối người hiến máu khẩn cấp theo ma trận nhóm máu hiếm (O-, Rh-) cho bệnh viện tiếp nhận ca chấn thương.
4. **HeroShield Welfare:** Bảo hiểm vi mô Good Samaritan (chi trả thuốc phơi nhiễm PEP, thương tật, xe máy) và chuỗi tự động bù đắp vật tư y tế tiêu hao (garô, gạc, găng tay) sau ca cứu nạn.
