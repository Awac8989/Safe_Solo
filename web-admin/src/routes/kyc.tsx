import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { CheckCircle2, XCircle, ShieldCheck, Fingerprint, IdCard } from "lucide-react";
import { fetchKycQueue, updateKycStatus, type KycApplicant } from "@/lib/api";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [{ title: "Xac minh KYC - SafeSolo Admin" }],
  }),
  component: KycPage,
});

const statusTone = { pending: "warning", review: "info", flagged: "sos" } as const;

function formatStatus(status: KycApplicant["status"]) {
  if (status === "pending") return "Cho duyet";
  if (status === "review") return "Dang xem xet";
  return "Can danh dau";
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

  return (
    <>
      <Topbar title="Nguoi dung va KYC" subtitle="Xac minh heroes cong dong truoc khi dieu pho" />
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Hang cho xac minh</h2>
              <p className="text-[11px] text-muted-foreground">{applicants.length} ho so dang cho xu ly</p>
            </div>
            <Tag tone="info">Hom nay</Tag>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Ung vien</th>
                  <th className="px-4 py-2 text-left font-medium">Khu vuc</th>
                  <th className="px-4 py-2 text-left font-medium">Do khop</th>
                  <th className="px-4 py-2 text-left font-medium">Trang thai</th>
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
                  <h2 className="text-sm font-semibold">Xem xet · {selected.name}</h2>
                  <p className="text-[11px] text-muted-foreground">{selected.userId} · {selected.phone}</p>
                </div>
                <Tag tone="info">
                  <Fingerprint className="h-3 w-3" /> Muc song {selected.liveness}
                </Tag>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {[
                  { label: "Mat truoc giay to", url: selected.frontImageUrl },
                  { label: "Mat sau giay to", url: selected.backImageUrl },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-border bg-gradient-to-br from-background/80 to-accent/30 p-4">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <IdCard className="h-3.5 w-3.5" /> {item.label}
                      </span>
                      <span>Da luu</span>
                    </div>
                    <div className="mt-3 aspect-[1.6/1] rounded-md border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground">
                      {item.url}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
                <SummaryCard label="Khop khuon mat" value={`${selected.match}%`} tone="text-success" progress={selected.match} />
                <SummaryCard label="Diem tin cay" value={selected.trustScore.toFixed(1)} tone="text-info" />
                <SummaryCard label="Hoat dong hero" value={`${selected.rescuesCount} lan cuu ho`} tone="text-warning" />
              </div>
              <div className="flex items-center justify-between border-t border-border bg-background/40 px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  Loi cam on: {selected.thankYouCount} · Da xac minh: {selected.isKycVerified ? "Co" : "Chua"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => actionMutation.mutate({ id: selected.id, action: "REJECT" })}
                    className="inline-flex items-center gap-2 rounded-md border border-sos/40 bg-sos/10 px-4 py-2 text-sm font-semibold text-sos hover:bg-sos/20"
                  >
                    <XCircle className="h-4 w-4" /> Tu choi / Khoa
                  </button>
                  <button
                    onClick={() => actionMutation.mutate({ id: selected.id, action: "APPROVE" })}
                    className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Duyet huy hieu Hero
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Chua co tai lieu KYC nao.</div>
          )}
        </section>
      </div>
    </>
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
      {label === "Diem tin cay" && (
        <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-success">
          <ShieldCheck className="h-4 w-4" /> Cong dong da xac minh
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}
