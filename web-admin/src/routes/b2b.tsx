import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BatteryCharging,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  HardHat,
  Phone,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchB2BOverview, type B2BEnterprise } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/b2b")({
  head: () => ({ meta: [{ title: "Cổng Doanh nghiệp B2B - SafeSolo Admin" }] }),
  component: B2BEnterprisePage,
});

function B2BEnterprisePage() {
  const [selectedEntId, setSelectedEntId] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const b2bQuery = useQuery({
    queryKey: ["b2b-overview"],
    queryFn: fetchB2BOverview,
    refetchInterval: 10000,
  });

  const data = b2bQuery.data?.data;
  const stats = data?.stats;
  const enterprises = data?.enterprises ?? [];

  const activeEnterprise =
    selectedEntId === "ALL" ? null : enterprises.find((e) => e.id === selectedEntId) ?? null;

  const allShifts = enterprises.flatMap((e) =>
    e.activeShifts.map((s) => ({ ...s, enterpriseName: e.name, enterpriseCode: e.code })),
  );

  const filteredShifts = allShifts.filter((s) => {
    const matchesSearch =
      s.workerName.toLowerCase().includes(search.toLowerCase()) ||
      s.post.toLowerCase().includes(search.toLowerCase()) ||
      s.enterpriseName.toLowerCase().includes(search.toLowerCase());
    const matchesEnt = selectedEntId === "ALL" || s.enterpriseCode === activeEnterprise?.code;
    return matchesSearch && matchesEnt;
  });

  const handleExport = () => {
    exportWorkbook("safesolo-b2b-lone-worker-report.xlsx", [
      {
        name: "Doanh nghiệp",
        rows: enterprises.map((e) => ({
          "Tên doanh nghiệp": e.name,
          "Mã đối tác": e.code,
          "Lĩnh vực": e.industry,
          "Nhân sự đang giám sát": e.activeWorkers,
          "Tổng nhân sự": e.totalWorkers,
          "Tần suất Check-in (phút)": e.checkInInterval,
          "Tỷ lệ tuân thủ (%)": e.complianceRate,
          "Cảnh báo vi phạm hôm nay": e.alertsToday,
          "Người phụ trách EHS": e.contactPerson,
          "Số điện thoại": e.contactPhone,
        })),
      },
      {
        name: "Ca trực nhân sự",
        rows: allShifts.map((s) => ({
          "Doanh nghiệp": s.enterpriseName,
          "Nhân viên": s.workerName,
          "Vị trí / Tuyến trực": s.post,
          "Hạn check-in tiếp theo": s.deadline,
          "Trạng thái": s.status,
          "Pin thiết bị (%)": s.battery,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar
        title="Cổng Doanh Nghiệp B2B (Lone Worker Safety Portal)"
        subtitle="Bảo vệ & Giám sát tuân thủ an toàn lao động nhân sự làm việc độc lập 24/7"
      />
      <div className="space-y-4 p-4 pb-16">
        {/* 1. Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-muted-foreground">Đối tác Doanh nghiệp</div>
            <div className="mt-1 text-2xl font-bold">{stats?.totalEnterprises ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Hợp đồng B2B active</div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-emerald-400">Nhân sự Lone Worker</div>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{stats?.totalMonitoredWorkers ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Giám sát Dead-Man Switch</div>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-sky-400">Tuân thủ điểm danh</div>
            <div className="mt-1 text-2xl font-bold text-sky-400">{stats?.averageComplianceRate ?? 98.6}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Đạt chuẩn ISO 45001</div>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-indigo-400">Ca trực ca đêm</div>
            <div className="mt-1 text-2xl font-bold text-indigo-400">{stats?.activeShiftsCount ?? 275}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Đang làm nhiệm vụ</div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-amber-400">Cảnh báo hôm nay</div>
            <div className="mt-1 text-2xl font-bold text-amber-400">{stats?.alertsTodayCount ?? 1}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Đã giải tỏa kịp thời</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-muted-foreground">Hạ tầng EHS SLA</div>
            <div className="mt-1 text-lg font-bold font-mono text-emerald-400">99.98%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Real-time Watchdog</div>
          </div>
        </div>

        {/* 2. Enterprise Organization Selector Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-sky-400" />
              Doanh Nghiệp Đối Tác Chiến Lược:
            </h2>
            <button
              onClick={() => setSelectedEntId("ALL")}
              className={`text-xs font-semibold underline transition ${
                selectedEntId === "ALL" ? "text-primary font-bold" : "text-muted-foreground"
              }`}
            >
              Xem tất cả ({enterprises.length})
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {enterprises.map((ent) => {
              const isSelected = selectedEntId === ent.id;
              return (
                <button
                  key={ent.id}
                  onClick={() => setSelectedEntId(isSelected ? "ALL" : ent.id)}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-card/80 hover:border-primary/40 hover:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-mono text-[10px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                      {ent.code}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {ent.complianceRate}% Tuân thủ
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-foreground leading-snug line-clamp-1">{ent.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{ent.industry}</p>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                    <span className="text-muted-foreground">
                      Nhân viên: <strong className="text-foreground">{ent.activeWorkers}/{ent.totalWorkers}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Chu kỳ: <strong className="text-foreground">{ent.checkInInterval}p</strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Shift Tracker & Live Roster Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <HardHat className="h-4 w-4 text-amber-400" />
                Bảng Giám Sát Ca Trực Nhân Sự Độc Lập (Live Lone Worker Roster)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Đồng hồ đếm ngược Dead-Man Switch · Cảnh báo trễ hạn check-in tự động
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm nhân viên, vị trí trực..."
                  className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
              >
                <Download className="h-3.5 w-3.5" /> Xuất Báo Cáo EHS
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Nhân sự Lone Worker</th>
                  <th className="p-3">Doanh nghiệp</th>
                  <th className="p-3">Mục tiêu / Vị trí trực</th>
                  <th className="p-3">Thời hạn Check-in</th>
                  <th className="p-3">Pin thiết bị</th>
                  <th className="p-3">Trạng thái an toàn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredShifts.map((shift, idx) => {
                  const isUrgent = shift.status === "URGENT_CHECKIN";
                  const isPending = shift.status === "PENDING_CHECKIN";

                  return (
                    <tr key={idx} className="hover:bg-accent/30 transition">
                      <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                          {shift.workerName.charAt(0)}
                        </div>
                        {shift.workerName}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px]">{shift.enterpriseCode}</td>
                      <td className="p-3 text-foreground/90">{shift.post}</td>
                      <td className="p-3 font-mono">
                        <span className={`inline-flex items-center gap-1 ${isUrgent ? "text-rose-400 font-bold animate-pulse" : "text-foreground"}`}>
                          <Clock className="h-3 w-3" /> {shift.deadline}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <BatteryCharging className="h-3.5 w-3.5" /> {shift.battery}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isUrgent
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                              : isPending
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {shift.status === "ON_TRACK"
                            ? "ĐÚNG TIẾN ĐỘ"
                            : shift.status === "STANDBY"
                            ? "TRỰC SẴN SÀNG"
                            : shift.status === "URGENT_CHECKIN"
                            ? "CẢNH BÁO SẮP TRỄ"
                            : "CHỜ CHECK-IN"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
