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

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Phân tích dữ liệu - SafeSolo Admin" },
      {
        name: "description",
        content: "Dashboard phân tích thống kê nền tảng SafeSolo.",
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics-dashboard", days],
    queryFn: () => fetchAnalyticsDashboard(days),
    refetchInterval: 60_000,
  });

  const analytics = data?.data;

  return (
    <div className="flex flex-col h-screen">
      <Topbar title="Phân tích dữ liệu" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {/* Period selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Tổng quan Analytics</h2>
          </div>
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
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

            {/* Footer */}
            <div className="text-center text-[10px] text-muted-foreground/50 pb-4">
              Dữ liệu tổng hợp {days} ngày — cập nhật lúc{" "}
              {new Date(analytics.period.generatedAt).toLocaleTimeString("vi-VN")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
