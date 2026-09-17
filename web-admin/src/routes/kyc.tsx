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
    meta: [{ title: "Xác minh KYC & Hiệp Sĩ - SafeSolo Admin" }],
  }),
  component: KycPage,
});

const statusTone = {
  pending: "warning",
  approved: "success",
  rejected: "sos",
} as const;

function formatStatus(status: KycApplicant["status"]) {
  if (status === "pending") return "Chờ duyệt";
  if (status === "approved") return "Đã duyệt";
  return "Từ chối";
}

function KycPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"KYC" | "THANK_YOU">("KYC");
  const [selected, setSelected] = useState<KycApplicant | null>(null);

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

  useEffect(() => {
    if (!selected && applicants.length > 0) {
      setSelected(applicants[0]);
    }
    if (selected && !applicants.some((item) => item.id === selected.id)) {
      setSelected(applicants[0] ?? null);
    }
  }, [applicants, selected]);

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "APPROVE" | "REJECT" }) =>
      updateKycStatus(id, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["kyc-queue"] });
    },
  });

  const handleExport = () => {
    exportWorkbook("safesolo-admin-kyc.xlsx", [
      {
        name: "KYC",
        rows: applicants.map((user) => ({
          ID: user.id,
          User_ID: user.userId,
          "Họ tên": user.name,
          "Số điện thoại": user.phone,
          "Khu vực": user.region,
          "Trạng thái": formatStatus(user.status),
          Match: user.match,
          Liveness: user.liveness,
          Trust_score: user.trustScore,
          Rescues: user.rescuesCount,
          Thank_you: user.thankYouCount,
          "Đã xác minh": user.isKycVerified ? "Có" : "Chưa",
          "Ngày nộp": user.applied,
          Selfie: user.selfieImageUrl,
          "Ảnh mặt trước": user.frontImageUrl,
          "Ảnh mặt sau": user.backImageUrl,
          CCCD: user.identityNumber,
          "Địa chỉ": user.identityAddress,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar
        title="Người dùng, Hiệp sĩ & KYC"
        subtitle="Xác minh hồ sơ, cấp chứng chỉ sơ cứu & Hộp thư tri ân cộng đồng SafeSolo"
      />
      <div className="space-y-3 p-3">
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
            Xuất Excel
          </button>
        </div>

        {/* TAB 1: KYC QUEUE & HERO CREDENTIALS */}
        {activeTab === "KYC" && (
          <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">Hàng chờ xác minh danh tính</h2>
                  <p className="text-[11px] text-muted-foreground">{applicants.length} hồ sơ thực tế từ MongoDB</p>
                </div>
                <Tag tone="info">KYC CCCD</Tag>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Ứng viên</th>
                      <th className="px-4 py-2 text-left font-medium">Khu vực</th>
                      <th className="px-4 py-2 text-left font-medium">Độ khớp</th>
                      <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => setSelected(user)}
                        className={`cursor-pointer border-t border-border transition ${
                          selected?.id === user.id ? "bg-info/5" : "hover:bg-accent/30"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {user.userId} · {formatDate(user.applied)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.region}</td>
                        <td className="px-4 py-3 font-mono">{user.match}%</td>
                        <td className="px-4 py-3">
                          <Tag tone={statusTone[user.status]}>{formatStatus(user.status)}</Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-border bg-card">
              {selected ? (
                <>
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold">Hồ sơ Hiệp sĩ · {selected.name}</h2>
                      <p className="text-[11px] text-muted-foreground">{selected.userId} · {selected.phone}</p>
                    </div>
                    <Tag tone={statusTone[selected.status]}>
                      <Fingerprint className="h-3 w-3" /> {formatStatus(selected.status)}
                    </Tag>
                  </div>

                  <div className="grid gap-3 p-4 md:grid-cols-3">
                    <ImageCard
                      icon={UserCircle2}
                      label="Ảnh chân dung"
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
                  </div>

                  <div className="grid gap-3 px-4 pb-3 md:grid-cols-3">
                    <SummaryCard label="Khớp khuôn mặt" value={`${selected.match}%`} tone="text-success" progress={selected.match} />
                    <SummaryCard label="Điểm tin cậy" value={selected.trustScore.toFixed(1)} tone="text-info" />
                    <SummaryCard label="Hoạt động hiệp sĩ" value={`${selected.rescuesCount} ca cứu trợ`} tone="text-warning" />
                  </div>

                  {/* Thông tin giấy tờ CCCD */}
                  <div className="mx-4 mb-3 rounded-xl border border-border bg-background/40 p-3.5">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Thông tin căn cước công dân
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 text-xs">
                      <DetailRow label="Tên trên hồ sơ" value={selected.name} />
                      <DetailRow label="Số CCCD" value={selected.identityNumber} />
                      <DetailRow label="Loại giấy tờ" value={selected.documentLabel} />
                      <DetailRow label="Liveness" value={selected.liveness} />
                      <DetailRow label="Địa chỉ thường trú" value={selected.identityAddress} full />
                    </div>
                  </div>

                  {/* Chứng chỉ Chuyên Môn & Trang Bị Cứu Hộ */}
                  <div className="mx-4 mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Award className="h-4 w-4 text-emerald-400" /> KỸ NĂNG & CHỨNG CHỈ SƠ CẤP CỨU
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-300">
                        ✓ Chứng chỉ CPR Hội Chữ Thập Đỏ TP.HCM
                      </span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-300">
                        ✓ Kỹ thuật ép tim & cố định gãy xương
                      </span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-300">
                        ✓ Xử trí đột quỵ F.A.S.T
                      </span>
                    </div>

                    <div className="pt-2 border-t border-emerald-500/20">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mb-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-sky-400" /> TRANG THIẾT BỊ CỨU HỘ MANG THEO
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                          🎒 Túi sơ cứu First-Aid
                        </span>
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                          🩹 Bộ nẹp y tế & băng gạc
                        </span>
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                          🔋 Dây câu bình ắc quy
                        </span>
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-sky-300">
                          🔦 Đèn pin công suất cao
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border bg-background/40 px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      Lời cảm ơn: {selected.thankYouCount} · Đã xác minh: {selected.isKycVerified ? "Có" : "Chưa"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => actionMutation.mutate({ id: selected.id, action: "REJECT" })}
                        className="inline-flex items-center gap-2 rounded-md border border-sos/40 bg-sos/10 px-4 py-2 text-sm font-semibold text-sos hover:bg-sos/20"
                      >
                        <XCircle className="h-4 w-4" /> Từ chối
                      </button>
                      <button
                        onClick={() => actionMutation.mutate({ id: selected.id, action: "APPROVE" })}
                        className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Duyệt hiệp sĩ
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">Chưa có tài liệu KYC nào.</div>
              )}
            </section>
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
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br ${tone} p-3`}>
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card/80">
        <img src={resolveAssetUrl(imageUrl)} alt={label} className="aspect-[4/5] w-full object-cover" />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  progress,
}: {
  label: string;
  value: string;
  tone: string;
  progress?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
        </div>
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
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-medium text-foreground">{value || "Không có"}</div>
    </div>
  );
}

function formatDate(value: string | undefined) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}
