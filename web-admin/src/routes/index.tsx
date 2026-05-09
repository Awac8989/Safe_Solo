import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  PhoneCall,
  Ambulance,
  Siren,
  MapPin,
  HeartPulse,
  Droplet,
  AlertTriangle,
  X,
  Volume2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Dispatch — Alive?" },
      { name: "description", content: "Real-time SOS map and incident triage." },
    ],
  }),
  component: DispatchCenter,
});

type Incident = {
  id: string;
  type: "SOS" | "DURESS" | "MEDICAL";
  name: string;
  age: number;
  blood: string;
  allergies: string;
  address: string;
  district: string;
  city: string;
  // map coords in % within 0..100 viewport
  x: number;
  y: number;
  receivedAt: Date;
  channel: "App" | "SMS" | "Zalo" | "Telegram";
};

const seed: Incident[] = [
  { id: "INC-2401", type: "DURESS", name: "Nguyễn Thị Lan", age: 27, blood: "O+", allergies: "Penicillin",
    address: "12 Trần Hưng Đạo", district: "Q.1", city: "TP.HCM", x: 42, y: 38,
    receivedAt: new Date(Date.now() - 1000 * 22), channel: "App" },
  { id: "INC-2402", type: "SOS", name: "Phạm Văn Hùng", age: 54, blood: "A-", allergies: "None",
    address: "88 Nguyễn Trãi", district: "Q.5", city: "TP.HCM", x: 30, y: 60,
    receivedAt: new Date(Date.now() - 1000 * 75), channel: "Zalo" },
  { id: "INC-2403", type: "MEDICAL", name: "Lê Minh Khoa", age: 19, blood: "B+", allergies: "Aspirin",
    address: "5 Lê Lợi", district: "Q.1", city: "TP.HCM", x: 55, y: 47,
    receivedAt: new Date(Date.now() - 1000 * 180), channel: "SMS" },
  { id: "INC-2404", type: "SOS", name: "Trần Thu Hà", age: 33, blood: "AB+", allergies: "Latex",
    address: "201 Cách Mạng Tháng 8", district: "Q.3", city: "TP.HCM", x: 67, y: 28,
    receivedAt: new Date(Date.now() - 1000 * 240), channel: "Telegram" },
];

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function DispatchCenter() {
  const [incidents, setIncidents] = useState<Incident[]>(seed);
  const [selected, setSelected] = useState<Incident | null>(seed[0]);
  const [muted, setMuted] = useState(true);

  // simulate incoming SOS feed
  useEffect(() => {
    const id = setInterval(() => {
      setIncidents((prev) => {
        const types: Incident["type"][] = ["SOS", "DURESS", "MEDICAL"];
        const channels: Incident["channel"][] = ["App", "SMS", "Zalo", "Telegram"];
        const next: Incident = {
          id: `INC-${2400 + prev.length + 1}`,
          type: types[Math.floor(Math.random() * types.length)],
          name: ["Hoàng Anh", "Đỗ Quang", "Vũ Mai", "Bùi Thảo"][Math.floor(Math.random() * 4)],
          age: 18 + Math.floor(Math.random() * 50),
          blood: ["O+", "A+", "B-", "AB+"][Math.floor(Math.random() * 4)],
          allergies: ["None", "Penicillin", "Peanuts"][Math.floor(Math.random() * 3)],
          address: `${Math.floor(Math.random() * 300)} Võ Văn Kiệt`,
          district: `Q.${Math.ceil(Math.random() * 10)}`,
          city: "TP.HCM",
          x: 10 + Math.random() * 80,
          y: 10 + Math.random() * 75,
          receivedAt: new Date(),
          channel: channels[Math.floor(Math.random() * channels.length)],
        };
        return [next, ...prev].slice(0, 12);
      });
    }, 12000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => ({
    sos: incidents.filter((i) => i.type === "SOS").length,
    duress: incidents.filter((i) => i.type === "DURESS").length,
    medical: incidents.filter((i) => i.type === "MEDICAL").length,
  }), [incidents]);

  return (
    <>
      <Topbar title="Live Dispatch Command" subtitle="Real-time SOS feed · Vietnam region" />
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_380px]">
        {/* MAP */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          {/* fake map */}
          <div className="absolute inset-0 scanline-bg" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_color-mix(in_oklab,_var(--info)_15%,_transparent),_transparent_70%)]" />
          {/* rivers / roads */}
          <svg className="absolute inset-0 h-full w-full opacity-30" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M0,55 C20,40 40,70 60,55 S90,40 100,60" stroke="oklch(0.72 0.18 220)" strokeWidth="0.4" fill="none" />
            <path d="M10,0 L40,100" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
            <path d="M70,0 L60,100" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
            <path d="M0,30 L100,35" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
            <path d="M0,80 L100,75" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
          </svg>

          {/* incident markers */}
          {incidents.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelected(i)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${i.x}%`, top: `${i.y}%` }}
              aria-label={i.id}
            >
              <span
                className={`block h-3 w-3 rounded-full ${
                  i.type === "DURESS" ? "bg-duress pulse-duress" :
                  i.type === "SOS" ? "bg-sos pulse-sos" : "bg-warning"
                }`}
              />
            </button>
          ))}

          {/* HUD overlays */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur">
              <div className="flex items-center gap-2 font-mono">
                <span className="h-2 w-2 rounded-full bg-success" /> LIVE FEED · WS Connected
              </div>
            </div>
            <div className="flex gap-1.5 rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur">
              <Tag tone="sos">SOS {stats.sos}</Tag>
              <Tag tone="duress">DURESS {stats.duress}</Tag>
              <Tag tone="warning">MED {stats.medical}</Tag>
            </div>
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              onClick={() => setMuted((m) => !m)}
              className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="h-3.5 w-3.5" />
                {muted ? "Alert sound: OFF" : "Alert sound: ON"}
              </div>
            </button>
          </div>

          {/* compass */}
          <div className="absolute bottom-3 right-3 rounded-md border border-border bg-background/70 px-3 py-2 text-[10px] font-mono uppercase backdrop-blur">
            10.7769° N · 106.7009° E
          </div>
        </div>

        {/* FEED */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Active Incidents</h2>
              <p className="text-[11px] text-muted-foreground">Newest first · auto-refresh 12s</p>
            </div>
            <Tag tone="info">{incidents.length}</Tag>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-2">
              {incidents.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setSelected(i)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selected?.id === i.id ? "border-info bg-info/5" : "border-border hover:border-info/40 hover:bg-accent/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Tag tone={i.type === "DURESS" ? "duress" : i.type === "SOS" ? "sos" : "warning"}>
                      {i.type === "DURESS" ? "SILENT DURESS" : i.type}
                    </Tag>
                    <span className="text-[10px] font-mono text-muted-foreground">{timeAgo(i.receivedAt)}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold">{i.name} · {i.age}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {i.address}, {i.district}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    via {i.channel} · {i.id}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ACTION MODAL */}
      {selected && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md">
            <div className={`flex items-center justify-between rounded-t-2xl border-b border-border px-5 py-3 ${
              selected.type === "DURESS" ? "bg-duress/10" : selected.type === "SOS" ? "bg-sos/10" : "bg-warning/10"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  selected.type === "DURESS" ? "bg-duress/20 text-duress pulse-duress" : "bg-sos/20 text-sos pulse-sos"
                }`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Tag tone={selected.type === "DURESS" ? "duress" : "sos"}>
                      {selected.type === "DURESS" ? "SILENT DURESS CODE" : selected.type}
                    </Tag>
                    <span className="text-[10px] font-mono text-muted-foreground">{selected.id}</span>
                  </div>
                  <div className="mt-1 text-base font-semibold">{selected.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {selected.address}, {selected.district}, {selected.city} · {timeAgo(selected.receivedAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Droplet className="h-3.5 w-3.5" /> Blood Type
                </div>
                <div className="mt-1 text-2xl font-bold text-info">{selected.blood}</div>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <HeartPulse className="h-3.5 w-3.5" /> Allergies
                </div>
                <div className="mt-1 text-sm font-semibold">{selected.allergies}</div>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Age · Channel</div>
                <div className="mt-1 text-sm font-semibold">{selected.age} y/o · {selected.channel}</div>
              </div>
            </div>

            <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-3">
              <button className="flex items-center justify-center gap-2 rounded-lg bg-info px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <PhoneCall className="h-4 w-4" /> Call Guardian
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <Ambulance className="h-4 w-4" /> Dispatch Ambulance
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg bg-sos px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 pulse-sos">
                <Siren className="h-4 w-4" /> Alert Police 113
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
