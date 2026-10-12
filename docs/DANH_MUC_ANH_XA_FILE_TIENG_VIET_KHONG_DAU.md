# BẢNG ÁNH XẠ CẤU TRÚC FILE DỰ ÁN SAFESOLO SANG TIẾNG VIỆT KHÔNG DẤU
## HỆ THỐNG AN TOÀN & ĐIỀU PHỐI CỨU NẠN KHẨN CẤP SAFESOLO

> **Mục đích:** Hỗ trợ lập trình viên, giảng viên và hội đồng nghiệm thu tra cứu nhanh chóng toàn bộ cây thư mục mã nguồn sang tên gọi nghiệp vụ tiếng Việt không dấu và có dấu.  
> **Nguyên tắc an toàn:** Không đổi tên vật lý file code để đảm bảo tuân thủ chuẩn quốc tế **Effective Dart (Google)**, tránh xung đột import và lỗi build trên Android/iOS.

---

## 1. MỤC LỤC THƯ MỤC CHÍNH (CORE DIRECTORIES)

| Thư mục gốc | Tên tiếng Việt không dấu | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| `lib/` | `thu_vien_ma_nguon_chinh` | Toàn bộ mã nguồn ứng dụng di động Flutter |
| `backend/` | `may_chu_dieu_phoi_backend` | Bộ não xử lý logic ngầm, Node.js, Socket.IO & MongoDB |
| `web-admin/` | `trung_tam_dieu_phoi_web_admin` | Cổng tác chiến điều phối khẩn cấp 24/7 của ban chỉ huy |
| `docs/` | `tai_lieu_nghiep_vu_va_bao_cao` | Đặc tả 24 kịch bản cứu hộ, báo cáo ca, kiến trúc bảo mật |
| `assets/` | `tai_nguyen_hinh_anh_am_thanh` | Còi hú SOS, biểu tượng, chứng thư số, bản đồ |
| `android/` | `cau_hinh_he_dieu_hanh_android` | Cấu hình Full-screen Intent, quyền SMS GSM, nền tảng Android |

---

## 2. PHÂN HỆ GIAO DIỆN NGƯỜI DÙNG (`lib/views/`)

### 2.1. Phân hệ Âm thanh & Cuộc gọi giả (`lib/views/audio/`)
*(Thoát hiểm thông minh khi bị bám đuôi, quấy rối hoặc khống chế)*

| Tên file mã nguồn | Tên tiếng Việt không dấu | Tên tiếng Việt có dấu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- |
| [`fake_call_screen.dart`](file:///c:/Users/Admin/SafeSolo/lib/views/audio/fake_call_screen.dart) | `man_hinh_cuoc_goi_gia` | Màn hình cuộc gọi giả | Giả lập cuộc gọi đến như thật để có cớ thoát khỏi tình huống nguy hiểm |
| [`fake_call_setup_sheet.dart`](file:///c:/Users/Admin/SafeSolo/lib/views/audio/fake_call_setup_sheet.dart) | `cai_dat_cuoc_goi_gia` | Cài đặt cuộc gọi giả | Chọn người gọi (Bố, Mẹ, Cảnh sát), hẹn giờ đổ chuông sau 5s/15s/30s |
| [`walkie_talkie_dialog.dart`](file:///c:/Users/Admin/SafeSolo/lib/views/audio/walkie_talkie_dialog.dart) | `hop_thoai_bo_dam_noi_bo` | Hộp thoại bộ đàm nội bộ | Kênh bộ đàm Push-to-Talk (PTT) nói chuyện trực tiếp với Hiệp sĩ cứu hộ |

---

### 2.2. Phân hệ Hiệp sĩ Cứu hộ & Chuyên môn Lâm sàng (`lib/views/heroes/`)
*(Dành riêng cho lực lượng phản ứng nhanh cứu người ngoại viện)*

| Tên file mã nguồn | Tên tiếng Việt không dấu | Tên tiếng Việt có dấu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- |
| [`heroes_page.dart`](file:///c:/Users/Admin/SafeSolo/lib/views/heroes/heroes_page.dart) | `danh_sach_va_kyc_hiep_si` | Danh sách & KYC Hiệp sĩ | Quản lý hiệp sĩ, đăng ký thẩm định chứng chỉ y tế, bài thi sát hạch 20 câu |
| [`hero_workspace_page.dart`](file:///c:/Users/Admin/SafeSolo/lib/views/heroes/hero_workspace_page.dart) | `khu_vuc_tac_chien_hiep_si` | Khu vực tác chiến hiệp sĩ | Nhận ca SOS, đếm nhịp CPR Metronome, nẹp C-Spine, còi tầm gần, xuất SBAR cho 115 |

---

### 2.3. Phân hệ Sức khỏe & Sinh tồn WearOS (`lib/views/health/`)
*(Theo dõi nhịp tim, oxy máu SpO2, cảnh báo đột quỵ & phát hiện ngã)*

| Tên file mã nguồn | Tên tiếng Việt không dấu | Tên tiếng Việt có dấu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- |
| [`health_history_page.dart`](file:///c:/Users/Admin/SafeSolo/lib/views/health/health_history_page.dart) | `lich_su_suc_khoe` | Lịch sử sức khỏe | Biểu đồ diễn tiến sinh tồn nhiều ngày, thống kê nhịp tim bất thường |
| `widgets/activity_rings_widget.dart` | `vong_hoat_dong_the_chat` | Vòng hoạt động thể chất | Vòng tròn calo, vận động và thời gian đứng trong ngày |
| `widgets/hrv_stroke_card.dart` | `the_canh_bao_dot_quy_hrv` | Thẻ cảnh báo đột quỵ HRV | Phân tích biến thiên nhịp tim (HRV) phát hiện sớm rung nhĩ AFib |
| `widgets/sleep_apnea_monitor_card.dart` | `the_ngung_tho_khi_ngu` | Thẻ ngưng thở khi ngủ | Theo dõi SpO2 ban đêm, phát hiện nguy cơ ngưng thở nguy hiểm |
| `widgets/vitals_matrix_card.dart` | `ma_tran_thong_so_sinh_ton` | Ma trận thông số sinh tồn | Bảng điện tử nhịp tim, SpO2, huyết áp và nhiệt độ thời gian thực |

---

### 2.4. Phân hệ Khẩn cấp & Cứu trợ SOS (`lib/views/emergency/`)

| Tên file mã nguồn | Tên tiếng Việt không dấu | Tên tiếng Việt có dấu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `emergency_sos_screen.dart` | `man_hinh_kich_hoat_sos` | Màn hình kích hoạt SOS | Bấm giữ nút SOS 3 giây, đếm ngược 15s xác minh tại chỗ |
| `sos_countdown_sheet.dart` | `bang_dem_nguoc_huy_sos` | Bảng đếm ngược hủy SOS | Nhập PIN thật để hủy báo động giả, hoặc nhập Duress PIN ngầm |
| `sos_active_view.dart` | `giao_dien_sos_dang_chay` | Giao diện SOS đang chạy | Trạng thái phát tín hiệu, tọa độ trực tiếp, thông báo người nhà |

---

### 2.5. Phân hệ Người thân & Vòng tròn An toàn (`lib/views/circle/`)

| Tên file mã nguồn | Tên tiếng Việt không dấu | Tên tiếng Việt có dấu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `trusted_contacts_page.dart` | `danh_ba_nguoi_than_tin_cay` | Danh bạ người thân tin cậy | Cài đặt số điện thoại người giám hộ nhận cuộc gọi AI & SMS khẩn cấp |
| `guardian_war_room_page.dart` | `phong_tac_chien_gia_dinh` | Phòng tác chiến gia đình | Nơi người nhà theo dõi lộ trình xe hiệp sĩ và chat trực tiếp |

---

### 2.6. Phân hệ Hồ sơ Y tế & Bản quyền Pháp lý (`lib/views/medical/` & `vault/`)

| Tên file mã nguồn | Tên tiếng Việt không dấu | Tên tiếng Việt có dấu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `medical_id_screen.dart` | `ho_so_y_te_safetag` | Hồ sơ y tế SafeTag | Nhóm máu, dị ứng thuốc, bệnh nền, thẻ SafeTag ICE ngoại tuyến |
| `safety_vault_page.dart` | `ket_an_toan_hop_den` | Két an toàn hộp đen | Lưu trữ bản ghi âm, nhật ký GPS có chữ ký số SHA-256 chống tranh chấp |

---

## 3. CÁCH TRA CỨU NHANH TRÊN VS CODE / ANTIGRAVITY IDE

Khi cần mở nhanh bất kỳ file nào trong danh sách trên:
1. Nhấn tổ hợp phím **`Ctrl + P`** (Windows) hoặc **`Cmd + P`** (Mac).
2. Gõ tên tiếng Anh của file (ví dụ: `fake_call`, `hero_work`, `vitals`).
3. IDE sẽ mở ngay lập tức mà không bao giờ gặp lỗi đường dẫn hoặc lỗi build!
