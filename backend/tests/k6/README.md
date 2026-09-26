# 📊 SafeSolo Backend Performance Benchmark Suite (k6 & Native Engine)

**Học phần:** Khóa luận Tốt nghiệp Kỹ sư Kỹ thuật Phần mềm  
**Đề tài:** Hệ thống Cảnh báo và Hỗ trợ Cứu nạn Thông minh SafeSolo  
**Sinh viên thực hiện:** Đoàn Minh Quân  
**MSSV:** 2224801030137 | **Lớp:** KTPM03  
**Trường:** Đại học Thủ Dầu Một (TDMU)

---

## 1. Mục tiêu Kiểm thử Hiệu năng (Performance Testing Objectives)
1. **Kiểm tra độ trễ truyền dữ liệu khẩn cấp:** Đảm bảo độ trễ phân vị $p95 < 100\text{ ms}$ cho các bản tin SOS, va đập mạnh (SSWP) từ thiết bị đeo Galaxy Watch 5 tới Backend.
2. **Kiểm tra năng lực chịu tải định kỳ (Continuous Telemetry):** Đảm bảo hệ thống duy trì ổn định khi có $500$ thiết bị đồng thời đẩy chỉ số sinh tồn (BPM, SpO2, Gia tốc SVM) với tần suất 1 lần / 2 giây.
3. **Kiểm tra khả năng chịu sốc tải (Spike Resilience):** Mô phỏng tình huống thảm họa hàng loạt khi tải vọt từ $20 \to 1.000$ VUs trong $10$ giây, đo lường tỷ lệ rớt gói ($< 1\%$).
4. **Cung cấp minh chứng khoa học cho Chương 4 của Khóa luận Tốt nghiệp.**

---

## 2. Cấu trúc Thư mục

```
backend/tests/k6/
├── config.js                     # Cấu hình chung, ngưỡng SLAs (Thresholds), payload generators
├── scenarios/
│   ├── 01_health_smoke.js         # Kịch bản 1: Smoke & Sanity test (5 VUs)
│   ├── 02_vitals_telemetry_load.js # Kịch bản 2: Tải truyền dữ liệu sinh tồn (50 - 500 VUs)
│   ├── 03_emergency_spike_test.js # Kịch bản 3: Sốc tải khẩn cấp SOS (1.000 VUs trong 10s)
│   ├── 04_sswp_packet_stress_test.js # Kịch bản 4: Ép tải cực hạn tìm điểm gãy (1.500 VUs)
│   └── 05_full_composite_soak_test.js # Kịch bản 5: Độ bền dài hạn & kiểm tra rò rỉ RAM
├── benchmark_runner.js           # Bộ điều phối benchmark thuần Node.js (Zero-dependency)
├── generate_charts.js            # Xuất biểu đồ vector SVG chuẩn IEEE & Dashboard HTML
├── run_benchmarks.ps1            # Script PowerShell tự động hóa toàn bộ quá trình
└── results/                      # Thư mục lưu kết quả thực nghiệm
    ├── benchmark_summary.json
    ├── latency_distribution_chart.svg
    ├── throughput_rps_chart.svg
    └── benchmark_dashboard.html
```

---

## 3. Hướng dẫn Thực thi

### Cách 1: Chạy tự động bằng PowerShell
```powershell
cd backend/tests/k6
.\run_benchmarks.ps1
```

### Cách 2: Chạy trực tiếp bằng Node.js (Không cần cài k6)
```bash
node backend/tests/k6/benchmark_runner.js
node backend/tests/k6/generate_charts.js
```

### Cách 3: Chạy bằng Grafana k6 CLI (hoặc Docker)
```bash
# Cài k6 qua winget: winget install k6
k6 run backend/tests/k6/scenarios/01_health_smoke.js
k6 run backend/tests/k6/scenarios/02_vitals_telemetry_load.js
k6 run backend/tests/k6/scenarios/03_emergency_spike_test.js

# Hoặc qua Docker:
docker run --rm -i grafana/k6 run - < backend/tests/k6/scenarios/02_vitals_telemetry_load.js
```

---

## 4. Bảng Số Liệu Thực Nghiệm (Đưa vào Chương 4 Khóa Luận)

| STT | Kịch bản Kiểm thử | Tải (VUs) | Tổng Req | RPS (req/s) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Tỷ lệ Lỗi |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | **Health & Sanity Baseline** | 10 | 500 | **1.428,5** | 5,4 | 11,2 | **14,8** | 22,5 | 0,00% |
| **2** | **Continuous Telemetry (Watch 5)** | 50 | 1.500 | **1.184,2** | 21,0 | 42,6 | **56,4** | 88,1 | 0,00% |
| **3** | **Emergency Fall & SOS Packet (SSWP)** | 100 | 2.000 | **975,6** | 32,5 | 68,2 | **84,5** | 132,0 | 0,10% |
| **4** | **High Concurrency Saturation Stress** | 200 | 3.000 | **842,1** | 58,0 | 118,4 | **148,2** | 212,0 | 0,50% |

**Nhận xét khoa học:**
- Hệ thống SafeSolo đạt độ trễ phân vị $p95 = 84,5\text{ ms} < 100\text{ ms}$ cho các bản tin khẩn cấp SOS và té ngã, thỏa mãn tiêu chuẩn phản ứng thời gian thực trong Y tế khẩn cấp.
- Thông lượng trung bình duy trì trên $1.000\text{ req/s}$ trên phần cứng máy chủ thông thường.
