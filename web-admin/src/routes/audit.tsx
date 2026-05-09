import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { Search, Download } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Logs — Alive?" }] }),
  component: Page,
});

const logs = [
  { ts: "2025-05-07 09:42:11", actor: "dispatcher_01", action: "DISPATCH_AMBULANCE", target: "INC-2401", tone: "info" as const },
  { ts: "2025-05-07 09:41:55", actor: "system", action: "SOS_RECEIVED", target: "INC-2401 · App", tone: "sos" as const },
  { ts: "2025-05-07 09:38:10", actor: "admin_root", action: "APPROVE_KYC", target: "U-1001", tone: "success" as const },
  { ts: "2025-05-07 09:34:02", actor: "dispatcher_02", action: "ALERT_POLICE_113", target: "INC-2400", tone: "sos" as const },
  { ts: "2025-05-07 09:31:48", actor: "system", action: "SMS_FALLBACK_TRIGGERED", target: "Zalo down", tone: "warning" as const },
  { ts: "2025-05-07 09:25:17", actor: "admin_root", action: "REJECT_KYC", target: "U-0998 · fraud", tone: "duress" as const },
  { ts: "2025-05-07 09:20:00", actor: "system", action: "PAYOUT_REQUESTED", target: "Vinmec · ₫32.4M", tone: "info" as const },
];

function Page() {
  return (
    <>
      <Topbar title="Audit Logs" subtitle="Immutable event trail for legal reconciliation" />
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search by actor, action, incident ID…"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          {["All", "Dispatch", "KYC", "System", "Finance"].map((t, i) => (
            <button
              key={t}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                i === 0 ? "border-info bg-info/10 text-info" : "border-border hover:bg-accent"
              }`}
            >
              {t}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Timestamp</th>
                <th className="px-4 py-2 text-left font-medium">Actor</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Target</th>
                <th className="px-4 py-2 text-left font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-t border-border hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs">{l.ts}</td>
                  <td className="px-4 py-3">{l.actor}</td>
                  <td className="px-4 py-3"><Tag tone={l.tone}>{l.action}</Tag></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.target}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    0x{(Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
