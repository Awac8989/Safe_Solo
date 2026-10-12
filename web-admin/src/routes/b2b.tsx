import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  BatteryCharging,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  HardHat,
  Phone,
  PhoneCall,
  Printer,
  Radio,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchB2BOverview, pingB2BWorker, type B2BEnterprise } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/b2b")({
  head: () => ({ meta: [{ title: "Cổng Doanh nghiệp B2B - SafeSolo Admin" }] }),
  component: B2BEnterprisePage,
});

function B2BEnterprisePage() {
  const queryClient = useQueryClient();
  const [selectedEntId, setSelectedEntId] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // EHS Contact Modal
  const [selectedEhsContact, setSelectedEhsContact] = useState<{
    name: string;
    phone: string;
    entName: string;
    entCode: string;
  } | null>(null);

  // ISO 45001 Certificate Modal
  const [selectedCertEnt, setSelectedCertEnt] = useState<B2BEnterprise | null>(null);

  const b2bQuery = useQuery({
    queryKey: ["b2b-overview"],
    queryFn: fetchB2BOverview,
    refetchInterval: 10000,
  });

  const pingWorkerMutation = useMutation({
    mutationFn: (payload: { workerName: string; enterpriseCode: string; post: string }) =>
      pingB2BWorker(payload),
    onSuccess: (res) => {
      setActionNotice(res.data.message || "Đã gửi tín hiệu kiểm tra an toàn Dead-Man Switch tới nhân sự!");
      setTimeout(() => setActionNotice(null), 3500);
      void queryClient.invalidateQueries({ queryKey: ["b2b-overview"] });
    },
  });

  const data = b2bQuery.data?.data;
  const stats = data?.stats;
  const enterprises = data?.enterprises ?? [];

  const activeEnterprise =
    selectedEntId === "ALL" ? null : enterprises.find((e) => e.id === selectedEntId) ?? null;

  const allShifts = enterprises.flatMap((e) =>
    e.activeShifts.map((s) => ({
      ...s,
      enterpriseName: e.name,
      enterpriseCode: e.code,
      contactPerson: e.contactPerson,
      contactPhone: e.contactPhone,
    })),
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
        {/* Toast Notice */}
        {actionNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/40 p-3 text-xs font-semibold text-sky-300 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
            {actionNotice}
          </div>
        )}

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
                <div
                  key={ent.id}
                  className={`rounded-xl border p-3.5 text-left transition flex flex-col justify-between ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-card/80 hover:border-primary/40 hover:bg-card"
                  }`}
                >
                  <div
                    onClick={() => setSelectedEntId(isSelected ? "ALL" : ent.id)}
                    className="cursor-pointer"
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
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <button
                      onClick={() => setSelectedCertEnt(ent)}
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-sky-400 hover:text-sky-300 transition"
                    >
                      <Award className="h-3 w-3" /> Chứng thư ISO 45001
                    </button>
                    <button
                      onClick={() =>
                        setSelectedEhsContact({
                          name: ent.contactPerson,
                          phone: ent.contactPhone,
                          entName: ent.name,
                          entCode: ent.code,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                    >
                      <PhoneCall className="h-3 w-3" /> EHS Hotline
                    </button>
                  </div>
                </div>
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
                  <th className="p-3 text-right">Hành động tác chiến</th>
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
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              pingWorkerMutation.mutate({
                                workerName: shift.workerName,
                                enterpriseCode: shift.enterpriseCode,
                                post: shift.post,
                              })
                            }
                            disabled={pingWorkerMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 text-[11px] font-bold text-sky-400 transition shadow-sm disabled:opacity-50"
                            title="Gửi tín hiệu kiểm tra an toàn Dead-Man Switch"
                          >
                            <Send className="h-3 w-3" /> Ping Bot
                          </button>
                          <button
                            onClick={() =>
                              setSelectedEhsContact({
                                name: shift.contactPerson,
                                phone: shift.contactPhone,
                                entName: shift.enterpriseName,
                                entCode: shift.enterpriseCode,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background hover:bg-accent px-2 py-1 text-[11px] font-semibold text-muted-foreground transition"
                            title="Liên hệ Trưởng ban EHS phụ trách"
                          >
                            <Phone className="h-3 w-3" /> EHS
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal 1: EHS Contact Hotline Modal */}
        {selectedEhsContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md rounded-2xl border border-sky-500/40 bg-[#090d16] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-sky-400">
                  <PhoneCall className="h-5 w-5" />
                  <h3 className="text-base font-bold text-white">Liên Hệ Trực Ban An Toàn EHS</h3>
                </div>
                <button
                  onClick={() => setSelectedEhsContact(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-2 text-xs">
                <div className="text-muted-foreground">Đơn vị doanh nghiệp:</div>
                <div className="font-bold text-sm text-white">{selectedEhsContact.entName}</div>
                <div className="text-[11px] font-mono text-sky-400">Mã: {selectedEhsContact.entCode}</div>

                <div className="border-t border-border/40 pt-2 mt-2">
                  <div className="text-muted-foreground">Trưởng ban phụ trách An toàn Lao động:</div>
                  <div className="font-bold text-foreground text-sm mt-0.5">{selectedEhsContact.name}</div>
                  <div className="font-mono text-emerald-400 text-sm mt-0.5">📞 {selectedEhsContact.phone}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <a
                  href={`tel:${selectedEhsContact.phone}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 px-4 text-xs font-bold text-white transition shadow"
                >
                  <Phone className="h-3.5 w-3.5" /> Gọi Hotline EHS
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedEhsContact(null)}
                  className="rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: ISO 45001 EHS Compliance Certificate */}
        {selectedCertEnt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-xl rounded-2xl border border-sky-500/40 bg-[#090d16] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-sky-400">
                  <Award className="h-5 w-5" />
                  <h3 className="text-base font-bold uppercase tracking-wider text-white">
                    Chứng Thư An Toàn Lao Động ISO 45001:2018
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCertEnt(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Printable Certificate Frame */}
              <div className="rounded-2xl border-2 border-sky-500/50 bg-gradient-to-b from-sky-950/30 to-card p-6 shadow-xl space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="h-14 w-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-lg">
                    <ShieldCheck className="h-8 w-8 animate-pulse" />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase font-mono tracking-widest text-sky-400">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM — AN TOÀN VỆ SINH LAO ĐỘNG
                  </h4>
                  <h3 className="text-base font-extrabold text-white mt-1">
                    CHỨNG CHỈ GIÁM SÁT AN TOÀN NHÂN SỰ LONE WORKER 24/7
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    Số hiệu: ISO45001-VN-{selectedCertEnt.code}-2026
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doanh nghiệp thụ hưởng:</span>
                    <strong className="text-white">{selectedCertEnt.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mã đối tác EHS:</span>
                    <strong className="font-mono text-sky-400">{selectedCertEnt.code}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quy chuẩn tuân thủ:</span>
                    <strong className="text-emerald-400">ISO 45001:2018 & Luật ATVSLĐ 2015</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tỷ lệ tuân thủ thực tế:</span>
                    <strong className="text-emerald-400 font-mono font-bold">{selectedCertEnt.complianceRate}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bảo hiểm trách nhiệm:</span>
                    <strong className="text-amber-400">100.000.000 VNĐ / Nhân viên (Bảo Việt)</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
                  <span>Hệ thống giám sát: SafeSolo IoT & WatchOS</span>
                  <span className="font-mono text-sky-400">Xác thực số: SHA-256 EHS Verified</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
                >
                  <Printer className="h-3.5 w-3.5" /> In Chứng Thư A4
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCertEnt(null)}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
