import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ambulance,
  BellRing,
  Download,
  Droplet,
  HeartPulse,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Siren,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { Tag } from "@/components/Badge";
import { Topbar } from "@/components/Topbar";
import { fetchAdminOverview, resolveIncident } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trung tâm điều phối - SafeSolo Admin" },
      { name: "description", content: "Bản đồ SOS và điều phối sự cố theo thời gian thực." },
    ],
  }),
  component: DispatchCenter,
});

function timeAgo(value: string) {
  const d = new Date(value);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s} giây trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  return `${Math.floor(m / 60)} giờ trước`;
}

function formatIncidentType(type: "SOS" | "DURESS" | "MEDICAL") {
  if (type === "DURESS") return "Mã nguy hiểm im lặng";
  if (type === "MEDICAL") return "Y tế";
  return "SOS";
}

function DispatchCenter() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [muted, setMuted] = useState(true);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    refetchInterval: 10000,
  });

  const incidents = overviewQuery.data?.data.incidents ?? [];
  const stats = overviewQuery.data?.data.stats;

  useEffect(() => {
    if (!hasAutoSelected && incidents.length > 0) {
      setSelectedId(incidents[0].id);
      setIsDetailOpen(true);
      setHasAutoSelected(true);
      return;
    }

    if (selectedId && !incidents.some((incident) => incident.id === selectedId)) {
      const nextId = incidents[0]?.id ?? null;
      setSelectedId(nextId);
      if (!nextId) {
        setIsDetailOpen(false);
      }
    }

    if (incidents.length === 0) {
      setSelectedId(null);
      setIsDetailOpen(false);
    }
  }, [hasAutoSelected, incidents, selectedId]);

  const selected = useMemo(
    () => incidents.find((incident) => incident.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  const resolveMutation = useMutation({
    mutationFn: (incidentId: string) => resolveIncident(incidentId, "Đã xử lý từ trung tâm điều phối"),
    onSuccess: async () => {
      setIsDetailOpen(false);
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

  const handleExport = () => {
    exportWorkbook("safesolo-admin-dispatch.xlsx", [
      {
        name: "Thong ke",
        rows: stats
          ? [{
              Tong_nguoi_dung: stats.totalUsers,
              Nguoi_dung_theo_doi: stats.monitoredUsers,
              Su_co_dang_mo: stats.activeIncidents,
              KYC_cho_duyet: stats.kycPending,
              Heroes_xac_minh: stats.heroesVerified,
              Canh_bao_hom_nay: stats.alertsToday,
            }]
          : [],
      },
      {
        name: "Su co",
        rows: incidents.map((incident) => ({
          ID: incident.id,
          Loai: formatIncidentType(incident.type),
          Muc_do: incident.severity,
          Trang_thai: incident.status,
          Nguoi_gap_su_co: incident.name,
          Tuoi: incident.age,
          Nhom_mau: incident.blood,
          Di_ung: incident.allergies,
          Dia_chi: incident.address,
          Quan_huyen: incident.district,
          Thanh_pho: incident.city,
          Kenh: incident.channel,
          SDT_user: incident.phoneNumber,
          Lien_he_khan_cap: incident.emergencyContactName,
          SDT_lien_he: incident.emergencyContactPhone,
          Thoi_gian_nhan: incident.receivedAt,
          Ban_do_X: incident.x,
          Ban_do_Y: incident.y,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar title="Trung tâm điều phối trực tiếp" subtitle="Luồng SOS thời gian thực · mạng SafeSolo" />
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

        {stats && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Users} label="Tổng người dùng" value={String(stats.totalUsers)} tone="info" />
            <MetricCard icon={ShieldCheck} label="Heroes đã xác minh" value={String(stats.heroesVerified)} tone="success" />
            <MetricCard icon={AlertTriangle} label="Sự cố đang mở" value={String(stats.activeIncidents)} tone="sos" />
            <MetricCard icon={BellRing} label="Cảnh báo hôm nay" value={String(stats.alertsToday)} tone="warning" />
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
                onClick={() => {
                  setSelectedId(incident.id);
                  setIsDetailOpen(true);
                }}
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
                  <span className="h-2 w-2 rounded-full bg-success" /> ĐANG NHẬN DỮ LIỆU · API đã kết nối
                </div>
              </div>
              <div className="flex gap-1.5 rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur">
                <Tag tone="sos">SOS {incidentStats.sos}</Tag>
                <Tag tone="duress">IM LẶNG {incidentStats.duress}</Tag>
                <Tag tone="warning">Y TẾ {incidentStats.medical}</Tag>
              </div>
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                onClick={() => setMuted((value) => !value)}
                className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs backdrop-blur hover:bg-accent"
              >
                <div className="flex items-center gap-2">
                  <Volume2 className="h-3.5 w-3.5" />
                  {muted ? "Âm thanh cảnh báo: TẮT" : "Âm thanh cảnh báo: BẬT"}
                </div>
              </button>
            </div>
            <div className="absolute bottom-3 right-3 rounded-md border border-border bg-background/70 px-3 py-2 text-[10px] font-mono uppercase backdrop-blur">
              Bản đồ mật độ sự cố SafeSolo
            </div>
          </div>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Sự cố đang xử lý</h2>
                <p className="text-[11px] text-muted-foreground">Mới nhất ở trên · tự động làm mới 10 giây</p>
              </div>
              <Tag tone="info">{incidents.length}</Tag>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {overviewQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Đang tải danh sách sự cố...</div>
              ) : overviewQuery.isError ? (
                <div className="text-sm text-sos">{overviewQuery.error.message}</div>
              ) : (
                <div className="space-y-2">
                  {incidents.map((incident) => (
                    <button
                      key={incident.id}
                      onClick={() => {
                        setSelectedId(incident.id);
                        setIsDetailOpen(true);
                      }}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected?.id === incident.id && isDetailOpen
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

      {isDetailOpen && selected && (
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
                      {selected.type === "DURESS" ? "Mã nguy hiểm im lặng" : formatIncidentType(selected.type)}
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
                onClick={() => setIsDetailOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              <InfoBox icon={Droplet} label="Nhóm máu" value={selected.blood} accent="text-info" />
              <InfoBox icon={HeartPulse} label="Dị ứng" value={selected.allergies} />
              <InfoBox icon={PhoneCall} label="Liên hệ khẩn cấp" value={selected.emergencyContactPhone || "Không có"} />
            </div>

            <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-3">
              <button className="flex items-center justify-center gap-2 rounded-lg bg-info px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <PhoneCall className="h-4 w-4" /> Gọi người thân
              </button>
              <button className="flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                <Ambulance className="h-4 w-4" /> Điều xe cứu thương
              </button>
              <button
                onClick={() => resolveMutation.mutate(selected.id)}
                disabled={resolveMutation.isPending}
                className="flex items-center justify-center gap-2 rounded-lg bg-sos px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 pulse-sos disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Siren className="h-4 w-4" /> {resolveMutation.isPending ? "Đang đánh dấu đã xử lý..." : "Đánh dấu đã xử lý"}
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
