import { createFileRoute } from "@tanstack/react-router";
import { useState, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  ExternalLink,
  FileCheck,
  FileText,
  Gift,
  HeartHandshake,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchHeroClaims,
  fetchHeroPolicies,
  fetchHeroRestockVouchers,
  fetchHeroShieldCandidates,
  issueRestockVoucherFromSbar,
  redeemHeroRestockVoucher,
  settleHeroClaim,
  type HeroCandidateOption,
  type HeroPolicyItem,
  type HeroShieldClaimItem,
  type RestockVoucherItem,
} from "@/lib/api";

export const Route = createFileRoute("/heroshield")({
  head: () => ({ meta: [{ title: "HeroShield: Bảo Hiểm Ngoại Viện & Bồi Hoàn Vật Tư - SafeSolo Admin" }] }),
  component: HeroShieldManagementPage,
});

function HeroShieldManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"POLICIES" | "RESTOCK_VOUCHERS" | "CLAIMS">("POLICIES");
  const [targetHeroId, setTargetHeroId] = useState<string>("ALL");
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [incidentIdInput, setIncidentIdInput] = useState("INC_TRAUMA_9921");
  const [sbarNoteInput, setSbarNoteInput] = useState(
    "Đã sử dụng 4 cuộn gạc vô trùng 10x10cm, 2 băng thun ép garô C.A.T Gen 7, 1 mặt nạ CPR bỏ túi hỗ trợ hô hấp."
  );

  // Claim settlement modal state
  const [settleModalClaim, setSettleModalClaim] = useState<HeroShieldClaimItem | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState<number>(1500000);
  const [settleNoteInput, setSettleNoteInput] = useState("Chi trả 100% phác đồ thuốc PEP 72h chống phơi nhiễm HIV/HBV tại BV Bệnh Nhiệt Đới");

  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // 1. Danh sách Hiệp Sĩ thật từ MongoDB
  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ["hero-candidates"],
    queryFn: fetchHeroShieldCandidates,
    refetchInterval: 30000,
  });

  const candidates: HeroCandidateOption[] = candidatesData?.data || [];

  // 2. Danh sách Chính sách bảo hiểm
  const { data: policiesData, isLoading: policiesLoading, refetch: refetchPolicies } = useQuery({
    queryKey: ["hero-policies", targetHeroId],
    queryFn: () => fetchHeroPolicies(targetHeroId),
    refetchInterval: 15000,
  });

  // 3. Danh sách Voucher bồi hoàn vật tư y tế
  const { data: vouchersData, isLoading: vouchersLoading, refetch: refetchVouchers } = useQuery({
    queryKey: ["hero-vouchers", targetHeroId],
    queryFn: () => fetchHeroRestockVouchers(targetHeroId),
    refetchInterval: 15000,
  });

  // 4. Danh sách Yêu Cầu Bồi Thường (Claims & PEP)
  const { data: claimsData, isLoading: claimsLoading, refetch: refetchClaims } = useQuery({
    queryKey: ["hero-claims", targetHeroId],
    queryFn: () => fetchHeroClaims(targetHeroId),
    refetchInterval: 15000,
  });

  // Phát hành Voucher SBAR
  const issueVoucherMutation = useMutation({
    mutationFn: () =>
      issueRestockVoucherFromSbar({
        heroId: targetHeroId === "ALL" ? (candidates[0]?.id || "HERO_RESCUER_001") : targetHeroId,
        incidentId: incidentIdInput,
        consumedSuppliesNote: sbarNoteInput,
      }),
    onSuccess: (res) => {
      setVoucherModalOpen(false);
      setFeedbackNotice(`⚡ Đã cấp Voucher bồi hoàn [${res.data.voucherCode}] và tự động gửi Email chính thức + Thông báo Telegram tới Hiệp sĩ!`);
      void queryClient.invalidateQueries({ queryKey: ["hero-vouchers"] });
      setTimeout(() => setFeedbackNotice(null), 6000);
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi cấp voucher: ${err.message}`);
    },
  });

  // Duyệt chi trả bồi thường bảo hiểm vào ví Hiệp Sĩ
  const settleClaimMutation = useMutation({
    mutationFn: () => {
      if (!settleModalClaim) throw new Error("Chưa chọn hồ sơ");
      return settleHeroClaim(settleModalClaim.policyId || settleModalClaim._id, settleAmountInput);
    },
    onSuccess: (res) => {
      const claim = settleModalClaim;
      setSettleModalClaim(null);
      setFeedbackNotice(
        `💰 Đã thẩm định và chi trả ${settleAmountInput.toLocaleString("vi-VN")}đ vào ví Hiệp sĩ [${claim?.heroName}]. Đã đồng bộ thông báo tới Telegram Bot!`
      );
      void queryClient.invalidateQueries({ queryKey: ["hero-claims"] });
      void queryClient.invalidateQueries({ queryKey: ["hero-policies"] });
      setTimeout(() => setFeedbackNotice(null), 6000);
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi chi trả bảo hiểm: ${err.message}`);
    },
  });

  // Đánh dấu Voucher đã nhận vật tư tại nhà thuốc
  const redeemVoucherMutation = useMutation({
    mutationFn: (code: string) => redeemHeroRestockVoucher(code),
    onSuccess: (res) => {
      setFeedbackNotice(`Đã xác nhận quy đổi Voucher [${res.voucherCode}] tại hệ thống Nhà thuốc FPT Long Châu!`);
      void queryClient.invalidateQueries({ queryKey: ["hero-vouchers"] });
      setTimeout(() => setFeedbackNotice(null), 5000);
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi quy đổi: ${err.message}`);
    },
  });

  const policies = policiesData?.data || [];
  const vouchers = vouchersData?.data || [];
  const claims = claimsData?.data || [];

  const totalVouchersValue = vouchers.reduce((sum, v) => sum + (v.totalEstimatedValueVND || 0), 0);
  const totalClaimsSettledValue = claims
    .filter((c) => c.claimStatus === "PAID_OUT")
    .reduce((sum, c) => sum + (c.payoutAmountVND || 0), 0);
  const pendingClaimsCount = claims.filter((c) => c.claimStatus === "FILED" || c.claimStatus === "UNDER_REVIEW").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar
        title="HeroShield: Bảo Hiểm Pháp Lý Ngoại Viện & Quỹ Bồi Hoàn Vật Tư"
        subtitle="Lá chắn Good Samaritan bảo vệ hiệp sĩ, Quỹ phơi nhiễm PEP 72h và tái cấp vật tư y tế SBAR"
      />

      <main className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Banner Pháp Lý Cấp Cứu Ngoại Viện */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-card to-card p-5 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400 shrink-0">
                <Scale className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Căn Cứ Pháp Lý & Lá Chắn Bảo Vệ Hiệp Sĩ Cứu Nạn</h2>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-500/30">
                    Good Samaritan Shield Active
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
                  Tuân thủ nghiêm ngặt <strong className="text-foreground">Điều 87 Luật Khám bệnh, chữa bệnh 2023</strong> (Cấp cứu ngoại viện do người được đào tạo kỹ năng thực hiện),
                  <strong className="text-foreground"> Điều 132 & Điều 23 Bộ luật Hình sự 2015</strong> (Tình thế cấp thiết cứu người và Nghĩa vụ cứu giúp người trong tình trạng nguy hiểm),
                  và <strong className="text-foreground">Điều 584 Bộ luật Dân sự 2015</strong> (Miễn trừ trách nhiệm bồi thường khi hành động cứu nạn khẩn cấp).
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 text-sky-400 px-2.5 py-1 text-[11px] font-medium border border-sky-500/20">
                    <Sparkles className="h-3.5 w-3.5" />
                    Telegram Dispatch: <strong>@SFESOLOBot</strong> (Polling Active)
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 text-amber-400 px-2.5 py-1 text-[11px] font-medium border border-amber-500/20">
                    <FileCheck className="h-3.5 w-3.5" />
                    Gmail SMTP: <strong>safesolocompanyvn@gmail.com</strong> (Live Verified)
                  </span>
                </div>
              </div>
            </div>

            <button
              id="btn-open-sbar-modal"
              onClick={() => setVoucherModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 text-xs font-bold shadow-md shrink-0 transition-all"
            >
              <Gift className="h-4 w-4" />
              Cấp Voucher Bồi Hoàn Vật Tư (SBAR)
            </button>
          </div>
        </div>

        {/* 4 Thẻ KPI Chỉ Số */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hạn Mức Trợ Giúp Pháp Lý</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground font-mono">500,000,000đ</span>
              <span className="text-xs text-muted-foreground">Luật sư & Án phí</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Bảo lãnh trọn gói 100% vụ việc
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quỹ Bồi Hoàn Phơi Nhiễm PEP</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">100,000,000đ</span>
              <span className="text-xs text-muted-foreground">Thuốc PEP 72h & Y tế</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Đã chi trả: <strong className="text-foreground font-mono">{totalClaimsSettledValue.toLocaleString("vi-VN")}đ</strong>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hồ Sơ Yêu Cầu Bồi Thường</span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">{claims.length}</span>
              <span className="text-xs text-muted-foreground">ca nộp</span>
              {pendingClaimsCount > 0 && (
                <span className="ml-auto rounded-full bg-rose-500/15 text-rose-400 px-2 py-0.5 text-[10px] font-bold">
                  {pendingClaimsCount} chờ duyệt
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Phơi nhiễm dịch thể & tai nạn khi cứu nạn
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Voucher Vật Tư Long Châu</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Ticket className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400 font-mono">{vouchers.length}</span>
              <span className="text-xs text-muted-foreground">voucher</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Tổng giá trị: <strong className="text-foreground font-mono">{totalVouchersValue.toLocaleString("vi-VN")}đ</strong>
            </div>
          </div>
        </div>

        {/* Thông báo thao tác */}
        {feedbackNotice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{feedbackNotice}</span>
            </div>
            <button onClick={() => setFeedbackNotice(null)} className="text-muted-foreground hover:text-foreground">
              Đóng
            </button>
          </div>
        )}

        {/* Bộ Lọc Hiệp Sĩ & Thanh Tab Nghiệp Vụ */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <button
              id="tab-policies"
              onClick={() => setActiveTab("POLICIES")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "POLICIES"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Shield className="h-4 w-4" />
              Chứng Thư Bảo Hiểm ({policies.length})
            </button>
            <button
              id="tab-vouchers"
              onClick={() => setActiveTab("RESTOCK_VOUCHERS")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "RESTOCK_VOUCHERS"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Package className="h-4 w-4" />
              Voucher Bồi Hoàn Vật Tư ({vouchers.length})
            </button>
            <button
              id="tab-claims"
              onClick={() => setActiveTab("CLAIMS")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "CLAIMS"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              Hồ Sơ Bồi Thường & PEP ({claims.length})
              {pendingClaimsCount > 0 && (
                <span className="rounded-full bg-white text-rose-600 px-1.5 py-0.2 text-[10px] font-extrabold">
                  {pendingClaimsCount}
                </span>
              )}
            </button>
          </div>

          {/* Chọn Hiệp Sĩ thật từ Database */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Lọc theo Hiệp Sĩ:</span>
              <select
                id="select-hero-filter"
                value={targetHeroId}
                onChange={(e) => setTargetHeroId(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary min-w-[240px]"
              >
                <option value="ALL">🌐 Tất Cả Hiệp Sĩ (Toàn Mạng Lưới)</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - {c.tier}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                void refetchPolicies();
                void refetchVouchers();
                void refetchClaims();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới
            </button>
          </div>
        </div>

        {/* TAB 1: BẢNG CHỨNG THƯ BẢO HIỂM */}
        {activeTab === "POLICIES" && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Số Chứng Thư</th>
                  <th className="px-4 py-3">Mã Ca Điều Phối</th>
                  <th className="px-4 py-3">Hiệp Sĩ Thụ Hưởng</th>
                  <th className="px-4 py-3">Loại Bảo Hiểm & Căn Cứ</th>
                  <th className="px-4 py-3">Đơn Vị Bảo Lãnh</th>
                  <th className="px-4 py-3">Hạn Mức Trợ Giúp</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {policies.map((p, pIdx) => {
                  const legalDefenseLimit =
                    p.coverageLimits?.maxLegalDefenseFundVND ?? (p as any).liabilityLimitVND ?? 500000000;
                  const medicalLimit = p.coverageLimits?.maxMedicalExpenseVND ?? 100000000;
                  const legalBasis = p.statutoryLegalBasis || (p as any).legalBasis || "Điều 87 Luật Khám bệnh, chữa bệnh 2023";
                  const underwriter = p.insuranceUnderwriter || (p as any).underwriter || "Tổng Công Ty Bảo Hiểm Bảo Việt";

                  return (
                    <tr key={p._id || p.policyNumber || pIdx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                        {p.policyNumber}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                        {p.incidentId}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <span>{(p as any).heroName || "Hiệp sĩ SafeSolo"}</span>
                          <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-mono">
                            {(p as any).heroTier || "TIER_1"}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {(p as any).heroPhone || p.heroId}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-xs text-blue-400">{p.coverageType}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5" title={legalBasis}>
                          {legalBasis}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-foreground">
                        {underwriter}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-bold text-foreground font-mono">
                          {legalDefenseLimit.toLocaleString("vi-VN")}đ
                        </div>
                        <div className="text-[10px] text-emerald-400">
                          Y tế & PEP: {medicalLimit.toLocaleString("vi-VN")}đ
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Tag variant={p.status === "ACTIVE" ? "emerald" : "zinc"}>
                          {p.status}
                        </Tag>
                      </td>
                    </tr>
                  );
                })}
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

        {/* TAB 2: BẢNG VOUCHER BỒI HOÀN VẬT TƯ */}
        {activeTab === "RESTOCK_VOUCHERS" && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã Voucher</th>
                  <th className="px-4 py-3">Mã Ca Cứu Hộ</th>
                  <th className="px-4 py-3">Hiệp Sĩ Tiếp Nhận</th>
                  <th className="px-4 py-3">Danh Mục Vật Tư Tiêu Hao Được Bồi Hoàn</th>
                  <th className="px-4 py-3">Giá Trị Ước Tính</th>
                  <th className="px-4 py-3">Chuỗi Nhà Thuốc Đối Tác</th>
                  <th className="px-4 py-3">Trạng Thái & Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {vouchers.map((v, vIdx) => {
                  const itemsList = v.itemsApproved || (v as any).items || [];
                  const isRedeemed = v.status === "REDEEMED";

                  return (
                    <tr key={v.voucherCode || vIdx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-extrabold text-amber-500">
                        {v.voucherCode}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                        {v.incidentId}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-xs text-foreground">
                          {(v as any).heroName || "Hiệp sĩ SafeSolo"}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {(v as any).heroPhone || v.heroId}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {itemsList.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs text-foreground">
                              <span className="font-semibold">• {item.itemName}</span>
                              <span className="text-[11px] text-muted-foreground">(x{item.quantity})</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-emerald-400 font-mono text-xs">
                        {(v.totalEstimatedValueVND || 420000).toLocaleString("vi-VN")}đ
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-foreground">
                        {v.partnerPharmacyNetwork || (v as any).partnerPharmacyChain || "Chuỗi FPT Long Châu & Pharmacity"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Tag variant={isRedeemed ? "emerald" : "amber"}>
                            {isRedeemed ? "ĐÃ QUY ĐỔI" : "CHỜ LĨNH HÀNG"}
                          </Tag>

                          {!isRedeemed && (
                            <button
                              onClick={() => redeemVoucherMutation.mutate(v.voucherCode)}
                              disabled={redeemVoucherMutation.isPending}
                              className="rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2 py-1 text-[11px] font-semibold transition"
                              title="Xác nhận hiệp sĩ đã nhận vật tư tại nhà thuốc"
                            >
                              Đã Nhận
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

        {/* TAB 3: HỒ SƠ YÊU CẦU BỒI THƯỜNG BẢO HIỂM (CLAIMS & PEP EXPOSURE) */}
        {activeTab === "CLAIMS" && (
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            <div className="border-b border-border/50 bg-rose-950/20 p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Quỹ Bảo Trợ Khẩn Cấp Good Samaritan — Bồi Hoàn Phơi Nhiễm PEP & Tai Nạn Cứu Nạn
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Duyệt chi trả 100% chi phí xét nghiệm và phác đồ thuốc PEP chống phơi nhiễm HIV/HBV (trong 72h vàng) theo Điều 87 Luật Khám bệnh, chữa bệnh 2023.
                  </p>
                </div>
              </div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã Hồ Sơ</th>
                  <th className="px-4 py-3">Hiệp Sĩ & Tier</th>
                  <th className="px-4 py-3">Loại Phơi Nhiễm / Rủi Ro</th>
                  <th className="px-4 py-3">Chẩn Đoán Lâm Sàng & Hồ Sơ Bệnh Viện</th>
                  <th className="px-4 py-3">Chi Phí Đề Xuất</th>
                  <th className="px-4 py-3">Trạng Thái</th>
                  <th className="px-4 py-3">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {claims.map((c, cIdx) => {
                  const isPaid = c.claimStatus === "PAID_OUT";
                  const isPending = c.claimStatus === "FILED" || c.claimStatus === "UNDER_REVIEW";

                  return (
                    <tr key={c._id || cIdx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                        <div>{c.policyNumber}</div>
                        <div className="text-[10px] text-muted-foreground">{c.incidentId}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <span>{c.heroName}</span>
                          <span className="rounded bg-rose-500/15 text-rose-400 px-1.5 py-0.2 text-[10px] font-mono">
                            {c.heroTier}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">{c.heroPhone}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-xs text-rose-400">{c.claimTypeLabel}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{c.legalBasis}</div>
                      </td>
                      <td className="px-4 py-3.5 max-w-md">
                        <div className="text-xs text-foreground font-medium">{c.doctorDiagnosis}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 italic">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span>{c.hospitalReportUrl}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground font-mono text-xs">
                          {c.estimatedLossVND.toLocaleString("vi-VN")}đ
                        </div>
                        {isPaid && (
                          <div className="text-[10px] text-emerald-400 font-semibold font-mono">
                            Đã duyệt: {c.payoutAmountVND.toLocaleString("vi-VN")}đ
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Tag variant={isPaid ? "emerald" : isPending ? "rose" : "zinc"}>
                          {isPaid ? "ĐÃ CHI TRẢ" : "CHỜ DUYỆT CHI"}
                        </Tag>
                      </td>
                      <td className="px-4 py-3.5">
                        {isPending ? (
                          <button
                            id={`btn-settle-claim-${cIdx}`}
                            onClick={() => {
                              setSettleModalClaim(c);
                              setSettleAmountInput(c.estimatedLossVND || 1500000);
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            Duyệt Chi Trả
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            Đã giải ngân ví
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {claims.length === 0 && !claimsLoading && (
              <div className="p-12 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
                <h3 className="mt-2 text-sm font-semibold">Chưa có hồ sơ yêu cầu bồi thường nào</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tất cả Hiệp Sĩ trong ca điều phối đều an toàn và không xảy ra sự cố phơi nhiễm.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: CẤP VOUCHER VẬT TƯ Y TẾ SBAR */}
      {voucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Cấp Voucher Bồi Hoàn Vật Tư Sơ Cứu</h3>
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
                <label className="text-xs font-medium text-muted-foreground">Hiệp Sĩ Tiếp Nhận</label>
                <select
                  value={targetHeroId === "ALL" ? (candidates[0]?.id || "") : targetHeroId}
                  onChange={(e) => setTargetHeroId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - {c.tier}
                    </option>
                  ))}
                </select>
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
                <label className="text-xs font-medium text-muted-foreground">Ghi chú vật tư tiêu hao (SBAR Recommendation)</label>
                <textarea
                  rows={3}
                  value={sbarNoteInput}
                  onChange={(e) => setSbarNoteInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                <div>• Voucher có giá trị tại các chuỗi nhà thuốc đối tác (FPT Long Châu, Pharmacity).</div>
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

      {/* MODAL 2: THẨM ĐỊNH & DUYỆT CHI TRẢ BỒI THƯỜNG (CLAIM SETTLEMENT) */}
      {settleModalClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Thẩm Định & Chi Trả Bồi Thường Y Tế</h3>
                  <p className="text-xs text-muted-foreground">
                    Giải ngân trực tiếp vào Ví Hiệp Sĩ từ Quỹ Good Samaritan SafeSolo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettleModalClaim(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hiệp sĩ:</span>
                  <span className="font-bold text-foreground">{settleModalClaim.heroName} ({settleModalClaim.heroPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số chứng thư:</span>
                  <span className="font-mono font-bold text-foreground">{settleModalClaim.policyNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loại rủi ro:</span>
                  <span className="font-semibold text-rose-400">{settleModalClaim.claimTypeLabel}</span>
                </div>
                <div className="border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  <strong>Bằng chứng y tế:</strong> {settleModalClaim.hospitalReportUrl}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Số tiền phê duyệt giải ngân (VNĐ)</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    value={settleAmountInput}
                    onChange={(e) => setSettleAmountInput(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">VNĐ</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Chi trả 100% phác đồ thuốc dự phòng sau phơi nhiễm PEP 28 ngày và xét nghiệm máu HIV/HBV.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Ghi chú quyết định kiểm toán</label>
                <textarea
                  rows={2}
                  value={settleNoteInput}
                  onChange={(e) => setSettleNoteInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setSettleModalClaim(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => settleClaimMutation.mutate()}
                  disabled={settleClaimMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm"
                >
                  <DollarSign className="h-4 w-4" />
                  {settleClaimMutation.isPending ? "Đang giải ngân..." : "Xác Nhận Giải Ngân Vào Ví"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
