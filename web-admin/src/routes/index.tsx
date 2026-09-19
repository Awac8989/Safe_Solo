import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
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
  VolumeX,
  Maximize2,
  Minimize2,
  Keyboard,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { Tag } from "@/components/Badge";
import { HitlDispatchPanel } from "@/components/HitlDispatchPanel";
import { IncidentMap } from "@/components/IncidentMap";
import { Topbar } from "@/components/Topbar";
import { fetchAdminOverview, resolveIncident, submitHitlAction } from "@/lib/api";
import type { HitlActionPayload } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";
import { audioAlarm } from "@/lib/audioAlarm";

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
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const hitlMutation = useMutation({
    mutationFn: ({ incidentId, payload }: { incidentId: string; payload: HitlActionPayload }) =>
      submitHitlAction(incidentId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  // Audio Alarm Automation
  useEffect(() => {
    audioAlarm.setMuted(muted);
    const hasActiveP1 = incidents.some(
      (inc) =>
        inc.hitl?.priority === "P1_CRITICAL" &&
        inc.hitl?.state !== "DISPATCHED" &&
        inc.hitl?.state !== "CANCELLED_FALSE_ALARM" &&
        inc.status === "ACTIVE",
    );

    if (hasActiveP1 && !muted) {
      audioAlarm.playP1Siren();
    } else {
      audioAlarm.stop();
    }
  }, [incidents, muted]);

  // Keyboard Hotkeys for 24/7 Operations Cockpit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (selected && selected.hitl?.state !== "DISPATCHED" && selected.hitl?.state !== "CANCELLED_FALSE_ALARM") {
          hitlMutation.mutate({
            incidentId: selected.id,
            payload: {
              action: "INSTANT_DISPATCH",
              supervisorName: "Đoàn Minh Quân (Trưởng ca)",
              tier: 2,
            },
          });
        }
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (selected) {
          const isCurrentlyPaused = selected.hitl?.state === "PAUSED";
          hitlMutation.mutate({
            incidentId: selected.id,
            payload: {
              action: isCurrentlyPaused ? "RESUME_COUNTDOWN" : "PAUSE_COUNTDOWN",
              supervisorName: "Đoàn Minh Quân (Trưởng ca)",
              tier: 2,
            },
          });
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (isDetailOpen) {
          setIsDetailOpen(false);
        }
      } else if (e.key === "1" && incidents[0]) {
        setSelectedId(incidents[0].id);
        setIsDetailOpen(true);
      } else if (e.key === "2" && incidents[1]) {
        setSelectedId(incidents[1].id);
        setIsDetailOpen(true);
      } else if (e.key === "3" && incidents[2]) {
        setSelectedId(incidents[2].id);
        setIsDetailOpen(true);
      } else if (e.key === "m" || e.key === "M") {
        setMuted((prev) => {
          const next = !prev;
          audioAlarm.setMuted(next);
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, isDetailOpen, incidents, hitlMutation]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

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
        name: "Thống kê",
        rows: stats
          ? [{
              "Tổng người dùng": stats.totalUsers,
              "Người dùng theo dõi": stats.monitoredUsers,
              "Sự cố đang mở": stats.activeIncidents,
              "KYC chờ duyệt": stats.kycPending,
              "Hiệp sĩ đã xác minh": stats.heroesVerified,
              "Cảnh báo hôm nay": stats.alertsToday,
            }]
          : [],
      },
      {
        name: "Sự cố",
        rows: incidents.map((incident) => ({
          ID: incident.id,
          Loại: formatIncidentType(incident.type),
          "Mức độ": incident.severity,
          "Trạng thái": incident.status,
          "Người gặp sự cố": incident.name,
          Tuổi: incident.age,
          "Nhóm máu": incident.blood,
          "Dị ứng": incident.allergies,
          "Địa chỉ": incident.address,
          "Quận huyện": incident.district,
          "Thành phố": incident.city,
          Kênh: incident.channel,
          "SĐT user": incident.phoneNumber,
          "Liên hệ khẩn cấp": incident.emergencyContactName,
          "SĐT liên hệ": incident.emergencyContactPhone,
          "Thời gian nhận": incident.receivedAt,
          "Bản đồ X": incident.x,
          "Bản đồ Y": incident.y,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar title="Trung tâm điều phối trực tiếp" subtitle="Phòng trực ban cứu hộ 24/7 · Mạng lưới SafeSolo" />
      <div className="space-y-3 p-3 pb-12">
        {/* Cockpit Status & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            {overviewQuery.isError ? (
              <>
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="font-bold text-rose-400">MẤT KẾT NỐI MÁY CHỦ BACKEND (PORT 4000)</span>
                <span className="text-border">|</span>
                <button
                  onClick={() => overviewQuery.refetch()}
                  className="text-xs text-sky-400 underline font-semibold hover:text-sky-300"
                >
                  Kết nối lại
                </button>
              </>
            ) : (
              <>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-bold text-foreground">TRỰC BAN:</span>
                <span className="text-muted-foreground">Đoàn Minh Quân (SUP-0137)</span>
                <span className="text-border">|</span>
                <span className="text-muted-foreground font-mono">Độ trễ: 12ms (Live Stream)</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => audioAlarm.playTestSpeaker()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-semibold hover:bg-accent transition"
            >
              <Volume2 className="h-3.5 w-3.5 text-sky-400" /> Test Còi Trực Ban
            </button>
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-semibold hover:bg-accent transition"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1.5 text-xs font-semibold hover:bg-accent transition"
            >
              <Download className="h-3.5 w-3.5" /> Xuất Excel
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Users} label="Tổng người dùng" value={String(stats.totalUsers)} tone="info" />
            <MetricCard icon={ShieldCheck} label="Hiệp sĩ đã xác minh" value={String(stats.heroesVerified)} tone="success" />
            <MetricCard icon={AlertTriangle} label="Sự cố đang mở" value={String(stats.activeIncidents)} tone="sos" />
            <MetricCard icon={BellRing} label="Cảnh báo hôm nay" value={String(stats.alertsToday)} tone="warning" />
          </div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_380px]">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <IncidentMap
              incidents={incidents}
              selectedId={selectedId}
              onSelect={(incidentId) => {
                setSelectedId(incidentId);
                setIsDetailOpen(true);
              }}
            />

            <div className="absolute right-3 top-3 flex gap-2 z-20">
              <button
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  audioAlarm.setMuted(next);
                }}
                className={`rounded-md border border-border px-3 py-2 text-xs backdrop-blur font-bold transition ${
                  muted ? "bg-background/80 text-muted-foreground hover:bg-accent" : "bg-rose-600 text-white animate-pulse"
                }`}
              >
                <div className="flex items-center gap-2">
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {muted ? "Còi báo: TẮT" : "Còi báo: ĐANG BẬT"}
                </div>
              </button>
            </div>
            <div className="absolute bottom-3 right-3 rounded-md border border-border bg-background/70 px-3 py-2 text-[10px] font-mono uppercase backdrop-blur z-20">
              Bản đồ Radar tác chiến SafeSolo
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
                <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Đang kết nối trung tâm dữ liệu...</span>
                </div>
              ) : overviewQuery.isError ? (
                <div className="rounded-lg border border-sos/30 bg-sos/10 p-4 text-xs text-sos space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Không thể kết nối máy chủ SafeSolo Backend
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Vui lòng kiểm tra backend server trên cổng 4000 (cd backend && npm start).
                  </p>
                  <button
                    onClick={() => overviewQuery.refetch()}
                    className="rounded bg-sos/20 px-2.5 py-1 text-xs font-semibold hover:bg-sos/30 transition text-foreground"
                  >
                    Thử kết nối lại
                  </button>
                </div>
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
                        <div className="flex items-center gap-1.5">
                          <Tag tone={incident.type === "DURESS" ? "duress" : incident.type === "SOS" ? "sos" : "warning"}>
                            {formatIncidentType(incident.type)}
                          </Tag>
                          {incident.hitl?.priority === "P1_CRITICAL" && (
                            <span className="inline-flex items-center rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-400 animate-pulse">
                              ⚡ HITL 30s
                            </span>
                          )}
                        </div>
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
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
          <div className="pointer-events-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-md">
            <div
              className={`sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border px-5 py-3 backdrop-blur-md ${
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

            {/* Bảng Điều Khiển Bán Tự Động HITL với Đếm Ngược An Toàn & Phân Tầng Quyền Hạn */}
            <HitlDispatchPanel
              incident={selected}
              onAction={async (payload) => {
                await hitlMutation.mutateAsync({ incidentId: selected.id, payload });
              }}
              isPending={hitlMutation.isPending}
            />

            <div className="grid gap-3 px-5 pb-4 md:grid-cols-3">
              <InfoBox icon={Droplet} label="Nhóm máu" value={selected.blood} accent="text-info" />
              <InfoBox icon={HeartPulse} label="Dị ứng" value={selected.allergies} />
              <InfoBox icon={PhoneCall} label="Liên hệ khẩn cấp" value={selected.emergencyContactPhone || "Không có"} />
            </div>

            <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-border bg-card/95 p-4 backdrop-blur-md sm:grid-cols-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-info px-4 py-3 text-xs font-bold text-primary-foreground transition hover:opacity-90">
                <PhoneCall className="h-4 w-4" /> Gọi người thân ({selected.emergencyContactPhone || "Chưa có"})
              </button>
              <button
                onClick={() => resolveMutation.mutate(selected.id)}
                disabled={resolveMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sos px-4 py-3 text-xs font-bold text-primary-foreground transition hover:opacity-90 pulse-sos disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Siren className="h-4 w-4" /> {resolveMutation.isPending ? "Đang xử lý..." : "Đóng & Đánh dấu hoàn tất sự cố"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 24/7 Operations Cockpit Hotkeys Hints Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-[#090e1a]/95 px-4 py-2 text-[11px] backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shadow-2xl">
        <div className="flex items-center gap-2 text-sky-400 font-bold">
          <Keyboard className="h-4 w-4" /> PHÍM TẮT TRỰC BAN 24/7:
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-bold border border-border">SPACE</kbd> Duyệt Điều Phối
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-bold border border-border">P</kbd> Tạm Dừng / Tiếp Tục
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-bold border border-border">ESC</kbd> Đóng Chi Tiết
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-bold border border-border">1 / 2 / 3</kbd> Chọn Ca Sự Cố
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground font-bold border border-border">M</kbd> Bật / Tắt Còi Báo
          </span>
        </div>
        <div className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          ISO 27001 & HITL COCKPIT ACTIVE
        </div>
      </div>
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
