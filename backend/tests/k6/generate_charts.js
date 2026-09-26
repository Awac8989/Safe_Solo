/**
 * ============================================================================
 * SAFESOLO BENCHMARK CHART & DASHBOARD GENERATOR
 * Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
 * Mô tả: Tạo các biểu đồ vector SVG chuẩn ấn phẩm khoa học và dashboard HTML
 * phục vụ chèn trực tiếp vào Khóa luận tốt nghiệp (Chương 4) và slide thuyết trình.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, 'results');
const summaryPath = path.join(resultsDir, 'benchmark_summary.json');

if (!fs.existsSync(summaryPath)) {
  console.error(`Không tìm thấy file kết quả tại: ${summaryPath}. Hãy chạy benchmark_runner.js trước!`);
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));

// 1. Tạo biểu đồ SVG: Phân vị độ trễ (Latency Percentiles Chart)
function generateLatencySvg(data) {
  const width = 850;
  const height = 450;
  const padding = { top: 60, right: 180, bottom: 80, left: 80 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Max latency để scale trục Y
  const maxLatency = 250; // ms

  const barGroups = data.length;
  const groupWidth = plotW / barGroups;
  const barWidth = 14;

  const colors = {
    p50: '#10B981', // Emerald Green
    p90: '#3B82F6', // Blue
    p95: '#F59E0B', // Amber
    p99: '#EF4444', // Red
  };

  let svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
  <style>
    .title { font-size: 16px; font-weight: bold; fill: #FFFFFF; }
    .subtitle { font-size: 11px; fill: #94A3B8; }
    .axis { stroke: #334155; stroke-width: 1; }
    .grid { stroke: #1E293B; stroke-dasharray: 3,3; }
    .label { font-size: 10px; fill: #94A3B8; }
    .val-text { font-size: 9px; font-weight: bold; fill: #FFFFFF; text-anchor: middle; }
    .legend-text { font-size: 11px; fill: #E2E8F0; }
  </style>

  <!-- Tiêu đề biểu đồ -->
  <text x="${padding.left}" y="30" class="title">BIỂU ĐỒ 4.1: PHÂN BỐ ĐỘ TRỄ PHÂN VỊ THEO KỊCH BẢN (LATENCY PERCENTILES)</text>
  <text x="${padding.left}" y="48" class="subtitle">Khóa luận Tốt nghiệp KTPM - SV: Đoàn Minh Quân (MSSV: 2224801030137) - SafeSolo Backend</text>

  <!-- Lưới tọa độ trục Y -->
`;

  // Vẽ các đường kẻ ngang trục Y (0, 50, 100, 150, 200, 250 ms)
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const yVal = (maxLatency / ySteps) * i;
    const yPos = padding.top + plotH - (yVal / maxLatency) * plotH;
    svgContent += `
  <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" class="grid" />
  <text x="${padding.left - 10}" y="${yPos + 4}" class="label" text-anchor="end">${yVal} ms</text>
`;
  }

  // Trục X và Y
  svgContent += `
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotH}" class="axis" />
  <line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" class="axis" />
`;

  // Ngưỡng tiêu chuẩn Y tế khẩn cấp p95 < 100ms
  const threshold100Y = padding.top + plotH - (100 / maxLatency) * plotH;
  svgContent += `
  <line x1="${padding.left}" y1="${threshold100Y}" x2="${width - padding.right}" y2="${threshold100Y}" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,4" />
  <text x="${width - padding.right + 8}" y="${threshold100Y + 4}" fill="#EF4444" font-size="10px" font-weight="bold">Ngưỡng Khẩn Cấp (100ms)</text>
`;

  // Vẽ các cột của từng kịch bản
  data.forEach((item, idx) => {
    const groupX = padding.left + idx * groupWidth;
    const centerX = groupX + groupWidth / 2;

    const lat = item.latency;
    const p50H = (lat.p50Ms / maxLatency) * plotH;
    const p90H = (lat.p90Ms / maxLatency) * plotH;
    const p95H = (lat.p95Ms / maxLatency) * plotH;
    const p99H = (lat.p99Ms / maxLatency) * plotH;

    const b1X = centerX - barWidth * 2 - 3;
    const b2X = centerX - barWidth - 1;
    const b3X = centerX + 1;
    const b4X = centerX + barWidth + 3;

    // p50
    svgContent += `
  <rect x="${b1X}" y="${padding.top + plotH - p50H}" width="${barWidth}" height="${p50H}" fill="${colors.p50}" rx="2" />
  <text x="${b1X + barWidth / 2}" y="${padding.top + plotH - p50H - 4}" class="val-text">${lat.p50Ms}</text>
`;
    // p90
    svgContent += `
  <rect x="${b2X}" y="${padding.top + plotH - p90H}" width="${barWidth}" height="${p90H}" fill="${colors.p90}" rx="2" />
  <text x="${b2X + barWidth / 2}" y="${padding.top + plotH - p90H - 4}" class="val-text">${lat.p90Ms}</text>
`;
    // p95
    svgContent += `
  <rect x="${b3X}" y="${padding.top + plotH - p95H}" width="${barWidth}" height="${p95H}" fill="${colors.p95}" rx="2" />
  <text x="${b3X + barWidth / 2}" y="${padding.top + plotH - p95H - 4}" class="val-text">${lat.p95Ms}</text>
`;
    // p99
    svgContent += `
  <rect x="${b4X}" y="${padding.top + plotH - p99H}" width="${barWidth}" height="${p99H}" fill="${colors.p99}" rx="2" />
  <text x="${b4X + barWidth / 2}" y="${padding.top + plotH - p99H - 4}" class="val-text">${lat.p99Ms}</text>
`;

    // Nhãn trục X
    const shortLabel = `Kịch bản ${idx + 1} (${item.concurrency} VUs)`;
    svgContent += `
  <text x="${centerX}" y="${padding.top + plotH + 20}" class="label" text-anchor="middle" font-weight="bold">${shortLabel}</text>
`;
  });

  // Chú thích (Legend)
  const legendX = width - padding.right + 20;
  const legendY = padding.top + 50;

  svgContent += `
  <g transform="translate(${legendX}, ${legendY})">
    <rect x="0" y="0" width="12" height="12" fill="${colors.p50}" rx="2" />
    <text x="18" y="10" class="legend-text">p50 (Median)</text>

    <rect x="0" y="24" width="12" height="12" fill="${colors.p90}" rx="2" />
    <text x="18" y="34" class="legend-text">p90 Latency</text>

    <rect x="0" y="48" width="12" height="12" fill="${colors.p95}" rx="2" />
    <text x="18" y="58" class="legend-text">p95 Latency</text>

    <rect x="0" y="72" width="12" height="12" fill="${colors.p99}" rx="2" />
    <text x="18" y="82" class="legend-text">p99 Latency</text>
  </g>
</svg>`;

  return svgContent;
}

// 2. Tạo biểu đồ SVG: Throughput RPS (Throughput Chart)
function generateThroughputSvg(data) {
  const width = 850;
  const height = 400;
  const padding = { top: 60, right: 60, bottom: 80, left: 80 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxRps = 1600;

  const barGroups = data.length;
  const groupWidth = plotW / barGroups;
  const barWidth = 42;

  let svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: #0F172A; font-family: 'Segoe UI', Arial, sans-serif;">
  <style>
    .title { font-size: 16px; font-weight: bold; fill: #FFFFFF; }
    .subtitle { font-size: 11px; fill: #94A3B8; }
    .axis { stroke: #334155; stroke-width: 1; }
    .grid { stroke: #1E293B; stroke-dasharray: 3,3; }
    .label { font-size: 10px; fill: #94A3B8; }
    .val-text { font-size: 11px; font-weight: bold; fill: #38EF7D; text-anchor: middle; }
  </style>

  <text x="${padding.left}" y="30" class="title">BIỂU ĐỒ 4.2: THÔNG LƯỢNG XỬ LÝ (THROUGHPUT RPS) THEO KỊCH BẢN</text>
  <text x="${padding.left}" y="48" class="subtitle">Đo đạc số lượng yêu cầu xử lý thành công mỗi giây (Requests Per Second)</text>
`;

  // Lưới trục Y
  for (let i = 0; i <= 4; i++) {
    const val = (maxRps / 4) * i;
    const yPos = padding.top + plotH - (val / maxRps) * plotH;
    svgContent += `
  <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" class="grid" />
  <text x="${padding.left - 10}" y="${yPos + 4}" class="label" text-anchor="end">${val} req/s</text>
`;
  }

  svgContent += `
  <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotH}" class="axis" />
  <line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" class="axis" />
`;

  data.forEach((item, idx) => {
    const groupX = padding.left + idx * groupWidth;
    const centerX = groupX + groupWidth / 2;
    const barH = (item.rps / maxRps) * plotH;
    const barX = centerX - barWidth / 2;

    svgContent += `
  <defs>
    <linearGradient id="rpsGrad${idx}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38EF7D" />
      <stop offset="100%" stop-color="#11998E" />
    </linearGradient>
  </defs>
  <rect x="${barX}" y="${padding.top + plotH - barH}" width="${barWidth}" height="${barH}" fill="url(#rpsGrad${idx})" rx="4" />
  <text x="${centerX}" y="${padding.top + plotH - barH - 8}" class="val-text">${item.rps} rps</text>
  <text x="${centerX}" y="${padding.top + plotH + 20}" class="label" text-anchor="middle" font-weight="bold">Kịch bản ${idx + 1}</text>
  <text x="${centerX}" y="${padding.top + plotH + 34}" class="label" text-anchor="middle">(${item.concurrency} VUs)</text>
`;
  });

  svgContent += `\n</svg>`;
  return svgContent;
}

// 3. Tạo Dashboard HTML tương tác
function generateHtmlDashboard(data) {
  const tableRows = data.map((m, idx) => `
    <tr>
      <td><strong>${idx + 1}</strong></td>
      <td style="text-align: left;">
        <strong>${m.scenarioName}</strong><br/>
        <code style="color: #60A5FA;">${m.endpoint}</code>
      </td>
      <td><span class="badge badge-vu">${m.concurrency} VUs</span></td>
      <td>${m.totalRequests}</td>
      <td><strong style="color: #38EF7D;">${m.rps}</strong></td>
      <td>${m.latency.p50Ms} ms</td>
      <td>${m.latency.p90Ms} ms</td>
      <td><strong style="color: ${m.latency.p95Ms < 100 ? '#10B981' : '#F59E0B'}">${m.latency.p95Ms} ms</strong></td>
      <td>${m.latency.p99Ms} ms</td>
      <td><span class="badge ${m.errorRatePercent === 0 ? 'badge-success' : 'badge-warning'}">${m.errorRatePercent}%</span></td>
    </tr>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>SafeSolo Backend Benchmark Dashboard - KTPM03</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0A0F1D;
      color: #F8FAFC;
      margin: 0;
      padding: 30px;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    .header {
      border-bottom: 1px solid #1E293B;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .header h1 { font-size: 24px; color: #38EF7D; margin: 0 0 8px 0; }
    .header p { color: #94A3B8; margin: 0; font-size: 13px; }
    .card {
      background: #0F172A;
      border: 1px solid #1E293B;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 25px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .card h2 { font-size: 16px; color: #F1F5F9; margin-top: 0; margin-bottom: 15px; border-left: 4px solid #38EF7D; padding-left: 10px; }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
      font-size: 13px;
    }
    th {
      background: #1E293B;
      color: #94A3B8;
      padding: 12px 10px;
      font-weight: 600;
      border-bottom: 2px solid #334155;
    }
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #1E293B;
    }
    tr:hover td { background: #162032; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: bold;
    }
    .badge-vu { background: rgba(96, 165, 250, 0.2); color: #60A5FA; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #10B981; }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #F59E0B; }
    .chart-container {
      text-align: center;
      margin-top: 15px;
    }
    .chart-container svg { max-width: 100%; height: auto; border-radius: 8px; }
    .footer {
      text-align: center;
      color: #64748B;
      font-size: 12px;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SAFESOLO BACKEND PERFORMANCE BENCHMARK DASHBOARD</h1>
      <p>Đồ án Tốt nghiệp Kỹ sư Kỹ thuật Phần mềm | SV: <strong>Đoàn Minh Quân</strong> (MSSV: <strong>2224801030137</strong>) | Lớp: <strong>KTPM03</strong></p>
    </div>

    <div class="card">
      <h2>BẢNG 4.1: TỔNG HỢP KẾT QUẢ THỰC NGHIỆM ĐO ĐẠC TẢI</h2>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Kịch bản Kiểm thử</th>
            <th>Tải (VUs)</th>
            <th>Tổng Req</th>
            <th>Throughput (req/s)</th>
            <th>p50 (ms)</th>
            <th>p90 (ms)</th>
            <th>p95 (ms)</th>
            <th>p99 (ms)</th>
            <th>Tỷ lệ Lỗi</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>BIỂU ĐỒ 4.1: PHÂN BỐ ĐỘ TRỄ PHÂN VỊ THEO KỊCH BẢN (PERCENTILES)</h2>
      <div class="chart-container">
        <img src="latency_distribution_chart.svg" alt="Latency Chart" style="max-width: 100%;" />
      </div>
    </div>

    <div class="card">
      <h2>BIỂU ĐỒ 4.2: THÔNG LƯỢNG XỬ LÝ (THROUGHPUT RPS)</h2>
      <div class="chart-container">
        <img src="throughput_rps_chart.svg" alt="Throughput Chart" style="max-width: 100%;" />
      </div>
    </div>

    <div class="footer">
      Báo cáo được khởi tạo tự động bởi SafeSolo Benchmark Framework v1.0 • Đại học Thủ Dầu Một (TDMU)
    </div>
  </div>
</body>
</html>`;
}

// Thực thi xuất file
const latencySvg = generateLatencySvg(metrics);
fs.writeFileSync(path.join(resultsDir, 'latency_distribution_chart.svg'), latencySvg, 'utf-8');

const throughputSvg = generateThroughputSvg(metrics);
fs.writeFileSync(path.join(resultsDir, 'throughput_rps_chart.svg'), throughputSvg, 'utf-8');

const htmlDashboard = generateHtmlDashboard(metrics);
fs.writeFileSync(path.join(resultsDir, 'benchmark_dashboard.html'), htmlDashboard, 'utf-8');

console.log('✅ Đã xuất thành công:');
console.log(`   - Biểu đồ Độ trễ Phân vị: ${path.join(resultsDir, 'latency_distribution_chart.svg')}`);
console.log(`   - Biểu đồ Throughput RPS: ${path.join(resultsDir, 'throughput_rps_chart.svg')}`);
console.log(`   - Dashboard Báo cáo HTML: ${path.join(resultsDir, 'benchmark_dashboard.html')}`);
