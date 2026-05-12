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
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchKycQueue, resolveAssetUrl, updateKycStatus, type KycApplicant } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [{ title: "Xác minh KYC - SafeSolo Admin" }],
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
  const [selected, setSelected] = useState<KycApplicant | null>(null);

  const queueQuery = useQuery({
    queryKey: ["kyc-queue"],
    queryFn: fetchKycQueue,
  });

  const applicants = queueQuery.data?.data ?? [];

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
      <Topbar title="Người dùng và KYC" subtitle="Xác minh hiệp sĩ cộng đồng trước khi điều phối cứu hộ" />
      <div className="space-y-3 p-3">
        <div className="flex justify-end">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Hàng chờ xác minh</h2>
                <p className="text-[11px] text-muted-foreground">{applicants.length} hồ sơ đang chờ xử lý hoặc lưu để đối soát</p>
              </div>
              <Tag tone="info">KYC</Tag>
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
                    <h2 className="text-sm font-semibold">Hồ sơ KYC · {selected.name}</h2>
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

                <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
                  <SummaryCard label="Khớp khuôn mặt" value={`${selected.match}%`} tone="text-success" progress={selected.match} />
                  <SummaryCard label="Điểm tin cậy" value={selected.trustScore.toFixed(1)} tone="text-info" />
                  <SummaryCard label="Hoạt động hiệp sĩ" value={`${selected.rescuesCount} lần hỗ trợ`} tone="text-warning" />
                </div>

                <div className="mx-4 mb-4 rounded-xl border border-border bg-background/40 p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Thông tin giấy tờ
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailRow label="Tên trên hồ sơ" value={selected.name} />
                    <DetailRow label="Số CCCD" value={selected.identityNumber} />
                    <DetailRow label="Loại giấy tờ" value={selected.documentLabel} />
                    <DetailRow label="Liveness" value={selected.liveness} />
                    <DetailRow label="Địa chỉ thường trú" value={selected.identityAddress} full />
                    <DetailRow label="Ngày nộp" value={formatDateTime(selected.applied)} full />
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
      {progress != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-success" style={{ width: `${progress}%` }} />
        </div>
      )}
      {label === "Điểm tin cậy" && (
        <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-success">
          <ShieldCheck className="h-4 w-4" /> Cộng đồng đã xác minh
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}
