import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { CheckCircle2, XCircle, ShieldCheck, Fingerprint, IdCard } from "lucide-react";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [{ title: "KYC Verification — Alive?" }],
  }),
  component: KycPage,
});

type Applicant = {
  id: string;
  name: string;
  applied: string;
  status: "pending" | "review" | "flagged";
  match: number;
  region: string;
};

const data: Applicant[] = [
  { id: "U-1001", name: "Đặng Quốc Việt", applied: "2025-05-06", status: "pending", match: 96, region: "Hà Nội" },
  { id: "U-1002", name: "Nguyễn Hà My", applied: "2025-05-06", status: "review", match: 88, region: "TP.HCM" },
  { id: "U-1003", name: "Trần Bảo Long", applied: "2025-05-05", status: "flagged", match: 62, region: "Đà Nẵng" },
  { id: "U-1004", name: "Phạm Khánh Linh", applied: "2025-05-05", status: "pending", match: 94, region: "Cần Thơ" },
  { id: "U-1005", name: "Lê Tuấn Minh", applied: "2025-05-04", status: "pending", match: 91, region: "Hải Phòng" },
];

const statusTone = { pending: "warning", review: "info", flagged: "sos" } as const;

function KycPage() {
  const [selected, setSelected] = useState(data[0]);
  return (
    <>
      <Topbar title="User & KYC" subtitle="Verify community heroes before dispatching" />
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Verification Queue</h2>
              <p className="text-[11px] text-muted-foreground">{data.length} applicants pending</p>
            </div>
            <Tag tone="info">Today</Tag>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Applicant</th>
                  <th className="px-4 py-2 text-left font-medium">Region</th>
                  <th className="px-4 py-2 text-left font-medium">Match</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className={`cursor-pointer border-t border-border transition ${
                      selected.id === u.id ? "bg-info/5" : "hover:bg-accent/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{u.id} · {u.applied}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.region}</td>
                    <td className="px-4 py-3 font-mono">{u.match}%</td>
                    <td className="px-4 py-3"><Tag tone={statusTone[u.status]}>{u.status}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Review · {selected.name}</h2>
              <p className="text-[11px] text-muted-foreground">{selected.id} · {selected.region}</p>
            </div>
            <Tag tone="info"><Fingerprint className="h-3 w-3" /> Liveness OK</Tag>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {["Front of ID", "Back of ID"].map((label) => (
              <div key={label} className="rounded-lg border border-border bg-gradient-to-br from-background/80 to-accent/30 p-4">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1"><IdCard className="h-3.5 w-3.5" /> {label}</span>
                  <span>Encrypted</span>
                </div>
                <div className="mt-3 aspect-[1.6/1] rounded-md border border-dashed border-border bg-card/60" />
                <div className="mt-2 text-[11px] text-muted-foreground">CCCD · 0791234567{label === "Back of ID" ? "8" : "9"}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 px-4 pb-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Face match</div>
              <div className="mt-1 text-2xl font-bold text-success">{selected.match}%</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-success" style={{ width: `${selected.match}%` }} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Criminal record</div>
              <div className="mt-1 text-sm font-semibold text-success flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" /> Clean
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone OTP</div>
              <div className="mt-1 text-sm font-semibold">Verified · Viettel</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-background/40 px-4 py-3">
            <button className="inline-flex items-center gap-2 rounded-md border border-sos/40 bg-sos/10 px-4 py-2 text-sm font-semibold text-sos hover:bg-sos/20">
              <XCircle className="h-4 w-4" /> Reject / Ban
            </button>
            <button className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <CheckCircle2 className="h-4 w-4" /> Approve Hero Badge
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
