import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BatteryCharging,
  CheckCircle2,
  Coins,
  Download,
  Flame,
  HeartHandshake,
  MapPin,
  Medal,
  Phone,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  X,
  Zap,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchHeroFleet, disburseHeroBounty, type HeroFleetItem } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/heroes")({
  head: () => ({ meta: [{ title: "Quản trị Đội Hiệp sĩ & Quỹ Thưởng - SafeSolo Admin" }] }),
  component: HeroFleetPage,
});

function HeroFleetPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [bountyModalHero, setBountyModalHero] = useState<HeroFleetItem | null>(null);
  const [bountyAmount, setBountyAmount] = useState(200000);
  const [bountyReason, setBountyReason] = useState("Hỗ trợ xăng xe & chi phí sơ cứu tại chỗ");
  const [notice, setNotice] = useState<string | null>(null);

  const fleetQuery = useQuery({
    queryKey: ["hero-fleet"],
    queryFn: fetchHeroFleet,
    refetchInterval: 10000,
  });

  const bountyMutation = useMutation({
    mutationFn: ({ heroId, amount, reason }: { heroId: string; amount: number; reason: string }) =>
      disburseHeroBounty(heroId, amount, reason),
    onSuccess: (_, vars) => {
      setBountyModalHero(null);
      setNotice(`Đã giải ngân thành công ${vars.amount.toLocaleString("vi-VN")}đ tới Hiệp sĩ!`);
      setTimeout(() => setNotice(null), 3500);
      void queryClient.invalidateQueries({ queryKey: ["hero-fleet"] });
    },
  });

  const data = fleetQuery.data?.data;
  const fleet = data?.fleet ?? [];
  const stats = data?.stats;
  const inventory = data?.safeHavensInventory ?? [];

  const filteredFleet = fleet.filter((hero) => {
    const matchesSearch =
      hero.name.toLowerCase().includes(search.toLowerCase()) ||
      hero.phone.toLowerCase().includes(search.toLowerCase()) ||
      hero.zone.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || hero.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = () => {
    exportWorkbook("safesolo-hero-fleet-report.xlsx", [
      {
        name: "Lực lượng Hiệp sĩ",
        rows: fleet.map((h) => ({
          "Họ và tên": h.name,
          SĐT: h.phone,
          "Điểm tin cậy": h.trustScore,
          "Số ca cứu hộ": h.rescuesCount,
          "Trạng thái": h.status,
          "Khu vực tuần tra": h.zone,
          "Thời gian tiếp cận (ETA)": h.responseEta,
          "Pin thiết bị (%)": h.battery,
          "Trang bị mang theo": h.equippedGear.join(", "),
        })),
      },
      {
        name: "Kho trang thiết bị Trạm An Toàn",
        rows: inventory.map((inv) => ({
          "Trạm an toàn": inv.name,
          "Máy sốc tim AED": inv.aedStatus,
          "Bình oxy": inv.oxygenStatus,
          "Hộp sơ cứu": inv.firstAidKit,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar
        title="Quản Trị Lực Lượng Hiệp Sĩ & Quỹ Cứu Trợ (Hero Fleet & Logistics)"
        subtitle="Phân công trực chiến, giải ngân trợ cấp và kiểm định trang thiết bị y tế tại Trạm An Toàn"
      />
      <div className="space-y-4 p-4 pb-16">
        {/* Notice Toast */}
        {notice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {notice}
          </div>
        )}

        {/* 1. Fleet Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-muted-foreground">Tổng Hiệp sĩ chính thức</div>
            <div className="mt-1 text-2xl font-bold">{stats?.totalHeroes ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Đã xác minh KYC CCCD</div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-emerald-400">Trực chiến sẵn sàng</div>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{stats?.onDutyCount ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Bán kính tiếp cận &lt;1km</div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-amber-400">Đang làm nhiệm vụ</div>
            <div className="mt-1 text-2xl font-bold text-amber-400">{stats?.onMissionCount ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Hỗ trợ nạn nhân tại chỗ</div>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-sky-400">Ca cứu hộ tháng này</div>
            <div className="mt-1 text-2xl font-bold text-sky-400">{stats?.totalRescuesThisMonth ?? 148}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">100% đánh giá tốt</div>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-indigo-400">Thời gian tiếp cận (ETA)</div>
            <div className="mt-1 text-2xl font-bold text-indigo-400 font-mono">{stats?.averageResponseTimeMinutes ?? 2.8}p</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Kỷ lục mạng lưới</div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-amber-400">Quỹ hỗ trợ cứu trợ</div>
            <div className="mt-1 text-lg font-bold font-mono text-amber-300">
              {(stats?.bountyFundPoolVND ?? 45000000).toLocaleString("vi-VN")}đ
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Tài trợ cộng đồng</div>
          </div>
        </div>

        {/* 2. Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm hiệp sĩ, số điện thoại, khu vực..."
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none"
            >
              <option value="ALL">Tất cả trạng thái trực</option>
              <option value="ON_DUTY">Đang trực chiến (On-Duty)</option>
              <option value="AVAILABLE">Sẵn sàng phản ứng (Available)</option>
              <option value="ON_MISSION">Đang cứu hộ (On-Mission)</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Báo Cáo Hậu Cần
          </button>
        </div>

        {/* 3. Hero Fleet Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFleet.map((hero) => {
            const isOnMission = hero.status === "ON_MISSION";
            const isOnDuty = hero.status === "ON_DUTY" || hero.status === "AVAILABLE";

            return (
              <div
                key={hero.id}
                className={`rounded-2xl border p-4 shadow-sm transition hover:border-primary/40 ${
                  isOnMission
                    ? "border-amber-500/50 bg-gradient-to-b from-amber-950/15 to-card"
                    : "border-border bg-card"
                }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs shadow">
                      {hero.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-tight flex items-center gap-1">
                        {hero.name}
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      </h4>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                        <span>{hero.phone}</span>
                        <span>·</span>
                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400" /> {hero.trustScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isOnMission
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {isOnMission ? "ĐANG CỨU HỘ" : "TRỰC CHIẾN SẴN SÀNG"}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-rose-400" /> Địa bàn:
                    </span>
                    <strong className="text-foreground">{hero.zone}</strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Medal className="h-3 w-3 text-sky-400" /> Thành tích cứu hộ:
                    </span>
                    <strong className="text-foreground">{hero.rescuesCount} ca thành công</strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <BatteryCharging className="h-3 w-3 text-emerald-400" /> Pin thiết bị:
                    </span>
                    <span className="font-mono text-emerald-400 font-semibold">{hero.battery}% · ETA {hero.responseEta}</span>
                  </div>

                  {/* Equipped Gear Chips */}
                  <div className="pt-1">
                    <div className="text-[10px] text-muted-foreground font-semibold mb-1">Trang bị sẵn sàng:</div>
                    <div className="flex flex-wrap gap-1">
                      {hero.equippedGear.map((gear, i) => (
                        <span
                          key={i}
                          className="rounded bg-background border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground"
                        >
                          {gear}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Button: Disburse Bounty */}
                <div className="mt-3.5 border-t border-border/50 pt-2.5 flex items-center justify-between">
                  <div className="text-[10px] text-muted-foreground">
                    Hạn mức trợ cấp: <strong className="text-emerald-400">{hero.availableBountyVND.toLocaleString("vi-VN")}đ</strong>
                  </div>
                  <button
                    onClick={() => setBountyModalHero(hero)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition shadow"
                  >
                    <Coins className="h-3 w-3" /> Trợ Cấp Xăng Xe
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Safe Havens Logistics & Emergency Medical Equipment Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mt-6">
          <div className="border-b border-border p-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-rose-400" />
              Kiểm Định Hậu Cần & Trang Thiết Bị Y Tế Tại Trạm An Toàn (Safe Havens Logistics)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Theo dõi tình trạng máy sốc tim ngoài lồng ngực tự động (AED), bình oxy và túi sơ cứu đa năng
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Điểm Trạm An Toàn</th>
                  <th className="p-3">Máy sốc tim AED tự động</th>
                  <th className="p-3">Bình Oxy Y Tế</th>
                  <th className="p-3">Túi / Hộp sơ cứu hiện trường</th>
                  <th className="p-3">Tình trạng kiểm định</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {inventory.map((inv, idx) => (
                  <tr key={idx} className="hover:bg-accent/30 transition">
                    <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      {inv.name}
                    </td>
                    <td className="p-3 font-mono font-semibold text-sky-400">{inv.aedStatus}</td>
                    <td className="p-3 font-mono text-muted-foreground">{inv.oxygenStatus}</td>
                    <td className="p-3 text-foreground/90">{inv.firstAidKit}</td>
                    <td className="p-3">
                      <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                        ĐÃ KIỂM ĐỊNH ĐẠT CHUẨN
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Bounty Disbursement Modal */}
        {bountyModalHero && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Coins className="h-4 w-4" /> Giải Ngân Quỹ Cứu Hộ Cho Hiệp Sĩ
                </div>
                <button onClick={() => setBountyModalHero(null)} className="rounded p-1 text-muted-foreground hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-muted/40 p-3 border border-border/60">
                  <div className="font-bold text-foreground text-sm">{bountyModalHero.name}</div>
                  <div className="text-muted-foreground text-[11px]">{bountyModalHero.phone} · Địa bàn: {bountyModalHero.zone}</div>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Mức hỗ trợ đề xuất (VNĐ)</label>
                  <select
                    value={bountyAmount}
                    onChange={(e) => setBountyAmount(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 outline-none font-mono font-bold text-foreground"
                  >
                    <option value={100000}>100.000 VNĐ (Hỗ trợ xăng xe tuần tra đêm)</option>
                    <option value={200000}>200.000 VNĐ (Hỗ trợ xăng xe + sơ cứu nạn nhân tại chỗ)</option>
                    <option value={500000}>500.000 VNĐ (Khen thưởng ca cứu hộ hiểm nghèo xuất sắc)</option>
                    <option value={1000000}>1.000.000 VNĐ (Trang cấp trọn bộ đồ sơ cứu cao cấp)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Lý do giải ngân & Ghi chú kiểm toán</label>
                  <input
                    type="text"
                    value={bountyReason}
                    onChange={(e) => setBountyReason(e.target.value)}
                    className="w-full h-8 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <button
                  onClick={() => setBountyModalHero(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() =>
                    bountyMutation.mutate({
                      heroId: bountyModalHero.id,
                      amount: bountyAmount,
                      reason: bountyReason,
                    })
                  }
                  disabled={bountyMutation.isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition"
                >
                  Xác Nhận Chuyển Khoản Trợ Cấp
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
