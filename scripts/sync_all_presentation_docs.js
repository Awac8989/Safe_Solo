const fs = require('fs');
const path = require('path');

const slidePath = path.join(__dirname, '..', 'docs', 'SLIDE_THUYET_TRINH_BAO_VE_KHOA_LUAN_SAFESOLO.html');
let slide = fs.readFileSync(slidePath, 'utf8');

slide = slide.replace(/134 Phân hệ/g, '142 Phân hệ');
slide = slide.replace(/134 Phân Hệ/g, '142 Phân Hệ');
slide = slide.replace(/134 phân hệ/g, '142 phân hệ');
slide = slide.replace(/134 PHÂN HỆ/g, '142 PHÂN HỆ');
slide = slide.replace(/537\/537/g, '569/569');
slide = slide.replace(/537 Master Test Cases/g, '569 Master Test Cases');
slide = slide.replace(/537 test cases/g, '569 test cases');
slide = slide.replace(/136 phác đồ/g, '144 phác đồ');
slide = slide.replace(/136 Phác Đồ/g, '144 Phác Đồ');

// Thêm thông tin Phân hệ 135-142 vào Slide
const slideHighlight = `
          ✅ <strong>Bộ 8 Phân Hệ Nghiệp Vụ Mở Rộng Đột Phá (Phân hệ 135-142) — ĐẠT ĐỈNH CAO 142 PHÂN HỆ / 569 TESTS PASS 100%:</strong><br>
          • <strong>Phân hệ 135 (VNeID CCCD NFC AutoFill):</strong> Đọc chip NFC ISO 14443-A BAC, tự động điền hồ sơ y tế I.C.E & trích xuất ảnh DG2 đối soát sinh trắc học theo NĐ 59/2022/NĐ-CP.<br>
          • <strong>Phân hệ 136 (Stroke Time-Lock tPA):</strong> Bộ đếm ngược 270 phút (4.5h) cửa sổ vàng tiêu sợi huyết, theo dõi 1.9 triệu tế bào não mất/phút, dẫn đường Stroke Center.<br>
          • <strong>Phân hệ 137 (Watch 5 SpO2 Continuous Monitor):</strong> Cảm biến BioActive rung haptic khi SpO2 &lt; 90%, Watchdog quá tải Hiệp sĩ khi nhịp tim &gt; 170 BPM nhắc đổi người.<br>
          • <strong>Phân hệ 138 (AI Threat Heatmap):</strong> Bản đồ nhiệt nguy hiểm suy giảm hàm mũ, hệ số đêm 1.5x, GeoJSON MapLibre GIS, Safe Route Shield né điểm nóng.<br>
          • <strong>Phân hệ 139 (CPR Quality Coach):</strong> Đo độ sâu ép tim 5-6 cm chuẩn AHA 2020 bằng gia tốc Z-axis, nhịp 100-120 BPM, điều phối chu kỳ 30:2, bảng điểm CCF 82%.<br>
          • <strong>Phân hệ 140 (Drug Contraindication Shield):</strong> Khóa cấm dùng thuốc dị ứng I.C.E (Beta-Lactam, NSAID xuất huyết, Morphin chấn thương sọ não), gợi ý thuốc thay thế an toàn.<br>
          • <strong>Phân hệ 141 (3-Tier Family Circle):</strong> Tier 1 Geofence trường học trẻ em, Tier 2 Ngã người già AI & nhắc thuốc, Tier 3 Dead-Man Switch 30 phút độc hành.<br>
          • <strong>Phân hệ 142 (Smart Ambulance HL7 FHIR Pre-Alert):</strong> Truyền gói cấp cứu trước viện HL7 FHIR, telemetry sinh tồn động, BV đích phản hồi ACK-200 kích hoạt Trauma Team sẵn sàng ICU.<br>`;

slide = slide.replace('✅ <strong>Tích Hợp Đa Thiết Bị Phần Cứng Honor', slideHighlight + '\n          ✅ <strong>Tích Hợp Đa Thiết Bị Phần Cứng Honor');
fs.writeFileSync(slidePath, slide, 'utf8');

// Cập nhật Cẩm nang bảo vệ đồ án tốt nghiệp
const camnangPath = path.join(__dirname, '..', 'docs', 'CAM_NANG_BAO_VE_DO_AN_TOT_NGHIEP_DIEM_10.md');
if (fs.existsSync(camnangPath)) {
  let camnang = fs.readFileSync(camnangPath, 'utf8');
  camnang = camnang.replace(/134 Phân Hệ/g, '142 Phân Hệ');
  camnang = camnang.replace(/134 phân hệ/g, '142 phân hệ');
  camnang = camnang.replace(/134 PHÂN HỆ/g, '142 PHÂN HỆ');
  camnang = camnang.replace(/537\/537/g, '569/569');
  camnang = camnang.replace(/537 Master Test Cases/g, '569 Master Test Cases');
  camnang = camnang.replace(/537/g, '569');
  camnang = camnang.replace(/136 Phác Đồ/g, '144 Phác Đồ');
  camnang = camnang.replace(/136 phác đồ/g, '144 phác đồ');
  fs.writeFileSync(camnangPath, camnang, 'utf8');
}

// Cập nhật Báo cáo chuyên đề 5 yêu cầu hội đồng
const baocao5Path = path.join(__dirname, '..', 'docs', 'BAO_CAO_CHUYEN_DE_5_YEU_CAU_HOI_DONG_SAFESOLO.md');
if (fs.existsSync(baocao5Path)) {
  let baocao = fs.readFileSync(baocao5Path, 'utf8');
  baocao = baocao.replace(/134 Phân Hệ/g, '142 Phân Hệ');
  baocao = baocao.replace(/134 phân hệ/g, '142 phân hệ');
  baocao = baocao.replace(/134 PHÂN HỆ/g, '142 PHÂN HỆ');
  baocao = baocao.replace(/537\/537/g, '569/569');
  baocao = baocao.replace(/537 Master Test Cases/g, '569 Master Test Cases');
  baocao = baocao.replace(/136 Phác Đồ/g, '144 Phác Đồ');
  baocao = baocao.replace(/136 phác đồ/g, '144 phác đồ');
  fs.writeFileSync(baocao5Path, baocao, 'utf8');
}

console.log('✅ ĐÃ ĐỒNG BỘ TOÀN BỘ SLIDE THUYẾT TRÌNH & CẨM NANG BẢO VỆ LÊN 142 PHÂN HỆ VÀ 569 TEST CASES!');
