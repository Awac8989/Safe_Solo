import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { MessageSquare, Send, Mail, Phone, Smartphone, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/omnichannel")({
  head: () => ({ meta: [{ title: "Omnichannel Gateway — Alive?" }] }),
  component: Page,
});

const channels = [
  { name: "SMS Provider", icon: Smartphone, quota: "182,430 / 250,000", success: 99.4, ok: true, vendor: "Viettel" },
  { name: "Zalo ZNS", icon: MessageSquare, quota: "47,210 / 100,000", success: 98.1, ok: true, vendor: "Zalo OA" },
  { name: "Telegram Bot", icon: Send, quota: "Unlimited", success: 99.9, ok: true, vendor: "Bot API" },
  { name: "Gmail SMTP", icon: Mail, quota: "8,402 / 10,000", success: 96.7, ok: true, vendor: "Workspace" },
  { name: "Voice Auto-Call", icon: Phone, quota: "1,204 / 5,000", success: 87.2, ok: false, vendor: "Stringee" },
];

function Page() {
  return (
    <>
      <Topbar title="Omnichannel Gateway" subtitle="Server health · message delivery routing" />
      <div className="space-y-3 p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {channels.map((c) => (
            <div key={c.name} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-info/10 text-info">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.vendor}</div>
                  </div>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${c.ok ? "bg-success pulse-sos" : "bg-sos pulse-sos"}`} />
              </div>
              <div className="mt-4 space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quota</div>
                  <div className="font-mono text-sm">{c.quota}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Success rate</span><span>{c.success}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${c.success > 95 ? "bg-success" : "bg-warning"}`} style={{ width: `${c.success}%` }} />
                  </div>
                </div>
                <div className="pt-1">
                  <Tag tone={c.ok ? "success" : "sos"}>{c.ok ? "Healthy" : "Degraded"}</Tag>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Message Routing Fallback</h2>
              <p className="text-[11px] text-muted-foreground">If a channel fails, alert auto-escalates downstream</p>
            </div>
            <Tag tone="info">Active policy v3.2</Tag>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {[
              { name: "Telegram", tone: "info" as const },
              { name: "Zalo ZNS", tone: "info" as const },
              { name: "SMS", tone: "warning" as const },
              { name: "Voice Call", tone: "sos" as const },
            ].map((s, i, arr) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-sm font-semibold">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Step {i + 1}</div>
                  {s.name}
                  <div className="mt-1"><Tag tone={s.tone}>Fallback</Tag></div>
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
