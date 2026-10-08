import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  FileText,
  Gift,
  HeartHandshake,
  Package,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchHeroPolicies,
  fetchHeroRestockVouchers,
  issueRestockVoucherFromSbar,
  type HeroPolicyItem,
  type RestockVoucherItem,
} from "@/lib/api";

export const Route = createFileRoute("/heroshield")({
  head: () => ({ meta: [{ title: "Bảo Hiểm Hiệp Sĩ & Bồi Hoàn Vật Tư - SafeSolo Admin" }] }),
  component: HeroShieldManagementPage,
});

function HeroShieldManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"POLICIES" | "RESTOCK_VOUCHERS">("POLICIES");
  const [targetHeroId, setTargetHeroId] = useState("HERO_RESCUER_001");
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [incidentIdInput, setIncidentIdInput] = useState("INC_TRAUMA_9921");
  const [sbarNoteInput, setSbarNoteInput] = useState(
    "Đã sử dụng 4 cuộn gạc vô trùng 10x10cm, 2 băng thun ép garô, 1 mặt nạ CPR bỏ túi hỗ trợ hô hấp."
  );
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const { data: policiesData, isLoading: policiesLoading, refetch: refetchPolicies } = useQuery({
    queryKey: ["hero-policies", targetHeroId],
    queryFn: () => fetchHeroPolicies(targetHeroId),
    refetchInterval: 15000,
  });

  const { data: vouchersData, isLoading: vouchersLoading, refetch: refetchVouchers } = useQuery({
    queryKey: ["hero-vouchers", targetHeroId],
    queryFn: () => fetchHeroRestockVouchers(targetHeroId),
    refetchInterval: 15000,
  });

  const issueVoucherMutation = useMutation({
    mutationFn: () =>
      issueRestockVoucherFromSbar({
        heroId: targetHeroId,
        incidentId: incidentIdInput,
        consumedSuppliesNote: sbarNoteInput,
      }),
    onSuccess: (res) => {
      setVoucherModalOpen(false);
      setFeedbackNotice(`Đã cấp Voucher bồi hoàn vật tư ${res.data.voucherCode} thành công cho Hiệp sĩ!`);
      void queryClient.invalidateQueries({ queryKey: ["hero-vouchers"] });
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi cấp voucher: ${err.message}`);
    },
  });

  const policies = policiesData?.data || [];
  const vouchers = vouchersData?.data || [];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar title="HeroShield: Bảo Hiểm Pháp Lý & Bồi Hoàn Vật Tư Sơ Cứu" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Banner Pháp Lý Cấp Cứu Ngoại Viện */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-card to-card p-6 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400 shrink-0">
                <Scale className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">Căn Cứ Pháp Lý & Lá Chắn Bảo Vệ Hiệp Sĩ Cứu Nạn</h2>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2.5 py-0.5 text-xs font-bold">
                    Good Samaritan Shield Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
                  Tuân thủ nghiêm ngặt <strong className="text-foreground">Điều 87 Luật Khám bệnh, chữa bệnh 2023</strong> (Cấp cứu ngoại viện do người được đào tạo thực hiện),
                  <strong className="text-foreground"> Điều 132 & Điều 23 Bộ luật Hình sự 2015</strong> (Tình thế cấp thiết và Nghĩa vụ cứu giúp người hiểm nghèo),
                  và <strong className="text-foreground">Điều 584 Bộ luật Dân sự 2015</strong> (Miễn trừ bồi thường thiệt hại khi hành động cứu nạn khẩn cấp).
                </p>
              </div>
            </div>

            <button
              onClick={() => setVoucherModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold shadow-md shrink-0 transition-all"
            >
              <Gift className="h-4 w-4" />
              Cấp Voucher Bồi Hoàn Vật Tư (SBAR)
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hạn Mức Trợ Giúp Pháp Lý</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">500,000,000đ</span>
              <span className="text-xs text-muted-foreground">Luật sư & Án phí</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bảo Hiểm Tai Nạn Hiệp Sĩ</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-500">100,000,000đ</span>
              <span className="text-xs text-muted-foreground">Y tế & Phơi nhiễm</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chứng Thư Bảo Hiểm</span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                <FileCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{policies.length}</span>
              <span className="text-xs text-muted-foreground">Đã cấp theo ca điều phối</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Voucher Bồi Hoàn Vật Tư</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Ticket className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-500">{vouchers.length}</span>
              <span className="text-xs text-muted-foreground">Hoàn trả gạc/băng tại chuỗi Long Châu</span>
            </div>
          </div>
        </div>

        {feedbackNotice && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{feedbackNotice}</span>
            </div>
            <button
              onClick={() => setFeedbackNotice(null)}
              className="text-xs font-semibold hover:underline text-muted-foreground"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Tab Selector & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("POLICIES")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "POLICIES"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Shield className="h-4 w-4" />
              Chính Sách Bảo Hiểm Ngoại Viện ({policies.length})
            </button>
            <button
              onClick={() => setActiveTab("RESTOCK_VOUCHERS")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "RESTOCK_VOUCHERS"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Package className="h-4 w-4" />
              Voucher Bồi Hoàn Vật Tư Y Tế ({vouchers.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Mã Hiệp Sĩ:</span>
              <input
                type="text"
                value={targetHeroId}
                onChange={(e) => setTargetHeroId(e.target.value)}
                className="w-48 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={() => {
                void refetchPolicies();
                void refetchVouchers();
              }}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tra Cứu
            </button>
          </div>
        </div>

        {/* Tab 1: Policies Table */}
        {activeTab === "POLICIES" && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Số Chứng Thư</th>
                  <th className="px-4 py-3">Mã Ca Điều Phối</th>
                  <th className="px-4 py-3">Loại Bảo Hiểm</th>
                  <th className="px-4 py-3">Căn Cứ Pháp Lý</th>
                  <th className="px-4 py-3">Đơn Vị Bảo Lãnh</th>
                  <th className="px-4 py-3">Hạn Mức Trợ Giúp</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {policies.map((p) => (
                  <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                      {p.policyNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {p.incidentId}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-xs text-blue-400">{p.coverageType}</div>
                      <div className="text-[11px] text-emerald-500 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Lá chắn pháp lý có hiệu lực
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-xs truncate">
                      {p.statutoryLegalBasis}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-foreground">
                      {p.insuranceUnderwriter}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <div className="font-bold text-foreground">
                        {p.coverageLimits.maxLegalDefenseFundVND.toLocaleString("vi-VN")}đ
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Y tế: {p.coverageLimits.maxMedicalExpenseVND.toLocaleString("vi-VN")}đ
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Tag variant={p.status === "ACTIVE" ? "emerald" : "zinc"}>
                        {p.status}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {policies.length === 0 && !policiesLoading && (
              <div className="p-12 text-center">
                <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">Chưa có chứng thư nào cho hiệp sĩ này</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chứng thư bảo vệ pháp lý sẽ được tự động kích hoạt ngay khi hiệp sĩ nhận lệnh điều phối khẩn cấp.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Restock Vouchers Table */}
        {activeTab === "RESTOCK_VOUCHERS" && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã Voucher</th>
                  <th className="px-4 py-3">Mã Ca Cứu Hộ</th>
                  <th className="px-4 py-3">Danh Mục Vật Tư Tiêu Hao Được Bồi Hoàn</th>
                  <th className="px-4 py-3">Giá Trị Ước Tính</th>
                  <th className="px-4 py-3">Chuỗi Nhà Thuốc Đối Tác</th>
                  <th className="px-4 py-3">Hạn Dùng</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vouchers.map((v) => (
                  <tr key={v.voucherCode} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-extrabold text-amber-500">
                      {v.voucherCode}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {v.incidentId}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {v.itemsApproved.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-foreground">
                            <span className="font-semibold">• {item.itemName}</span>
                            <span className="text-[11px] text-muted-foreground">(x{item.quantity})</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-500 text-xs">
                      {v.totalEstimatedValueVND.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-foreground">
                      {v.partnerPharmacyNetwork}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {new Date(v.expiresAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3.5">
                      <Tag variant={v.status === "ISSUED" ? "emerald" : "zinc"}>
                        {v.status}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {vouchers.length === 0 && !vouchersLoading && (
              <div className="p-12 text-center">
                <Ticket className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">Chưa có voucher bồi hoàn vật tư nào</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Điều phối viên có thể bấm "Cấp Voucher Bồi Hoàn Vật Tư (SBAR)" ở góc trên để phê duyệt.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Cấp Voucher SBAR */}
      {voucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Cấp Voucher Bồi Hoàn Vật Tư Sơ Cứu</h3>
                  <p className="text-xs text-muted-foreground">
                    Tự động nhận diện danh mục y tế tiêu hao từ báo cáo SBAR và phát hành mã voucher.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVoucherModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Mã Hiệp Sĩ tiếp nhận</label>
                <input
                  type="text"
                  value={targetHeroId}
                  onChange={(e) => setTargetHeroId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Mã Ca Sự Cố (Incident ID)</label>
                <input
                  type="text"
                  value={incidentIdInput}
                  onChange={(e) => setIncidentIdInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Ghi chú vật tư tiêu hao (Trích xuất từ SBAR Recommendation)</label>
                <textarea
                  rows={3}
                  value={sbarNoteInput}
                  onChange={(e) => setSbarNoteInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                <div>• Voucher có giá trị tại các chuỗi nhà thuốc đối tác (Pharmacity, Long Châu, An Khang).</div>
                <div>• Chi phí được trích xuất từ Quỹ Bồi Hoàn Hiệp Sĩ SafeSolo Foundation.</div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setVoucherModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => issueVoucherMutation.mutate()}
                  disabled={issueVoucherMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-semibold shadow-sm"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  {issueVoucherMutation.isPending ? "Đang phát hành..." : "Phát Hành Voucher Ngay"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
