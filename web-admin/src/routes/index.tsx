import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Users,
  ShieldCheck,
  BellRing,
} from "lucide-react";
import { fetchAdminOverview, resolveIncident } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trung tam dieu pho - SafeSolo Admin" },
      { name: "description", content: "Ban do SOS va dieu phoi su co theo thoi gian thuc." },
    ],
  }),
  component: DispatchCenter,
});

function timeAgo(value: string) {
  const d = new Date(value);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s} giay truoc`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phut truoc`;
  return `${Math.floor(m / 60)} gio truoc`;
}

function formatIncidentType(type: "SOS" | "DURESS" | "MEDICAL") {
  if (type === "DURESS") return "Ma nguy hiem im lang";
  if (type === "MEDICAL") return "Y te";
  return "SOS";
}

function DispatchCenter() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    refetchInterval: 10000,
  });

  const incidents = overviewQuery.data?.data.incidents ?? [];
  const stats = overviewQuery.data?.data.stats;

  useEffect(() => {
    if (!selectedId && incidents.length > 0) {
      setSelectedId(incidents[0].id);
    }
    if (selectedId && !incidents.some((incident) => incident.id === selectedId)) {
      setSelectedId(incidents[0]?.id ?? null);
    }
  }, [incidents, selectedId]);

  const selected = useMemo(
    () => incidents.find((incident) => incident.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  const resolveMutation = useMutation({
    mutationFn: (incidentId: string) => resolveIncident(incidentId, "Da xu ly tu trung tam dieu pho"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  const incidentStats = useMemo(
    () => ({
      sos: incidents.filter((incident) => incident.type === "SOS").length,
      duress: incidents.filter((incident) => incident.type === "DURESS").length,
      medical: incidents.filter((incident) => incident.type === "MEDICAL").length,
    }),
    [incidents],
  );

  return (
    <>
      <Topbar title="Trung tam dieu pho truc tiep" subtitle="Luong SOS thoi gian thuc · mang SafeSolo" />
      <div className="space-y-3 p-3">
        {stats && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Users} label="Tong nguoi dung" value={String(stats.totalUsers)} tone="info" />
            <MetricCard icon={ShieldCheck} label="Heroes da xac minh" value={String(stats.heroesVerified)} tone="success" />
            <MetricCard icon={AlertTriangle} label="Su co dang mo" value={String(stats.activeIncidents)} tone="sos" />
            <MetricCard icon={BellRing} label="Canh bao hom nay" value={String(stats.alertsToday)} tone="warning" />
          </div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_380px]">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <div className="absolute inset-0 scanline-bg" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_color-mix(in_oklab,_var(--info)_15%,_transparent),_transparent_70%)]" />
            <svg className="absolute inset-0 h-full w-full opacity-30" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M0,55 C20,40 40,70 60,55 S90,40 100,60" stroke="oklch(0.72 0.18 220)" strokeWidth="0.4" fill="none" />
              <path d="M10,0 L40,100" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
              <path d="M70,0 L60,100" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
              <path d="M0,30 L100,35" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
              <path d="M0,80 L100,75" stroke="oklch(0.6 0.05 260)" strokeWidth="0.2" fill="none" />
            </svg>

            {incidents.map((incident) => (
              <button
                key={incident.id}
                onClick={() => setSelectedId(incident.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${incident.x}%`, top: `${incident.y}%` }}
                aria-label={incident.id}
              >
                <span
                  className={`block h-3 w-3 rounded-full ${
                    incident.type === "DURESS"
                      ? "bg-duress pulse-duress"
                      : incident.type === "SOS"
                        ? "bg-sos pulse-sos"
                        : "bg-warning"
                  }`}
                />
              </button>
            ))}

            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur">
                <div className="flex items-center gap-2 font-mono">
                  <span className="h-2 w-2 rounded-full bg-success" /> DANG NHAN DU LIEU · API da ket noi
                </div>
              </div>
              <div className="flex gap-1.5 rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur">
                <Tag tone="sos">SOS {incidentStats.sos}</Tag>
                <Tag tone="duress">IM LANG {incidentStats.duress}</Tag>
                <Tag tone="warning">Y TE {incidentStats.medical}</Tag>
              </div>
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                onClick={() => setMuted((value) => !value)}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur hover:bg-accent"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5" />
                  {muted ? "Am thanh canh bao: TAT" : "Am thanh canh bao: BAT"}
                </div>
              </button>
            </div>
            <div className="absolute bottom-3 right-3 rounded-md border border-border bg-background/70 px-3 py-2 text-[10px] font-mono uppercase backdrop-blur">
              Ban do mat do su co SafeSolo
            </div>
          </div>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Su co dang xu ly</h2>
                <p className="text-[11px] text-muted-foreground">Moi nhat o tren · tu dong lam moi 10 giay</p>
              </div>
              <Tag tone="info">{incidents.length}</Tag>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {overviewQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Dang tai danh sach su co...</div>
              ) : overviewQuery.isError ? (
                <div className="text-sm text-sos">{overviewQuery.error.message}</div>
              ) : (
                <div className="space-y-2">
                  {incidents.map((incident) => (
                    <button
                      key={incident.id}
                      onClick={() => setSelectedId(incident.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected?.id === incident.id
                          ? "border-info bg-info/5"
                          : "border-border hover:border-info/40 hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Tag tone={incident.type === "DURESS" ? "duress" : incident.type === "SOS" ? "sos" : "warning"}>
                          {formatIncidentType(incident.type)}
                        </Tag>
                        <span className="text-[10px] font-mono text-muted-foreground">{timeAgo(incident.receivedAt)}</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold">{incident.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {incident.address}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        qua {incident.channel} · {incident.id}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {selected && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md">
            <div
              className={`flex items-center justify-between rounded-t-2xl border-b border-border px-5 py-3 ${
                selected.type === "DURESS" ? "bg-duress/10" : selected.type === "SOS" ? "bg-sos/10" : "bg-warning/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    selected.type === "DURESS" ? "bg-duress/20 text-duress pulse-duress" : "bg-sos/20 text-sos pulse-sos"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Tag tone={selected.type === "DURESS" ? "duress" : "sos"}>
                      {selected.type === "DURESS" ? "Ma nguy hiem im lang" : formatIncidentType(selected.type)}
                    </Tag>
                    <span className="text-[10px] font-mono text-muted-foreground">{selected.id}</span>
                  </div>
                  <div className="mt-1 text-base font-semibold">{selected.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {selected.address}, {selected.city} · {timeAgo(selected.receivedAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Dong"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              <InfoBox icon={Droplet} label="Nhom mau" value={selected.blood} accent="text-info" />
              <InfoBox icon={HeartPulse} label="Di ung" value={selected.allergies} />
              <InfoBox icon={PhoneCall} label="Lien he khan cap" value={selected.emergencyContactPhone || "Khong co"} />
            </div>

            <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-3">
              <button className="flex items-center justify-center gap-2 rounded-lg bg-info px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <PhoneCall className="h-4 w-4" /> Goi nguoi than
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <Ambulance className="h-4 w-4" /> Dieu xe cuu thuong
              </button>
              <button
                onClick={() => resolveMutation.mutate(selected.id)}
                disabled={resolveMutation.isPending}
                className="flex items-center justify-center gap-2 rounded-lg bg-sos px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 pulse-sos disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Siren className="h-4 w-4" /> {resolveMutation.isPending ? "Dang danh dau da xu ly..." : "Danh dau da xu ly"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "info" | "success" | "sos" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-2">
        <Tag tone={tone}>{label}</Tag>
      </div>
    </div>
  );
}

function InfoBox({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-sm font-semibold ${accent || ""}`}>{value}</div>
    </div>
  );
}
