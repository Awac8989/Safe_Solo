import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  Fingerprint,
  IdCard,
  ShieldCheck,
  UserCircle2,
  XCircle,
  HeartHandshake,
  Star,
  Award,
  Briefcase,
  Sparkles,
  Stethoscope,
  FileCheck,
  AlertTriangle,
  AlertOctagon,
  Flame,
  Compass,
  ShieldAlert,
  Lock,
  Building2,
  Clock,
  FileText,
  BadgeCheck,
  ChevronRight,
  Printer,
  QrCode,
  ScrollText,
  Send,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchKycQueue,
  fetchThankYouNotes,
  resolveAssetUrl,
  updateKycStatus,
  type KycApplicant,
} from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [{ title: "Thẩm định Nghiệp vụ Hiệp Sĩ & KYC - SafeSolo Admin" }],
  }),
  component: KycPage,
});

const statusTone = {
  pending: "warning",
  approved: "success",
  rejected: "sos",
} as const;

function formatStatus(status: KycApplicant["status"]) {
  if (status === "pending") return "Chờ thẩm định";
  if (status === "approved") return "Đã phê duyệt";
  return "Đã từ chối";
}

const professionMeta: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    borderClass: string;
    bgClass: string;
    textClass: string;
    defaultTier: string;
  }
> = {
  MEDICAL_NURSE: {
    label: "Y tế / Điều dưỡng",
    icon: Stethoscope,
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    borderClass: "border-emerald-500/30",
    bgClass: "bg-emerald-950/20",
    textClass: "text-emerald-400",
    defaultTier: "TIER_PARAMEDIC_MEDIC",
  },
  POLICE_SECURITY: {
    label: "Công an / CS Cơ động",
    icon: ShieldAlert,
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    borderClass: "border-indigo-500/30",
    bgClass: "bg-indigo-950/20",
    textClass: "text-indigo-400",
    defaultTier: "TIER_POLICE_SECURITY",
  },
  FIRE_RESCUE: {
    label: "Cảnh sát PCCC & CNCH",
    icon: Flame,
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    borderClass: "border-rose-500/30",
    bgClass: "bg-rose-950/20",
    textClass: "text-rose-400",
    defaultTier: "TIER_FIRE_RESCUE",
  },
  WILDERNESS_EXPLORER: {
    label: "Cứu hộ Dã ngoại WFR",
    icon: Compass,
    badgeClass: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    borderClass: "border-teal-500/30",
    bgClass: "bg-teal-950/20",
    textClass: "text-teal-400",
    defaultTier: "TIER_WILDERNESS_EXPLORER",
  },
  RED_CROSS_FIRST_AID: {
    label: "Sơ cấp cứu Chữ Thập Đỏ",
    icon: Award,
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    borderClass: "border-amber-500/30",
    bgClass: "bg-amber-950/20",
    textClass: "text-amber-400",
    defaultTier: "TIER_BLS_FIRST_AID",
  },
  UNQUALIFIED_CIVILIAN: {
    label: "Dân sự (Chưa đủ chuẩn)",
    icon: AlertOctagon,
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/40",
    borderClass: "border-red-500/40",
    bgClass: "bg-red-950/25",
    textClass: "text-red-400",
    defaultTier: "NONE",
  },
};

function getProfessionInfo(category?: string) {
  if (category && professionMeta[category]) {
    return professionMeta[category];
  }
  return {
    label: "Y tế / Điều dưỡng",
    icon: Stethoscope,
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    borderClass: "border-emerald-500/30",
    bgClass: "bg-emerald-950/20",
    textClass: "text-emerald-400",
    defaultTier: "TIER_PARAMEDIC_MEDIC",
  };
}

function KycPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"KYC" | "THANK_YOU">("KYC");
  const [professionFilter, setProfessionFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<KycApplicant | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("TIER_PARAMEDIC_MEDIC");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasonSelection, setRejectReasonSelection] = useState(
    "Chưa đạt điểm sát hạch lý thuyết cấp cứu ngoại viện (Yêu cầu tối thiểu 18/20 điểm theo quy chuẩn TOC)."
  );
  const [customRejectNote, setCustomRejectNote] = useState("");
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const queueQuery = useQuery({
    queryKey: ["kyc-queue"],
    queryFn: fetchKycQueue,
  });

  const thankYouQuery = useQuery({
    queryKey: ["thank-you-notes"],
    queryFn: fetchThankYouNotes,
  });

  const applicants = queueQuery.data?.data ?? [];
  const thankYouNotes = thankYouQuery.data?.data ?? [];

  const filteredApplicants = applicants.filter((item) => {
    if (professionFilter === "ALL") return true;
    return item.professionCategory === professionFilter;
  });

  useEffect(() => {
    if (filteredApplicants.length > 0) {
      if (!selected || !filteredApplicants.some((item) => item.id === selected.id)) {
        setSelected(filteredApplicants[0]);
      }
    } else {
      setSelected(null);
    }
  }, [professionFilter, filteredApplicants, selected]);

  useEffect(() => {
    if (!selected) return;
    const info = getProfessionInfo(selected.professionCategory);
    if (selected.specialtyTier && selected.specialtyTier !== "NONE" && selected.specialtyTier !== "UNVERIFIED") {
      setSelectedTier(selected.specialtyTier);
    } else {
      setSelectedTier(info.defaultTier);
    }
  }, [selected]);

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      tier,
      reason,
    }: {
      id: string;
      action: "APPROVE" | "REJECT";
      tier?: string;
      reason?: string;
    }) => updateKycStatus(id, action, { tier, reason }),
    onSuccess: async (_, variables) => {
      setActionNotice({
        type: "success",
        message:
          variables.action === "APPROVE"
            ? `Đã phê duyệt thăng hạng Hiệp Sĩ thành công (${variables.tier || selectedTier})! Đã kích hoạt Telegram Bot @SFESOLOBot & gửi thư chúc mừng qua Gmail.`
            : "Đã gửi quyết định từ chối hồ sơ kèm lý do chuyên môn chi tiết qua Email & Telegram!",
      });
      setRejectModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["kyc-queue"] });
    },
    onError: (error: Error) => {
      setActionNotice({
        type: "error",
        message: error.message || "Thao tác không thành công!",
      });
    },
  });

  // CỔNG KIỂM SOÁT PHÊ DUYỆT NGHIÊM NGẶT (STRICT ELIGIBILITY GATE)
  const isUnqualified = selected?.professionCategory === "UNQUALIFIED_CIVILIAN";
  const isScoreLow = (selected?.theoryExamScore ?? 0) < 18;
  const isMatchLow = (selected?.match ?? 0) < 90;
  const isLivenessFailed = selected?.liveness !== "PASSED_3D_LIVENESS";

  const isEligible = Boolean(
    selected &&
    !isUnqualified &&
    !isScoreLow &&
    !isMatchLow &&
    !isLivenessFailed &&
    selected.theoryExamPassed
  );

  const failureReasons: string[] = [];
  if (isUnqualified) {
    failureReasons.push("Chưa có bằng cấp/chứng chỉ chuyên môn (Y tế, Công an, Cứu hỏa hoặc Cứu hộ dã ngoại)");
  }
  if (isScoreLow) {
    failureReasons.push(`Điểm sát hạch ngoại viện chưa đạt (${selected?.theoryExamScore ?? 0}/20, yêu cầu tối thiểu 18/20)`);
  }
  if (isMatchLow) {
    failureReasons.push(`Độ khớp FaceMatch dưới ngưỡng an toàn (${selected?.match ?? 0}%, yêu cầu ≥ 90%)`);
  }
  if (isLivenessFailed) {
    failureReasons.push("Chưa vượt qua kiểm định 3D Liveness Detection chống deepfake/ảnh in");
  }

  const handleExport = () => {
    exportWorkbook("safesolo-admin-kyc.xlsx", [
      {
        name: "KYC_HIEP_SI",
        rows: applicants.map((user) => ({
          ID: user.id,
          User_ID: user.userId,
          "Họ tên": user.name,
          "Số điện thoại": user.phone,
          "Nhóm chuyên môn": user.professionCategory || "MEDICAL_NURSE",
          "Văn bằng / Thẻ ngành": user.credentialName || "N/A",
          "Số hiệu": user.credentialNumber || "N/A",
          "Cơ quan cấp": user.issuingAuthority || "N/A",
          "Đơn vị công tác": user.workingUnit || "N/A",
          "Thâm niên (năm)": user.yearsOfExperience || 0,
          "Điểm sát hạch": `${user.theoryExamScore ?? 0}/20`,
          "Đạt sát hạch": user.theoryExamPassed ? "ĐẠT" : "KHÔNG ĐẠT",
          "Độ khớp FaceMatch": `${user.match}%`,
          Liveness: user.liveness,
          "Trạng thái": formatStatus(user.status),
          "Ngày nộp": user.applied,
        })),
      },
    ]);
  };

  const selectedProfInfo = getProfessionInfo(selected?.professionCategory);
  const SelectedProfIcon = selectedProfInfo.icon;

  return (
    <>
      <Topbar
        title="Thẩm định Nghiệp vụ Hiệp Sĩ & Xác minh KYC"
        subtitle="Hệ thống 4 trụ cột giám định văn bằng Y tế, Công an, Cứu hỏa, Thám hiểm & Sát hạch ngoại viện"
      />

      <div className="space-y-3 p-3">
        {/* Notice Toast / Alert Banner */}
        {actionNotice && (
          <div
            className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium transition ${
              actionNotice.type === "success"
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                : "border-red-500/40 bg-red-950/40 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertOctagon className="h-4 w-4 text-red-400" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="rounded p-1 text-muted-foreground hover:bg-accent/40"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Header & Tab Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 p-2.5 rounded-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("KYC")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "KYC"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Hồ Sơ KYC & Năng Lực Hiệp Sĩ ({applicants.length})
            </button>
            <button
              onClick={() => setActiveTab("THANK_YOU")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "THANK_YOU"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <HeartHandshake className="h-4 w-4 text-rose-300" />
              Hộp Thư Tri Ân Cộng Đồng ({thankYouNotes.length})
            </button>
          </div>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất Báo Cáo Excel
          </button>
        </div>

        {/* TAB 1: KYC QUEUE & HERO CREDENTIALS */}
        {activeTab === "KYC" && (
          <div className="space-y-3">
            {/* Live Certification & Dispatch Banner */}
            <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card p-3 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
                  <BadgeCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Hội Đồng Thẩm Định & Cấp Chứng Thư Hiệp Sĩ (Điều 87)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Live Dual-Channel Sync
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Mọi quyết định phê duyệt/từ chối đều được đồng bộ tức thì: Kích hoạt bàn phím tác chiến trên <b>Telegram Bot (@SFESOLOBot)</b> và gửi thư điện tử chính thức kèm chứng thư số qua <b>Gmail Live (safesolocompanyvn@gmail.com)</b>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">
                  Bảo Việt Shield: 500.000.000 VNĐ
                </span>
              </div>
            </div>

            {/* Sector Category Filter Bar */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card/50 p-2 text-xs">
              <span className="px-2 text-[11px] font-semibold uppercase text-muted-foreground">
                Lọc chuyên môn:
              </span>
              <button
                onClick={() => setProfessionFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  professionFilter === "ALL"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                Tất cả ({applicants.length})
              </button>
              <button
                onClick={() => setProfessionFilter("MEDICAL_NURSE")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                  professionFilter === "MEDICAL_NURSE"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5 text-emerald-400" />
                Y tế / Điều dưỡng ({applicants.filter((a) => a.professionCategory === "MEDICAL_NURSE").length})
              </button>
              <button
                onClick={() => setProfessionFilter("POLICE_SECURITY")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                  professionFilter === "POLICE_SECURITY"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" />
                Công an / CAND ({applicants.filter((a) => a.professionCategory === "POLICE_SECURITY").length})
              </button>
              <button
                onClick={() => setProfessionFilter("FIRE_RESCUE")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                  professionFilter === "FIRE_RESCUE"
                    ? "bg-rose-600 text-white shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Flame className="h-3.5 w-3.5 text-rose-400" />
                Cứu hỏa PCCC ({applicants.filter((a) => a.professionCategory === "FIRE_RESCUE").length})
              </button>
              <button
                onClick={() => setProfessionFilter("WILDERNESS_EXPLORER")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                  professionFilter === "WILDERNESS_EXPLORER"
                    ? "bg-teal-600 text-white shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Compass className="h-3.5 w-3.5 text-teal-400" />
                Cứu hộ Dã ngoại ({applicants.filter((a) => a.professionCategory === "WILDERNESS_EXPLORER").length})
              </button>
              <button
                onClick={() => setProfessionFilter("UNQUALIFIED_CIVILIAN")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition ${
                  professionFilter === "UNQUALIFIED_CIVILIAN"
                    ? "bg-red-700 text-white shadow"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <AlertOctagon className="h-3.5 w-3.5 text-red-300" />
                Dân sự (Chưa đủ chuẩn) ({applicants.filter((a) => a.professionCategory === "UNQUALIFIED_CIVILIAN").length})
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
              {/* LEFT COLUMN: APPLICANT QUEUE TABLE */}
              <section className="overflow-hidden rounded-xl border border-border bg-card flex flex-col max-h-[calc(100vh-210px)]">
                <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold">Danh sách hàng chờ thẩm định</h2>
                    <p className="text-[11px] text-muted-foreground">
                      Hiển thị {filteredApplicants.length} hồ sơ thực tế từ MongoDB
                    </p>
                  </div>
                  <Tag tone="info">Đa trụ cột KYC</Tag>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Ứng viên & Chuyên môn</th>
                        <th className="px-3 py-2 text-left font-medium">FaceMatch</th>
                        <th className="px-3 py-2 text-left font-medium">Sát hạch</th>
                        <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplicants.map((user) => {
                        const prof = getProfessionInfo(user.professionCategory);
                        const ProfIcon = prof.icon;
                        const isUserEligible =
                          user.professionCategory !== "UNQUALIFIED_CIVILIAN" &&
                          user.match >= 90 &&
                          user.theoryExamPassed &&
                          (user.theoryExamScore ?? 0) >= 18;

                        return (
                          <tr
                            key={user.id}
                            onClick={() => setSelected(user)}
                            className={`cursor-pointer border-t border-border transition ${
                              selected?.id === user.id ? "bg-info/10 border-l-4 border-l-primary" : "hover:bg-accent/30"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground flex items-center gap-1.5">
                                {user.name}
                                {!isUserEligible && (
                                  <span title="Không đạt tiêu chuẩn" className="text-red-400">
                                    ⚠️
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border ${prof.badgeClass}`}
                                >
                                  <ProfIcon className="h-3 w-3" />
                                  {prof.label}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {user.phone}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-mono text-xs font-semibold flex items-center gap-1">
                                <span className={user.match >= 90 ? "text-emerald-400" : "text-red-400"}>
                                  {user.match}%
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {user.liveness === "PASSED_3D_LIVENESS" ? "3D OK" : "Failed"}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-mono text-xs font-bold">
                                <span
                                  className={
                                    (user.theoryExamScore ?? 0) >= 18 ? "text-emerald-400" : "text-amber-400"
                                  }
                                >
                                  {user.theoryExamScore !== undefined ? `${user.theoryExamScore}/20` : "N/A"}
                                </span>
                              </div>
                              <div className="text-[10px]">
                                {user.theoryExamPassed ? (
                                  <span className="text-emerald-400 font-semibold">Đạt</span>
                                ) : (
                                  <span className="text-red-400 font-semibold">Rớt</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Tag tone={statusTone[user.status]}>{formatStatus(user.status)}</Tag>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredApplicants.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                            Không tìm thấy hồ sơ nào trong danh mục chuyên môn này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* RIGHT COLUMN: DETAILED DOSSIER & 4-PILLAR AUDIT */}
              <section className="overflow-hidden rounded-xl border border-border bg-card flex flex-col max-h-[calc(100vh-210px)]">
                {selected ? (
                  <>
                    {/* Header */}
                    <div className="shrink-0 flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-foreground">{selected.name}</h2>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border ${selectedProfInfo.badgeClass}`}
                          >
                            <SelectedProfIcon className="h-3.5 w-3.5" />
                            {selectedProfInfo.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          ID: {selected.userId} · SĐT: {selected.phone} · Khu vực: {selected.region}
                        </p>
                      </div>
                      <Tag tone={statusTone[selected.status]}>
                        <Fingerprint className="h-3 w-3" /> {formatStatus(selected.status)}
                      </Tag>
                    </div>

                    {/* Scrollable Dossier Content */}
                    <div className="overflow-y-auto flex-1 p-3.5 space-y-2.5">
                      {/* 4 Document Cards Grid */}
                      <div className="grid gap-2.5 md:grid-cols-4">
                        <ImageCard
                          icon={UserCircle2}
                          label="Chân dung eKYC"
                          imageUrl={selected.selfieImageUrl}
                          tone="from-success/10 to-info/10"
                        />
                        <ImageCard
                          icon={IdCard}
                          label="CCCD mặt trước"
                          imageUrl={selected.frontImageUrl}
                          tone="from-warning/10 to-info/10"
                        />
                        <ImageCard
                          icon={IdCard}
                          label="CCCD mặt sau"
                          imageUrl={selected.backImageUrl}
                          tone="from-warning/10 to-success/10"
                        />
                        <ImageCard
                          icon={SelectedProfIcon}
                          label="Văn bằng / Thẻ ngành"
                          imageUrl={selected.certificateImageUrl || selected.credentialImageUrl || ""}
                          tone={`${selectedProfInfo.bgClass} border ${selectedProfInfo.borderClass}`}
                        />
                      </div>

                    {/* Key Metrics Bar */}
                    <div className="grid gap-2.5 px-3.5 pb-2.5 md:grid-cols-3">
                      <SummaryCard
                        label="Khớp khuôn mặt FaceMatch"
                        value={`${selected.match}%`}
                        tone={selected.match >= 90 ? "text-emerald-400" : "text-rose-400"}
                        progress={selected.match}
                        subtitle={selected.match >= 90 ? "Đạt ngưỡng an toàn (≥90%)" : "Cảnh báo: Dưới 90%"}
                      />
                      <SummaryCard
                        label="3D Liveness Detection"
                        value={selected.liveness === "PASSED_3D_LIVENESS" ? "VƯỢT QUA" : "THẤT BẠI"}
                        tone={selected.liveness === "PASSED_3D_LIVENESS" ? "text-emerald-400" : "text-red-400"}
                        subtitle="Chống giả mạo Deepfake 3D"
                      />
                      <SummaryCard
                        label="Sát hạch ngoại viện"
                        value={`${selected.theoryExamScore ?? 0}/20`}
                        tone={(selected.theoryExamScore ?? 0) >= 18 ? "text-emerald-400" : "text-amber-400"}
                        subtitle={selected.theoryExamPassed ? "Đạt chuẩn xuất sắc" : "Chưa đạt chuẩn (≥18/20)"}
                      />
                    </div>

                    {/* TRỤ CỘT 1: THẨM ĐỊNH BẰNG CẤP & THẺ NGÀNH CHUYÊN MÔN */}
                    <div
                      className={`mx-3.5 mb-2.5 rounded-xl border p-3.5 space-y-2.5 ${selectedProfInfo.borderClass} ${selectedProfInfo.bgClass}`}
                    >
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                          <SelectedProfIcon className={`h-4 w-4 ${selectedProfInfo.textClass}`} />
                          TRỤ CỘT 1: THẨM ĐỊNH VĂN BẰNG & THẺ NGÀNH CHUYÊN MÔN
                        </div>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-bold border ${selectedProfInfo.badgeClass}`}>
                          {selected.specialtyTier || selectedProfInfo.defaultTier}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 text-xs">
                        <DetailRow
                          label="Văn bằng / Chứng chỉ chuyên ngành"
                          value={selected.credentialName || "Chưa cung cấp văn bằng chuyên môn"}
                          full
                        />
                        <DetailRow
                          label="Số hiệu văn bằng / Thẻ ngành"
                          value={selected.credentialNumber || "CHƯA CÓ SỐ HIỆU"}
                        />
                        <DetailRow
                          label="Cơ quan / Đơn vị cấp bằng"
                          value={selected.issuingAuthority || "Cơ quan có thẩm quyền"}
                        />
                        <DetailRow
                          label="Đơn vị công tác hiện tại"
                          value={selected.workingUnit || "Chưa cập nhật đơn vị"}
                        />
                        <DetailRow
                          label="Thâm niên thực chiến"
                          value={
                            selected.yearsOfExperience
                              ? `${selected.yearsOfExperience} năm kinh nghiệm`
                              : "Dưới 1 năm"
                          }
                        />
                      </div>

                      {/* Kỹ năng nghiệp vụ được cấp phép */}
                      <div className="pt-1">
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1 font-semibold">
                          Kỹ năng nghiệp vụ & lâm sàng được phép thực hiện:
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {(selected.skillsList && selected.skillsList.length > 0
                            ? selected.skillsList
                            : ["CPR_AED", "AIRWAY_CHOKING", "HEMOSTASIS_PRESSURE"]
                          ).map((skill, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-background/80 px-2 py-0.5 font-medium text-foreground border border-border/60"
                            >
                              ✓ {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* TRỤ CỘT 2: THÔNG TIN CĂN CƯỚC & ĐỊNH DANH CCCD */}
                    <div className="mx-3.5 mb-2.5 rounded-xl border border-border bg-background/40 p-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <IdCard className="h-3.5 w-3.5" /> TRỤ CỘT 2: ĐỊNH DANH CCCD & SINH TRẮC HỌC
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 text-xs">
                        <DetailRow label="Họ và tên trên CCCD" value={selected.name} />
                        <DetailRow label="Số định danh CCCD" value={selected.identityNumber} />
                        <DetailRow label="Địa chỉ thường trú" value={selected.identityAddress} full />
                        <DetailRow label="Điểm tin cậy cộng đồng" value={`${selected.trustScore.toFixed(1)} / 5.0 ⭐`} />
                        <DetailRow label="Số lượt cứu hộ hoàn tất" value={`${selected.rescuesCount} ca an toàn`} />
                      </div>
                    </div>

                    {/* TRỤ CỘT 3: SÁT HẠCH LÝ THUYẾT & TÌNH HUỐNG LÂM SÀNG NGOẠI VIỆN */}
                    <div className="mx-3.5 mb-2.5 rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <FileCheck className="h-5 w-5 text-sky-400" />
                        <div>
                          <div className="font-bold text-foreground">
                            TRỤ CỘT 3: SÁT HẠCH LÝ THUYẾT & TÌNH HUỐNG NGOẠI VIỆN (20 CÂU)
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Điểm số trắc nghiệm:{" "}
                            <span className="font-bold font-mono text-foreground">
                              {selected.theoryExamScore !== undefined ? `${selected.theoryExamScore}/20` : "Chưa hoàn tất"}
                            </span>{" "}
                            (Yêu cầu tối thiểu: 18/20 điểm)
                          </div>
                        </div>
                      </div>
                      <div>
                        {selected.theoryExamPassed && (selected.theoryExamScore ?? 0) >= 18 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                            <BadgeCheck className="h-3.5 w-3.5" /> ĐẠT CHUẨN XUẤT SẮC
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-300 border border-rose-500/30">
                            <AlertTriangle className="h-3.5 w-3.5" /> KHÔNG ĐẠT CHUẨN (CẦN ÔN TẬP)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TRỤ CỘT 4: PHÂN CẤP BẬC HÀNH NGHỀ KHI PHÊ DUYỆT */}
                    <div className="mx-3.5 mb-3 rounded-xl border border-purple-500/30 bg-purple-950/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4 text-purple-400" /> TRỤ CỘT 4: PHÂN CẤP BẬC HÀNH NGHỀ KHI DUYỆT
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Điều 87 Luật Khám bệnh, chữa bệnh 2023
                        </span>
                      </div>

                      <select
                        value={selectedTier}
                        onChange={(e) => setSelectedTier(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="TIER_PARAMEDIC_MEDIC">
                          🩺 Tier Paramedic/Medic: Bác sĩ / Điều dưỡng phản ứng nhanh (Hồi sức nâng cao ACLS/BLS, Tele-FirstAid)
                        </option>
                        <option value="TIER_POLICE_SECURITY">
                          🛡️ Tier Police/Security: Hiệp sĩ An ninh - CAND (Khống chế bạo lực, xử lý mã Duress bí mật, bảo vệ hiện trường)
                        </option>
                        <option value="TIER_FIRE_RESCUE">
                          🚒 Tier Fire/Rescue: Cảnh sát PCCC & CNCH (Cắt phá cabin sập, cứu hỏa, đu dây địa hình cao)
                        </option>
                        <option value="TIER_WILDERNESS_EXPLORER">
                          🧭 Tier Wilderness Explorer: Cứu hộ Địa hình Dã ngoại (Rừng núi hiểm trở, hang động, sông nước WFR)
                        </option>
                        <option value="TIER_BLS_FIRST_AID">
                          🚑 Tier BLS First Aid: Tình nguyện viên Chữ Thập Đỏ (Ép tim CPR/AED, Dị vật đường thở, Băng ép)
                        </option>
                      </select>
                    </div>

                    {/* CỔNG KIỂM SOÁT PHÊ DUYỆT NGHIÊM NGẶT (STRICT APPROVAL GATE) */}
                    <div className="mx-3.5 mb-3">
                      {!isEligible ? (
                        <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 space-y-2">
                          <div className="flex items-center gap-2 text-red-300 font-bold text-xs">
                            <AlertOctagon className="h-4 w-4 text-red-400 shrink-0" />
                            <span>CỔNG AN TOÀN: HỒ SƠ KHÔNG ĐỦ TIÊU CHUẨN NĂNG LỰC HIỆP SĨ</span>
                          </div>
                          <div className="text-[11px] text-red-200/90 space-y-1 pl-6">
                            {failureReasons.map((reason, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <span className="text-red-400 font-bold">•</span>
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-red-300/70 italic pl-6 border-t border-red-500/20 pt-1.5">
                            * Theo quy chuẩn an toàn SafeSolo, nút Phê duyệt bị khóa cứng để tránh nguy cơ rủi ro y tế và pháp lý cho người dân.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 flex items-center gap-2.5 text-xs text-emerald-200">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="font-bold">ĐỦ ĐIỀU KIỆN PHÊ DUYỆT:</span> Hồ sơ đã vượt qua 4 trụ cột thẩm định nghiệp vụ (Văn bằng ngành y/an ninh/cứu nạn, FaceMatch ≥ 90%, Sát hạch ≥ 18/20).
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Bar (Sticky bottom) */}
                  <div className="shrink-0 flex items-center justify-between border-t border-border bg-card/95 backdrop-blur px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        Lời cảm ơn: {selected.thankYouCount} · Đã xác minh: {selected.isKycVerified ? "Có" : "Chưa"}
                      </div>
                      <div className="flex items-center gap-2">
                        {selected.status === "approved" && (
                          <button
                            onClick={() => setCertificateModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition shadow-sm"
                          >
                            <ScrollText className="h-3.5 w-3.5 text-emerald-400" /> Xem Chứng Thư Số Điều 87
                          </button>
                        )}

                        <button
                          onClick={() => setRejectModalOpen(true)}
                          disabled={actionMutation.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Từ chối hồ sơ
                        </button>

                        <button
                          onClick={() =>
                            actionMutation.mutate({
                              id: selected.id,
                              action: "APPROVE",
                              tier: selectedTier,
                            })
                          }
                          disabled={!isEligible || actionMutation.isPending}
                          title={!isEligible ? "Hồ sơ không đủ tiêu chuẩn để phê duyệt" : "Phê duyệt thăng hạng Hiệp sĩ"}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition shadow ${
                            isEligible
                              ? "bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow-emerald-900/30"
                              : "bg-muted text-muted-foreground cursor-not-allowed opacity-40 border border-border"
                          }`}
                        >
                          {isEligible ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Phê duyệt {selectedTier.replace("TIER_", "Tier ")}
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              Đã khóa duyệt (Không đủ chuẩn)
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Chọn một hồ sơ từ danh sách để xem chi tiết giám định 4 trụ cột.
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* TAB 2: COMMUNITY THANK-YOU NOTES FEED */}
        {activeTab === "THANK_YOU" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-rose-400" />
                    Hộp Thư Tri Ân & Đánh Giá Cộng Đồng
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lời cảm ơn chân thực từ những người dân và gia đình được lực lượng Hiệp sĩ SafeSolo cứu trợ kịp thời
                  </p>
                </div>
                <Tag tone="success">⭐⭐⭐⭐⭐ 100% Đánh giá 5 sao</Tag>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {thankYouNotes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm hover:border-emerald-500/40 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-sm">{note.victimName}</span>
                        <span className="text-[11px] text-muted-foreground">gửi tới</span>
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                          {note.heroName}
                        </span>
                      </div>
                      <div className="flex text-amber-400 text-xs">
                        {Array.from({ length: note.rating }).map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-foreground/90 italic leading-relaxed bg-background/50 p-3 rounded-lg border border-border/50">
                      "{note.message}"
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                    <div className="flex flex-wrap gap-1">
                      {note.tags.map((tag, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono">{note.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: TỪ CHỐI HỒ SƠ KÈM LÝ DO CHUYÊN MÔN & PHÁP LÝ */}
      {rejectModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 text-left">
            <div className="flex items-start justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Từ Chối Thẩm Định Hồ Sơ Hiệp Sĩ</h3>
                  <p className="text-xs text-muted-foreground font-mono">Ứng viên: {selected.name} ({selected.phone})</p>
                </div>
              </div>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Hệ thống sẽ chuyển hồ sơ sang <b>REJECTED</b> và tự động gửi thông báo giải thích chi tiết qua <b>Email & Telegram Bot</b> để ứng viên nắm rõ nguyên nhân và hoàn thiện kiến thức.
              </p>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  Chọn lý do từ chối chuẩn chuyên môn y tế / pháp lý:
                </label>
                <div className="space-y-1.5 text-xs">
                  {[
                    "Chưa đạt điểm sát hạch lý thuyết cấp cứu ngoại viện (Yêu cầu tối thiểu 18/20 điểm theo quy chuẩn TOC).",
                    "Hồ sơ dân sự thông thường chưa có chứng chỉ chuyên môn y tế / cứu hỏa / an ninh theo Điều 87 Luật Khám chữa bệnh 2023.",
                    "Độ khớp nhận diện khuôn mặt eKYC FaceMatch dưới ngưỡng an toàn (< 90%).",
                    "Ảnh chụp chứng chỉ mờ, không rõ số hiệu CCHN hoặc cơ quan cấp phép.",
                    "Chưa vượt qua kiểm định 3D Liveness Detection chống deepfake/ảnh in.",
                  ].map((preset, idx) => (
                    <label
                      key={idx}
                      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                        rejectReasonSelection === preset
                          ? "border-red-500/50 bg-red-950/20 text-red-200"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rejectReason"
                        checked={rejectReasonSelection === preset}
                        onChange={() => setRejectReasonSelection(preset)}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-[11px] leading-snug">{preset}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Ghi chú hướng dẫn thêm cho ứng viên (tùy chọn):
                </label>
                <textarea
                  rows={2}
                  value={customRejectNote}
                  onChange={(e) => setCustomRejectNote(e.target.value)}
                  placeholder="Ví dụ: Vui lòng tham gia khóa đào tạo BLS/CPR tại Hội Chữ Thập Đỏ và nộp lại hồ sơ sau 7 ngày..."
                  className="w-full rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-border/50">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    const finalReason = customRejectNote
                      ? `${rejectReasonSelection} - Ghi chú: ${customRejectNote}`
                      : rejectReasonSelection;
                    actionMutation.mutate({
                      id: selected.id,
                      action: "REJECT",
                      reason: finalReason,
                    });
                  }}
                  disabled={actionMutation.isPending}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {actionMutation.isPending ? "Đang gửi..." : "Gửi Quyết Định Từ Chối"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHỨNG THƯ ĐIỆN TỬ BẢO TRỢ PHÁP LÝ ĐIỀU 87 */}
      {certificateModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl border-2 border-amber-500/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 text-center relative overflow-hidden">
            {/* Background watermarks */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM · ĐỘC LẬP - TỰ DO - HẠNH PHÚC
              </span>
              <button
                onClick={() => setCertificateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="my-4 p-5 rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-background to-background text-left space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Award className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-wide text-amber-300 uppercase">
                      CHỨNG THƯ HIỆP SĨ CẤP CỨU NGOẠI VIỆN
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      GOOD SAMARITAN FIRST RESPONDER CITATION · BẢO TRỢ PHÁP LÝ TOÀN PHẦN
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted-foreground block">MÃ CHỨNG THƯ</span>
                  <span className="font-mono font-bold text-xs text-amber-400">
                    SS-87-{selected.id.substring(0, 8).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-y border-border/60 py-3">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase block">HIỆP SĨ ĐƯỢC CÔNG NHẬN:</span>
                  <span className="text-base font-bold text-foreground">{selected.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase block">PHÂN HẠNG TÁC CHIẾN:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {selected.specialtyTier || selectedTier}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase block">CHỨNG CHỈ / THẺ NGÀNH:</span>
                  <span className="font-medium text-foreground">{selected.credentialName || "Chứng chỉ Sơ cấp cứu Y tế"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase block">SỐ HIỆU CCHN / THẺ:</span>
                  <span className="font-mono font-bold text-foreground">{selected.credentialNumber || "CCHN-2026-SS"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase block">ĐƠN VỊ CÔNG TÁC:</span>
                  <span className="font-medium text-foreground">{selected.workingUnit || "Hệ thống Phản ứng Nhanh SafeSolo"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase block">THỜI HẠN HIỆU LỰC:</span>
                  <span className="font-bold text-foreground">02 Năm (2026 - 2028)</span>
                </div>
              </div>

              {/* Legal & Insurance Protection Terms */}
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-1.5 text-emerald-200/90">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>LÁ CHẮN PHÁP LÝ & BẢO HIỂM NGHỀ NGHIỆP:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  • <b>Căn cứ pháp lý:</b> Được hưởng đầy đủ quyền miễn trừ trách nhiệm dân sự và hình sự theo <b>Điều 87 Luật Khám bệnh, chữa bệnh số 15/2023/QH15</b> khi tham gia sơ cứu, cấp cứu người gặp nạn ngoại viện.
                </p>
                <p className="text-[11px] leading-relaxed">
                  • <b>Quỹ bảo hiểm Good Samaritan Shield:</b> Hợp đồng số <code>BV-SS-2026-87</code> do Tổng Công ty Bảo hiểm Bảo Việt bảo trợ với hạn mức trách nhiệm bồi hoàn lên tới <b>500.000.000 VNĐ</b> cho chi phí pháp lý và bồi thường rủi ro ngoại viện.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <QrCode className="h-10 w-10 text-muted-foreground/60" />
                  <div className="text-[9px] text-muted-foreground font-mono leading-tight">
                    XÁC THỰC SỐ HÓA<br />
                    TOC-115-GOV-VN<br />
                    HASH: SHA-256 VALID
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-bold font-mono tracking-wider">
                    ★ SAFESOLO TOC VERIFIED SEAL ★
                  </div>
                  <span className="block text-[9px] text-muted-foreground mt-0.5">GIÁM ĐỐC TRUNG TÂM ĐIỀU PHỐI KÝ DUYỆT</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                In Chứng Thư Điện Tử
              </button>
              <button
                onClick={() => setCertificateModalOpen(false)}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-xs font-semibold shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ImageCard({
  icon: Icon,
  label,
  imageUrl,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  imageUrl: string;
  tone: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br ${tone} p-2`}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="h-3 w-3 shrink-0" /> <span className="truncate">{label}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card/80 aspect-[4/3] flex items-center justify-center">
        {!hasError && imageUrl ? (
          <img
            src={resolveAssetUrl(imageUrl)}
            alt={label}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="p-3 text-center text-[10px] text-muted-foreground flex flex-col items-center justify-center gap-1">
            <Icon className="h-5 w-5 opacity-40 text-primary" />
            <span className="text-[9px]">Chứng thư số điện tử</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  progress,
  subtitle,
}: {
  label: string;
  value: string;
  tone: string;
  progress?: number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold font-mono ${tone}`}>{value}</div>
      {typeof progress === "number" && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all ${progress >= 90 ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {subtitle && (
        <div className="mt-1 text-[10px] text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  full,
}: {
  label: string;
  value: string | number;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">
        {label}
      </div>
      <div className="font-medium text-foreground mt-0.5">{value || "Không có"}</div>
    </div>
  );
}
