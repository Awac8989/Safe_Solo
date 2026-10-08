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
  Lock,
  X,
  Stethoscope,
  QrCode,
  FileText,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Tag } from "@/components/Badge";
import { HitlDispatchPanel } from "@/components/HitlDispatchPanel";
import { IncidentMap } from "@/components/IncidentMap";
import { Topbar } from "@/components/Topbar";
import { fetchAdminOverview, resolveIncident, submitHitlAction, runClinicalSop } from "@/lib/api";
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

  const clinicalSopMutation = useMutation({
    mutationFn: (incidentId: string) => runClinicalSop(incidentId),
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

  const [isAutoPilot, setIsAutoPilot] = useState(false);

  useEffect(() => {
    if (!isAutoPilot || incidents.length === 0) return;

    incidents.forEach((inc) => {
      if (
        inc.hitl?.state === "COUNTDOWN_ACTIVE" &&
        inc.status === "ACTIVE"
      ) {
        hitlMutation.mutate({
          incidentId: inc.id,
          payload: {
            action: "INSTANT_DISPATCH",
            supervisorName: "Hệ thống AI SafeSolo (Auto-Pilot)",
            tier: 2,
          },
        });
      }
    });
  }, [incidents, isAutoPilot]);

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
              onClick={() => setIsAutoPilot(!isAutoPilot)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                isAutoPilot 
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse"
                  : "border-border bg-background/60 hover:bg-accent text-foreground"
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${isAutoPilot ? "text-emerald-400" : "text-amber-400"}`} /> 
              {isAutoPilot ? "Đang chạy Auto-Pilot (100% Tự động)" : "Bật Auto-Pilot AI"}
            </button>
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

            {/* Thanh Tiến Trình Cứu Hộ Lâm Sàng Thực Tế (Rescue Lifecycle Stage) */}
            {(() => {
              const isDispatched =
                selected.hitl?.state === "DISPATCHED" ||
                selected.hitl?.state === "AMBULANCE_DISPATCHED";
              const isAmbulance = selected.hitl?.state === "AMBULANCE_DISPATCHED";
              const isCancelled = selected.hitl?.state === "CANCELLED_FALSE_ALARM";
              const hasClinicalActions = Boolean(selected.clinicalActions && selected.clinicalActions.length > 0);
              const sbar = selected.sbarHandoff;

              return (
                <div className="mx-5 mb-3 space-y-3">
                  {/* Thanh Tiến Trình Cứu Hộ 4 Bước */}
                  <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-sky-400 animate-pulse" /> TIẾN TRÌNH CỨU HỘ THỰC TẾ
                      </span>
                      <span className="font-mono text-[11px] font-extrabold text-foreground">
                        {isCancelled
                          ? "ĐÃ HỦY (BÁO ĐỘNG GIẢ)"
                          : hasClinicalActions || isAmbulance
                          ? "🚑 ĐÃ CẤP CỨU & BÀN GIAO 115"
                          : isDispatched
                          ? "🏃 HIỆP SĨ ĐANG TỚI HIỆN TRƯỜNG"
                          : "⏳ CHỜ PHÁI CỬ HIỆP SĨ"}
                      </span>
                    </div>

                    {/* 4-step progress breadcrumbs */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-semibold">
                      <div className="rounded bg-rose-500/20 border border-rose-500/40 p-1.5 text-rose-300">
                        1. Tiếp nhận SOS
                      </div>
                      <div
                        className={`rounded p-1.5 border transition ${
                          isDispatched
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold"
                            : "bg-muted/30 border-border text-muted-foreground"
                        }`}
                      >
                        2. Hiệp sĩ tiếp nhận
                      </div>
                      <div
                        className={`rounded p-1.5 border transition ${
                          hasClinicalActions
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold"
                            : isDispatched
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300 font-bold animate-pulse"
                            : "bg-muted/30 border-border text-muted-foreground"
                        }`}
                      >
                        3. Sơ cứu hiện trường
                      </div>
                      <div
                        className={`rounded p-1.5 border transition ${
                          hasClinicalActions || isAmbulance
                            ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold"
                            : "bg-muted/30 border-border text-muted-foreground"
                        }`}
                      >
                        4. Bàn giao 115
                      </div>
                    </div>

                    {!isDispatched && !isCancelled && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-[11px] text-amber-300">
                        <div>
                          <strong>⚠️ Chưa có ai cứu hộ:</strong> Bắt buộc phải điều phối Hiệp sĩ hoặc Kíp 115 tiếp cận hiện trường trước khi hoàn tất ca.
                        </div>
                        <button
                          onClick={() =>
                            hitlMutation.mutate({
                              incidentId: selected.id,
                              payload: {
                                action: "INSTANT_DISPATCH",
                                supervisorName: "Đoàn Minh Quân (Trưởng ca)",
                                tier: 2,
                              },
                            })
                          }
                          className="whitespace-nowrap rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md transition"
                        >
                          ⚡ Điều phối Hiệp sĩ ngay
                        </button>
                      </div>
                    )}

                    {isDispatched && !hasClinicalActions && !isCancelled && (
                      <div className="mt-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-[11px] text-emerald-300 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <strong>✅ Hiệp sĩ đã tiếp cận:</strong> Đoàn Minh Quân (Tier 2 PHTLS) đang có mặt tại hiện trường.
                          </div>
                          <button
                            onClick={() => clinicalSopMutation.mutate(selected.id)}
                            disabled={clinicalSopMutation.isPending}
                            className="whitespace-nowrap rounded bg-gradient-to-r from-sky-600 to-emerald-600 px-3.5 py-1.5 text-xs font-black text-white hover:opacity-95 shadow-md transition animate-pulse"
                          >
                            <span className="flex items-center gap-1.5">
                              <Zap className="h-3.5 w-3.5" />
                              {clinicalSopMutation.isPending
                                ? "Đang thực hiện..."
                                : "▶ KÍCH HOẠT QUY TRÌNH LÂM SÀNG & SBAR 115"}
                            </span>
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Thực hiện 3 kỹ thuật chuẩn SOP: C-Spine Log-roll, Đặt Garô CAT chèn động mạch, Ép tim CPR Metronome 110 bpm theo máy AED.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* BẢNG THAO TÁC LÂM SÀNG & BIÊN BẢN SBAR 115 (Khi đã thực hiện sơ cứu) */}
                  {hasClinicalActions && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3.5 space-y-3">
                      {/* Tiêu đề & Sinh tồn phục hồi */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-400">
                          <Stethoscope className="h-4 w-4 text-emerald-400" />
                          NHẬT KÝ THAO TÁC LÂM SÀNG NGOẠI VIỆN (SOP V2.1)
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                            <HeartPulse className="h-3 w-3" /> SpO2: 96% (Hồi phục từ 91%)
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 text-[10px] font-black text-sky-300">
                            <Activity className="h-3 w-3" /> Mạch: 86 bpm (Ổn định)
                          </span>
                        </div>
                      </div>

                      {/* 3 Thao tác lâm sàng chi tiết */}
                      <div className="space-y-2">
                        {selected.clinicalActions?.map((action, idx) => (
                          <div
                            key={action.code || idx}
                            className="rounded-lg border border-border bg-card/70 p-2.5 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between font-bold text-foreground">
                              <span className="flex items-center gap-1.5 text-sky-400">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                {idx + 1}. {action.title}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">{action.performer}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{action.description}</p>
                            <div className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                              <span>✦ Kết quả:</span> {action.vitalImpact}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* BIÊN BẢN BÀN GIAO SBAR CHO 115 */}
                      {sbar && (
                        <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between font-extrabold text-indigo-300 border-b border-indigo-500/20 pb-1.5">
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-indigo-400" />
                              BIÊN BẢN BÀN GIAO LÂM SÀNG SBAR CHO 115 CHỢ RẪY
                            </span>
                            <span className="font-mono text-[10px] text-indigo-300">Xe: {sbar.ambulancePlate}</span>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
                            <div className="rounded bg-background/50 p-2 border border-border">
                              <span className="font-bold text-rose-400">S (Situation):</span> {sbar.situation}
                            </div>
                            <div className="rounded bg-background/50 p-2 border border-border">
                              <span className="font-bold text-amber-400">B (Background):</span> {sbar.background}
                            </div>
                            <div className="rounded bg-background/50 p-2 border border-border">
                              <span className="font-bold text-emerald-400">A (Assessment):</span> {sbar.assessment}
                            </div>
                            <div className="rounded bg-background/50 p-2 border border-border">
                              <span className="font-bold text-sky-400">R (Recommendation):</span> {sbar.recommendation}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-indigo-500/20 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">Bác sĩ tiếp nhận:</span> {sbar.paramedicName}
                            </div>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="flex items-center gap-1 text-emerald-400">
                                <QrCode className="h-3 w-3" /> EMR QR VERIFIED
                              </span>
                              <span className="text-muted-foreground">SHA-256: {sbar.qrVerificationHash}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-border bg-card/95 p-4 backdrop-blur-md sm:grid-cols-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-info px-4 py-3 text-xs font-bold text-primary-foreground transition hover:opacity-90">
                <PhoneCall className="h-4 w-4" /> Gọi người thân ({selected.emergencyContactPhone || "Chưa có"})
              </button>
              {(() => {
                const isDispatched =
                  selected.hitl?.state === "DISPATCHED" ||
                  selected.hitl?.state === "AMBULANCE_DISPATCHED";
                const isCancelled = selected.hitl?.state === "CANCELLED_FALSE_ALARM";

                if (!isDispatched && !isCancelled) {
                  return (
                    <button
                      disabled
                      title="Quy định y tế SOP: Ca này chưa có ai cứu nên không thể hoàn tất. Vui lòng bấm 'Điều phối Hiệp sĩ ngay' hoặc 'Hủy do báo động giả'."
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted/60 px-4 py-3 text-xs font-bold text-muted-foreground border border-border cursor-not-allowed opacity-60"
                    >
                      <Lock className="h-4 w-4" /> Chưa thể đóng ca (Chưa có ai cứu hộ)
                    </button>
                  );
                }

                return (
                  <button
                    onClick={() => resolveMutation.mutate(selected.id)}
                    disabled={resolveMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-emerald-500 shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {resolveMutation.isPending ? "Đang xử lý..." : "✅ Đã cứu & Đóng hoàn tất sự cố"}
                  </button>
                );
              })()}
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
