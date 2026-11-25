import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Ambulance,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Droplet,
  FileText,
  HeartPulse,
  Keyboard,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  PhoneCall,
  Play,
  QrCode,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
  Brain,
  ChevronRight,
  Shield,
  FileCheck,
  Vibrate,
  Watch,
} from "lucide-react";
import { Tag } from "@/components/Badge";
import { IncidentMap } from "@/components/IncidentMap";
import { Topbar } from "@/components/Topbar";
import { LiveVitalsTelemetry } from "@/components/LiveVitalsTelemetry";
import { DispatchCommsConsole } from "@/components/DispatchCommsConsole";
import { IncidentDossierModal } from "@/components/IncidentDossierModal";
import { IncidentPlaybackModal } from "@/components/IncidentPlaybackModal";
import { AiIncidentCopilotDrawer } from "@/components/AiIncidentCopilotDrawer";
import { News2ClinicalTriageModal } from "@/components/News2ClinicalTriageModal";
import { fetchAdminOverview, resolveIncident, submitHitlAction, runClinicalSop, sendWatchCommand, getWatchStreamUrl } from "@/lib/api";
import type { HitlActionPayload } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";
import { audioAlarm } from "@/lib/audioAlarm";
import { useAdminAuth } from "@/context/AdminAuthContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trung tâm điều phối TOC - SafeSolo" },
      { name: "description", content: "Bản đồ SOS và điều phối sự cố theo thời gian thực." },
    ],
  }),
  component: DispatchCenter,
});

function timeAgo(value: string) {
  const d = new Date(value);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p trước`;
  return `${Math.floor(m / 60)}h trước`;
}

function formatIncidentType(type: "SOS" | "DURESS" | "MEDICAL") {
  if (type === "DURESS") return "Báo động im lặng";
  if (type === "MEDICAL") return "Cấp cứu Y tế";
  return "SOS Khẩn cấp";
}

function DispatchCenter() {
  const queryClient = useQueryClient();
  const { adminUser } = useAdminAuth();
  const operatorName = adminUser?.name || "Điều phối viên TOC";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "clinical" | "heroes">("overview");
  const [filterType, setFilterType] = useState<"ALL" | "P1" | "MEDICAL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPilot, setIsAutoPilot] = useState(false);

  // Modals for deep-dive workflows
  const [showFalseAlarmModal, setShowFalseAlarmModal] = useState(false);
  const [falseAlarmReason, setFalseAlarmReason] = useState("Nạn nhân bấm nhầm");
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [supervisorCode, setSupervisorCode] = useState("SUP-0137");
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [showAiCopilotDrawer, setShowAiCopilotDrawer] = useState(false);
  const [showNews2Modal, setShowNews2Modal] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    refetchInterval: 10000,
  });

  const incidents = overviewQuery.data?.data.incidents ?? [];
  const stats = overviewQuery.data?.data.stats;

  const selected = useMemo(
    () => incidents.find((incident) => incident.id === selectedId) ?? null,
    [incidents, selectedId],
  );

  // Countdown timer for HITL Ring Expansion
  const initialSeconds = selected?.hitl?.countdownSeconds ?? 30;
  const [timeLeft, setTimeLeft] = useState<number>(initialSeconds);
  const [isPaused, setIsPaused] = useState<boolean>(selected?.hitl?.state === "PAUSED");

  useEffect(() => {
    setTimeLeft(initialSeconds);
    setIsPaused(selected?.hitl?.state === "PAUSED");
  }, [selected?.id, initialSeconds, selected?.hitl?.state]);

  const currentState = selected?.hitl?.state || "COUNTDOWN_ACTIVE";
  const isCountdownActive = currentState === "COUNTDOWN_ACTIVE" && !isPaused && timeLeft > 0;
  const isDispatched = currentState === "DISPATCHED" || currentState === "AMBULANCE_DISPATCHED";
  const isCancelled = currentState === "CANCELLED_FALSE_ALARM";

  const resolveMutation = useMutation({
    mutationFn: (incidentId: string) => resolveIncident(incidentId, "Đã xử lý từ trung tâm điều phối"),
    onSuccess: async () => {
      setIsDrawerOpen(false);
      setSelectedId(null);
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

  const [watchNotice, setWatchNotice] = useState<string | null>(null);
  const watchRemoteMutation = useMutation({
    mutationFn: ({
      userId,
      action,
      incidentId,
    }: {
      userId?: string | null;
      action: "FIND_WATCH_PING" | "INSTANT_MEASURE_REQ" | "TOC_DISPATCH_ACK";
      incidentId: string;
    }) =>
      sendWatchCommand({
        userId,
        action,
        payload: { incidentId },
        issuedBy: operatorName,
      }),
    onSuccess: (res, vars) => {
      setWatchNotice(`Đã gửi ${vars.action} -> ${res.data.deviceId}`);
      setTimeout(() => setWatchNotice(null), 4000);
    },
  });

  useEffect(() => {
    const es = new EventSource(getWatchStreamUrl());
    es.addEventListener("watch", () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    });
    return () => es.close();
  }, [queryClient]);

  // Countdown tick
  useEffect(() => {
    if (!isCountdownActive || !selected) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void hitlMutation.mutate({
            incidentId: selected.id,
            payload: {
              action: "AUTO_DISPATCH_TIMEOUT",
              supervisorName: "Hệ thống Fail-Safe SafeSolo",
              tier: 2,
            },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountdownActive, selected, hitlMutation]);

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

  // Keyboard Hotkeys
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
              supervisorName: operatorName,
              tier: 2,
            },
          });
        }
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (selected) {
          const paused = selected.hitl?.state === "PAUSED";
          hitlMutation.mutate({
            incidentId: selected.id,
            payload: {
              action: paused ? "RESUME_COUNTDOWN" : "PAUSE_COUNTDOWN",
              supervisorName: operatorName,
              tier: 2,
            },
          });
        }
      } else if (e.code === "Escape") {
        e.preventDefault();
        setIsDrawerOpen(false);
      } else if (e.key === "1" && incidents[0]) {
        setSelectedId(incidents[0].id);
        setIsDrawerOpen(true);
      } else if (e.key === "2" && incidents[1]) {
        setSelectedId(incidents[1].id);
        setIsDrawerOpen(true);
      } else if (e.key === "3" && incidents[2]) {
        setSelectedId(incidents[2].id);
        setIsDrawerOpen(true);
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
  }, [selected, incidents, hitlMutation]);

  // Auto-Pilot execution
  useEffect(() => {
    if (!isAutoPilot || incidents.length === 0) return;

    incidents.forEach((inc) => {
      if (inc.hitl?.state === "COUNTDOWN_ACTIVE" && inc.status === "ACTIVE") {
        hitlMutation.mutate({
          incidentId: inc.id,
          payload: {
            action: "INSTANT_DISPATCH",
            supervisorName: "SafeSolo AI Auto-Pilot",
            tier: 2,
          },
        });
      }
    });
  }, [incidents, isAutoPilot, hitlMutation]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleExport = () => {
    exportWorkbook("safesolo-admin-dispatch.xlsx", [
      {
        name: "Thống kê",
        rows: stats
          ? [
              {
                "Tổng người dùng": stats.totalUsers,
                "Người dùng theo dõi": stats.monitoredUsers,
                "Sự cố đang mở": stats.activeIncidents,
                "KYC chờ duyệt": stats.kycPending,
                "Hiệp sĩ đã xác minh": stats.heroesVerified,
                "Cảnh báo hôm nay": stats.alertsToday,
              },
            ]
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
        })),
      },
    ]);
  };

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filterType === "P1" && inc.hitl?.priority !== "P1_CRITICAL") return false;
      if (filterType === "MEDICAL" && inc.type !== "MEDICAL") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          inc.name.toLowerCase().includes(q) ||
          inc.address.toLowerCase().includes(q) ||
          inc.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [incidents, filterType, searchQuery]);

  const progressPercentage = Math.min(100, Math.max(0, (timeLeft / (selected?.hitl?.autoDispatchThreshold || 30)) * 100));

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden">
      {/* 1. TOPBAR CHUẨN */}
      <Topbar title="Trung tâm Điều phối Khẩn cấp (TOC)" subtitle="Phòng trực ban cứu nạn 24/7 · Mạng lưới SafeSolo" />

      {/* 2. COMMAND STRIP GỌN GÀNG, TRỰC QUAN (THAY THẾ 4 METRIC CARDS LÒE LOẸT & COCKPIT CỒNG KỀNH) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2 backdrop-blur-md">
        {/* Trái: Trạng thái kết nối tinh gọn */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-400 border border-emerald-500/20 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Trực ban TOC</span>
          </div>
          <span className="text-slate-400 font-medium">Trưởng ca: {operatorName}</span>
          <span className="text-slate-700">|</span>
          <span className="font-mono text-slate-400 text-[11px]">Độ trễ: 12ms</span>
        </div>

        {/* Giữa: 4 Chỉ số KPI Tinh Giản (Micro Stat Pills) */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-1 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-rose-300 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>Sự cố mở:</span>
            <strong className="font-mono font-bold text-white">{stats?.activeIncidents ?? incidents.length}</strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-emerald-300 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Hiệp sĩ:</span>
            <strong className="font-mono font-bold text-white">{stats?.heroesVerified ?? 12}</strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-slate-300 font-medium">
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <span>Người dùng:</span>
            <strong className="font-mono font-bold text-white">{stats?.totalUsers ?? 1420}</strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-amber-300 font-medium">
            <BellRing className="h-3.5 w-3.5 text-amber-400" />
            <span>Cảnh báo 24h:</span>
            <strong className="font-mono font-bold text-white">{stats?.alertsToday ?? 8}</strong>
          </div>
        </div>

        {/* Phải: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Toggle Auto-Pilot AI */}
          <button
            onClick={() => setIsAutoPilot(!isAutoPilot)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              isAutoPilot
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-sm"
                : "border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300"
            }`}
          >
            <Sparkles className={`h-3.5 w-3.5 ${isAutoPilot ? "text-emerald-400" : "text-amber-400"}`} />
            <span>Auto-Pilot AI: {isAutoPilot ? "BẬT" : "TẮT"}</span>
          </button>

          {/* Toggle Còi báo */}
          <button
            onClick={() => {
              const next = !muted;
              setMuted(next);
              audioAlarm.setMuted(next);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              muted
                ? "border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400"
                : "border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse"
            }`}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{muted ? "Còi: TẮT" : "Còi: BẬT"}</span>
          </button>

          {/* Xuất Excel */}
          <button
            onClick={handleExport}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs font-semibold hover:bg-slate-800 text-slate-300 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Xuất Excel</span>
          </button>

          {/* Toàn màn hình */}
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 3. WORKSPACE SPLIT VIEW: BẢN ĐỒ LÀM TRỌNG TÂM + SIDE PANEL TINH GỌN */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* CỘT TRÁI: BẢN ĐỒ RADAR KHÔNG GIAN (CHIẾM ĐA SỐ MÀN HÌNH) */}
        <div className="flex-1 relative h-full">
          <IncidentMap
            incidents={incidents}
            selectedId={selectedId}
            onSelect={(incidentId) => {
              setSelectedId(incidentId);
              setIsDrawerOpen(true);
            }}
          />

          {/* Floating Minimalist Hotkey Legend (Không choáng chỗ đáy màn hình) */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-400 backdrop-blur-md shadow-lg">
            <Keyboard className="h-3.5 w-3.5 text-sky-400" />
            <span>
              <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-200">SPACE</kbd> Duyệt ·{" "}
              <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-200">P</kbd> Tạm dừng ·{" "}
              <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-200">ESC</kbd> Đóng ·{" "}
              <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-200">M</kbd> Còi
            </span>
          </div>
        </div>

        {/* CỘT PHẢI: DRAWER TÁC CHIẾN / HÀNG ĐỢI SỰ CỐ */}
        <aside
          className={`flex flex-col border-l border-slate-800 bg-slate-900/95 backdrop-blur-md transition-all duration-200 z-30 shadow-2xl ${
            isDrawerOpen && selected ? "w-[440px] xl:w-[480px]" : "w-[360px] xl:w-[390px]"
          }`}
        >
          {/* TRƯỜNG HỢP 1: KHI ĐANG MỞ CHI TIẾT CA SỰ CỐ (ACTIVE INCIDENT DRAWER) */}
          {isDrawerOpen && selected ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Header Drawer */}
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="rounded-md border border-slate-800 p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
                    title="Quay lại danh sách"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm truncate max-w-[190px]">
                        {selected.name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider ${
                          selected.hitl?.priority === "P1_CRITICAL"
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            : selected.type === "DURESS"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {selected.hitl?.priority === "P1_CRITICAL" ? "P1 CẤP CỨU" : formatIncidentType(selected.type)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                      {selected.address}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sub-Tabs Điều Hướng Chuyên Sâu (3 Tab Gọn Gàng, Chống Rối Mắt) */}
              <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/60 p-1 text-xs font-semibold text-center">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition ${
                    activeTab === "overview"
                      ? "bg-slate-800 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-sky-400" />
                  <span>Tổng quan</span>
                </button>
                <button
                  onClick={() => setActiveTab("clinical")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition ${
                    activeTab === "clinical"
                      ? "bg-slate-800 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Stethoscope className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Sơ cứu & 115</span>
                </button>
                <button
                  onClick={() => setActiveTab("heroes")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition ${
                    activeTab === "heroes"
                      ? "bg-slate-800 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  <span>Hiệp sĩ & Gọi</span>
                </button>
              </div>

              {/* TAB CONTENT (CUỘN RIÊNG, KHÔNG RỐI MẮT) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {/* TAB 1: TỔNG QUAN NẠN NHÂN & ĐIỀU PHỐI */}
                {activeTab === "overview" && (
                  <div className="space-y-3">
                    {/* Thẻ đếm ngược điều phối mở rộng vòng 1 -> 2 -> 3 */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                          <Clock className={`h-4 w-4 ${isCountdownActive ? "text-emerald-400 animate-spin" : "text-slate-500"}`} />
                          <span>
                            {isCancelled
                              ? "Đã hủy ca (Báo động giả)"
                              : isDispatched
                              ? "✅ Đã điều phối tiếp cận"
                              : isPaused
                              ? "Đang tạm dừng đếm ngược"
                              : `Tự động mở Vòng 2 sau: ${timeLeft}s`}
                          </span>
                        </div>
                        {!isDispatched && !isCancelled && (
                          <button
                            onClick={() => {
                              const action = isPaused ? "RESUME_COUNTDOWN" : "PAUSE_COUNTDOWN";
                              setIsPaused(!isPaused);
                              hitlMutation.mutate({ incidentId: selected.id, payload: { action } });
                            }}
                            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700"
                          >
                            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                            {isPaused ? "Tiếp tục" : "Tạm dừng"}
                          </button>
                        )}
                      </div>

                      {!isCancelled && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-1000"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Thẻ Hồ sơ Nạn nhân I.C.E */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800/80 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-sky-400" />
                          HỒ SƠ Y TẾ KHẨN CẤP I.C.E
                        </span>
                        <span className="font-mono text-slate-400 text-[10px]">ID: {selected.id}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                          <div className="text-[10px] text-slate-400">Nhóm máu</div>
                          <div className="font-bold text-rose-400 text-sm mt-0.5">{selected.blood || "Chưa rõ"}</div>
                        </div>
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                          <div className="text-[10px] text-slate-400">Dị ứng</div>
                          <div className="font-semibold text-amber-300 text-xs mt-0.5 truncate">{selected.allergies || "Không"}</div>
                        </div>
                        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                          <div className="text-[10px] text-slate-400">Tuổi</div>
                          <div className="font-bold text-slate-200 text-sm mt-0.5">{selected.age ? `${selected.age}t` : "--"}</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1">
                        <span>Người bảo trợ: <strong>{selected.emergencyContactName || "Gia đình"}</strong></span>
                        <a
                          href={`tel:${selected.emergencyContactPhone}`}
                          className="font-mono text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <PhoneCall className="h-3 w-3" />
                          {selected.emergencyContactPhone || "Chưa cập nhật"}
                        </a>
                      </div>
                    </div>

                    {/* Thẻ Vi Địa Chỉ & Lệnh Can Thiệp Điều 23 BLHS */}
                    <div className="rounded-xl border border-sky-500/20 bg-sky-950/15 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-sky-300">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-sky-400" />
                          ĐỊA CHỈ HIỆN TRƯỜNG & LỆNH CAN THIỆP
                        </span>
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-sky-300">
                          ĐIỀU 23 BLHS
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {selected.microAddress ? (
                          <>Chi tiết: <strong>{selected.microAddress}</strong></>
                        ) : (
                          <>Vị trí GPS: <strong>{selected.address}</strong></>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Căn cứ Điều 23 BLHS 2015 & Điều 87 Luật KCB 2023: Cấp quyền Hiệp sĩ tiếp cận khẩn cấp để tiến hành hồi sức tim phổi CPR trong 4 phút vàng.
                      </p>
                    </div>

                    {/* Thẻ AI Triage Recommendation + Công cụ Tác chiến nhanh */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        <span>Đề xuất phân loại AI Triage</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {selected.hitl?.aiSummary || "Nghi ngờ ngừng tim / đột quỵ ngoại viện kèm bất động kéo dài. Cần hiệp sĩ có chứng chỉ CPR/AED tiếp cận ngay."}
                      </p>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        Khuyến nghị: {selected.hitl?.recommendedAction || "Phái cử 2 Hiệp sĩ Vòng 1 và thông báo sẵn sàng cho kíp xe 115 lân cận."}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowNews2Modal(true)}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Stethoscope className="h-3.5 w-3.5" />
                          <span>Phân loại NEWS2</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAiCopilotDrawer(true)}
                          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Brain className="h-3.5 w-3.5" />
                          <span>Trợ lý AI Copilot</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SINH TỒN & QUY TRÌNH LÂM SÀNG SBAR */}
                {activeTab === "clinical" && (
                  <div className="space-y-3">
                    {/* WearOS Telemetry & Live ECG */}
                    <LiveVitalsTelemetry
                      heartRate={selected.vitals?.heartRate ?? 124}
                      spo2={selected.vitals?.spo2 ?? 91}
                      hrvRmssd={selected.vitals?.hrvRmssd ?? 18}
                      strokeRisk={selected.vitals?.strokeRisk ?? "Rung nhĩ AFib (Nguy cơ cao)"}
                      battery={selected.vitals?.battery ?? 78}
                      device={selected.vitals?.device ?? "Samsung Galaxy Watch 5 (WearOS)"}
                      isAlert={Boolean(selected.vitals?.spo2 && selected.vitals.spo2 < 92)}
                      svmG={selected.vitals?.svmG}
                      isOffWrist={selected.vitals?.isOffWrist}
                      gForceWaveform={selected.vitals?.gForceWaveform}
                      ppgWaveform={selected.vitals?.ppgWaveform}
                      fusion={selected.vitals?.fusion}
                    />

                    {/* Điều khiển hai chiều Galaxy Watch 5 trực tiếp từ Dispatch Drawer */}
                    <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-sky-300">
                        <span className="flex items-center gap-1.5">
                          <Watch className="h-3.5 w-3.5" /> ĐIỀU KHIỂN GALAXY WATCH 5 HAI CHIỀU
                        </span>
                        {watchNotice && (
                          <span className="font-mono text-[10px] text-emerald-400">{watchNotice}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            watchRemoteMutation.mutate({
                              userId: selected.userId,
                              action: "INSTANT_MEASURE_REQ",
                              incidentId: selected.id,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 py-1.5 px-2 font-semibold text-sky-300 transition cursor-pointer"
                        >
                          <HeartPulse className="h-3.5 w-3.5 shrink-0" />
                          <span>Đo PPG Live</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            watchRemoteMutation.mutate({
                              userId: selected.userId,
                              action: "FIND_WATCH_PING",
                              incidentId: selected.id,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 py-1.5 px-2 font-semibold text-amber-300 transition cursor-pointer"
                        >
                          <Vibrate className="h-3.5 w-3.5 shrink-0" />
                          <span>Rung Watch 5</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            watchRemoteMutation.mutate({
                              userId: selected.userId,
                              action: "TOC_DISPATCH_ACK",
                              incidentId: selected.id,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 py-1.5 px-2 font-semibold text-emerald-300 transition cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Báo Cứu Hộ</span>
                        </button>
                      </div>
                    </div>

                    {/* Tiến trình cứu hộ 4 bước */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                      <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>TIẾN TRÌNH CỨU HỘ 4 BƯỚC</span>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {selected.clinicalActions?.length ? "BƯỚC 3-4 / 4" : isDispatched ? "BƯỚC 2 / 4" : "BƯỚC 1 / 4"}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold">
                        <div className="rounded bg-rose-500/20 border border-rose-500/30 p-1.5 text-rose-300">
                          1. Phát SOS
                        </div>
                        <div className={`rounded p-1.5 border transition ${isDispatched ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                          2. Nhận ca
                        </div>
                        <div className={`rounded p-1.5 border transition ${selected.clinicalActions?.length ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : isDispatched ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                          3. Sơ cứu
                        </div>
                        <div className={`rounded p-1.5 border transition ${selected.sbarHandoff ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                          4. Giao 115
                        </div>
                      </div>
                    </div>

                    {/* Công cụ Y Khoa & Điều xe 115 (Tier 3 Gate) */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setShowNews2Modal(true)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20 font-semibold text-center flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" />
                        <span>NEWS2</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAiCopilotDrawer(true)}
                        className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-sky-300 hover:bg-sky-500/20 font-semibold text-center flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Brain className="h-3.5 w-3.5 shrink-0" />
                        <span>AI SOP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAmbulanceModal(true)}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300 hover:bg-amber-500/20 font-semibold text-center flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Ambulance className="h-3.5 w-3.5 shrink-0" />
                        <span>Điều 115</span>
                      </button>
                    </div>

                    {/* Nút Kích hoạt Sơ cứu & SBAR nếu chưa chạy */}
                    {!selected.clinicalActions?.length && isDispatched && (
                      <button
                        onClick={() => clinicalSopMutation.mutate(selected.id)}
                        disabled={clinicalSopMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 transition"
                      >
                        <Zap className="h-4 w-4" />
                        {clinicalSopMutation.isPending ? "Đang xử lý..." : "KÍCH HOẠT QUY TRÌNH LÂM SÀNG & SBAR 115"}
                      </button>
                    )}

                    {/* Nhật ký thao tác sơ cứu lâm sàng */}
                    {selected.clinicalActions && selected.clinicalActions.length > 0 && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3 space-y-2 text-xs">
                        <div className="font-bold text-emerald-400 flex items-center gap-1.5 border-b border-emerald-500/20 pb-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          NHẬT KÝ SƠ CỨU LÂM SÀNG (SOP 2.1)
                        </div>
                        <div className="space-y-1.5">
                          {selected.clinicalActions.map((act, idx) => (
                            <div key={idx} className="rounded-lg bg-slate-900/80 border border-slate-800 p-2 text-[11px] space-y-0.5">
                              <div className="font-bold text-slate-200 flex justify-between">
                                <span>{idx + 1}. {act.title}</span>
                                <span className="font-mono text-slate-400 text-[10px]">{act.performer}</span>
                              </div>
                              <p className="text-slate-400 text-[10px]">{act.description}</p>
                              <div className="text-[10px] text-emerald-400 font-medium">✓ {act.vitalImpact}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Biên bản SBAR Bàn giao 115 */}
                    {selected.sbarHandoff && (
                      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-indigo-300 border-b border-indigo-500/20 pb-1.5">
                          <span className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-indigo-400" />
                            BIÊN BẢN BÀN GIAO SBAR CHO 115
                          </span>
                          <span className="font-mono text-[10px] text-indigo-300">Xe: {selected.sbarHandoff.ambulancePlate}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                            <strong className="text-rose-400">S:</strong> {selected.sbarHandoff.situation}
                          </div>
                          <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                            <strong className="text-amber-400">B:</strong> {selected.sbarHandoff.background}
                          </div>
                          <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                            <strong className="text-emerald-400">A:</strong> {selected.sbarHandoff.assessment}
                          </div>
                          <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800">
                            <strong className="text-sky-400">R:</strong> {selected.sbarHandoff.recommendation}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-mono">
                          <span>BS. {selected.sbarHandoff.paramedicName}</span>
                          <span className="text-emerald-400 flex items-center gap-1">
                            <QrCode className="h-3 w-3" /> EMR QR VERIFIED
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: HIỆP SĨ & ĐÀM THOẠI */}
                {activeTab === "heroes" && (
                  <div className="space-y-3">
                    {/* Danh sách Hiệp sĩ lân cận */}
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          HIỆP SĨ LÂN CẬN ({selected.nearbyHeroes?.length || 2})
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">ĐÃ KYC PHTLS</span>
                      </div>
                      <div className="space-y-2">
                        {selected.nearbyHeroes && selected.nearbyHeroes.length > 0 ? (
                          selected.nearbyHeroes.map((hero, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-800 p-2.5 text-xs">
                              <div>
                                <div className="font-bold text-slate-200">{hero.name}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  📞 {hero.phone} · Cách: <strong className="text-slate-200">{hero.distance}</strong>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold text-emerald-400">ETA: {hero.eta}</div>
                                <div className="text-[10px] text-amber-400 font-mono">⭐ {hero.trustScore} điểm</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 text-center text-xs text-slate-400">
                            Đang quét Radar tìm Hiệp sĩ KYC khả dụng trong bán kính 4.5 km...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bàn đàm thoại 1-chạm */}
                    <DispatchCommsConsole
                      incidentId={selected.id}
                      victimName={selected.name}
                      victimPhone={selected.phoneNumber}
                      guardianName={selected.emergencyContactName}
                      guardianPhone={selected.emergencyContactPhone}
                      heroName={selected.nearbyHeroes?.[0]?.name}
                      heroPhone={selected.nearbyHeroes?.[0]?.phone}
                    />

                    {/* Nút mở các công cụ chuyên sâu */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <button
                        onClick={() => setShowDossierModal(true)}
                        className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 font-medium text-center flex items-center justify-center gap-1.5"
                      >
                        <FileCheck className="h-3.5 w-3.5 text-sky-400" />
                        <span>Hồ sơ Bằng chứng</span>
                      </button>
                      <button
                        onClick={() => setShowPlaybackModal(true)}
                        className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 font-medium text-center flex items-center justify-center gap-1.5"
                      >
                        <Compass className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Phát lại Playback</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* STICKY BOTTOM ACTION BAR (RÕ RÀNG, DỨT KHOÁT, CHỐNG RỐI MẮT) */}
              <div className="border-t border-slate-800 bg-slate-950 p-3 space-y-2">
                <div className="flex gap-2">
                  {!isDispatched && !isCancelled ? (
                    <button
                      onClick={() =>
                        hitlMutation.mutate({
                          incidentId: selected.id,
                          payload: {
                            action: "INSTANT_DISPATCH",
                            supervisorName: operatorName,
                            tier: 2,
                          },
                        })
                      }
                      disabled={hitlMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      <Zap className="h-4 w-4" />
                      <span>{hitlMutation.isPending ? "Đang điều phối..." : "ĐIỀU PHỐI HIỆP SĨ NGAY"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => resolveMutation.mutate(selected.id)}
                      disabled={resolveMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{resolveMutation.isPending ? "Đang lưu..." : "ĐÃ CỨU & ĐÓNG CA HOÀN TẤT"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowFalseAlarmModal(true)}
                    disabled={hitlMutation.isPending || isCancelled}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50"
                    title="Báo động giả / Hủy ca"
                  >
                    Báo động giả
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: DANH SÁCH HÀNG ĐỢI SỰ CỐ (KHI CHƯA CHỌN CA CỤ THỂ) */
            <div className="flex flex-col h-full min-h-0">
              {/* Header Queue */}
              <div className="p-3 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <Radio className="h-4 w-4 text-rose-500" />
                    <span>Hàng đợi cứu hộ</span>
                  </h2>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                    {filteredIncidents.length} ca
                  </span>
                </div>

                {/* Search bar mini */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên nạn nhân, địa chỉ..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
                  />
                </div>

                {/* Filter pills */}
                <div className="flex gap-1.5 pt-0.5 text-[11px] font-semibold">
                  <button
                    onClick={() => setFilterType("ALL")}
                    className={`flex-1 py-1 rounded-md transition ${
                      filterType === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setFilterType("P1")}
                    className={`flex-1 py-1 rounded-md transition ${
                      filterType === "P1" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold" : "text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    P1 Nguy kịch
                  </button>
                  <button
                    onClick={() => setFilterType("MEDICAL")}
                    className={`flex-1 py-1 rounded-md transition ${
                      filterType === "MEDICAL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    Y tế SOS
                  </button>
                </div>
              </div>

              {/* Danh sách các ca sự cố phẳng, thoáng mắt */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {overviewQuery.isLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">Đang tải dữ liệu radar...</div>
                ) : filteredIncidents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">Không có sự cố nào phù hợp bộ lọc.</div>
                ) : (
                  filteredIncidents.map((inc) => {
                    const isP1 = inc.hitl?.priority === "P1_CRITICAL";
                    return (
                      <div
                        key={inc.id}
                        onClick={() => {
                          setSelectedId(inc.id);
                          setIsDrawerOpen(true);
                        }}
                        className={`group relative rounded-xl border p-3 cursor-pointer transition-all ${
                          selectedId === inc.id
                            ? "border-sky-500/50 bg-sky-950/20 shadow-md"
                            : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                isP1
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  : inc.type === "DURESS"
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {isP1 ? "P1 · Nguy kịch" : formatIncidentType(inc.type)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">qua {inc.channel}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">{timeAgo(inc.receivedAt)}</span>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="font-bold text-slate-200 text-sm group-hover:text-white transition">
                            {inc.name}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition" />
                        </div>

                        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                          <span className="truncate">{inc.address}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 4. MODALS TIỆN ÍCH DÀNH CHO NGHIỆM THU ĐỒ ÁN */}
      {/* Modal Hủy Báo Động Giả */}
      {showFalseAlarmModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-base">
              <AlertTriangle className="h-5 w-5" />
              <span>Xác nhận Hủy / Báo động giả</span>
            </div>
            <p className="text-xs text-slate-400">
              Vui lòng chọn lý do hủy ca cứu hộ của nạn nhân <strong>{selected.name}</strong>:
            </p>
            <div className="space-y-2 text-xs">
              {["Nạn nhân bấm nhầm", "Báo động kiểm thử hệ thống", "Đã liên hệ người thân an toàn", "Trẻ em nghịch máy"].map((reason) => (
                <label key={reason} className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 hover:bg-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    checked={falseAlarmReason === reason}
                    onChange={() => setFalseAlarmReason(reason)}
                    className="accent-rose-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFalseAlarmModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Hủy bỏ
              </button>
              <button
                onClick={async () => {
                  setShowFalseAlarmModal(false);
                  await hitlMutation.mutateAsync({
                    incidentId: selected.id,
                    payload: {
                      action: "CANCEL_FALSE_ALARM",
                      reason: falseAlarmReason,
                      supervisorName: operatorName,
                      tier: 1,
                    },
                  });
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 shadow"
              >
                Xác nhận Hủy ca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Điều Phối Xe Cấp Cứu 115 (Tier 3 Strict Gate) */}
      {showAmbulanceModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400 font-bold text-base">
              <Ambulance className="h-5 w-5" />
              <span>Lệnh Điều Xe Cấp Cứu 115 (Tier 3 Gate)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Xác nhận xuất xe cứu thương tới hiện trường nạn nhân <strong>{selected.name}</strong> tại{" "}
              <span className="text-sky-300">{selected.address}</span> (BV gần nhất: {selected.nearestHospital?.name || "BV Chợ Rẫy"}).
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Mã chữ ký điều phối viên trưởng ca
              </label>
              <input
                type="text"
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAmbulanceModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowAmbulanceModal(false);
                  await hitlMutation.mutateAsync({
                    incidentId: selected.id,
                    payload: {
                      action: "TIER3_AMBULANCE_DISPATCH",
                      supervisorName: operatorName,
                      supervisorId: supervisorCode,
                      reason: `Xuất xe 115 tới ${selected.nearestHospital?.name || "BV Tuyến đầu"}`,
                      tier: 3,
                    },
                  });
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white hover:bg-amber-500 shadow"
              >
                Ký & Điều Xe 115 Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dossier */}
      {showDossierModal && selected && (
        <IncidentDossierModal incidentId={String(selected.id)} onClose={() => setShowDossierModal(false)} />
      )}

      {/* Modal Playback */}
      {showPlaybackModal && selected && (
        <IncidentPlaybackModal incidentId={String(selected.id)} onClose={() => setShowPlaybackModal(false)} />
      )}

      {/* AI Copilot Drawer */}
      {showAiCopilotDrawer && selected && (
        <AiIncidentCopilotDrawer incidentId={String(selected.id)} onClose={() => setShowAiCopilotDrawer(false)} />
      )}

      {/* NEWS2 Modal */}
      {showNews2Modal && selected && (
        <News2ClinicalTriageModal
          isOpen={showNews2Modal}
          onClose={() => setShowNews2Modal(false)}
          incidentName={selected.name}
          incidentId={String(selected.id)}
          initialHeartRate={selected.vitals?.heartRate}
          initialSpo2={selected.vitals?.spo2}
          onApplyTriageToDispatch={(score, riskLevel, actionPlan) => {
            setShowNews2Modal(false);
            hitlMutation.mutate({
              incidentId: String(selected.id),
              payload: {
                action: "NEWS2_TRIAGE_APPLIED",
                reason: `NEWS2=${score} (${riskLevel}): ${actionPlan}`,
                supervisorName: operatorName,
                supervisorId: adminUser?.badgeNumber || supervisorCode,
                tier: score >= 7 ? 3 : 2,
              },
            });
          }}
        />
      )}
    </div>
  );
}
