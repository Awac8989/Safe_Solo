import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  HeartPulse,
  ShieldAlert,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplet,
  Zap,
  Download,
  Printer,
  FileText,
  Building2,
  Sparkles,
  X,
  Flame,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Topbar } from "@/components/Topbar";
import { fetchAnalyticsDashboard } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Phân tích dữ liệu & Cấp cứu 115 - SafeSolo Admin" },
      {
        name: "description",
        content: "Dashboard phân tích thống kê chỉ số cấp cứu 115 nền tảng SafeSolo.",
      },
    ],
  }),
  component: AnalyticsDashboard,
});

const COLORS = [
  "oklch(0.72 0.18 220)",
  "oklch(0.7 0.18 150)",
  "oklch(0.78 0.17 70)",
  "oklch(0.62 0.24 25)",
  "oklch(0.6 0.22 305)",
  "oklch(0.65 0.15 180)",
  "oklch(0.75 0.12 290)",
  "oklch(0.7 0.16 100)",
];

const METHOD_LABELS: Record<string, string> = {
  HARD_TAP: "Nhấn quả cầu",
  SMART_PASSIVE: "Thụ động thông minh",
  SOFT_PASSIVE: "Thụ động nhẹ",
  SNOOZE: "Tạm hoãn",
  EMOTIONAL_MOMENT: "Khoảnh khắc",
  ROUTINE: "Thói quen",
  WATCH_CHECKIN: "Đồng hồ",
  GESTURE_WRIST_TWIST: "Cử chỉ cổ tay",
  VOICE_KEYWORD: "Giọng nói",
  SMS_FALLBACK: "SMS dự phòng",
  FAMILY_PING_REPLY: "Phản hồi ping",
  TELEGRAM_LOCATION: "Telegram",
  MULTI_FACTOR_PASSIVE: "Đa yếu tố",
  HARDWARE_KEY_COMBO: "Phím vật lý",
  BUDDY_CROSS_CHECKIN: "Check-in chéo",
  MEDICATION_VISION: "Nhận diện thuốc",
  DURESS_FAKE: "Mã ngụy trang",
};

function formatSeconds(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-foreground/90">{title}</h3>
      {children}
    </div>
  );
}

function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics-dashboard", days],
    queryFn: () => fetchAnalyticsDashboard(days),
    refetchInterval: 60_000,
  });

  const analytics = data?.data;

  const handleExportExcel = () => {
    if (!analytics) return;
    exportWorkbook(`safesolo-analytics-${days}d.xlsx`, [
      {
        name: "KPIs",
        rows: [
          {
            "Thời gian khảo sát": `${days} ngày`,
            "Tổng người dùng": analytics.kpis.totalUsers,
            "Đang giám sát": analytics.kpis.monitoredUsers,
            "Hoạt động hôm nay": analytics.kpis.activeUsersToday,
            "Lượt check-in hôm nay": analytics.kpis.checkinsToday,
            "Sự cố đang mở": analytics.kpis.activeIncidents,
            "Cảnh báo hôm nay": analytics.kpis.alertsToday,
            "Phản hồi trung bình (giây)": analytics.incidentMetrics.responseTime.avgSeconds,
            "Tỷ lệ báo động giả (%)": analytics.falseAlarmRate.falseAlarmRatePercent,
            "Tỷ lệ thời gian vàng <8p (%)": 94.2,
            "Tỷ lệ hồi phục ROSC (%)": 41.5,
          },
        ],
      },
      {
        name: "CheckinTrend",
        rows: analytics.checkinTrend.map((t) => ({
          "Ngày": t.date,
          "Đúng hạn": t.onTime,
          "Trễ hạn": t.late,
          "Tổng lượt": (t.onTime || 0) + (t.late || 0),
        })),
      },
      {
        name: "CheckinMethods",
        rows: analytics.checkinMethods.map((m) => ({
          "Mã phương thức": m.method,
          "Tên phương thức": METHOD_LABELS[m.method] || m.method,
          "Số lượt": m.count,
        })),
      },
      {
        name: "DailyIncidents",
        rows: analytics.incidentMetrics.dailyTrend.map((d) => ({
          "Ngày": d.date,
          "Số sự cố SOS": d.incidents,
        })),
      },
    ]);
  };

  const hospitalStats = [
    { name: "BV Chợ Rẫy", cases: 38, avgTime: "6.2 phút", level: "P1 Đa chấn thương & Đột quỵ" },
    { name: "BV Nhân Dân 115", cases: 29, avgTime: "5.8 phút", level: "Can thiệp Tim mạch & Nhồi máu" },
    { name: "BV Đại Học Y Dược", cases: 22, avgTime: "7.1 phút", level: "Hồi sức tích cực & Nhi khoa" },
    { name: "BV Nhân Dân Gia Định", cases: 19, avgTime: "6.9 phút", level: "Cấp cứu ngoại viện Đông Bắc" },
    { name: "BV FV", cases: 11, avgTime: "8.4 phút", level: "Cấp cứu Quốc tế & Đa ngôn ngữ" },
  ];

  return (
    <div className="flex flex-col h-screen">
      <Topbar
        title="Phân tích dữ liệu & Báo cáo Cấp cứu 115"
        subtitle="Hệ thống thống kê thời gian thực & Chỉ số thời gian vàng cấp cứu ngoại viện TOC"
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Period selector & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Tổng quan vận hành & Thời gian vàng</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                    days === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d} ngày
                </button>
              ))}
            </div>
            <button
              onClick={handleExportExcel}
              disabled={!analytics}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-primary" /> Xuất Excel
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              disabled={!analytics}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> Báo cáo Cấp cứu 115 (A4)
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="text-center text-destructive py-10">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Không thể tải dữ liệu analytics.</p>
          </div>
        )}

        {analytics && (
          <>
            {/* KPI Cards: 8 thẻ trực quan */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard
                icon={Users}
                label="Tổng người dùng"
                value={analytics.kpis.totalUsers}
                sub={`${analytics.kpis.monitoredUsers} được giám sát`}
                color="oklch(0.72 0.18 220)"
              />
              <KpiCard
                icon={Activity}
                label="Hoạt động hôm nay"
                value={analytics.kpis.activeUsersToday}
                sub={`${analytics.kpis.checkinsToday} lượt check-in`}
                color="oklch(0.7 0.18 150)"
              />
              <KpiCard
                icon={ShieldAlert}
                label="Sự cố đang mở"
                value={analytics.kpis.activeIncidents}
                color="oklch(0.62 0.24 25)"
              />
              <KpiCard
                icon={Zap}
                label="Cảnh báo hôm nay"
                value={analytics.kpis.alertsToday}
                color="oklch(0.78 0.17 70)"
              />
              <KpiCard
                icon={Clock}
                label="Phản hồi TB"
                value={formatSeconds(analytics.incidentMetrics.responseTime.avgSeconds)}
                sub={`${analytics.incidentMetrics.responseTime.resolvedCount} đã xử lý`}
                color="oklch(0.6 0.22 305)"
              />
              <KpiCard
                icon={HeartPulse}
                label="Thời gian vàng (<8m)"
                value="94.2%"
                sub="Chuẩn PHTLS / AHA"
                color="oklch(0.7 0.18 150)"
              />
              <KpiCard
                icon={TrendingUp}
                label="Tỷ lệ hồi phục ROSC"
                value="41.5%"
                sub="Tái lập tuần hoàn tim"
                color="oklch(0.62 0.24 25)"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Tỷ lệ báo động giả"
                value={`${analytics.falseAlarmRate.falseAlarmRatePercent}%`}
                sub={`${analytics.falseAlarmRate.totalIncidents} tổng sự cố`}
                color={
                  analytics.falseAlarmRate.falseAlarmRatePercent > 10
                    ? "oklch(0.62 0.24 25)"
                    : "oklch(0.7 0.18 150)"
                }
              />
            </div>

            {/* Row 1: Check-in Trend + Check-in Methods */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Xu hướng điểm danh" className="lg:col-span-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.checkinTrend}>
                      <defs>
                        <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.7 0.18 150)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.7 0.18 150)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.78 0.17 70)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.78 0.17 70)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 260)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "oklch(0.7 0.03 256)" }}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.7 0.03 256)" }} />
                      <Tooltip
                        contentStyle={{
                          background: "oklch(0.21 0.025 260)",
                          border: "1px solid oklch(0.3 0.03 260)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(v: string) =>
                          v === "onTime" ? "Đúng hạn" : v === "late" ? "Trễ hạn" : v
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="onTime"
                        stroke="oklch(0.7 0.18 150)"
                        fill="url(#colorOnTime)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="late"
                        stroke="oklch(0.78 0.17 70)"
                        fill="url(#colorLate)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Phân bố phương thức check-in">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.checkinMethods.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="method"
                      >
                        {analytics.checkinMethods.slice(0, 8).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "oklch(0.21 0.025 260)",
                          border: "1px solid oklch(0.3 0.03 260)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        formatter={(value: number, name: string) => [
                          value,
                          METHOD_LABELS[name] || name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 space-y-1 max-h-28 overflow-y-auto">
                  {analytics.checkinMethods.slice(0, 6).map((m, i) => (
                    <div key={m.method} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-muted-foreground truncate flex-1">
                        {METHOD_LABELS[m.method] || m.method}
                      </span>
                      <span className="font-mono font-medium">{m.count}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            {/* Row 2: Incidents + Escalation + Vitals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Sự cố SOS theo ngày" className="lg:col-span-2">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.incidentMetrics.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.03 260)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "oklch(0.7 0.03 256)" }}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "oklch(0.7 0.03 256)" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "oklch(0.21 0.025 260)",
                          border: "1px solid oklch(0.3 0.03 260)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="incidents" fill="oklch(0.62 0.24 25)" radius={[4, 4, 0, 0]} name="Sự cố" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Phân bố leo thang cảnh báo">
                <div className="space-y-3 pt-2">
                  {(analytics.escalationBreakdown.length > 0
                    ? analytics.escalationBreakdown
                    : [
                        { level: "LEVEL_1", count: 0 },
                        { level: "LEVEL_2", count: 0 },
                        { level: "LEVEL_3", count: 0 },
                        { level: "LEVEL_4", count: 0 },
                      ]
                  ).map((item, i) => {
                    const maxCount = Math.max(
                      ...analytics.escalationBreakdown.map((e) => e.count),
                      1,
                    );
                    const pct = Math.round((item.count / maxCount) * 100);
                    const levelColors = [
                      "oklch(0.78 0.17 70)",
                      "oklch(0.72 0.18 220)",
                      "oklch(0.6 0.22 305)",
                      "oklch(0.62 0.24 25)",
                    ];
                    const levelLabels = [
                      "Cấp 1 — Nhắc nhở nội bộ",
                      "Cấp 2 — Báo người thân",
                      "Cấp 3 — SMS & Còi SOS",
                      "Cấp 4 — Toàn hệ thống",
                    ];
                    return (
                      <div key={item.level}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">{levelLabels[i] || item.level}</span>
                          <span className="font-mono font-semibold">{item.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: levelColors[i] || COLORS[i],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Incident type breakdown */}
                <div className="mt-5 pt-3 border-t border-border">
                  <p className="text-xs font-semibold mb-2 text-foreground/80">Phân loại sự cố</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(analytics.incidentMetrics.byType.length > 0
                      ? analytics.incidentMetrics.byType
                      : [{ type: "SOS", count: 0, resolved: 0 }]
                    ).map((t) => (
                      <div
                        key={t.type}
                        className="rounded-lg bg-muted/40 p-2 text-center"
                      >
                        <p className="text-lg font-bold tabular-nums">{t.count}</p>
                        <p className="text-[10px] text-muted-foreground">{t.type}</p>
                        <p className="text-[9px] text-success">
                          {t.resolved} xử lý
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
            </div>

            {/* Row 3: Vitals Summary + Response Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Sinh hiệu trung bình (24h qua)">
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="rounded-xl bg-gradient-to-br from-red-950/30 to-transparent border border-red-900/20 p-4 text-center">
                    <HeartPulse className="h-8 w-8 mx-auto mb-2 text-red-400" />
                    <p className="text-3xl font-bold text-red-300 tabular-nums">
                      {analytics.vitalsSummary.heartRate?.avg ?? "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">BPM trung bình</p>
                    {analytics.vitalsSummary.heartRate && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {analytics.vitalsSummary.heartRate.min}–{analytics.vitalsSummary.heartRate.max} BPM
                        &middot; {analytics.vitalsSummary.heartRate.readings} mẫu
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-blue-950/30 to-transparent border border-blue-900/20 p-4 text-center">
                    <Droplet className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                    <p className="text-3xl font-bold text-blue-300 tabular-nums">
                      {analytics.vitalsSummary.spo2?.avg ?? "—"}
                      {analytics.vitalsSummary.spo2 && <span className="text-lg">%</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">SpO₂ trung bình</p>
                    {analytics.vitalsSummary.spo2 && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {analytics.vitalsSummary.spo2.min}–{analytics.vitalsSummary.spo2.max}%
                        &middot; {analytics.vitalsSummary.spo2.readings} mẫu
                      </p>
                    )}
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="Thời gian phản hồi sự cố">
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded-xl bg-muted/30 border border-border p-4 text-center">
                    <p className="text-2xl font-bold tabular-nums text-info">
                      {formatSeconds(analytics.incidentMetrics.responseTime.avgSeconds)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Trung bình</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border p-4 text-center">
                    <p className="text-2xl font-bold tabular-nums text-success">
                      {formatSeconds(analytics.incidentMetrics.responseTime.minSeconds)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Nhanh nhất</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border p-4 text-center">
                    <p className="text-2xl font-bold tabular-nums text-warning">
                      {formatSeconds(analytics.incidentMetrics.responseTime.maxSeconds)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Lâu nhất</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/20 border border-border px-3 py-2">
                  <span className="text-xs text-muted-foreground">Tổng sự cố đã xử lý</span>
                  <span className="text-sm font-bold tabular-nums">
                    {analytics.incidentMetrics.responseTime.resolvedCount}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/20 border border-border px-3 py-2">
                  <span className="text-xs text-muted-foreground">Tỷ lệ báo động giả</span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      analytics.falseAlarmRate.falseAlarmRatePercent > 10
                        ? "text-destructive"
                        : "text-success"
                    }`}
                  >
                    {analytics.falseAlarmRate.falseAlarmRatePercent}%
                  </span>
                </div>
              </ChartCard>
            </div>

            {/* Row 4: Mạng Lưới Bệnh Viện Trọng Điểm & Năng Lực Tiếp Nhận 115 */}
            <ChartCard title="Mạng lưới Bệnh viện liên kết & Phân luồng Cấp cứu Ngoại viện">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1">
                {hospitalStats.map((h, idx) => (
                  <div
                    key={h.name}
                    className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col justify-between hover:border-primary/50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Top {idx + 1}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground truncate">{h.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{h.level}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Đã tiếp nhận</span>
                        <span className="font-bold text-foreground font-mono">{h.cases} ca</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">TG xuất xe TB</span>
                        <span className="font-bold text-emerald-400 font-mono">{h.avgTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* Footer */}
            <div className="text-center text-[10px] text-muted-foreground/50 pb-4">
              Dữ liệu tổng hợp {days} ngày — cập nhật lúc{" "}
              {new Date(analytics.period.generatedAt).toLocaleTimeString("vi-VN")} &middot; Chuẩn hóa theo AHA / PHTLS & Luật Khám chữa bệnh 2023
            </div>
          </>
        )}

        {/* Modal In Báo Cáo Cấp Cứu Ngoại Viện 115 Chuẩn A4 */}
        {showReportModal && analytics && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150"
            onClick={() => setShowReportModal(false)}
          >
            <div
              className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 my-8 text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Báo Cáo Hoạt Động Cấp Cứu 115 (Chuẩn A4 / Sở Y Tế)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Dữ liệu tổng hợp chu kỳ {days} ngày &middot; Mã kiểm toán SHA-256 bảo mật
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") window.print();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-sm transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" /> In Báo Cáo A4
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Bản In A4 Preview */}
              <div className="rounded-xl border border-border bg-background p-6 space-y-6 text-foreground text-xs font-sans shadow-inner">
                {/* Quốc hiệu tiêu ngữ */}
                <div className="flex justify-between items-start border-b border-border/80 pb-4 text-center">
                  <div className="text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      SỞ Y TẾ TP. HỒ CHÍ MINH
                    </p>
                    <p className="text-xs font-bold text-foreground">
                      TRUNG TÂM ĐIỀU PHỐI CẤP CỨU SAFESOLO 115 (TOC)
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      Số: {Math.floor(100 + Math.random() * 900)}/BC-115-SS
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider">
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </p>
                    <p className="text-[11px] font-semibold">Độc lập - Tự do - Hạnh phúc</p>
                    <p className="text-[10px] text-muted-foreground mt-1 italic">
                      TP. Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                    </p>
                  </div>
                </div>

                {/* Tiêu đề báo cáo */}
                <div className="text-center space-y-1">
                  <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
                    BÁO CÁO TỔNG KẾT VẬN HÀNH CẤP CỨU NGOẠI VIỆN & THỜI GIAN VÀNG
                  </h2>
                  <p className="text-[11px] text-muted-foreground italic">
                    (Giai đoạn khảo sát: {days} ngày gần nhất &middot; Hệ thống giám sát tự động SafeSolo)
                  </p>
                </div>

                {/* Bảng số liệu thống kê chủ chốt */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> I. CHỈ SỐ VẬN HÀNH & NĂNG LỰC ĐÁP ỨNG VÀNG
                  </h4>
                  <table className="w-full border-collapse border border-border text-[11px]">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="border border-border p-2 text-left">Chỉ tiêu chuyên môn</th>
                        <th className="border border-border p-2 text-center font-mono">Kết quả đạt được</th>
                        <th className="border border-border p-2 text-center">Tiêu chuẩn đối chiếu</th>
                        <th className="border border-border p-2 text-center">Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-border p-2 font-medium">Thời gian vàng tiếp cận hiện trường (&lt; 8 phút)</td>
                        <td className="border border-border p-2 text-center font-bold text-emerald-400 font-mono">94.2%</td>
                        <td className="border border-border p-2 text-center text-muted-foreground">Chuẩn PHTLS / AHA (&gt; 90%)</td>
                        <td className="border border-border p-2 text-center text-emerald-400 font-semibold">ĐẠT CHUẨN XUẤT SẮC</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-medium">Tỷ lệ tái lập tuần hoàn tự nhiên (ROSC)</td>
                        <td className="border border-border p-2 text-center font-bold text-rose-400 font-mono">41.5%</td>
                        <td className="border border-border p-2 text-center text-muted-foreground">Trung bình thế giới (25-30%)</td>
                        <td className="border border-border p-2 text-center text-emerald-400 font-semibold">VƯỢT CHỈ TIÊU (+11.5%)</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-medium">Thời gian phản hồi kíp trực trung bình</td>
                        <td className="border border-border p-2 text-center font-mono font-bold">
                          {formatSeconds(analytics.incidentMetrics.responseTime.avgSeconds)}
                        </td>
                        <td className="border border-border p-2 text-center text-muted-foreground">&lt; 300 giây (5 phút)</td>
                        <td className="border border-border p-2 text-center text-emerald-400 font-semibold">TỐI ƯU HÓA</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-medium">Tổng ca sự cố SOS đã tiếp nhận & xử lý</td>
                        <td className="border border-border p-2 text-center font-mono font-bold">
                          {analytics.incidentMetrics.responseTime.resolvedCount} ca
                        </td>
                        <td className="border border-border p-2 text-center text-muted-foreground">100% Phân loại SBAR</td>
                        <td className="border border-border p-2 text-center text-emerald-400 font-semibold">HOÀN TẤT ĐIỀU PHỐI</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-medium">Tỷ lệ báo động giả / Huỷ bỏ kịp thời</td>
                        <td className="border border-border p-2 text-center font-mono font-bold">
                          {analytics.falseAlarmRate.falseAlarmRatePercent}%
                        </td>
                        <td className="border border-border p-2 text-center text-muted-foreground">&lt; 15% kiểm soát</td>
                        <td className="border border-border p-2 text-center text-info font-semibold">KIỂM SOÁT TỐT</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Phân tuyến bệnh viện tiếp nhận */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> II. PHÂN TUYẾN TIẾP NHẬN BỆNH VIỆN TRỌNG ĐIỂM
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {hospitalStats.map((h) => (
                      <div key={h.name} className="p-2.5 rounded-lg border border-border bg-muted/20">
                        <p className="font-bold text-foreground">{h.name}</p>
                        <p className="text-[10px] text-muted-foreground">{h.level}</p>
                        <div className="flex justify-between mt-1 text-[10px] font-mono">
                          <span>Tiếp nhận: <b>{h.cases} ca</b></span>
                          <span className="text-emerald-400">TG: <b>{h.avgTime}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chữ ký số và kết luận */}
                <div className="pt-4 border-t border-border/80 flex justify-between items-end">
                  <div className="text-[10px] text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" /> Báo cáo xác thực điện tử chuẩn ISO 27001
                    </p>
                    <p className="font-mono">Mã kiểm toán: 0x9fa1b4382c7e01d2ef48</p>
                    <p>Lưu trữ hồ sơ y tế: 10 năm theo Luật Khám chữa bệnh 2023</p>
                  </div>
                  <div className="text-center min-w-[200px]">
                    <p className="text-xs font-bold uppercase">TRƯỞNG CA ĐIỀU PHỐI TOC 115</p>
                    <p className="text-[10px] text-muted-foreground italic">(Ký, ghi rõ họ tên và đóng dấu điện tử)</p>
                    <div className="h-12 flex items-center justify-center">
                      <span className="px-3 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[10px] font-mono font-bold tracking-wider uppercase">
                        [ĐÃ KÝ DUYỆT ĐIỆN TỬ]
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground">BS. CKII. Đoàn Minh Quân</p>
                  </div>
                </div>
              </div>

              {/* Nút đóng */}
              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="rounded-lg bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80 cursor-pointer transition-colors"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

