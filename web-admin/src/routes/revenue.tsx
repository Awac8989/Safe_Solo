import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { TrendingUp, Wallet, Building2 } from "lucide-react";

export const Route = createFileRoute("/revenue")({
  head: () => ({ meta: [{ title: "Revenue & Partners — Alive?" }] }),
  component: Page,
});

const partners = [
  { name: "Vinmec Central Park", dispatches: 142, rate: "15%", balance: "₫ 32,400,000" },
  { name: "FV Hospital", dispatches: 98, rate: "12%", balance: "₫ 18,720,000" },
  { name: "115 Ambulance Co.", dispatches: 211, rate: "10%", balance: "₫ 25,300,000" },
  { name: "Hoàn Mỹ Saigon", dispatches: 76, rate: "15%", balance: "₫ 11,400,000" },
];

const sparkline = [12, 18, 14, 22, 26, 21, 30, 28, 34, 31, 38, 42, 39, 45, 50, 48, 55, 60, 58, 64, 70, 68, 75, 80, 78, 84, 90, 95, 92, 99];

function Page() {
  const max = Math.max(...sparkline);
  const points = sparkline
    .map((v, i) => `${(i / (sparkline.length - 1)) * 100},${100 - (v / max) * 100}`)
    .join(" ");

  return (
    <>
      <Topbar title="Revenue & Partners" subtitle="AdMob earnings · medical dispatch commissions" />
      <div className="space-y-3 p-3">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: "AdMob Revenue (30d)", value: "$ 18,420", icon: TrendingUp, tone: "success" as const, sub: "+12.4% vs prev" },
            { label: "Unpaid Commissions", value: "₫ 87,820,000", icon: Wallet, tone: "warning" as const, sub: "4 partners pending" },
            { label: "Active Partner Hospitals", value: "37", icon: Building2, tone: "info" as const, sub: "3 onboarding" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold">{s.value}</div>
              <div className="mt-1"><Tag tone={s.tone}>{s.sub}</Tag></div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">AdMob Ad Revenue · Last 30 days</h2>
              <p className="text-[11px] text-muted-foreground">USD per day</p>
            </div>
            <Tag tone="success">Trending up</Tag>
          </div>
          <div className="mt-4">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-48 w-full">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 220)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 220)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline points={`0,100 ${points} 100,100`} fill="url(#g)" stroke="none" />
              <polyline points={points} fill="none" stroke="oklch(0.72 0.18 220)" strokeWidth="0.6" />
            </svg>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Ambulance Dispatch Commissions</h2>
              <p className="text-[11px] text-muted-foreground">Per partner hospital · this cycle</p>
            </div>
            <button className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Request Payout
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Partner</th>
                  <th className="px-4 py-2 text-left font-medium">Successful Dispatches</th>
                  <th className="px-4 py-2 text-left font-medium">Rate</th>
                  <th className="px-4 py-2 text-left font-medium">Unpaid Balance</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.name} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 font-mono">{p.dispatches}</td>
                    <td className="px-4 py-3"><Tag tone="info">{p.rate}</Tag></td>
                    <td className="px-4 py-3 font-mono font-semibold">{p.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
