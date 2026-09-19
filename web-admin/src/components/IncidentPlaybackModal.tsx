import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Award,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Download,
  FastForward,
  Flame,
  HeartPulse,
  Lock,
  MapPin,
  Maximize2,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { fetchIncidentPlayback, type IncidentPlaybackData } from "@/lib/api";

interface IncidentPlaybackModalProps {
  incidentId: string;
  onClose: () => void;
}

export function IncidentPlaybackModal({ incidentId, onClose }: IncidentPlaybackModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<1 | 2 | 4>(1);
  const [copiedHash, setCopiedHash] = useState(false);

  const playbackQuery = useQuery({
    queryKey: ["incident-playback", incidentId],
    queryFn: () => fetchIncidentPlayback(incidentId),
  });

  const data = playbackQuery.data?.data;
  const points = data?.timelinePoints ?? [];
  const milestones = data?.eventMilestones ?? [];

  const currentPoint = points[currentIndex] ?? points[0] ?? null;

  // Auto playback timer
  useEffect(() => {
    if (!isPlaying || points.length === 0) return;

    const intervalTime = Math.max(150, Math.round(900 / playSpeed));
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= points.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPlaying, playSpeed, points.length]);

  const handleCopyHash = () => {
    if (!data?.blackboxHash) return;
    navigator.clipboard.writeText(data.blackboxHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  const handleJumpToRelSec = (relSec: number) => {
    const idx = points.findIndex((p) => p.relSec >= relSec);
    if (idx !== -1) {
      setCurrentIndex(idx);
    }
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safesolo-blackbox-${incidentId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Map projection helper for the mini map canvas
  const mapCoords = useMemo(() => {
    if (points.length === 0) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    return {
      minLat: Math.min(...lats) - 0.0005,
      maxLat: Math.max(...lats) + 0.0005,
      minLng: Math.min(...lngs) - 0.0005,
      maxLng: Math.max(...lngs) + 0.0005,
    };
  }, [points]);

  const project = (lat: number, lng: number) => {
    const latSpan = mapCoords.maxLat - mapCoords.minLat || 0.001;
    const lngSpan = mapCoords.maxLng - mapCoords.minLng || 0.001;
    const x = ((lng - mapCoords.minLng) / lngSpan) * 100;
    const y = ((mapCoords.maxLat - lat) / latSpan) * 100;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl border border-sky-500/30 bg-card shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* 1. Header Bar */}
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-5 py-3 backdrop-blur shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <Compass className="h-4 w-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide text-foreground">
                  HỘP ĐEN SỰ CỐ · FLIGHT RECORDER PLAYBACK
                </span>
                <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-400">
                  {incidentId}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tái hiện vi mô diễn biến GPS, nhịp sinh tồn và xung cảm biến từng giây
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyHash}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:bg-accent hover:text-foreground transition"
              title="Sao chép mã băm niêm phong pháp lý"
            >
              <Lock className="h-3 w-3 text-sky-400" />
              {copiedHash ? (
                <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Đã chép</span>
              ) : (
                <span>SHA-256 Seal</span>
              )}
            </button>

            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition"
            >
              <Download className="h-3.5 w-3.5" /> Xuất Hộp Đen
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Content Area (Scrollable) */}
        <div className="p-4 md:p-5 space-y-4 overflow-y-auto flex-1">
          {playbackQuery.isLoading ? (
            <div className="p-16 text-center text-sm text-muted-foreground animate-pulse">
              Đang giải mã dữ liệu vi mô từ hộp đen SafeSolo...
            </div>
          ) : data ? (
            <>
              {/* Upper Grid: Map on Left, Bio-Signals on Right */}
              <div className="grid gap-4 lg:grid-cols-12">
                {/* Left: GPS Path Tracker (7 cols) */}
                <div className="lg:col-span-7 flex flex-col rounded-xl border border-border/80 bg-background/70 p-3 shadow-inner relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                      <Navigation className="h-3.5 w-3.5 text-sky-400" />
                      <span>Quỹ đạo di chuyển GPS (Breadcrumbs Path)</span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      Tọa độ: <strong className="text-foreground">{currentPoint?.lat.toFixed(5)}, {currentPoint?.lng.toFixed(5)}</strong>
                    </div>
                  </div>

                  {/* SVG Canvas for breadcrumbs path */}
                  <div className="relative h-56 w-full rounded-lg bg-slate-950/80 border border-border/50 overflow-hidden">
                    {/* Grid lines background */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30" />

                    {/* SVG Polyline */}
                    <svg className="absolute inset-0 h-full w-full pointer-events-none">
                      <polyline
                        fill="none"
                        stroke="#0ea5e9"
                        strokeWidth="3"
                        strokeDasharray="4 2"
                        opacity="0.5"
                        points={points
                          .map((p) => {
                            const { x, y } = project(p.lat, p.lng);
                            return `${x}%,${y}%`;
                          })
                          .join(" ")}
                      />
                      {/* Trail of traveled path up to current index */}
                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="4"
                        strokeLinecap="round"
                        points={points
                          .slice(0, currentIndex + 1)
                          .map((p) => {
                            const { x, y } = project(p.lat, p.lng);
                            return `${x}%,${y}%`;
                          })
                          .join(" ")}
                      />
                    </svg>

                    {/* Start point marker */}
                    {points[0] && (
                      <div
                        style={{
                          left: `${project(points[0].lat, points[0].lng).x}%`,
                          top: `${project(points[0].lat, points[0].lng).y}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-black/60 px-1 rounded mt-0.5">
                          T-00:45
                        </span>
                      </div>
                    )}

                    {/* Impact point marker (T-00:00) */}
                    {points.find((p) => p.relSec === 0) && (
                      <div
                        style={{
                          left: `${project(points.find((p) => p.relSec === 0)!.lat, points.find((p) => p.relSec === 0)!.lng).x}%`,
                          top: `${project(points.find((p) => p.relSec === 0)!.lat, points.find((p) => p.relSec === 0)!.lng).y}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center pointer-events-none"
                      >
                        <div className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-ping" />
                        <span className="text-[9px] font-bold text-rose-400 bg-black/75 px-1 rounded mt-0.5">
                          💥 Va chạm
                        </span>
                      </div>
                    )}

                    {/* Dynamic Moving Victim Marker */}
                    {currentPoint && (
                      <div
                        style={{
                          left: `${project(currentPoint.lat, currentPoint.lng).x}%`,
                          top: `${project(currentPoint.lat, currentPoint.lng).y}%`,
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-300 pointer-events-none"
                      >
                        <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 border-2 border-white shadow-[0_0_12px_#fbbf24]">
                          <span className="absolute -inset-1 rounded-full border-2 border-amber-300 animate-ping opacity-80" />
                          <span className="h-2 w-2 rounded-full bg-black" />
                        </div>
                        <div className="mt-1 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shadow">
                          {currentPoint.speedKmH > 0 ? `${currentPoint.speedKmH} km/h` : "Bất động (0 km/h)"}
                        </div>
                      </div>
                    )}

                    {/* Map bottom stats overlay */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground bg-black/70 px-2 py-1 rounded backdrop-blur border border-white/5">
                      <div>Vị trí: {data.baseLocation.address}</div>
                      <div>Thiết bị: {data.deviceModel}</div>
                    </div>
                  </div>
                </div>

                {/* Right: Bio-Signals & Telemetry Cards (5 cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-2.5">
                  {/* Card 1: Heart Rate & SpO2 */}
                  <div className="rounded-xl border border-border/80 bg-background/70 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-rose-400">
                        <HeartPulse className="h-4 w-4 animate-pulse" />
                        Nhịp Tim & Độ Bão Hòa Oxy (SpO2)
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Thời gian thực</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-card/80 p-2 border border-border/50 text-center">
                        <div className="text-[10px] text-muted-foreground">Nhịp tim (BPM)</div>
                        <div className="text-xl font-black text-rose-500 mt-0.5">
                          {currentPoint?.heartRate || 76}{" "}
                          <span className="text-xs font-normal text-muted-foreground">bpm</span>
                        </div>
                        <div className="text-[9px] font-medium text-amber-400">
                          {currentPoint && currentPoint.heartRate > 130 ? "⚠️ Cực đoan / Shock" : "Bình thường"}
                        </div>
                      </div>

                      <div className="rounded-lg bg-card/80 p-2 border border-border/50 text-center">
                        <div className="text-[10px] text-muted-foreground">Chỉ số SpO2</div>
                        <div className="text-xl font-black text-sky-400 mt-0.5">
                          {currentPoint?.spo2 || 98}{" "}
                          <span className="text-xs font-normal text-muted-foreground">%</span>
                        </div>
                        <div className="text-[9px] font-medium text-emerald-400">
                          {currentPoint && currentPoint.spo2 < 93 ? "⚠️ Tụt Oxy cấp tính" : "Ổn định"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Impact Force & Decibel Sensor Spikes */}
                  <div className="rounded-xl border border-border/80 bg-background/70 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
                        <Zap className="h-4 w-4 text-amber-400" />
                        Gia Tốc Va Đập (G) & Cường Độ Âm Thanh (dB)
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Microphone & IMU</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-card/80 p-2 border border-border/50 text-center">
                        <div className="text-[10px] text-muted-foreground">Lực G-Force</div>
                        <div className="text-xl font-black text-amber-400 mt-0.5">
                          {currentPoint?.gForce || 1.0} <span className="text-xs font-normal text-muted-foreground">g</span>
                        </div>
                        <div className="text-[9px] font-medium text-muted-foreground">
                          {currentPoint && currentPoint.gForce > 3.0 ? "🚨 VA CHẠM MẠNH" : "Dao động bình thường"}
                        </div>
                      </div>

                      <div className="rounded-lg bg-card/80 p-2 border border-border/50 text-center">
                        <div className="text-[10px] text-muted-foreground">Cường độ âm thanh</div>
                        <div className="text-xl font-black text-indigo-400 mt-0.5">
                          {currentPoint?.decibel || 52} <span className="text-xs font-normal text-muted-foreground">dB</span>
                        </div>
                        <div className="text-[9px] font-medium text-muted-foreground">
                          {currentPoint && currentPoint.decibel > 80 ? "🔊 Tiếng la hét / Phanh" : "Tiếng gió đường phố"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Current Moment Callout Banner */}
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-300">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      <span>Sự kiện tại mốc {currentPoint?.timeFormatted}:</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-foreground leading-snug">
                      {currentPoint?.eventLabel || "Nạn nhân đang di chuyển trên lộ trình, các chỉ số duy trì mức giám sát an toàn."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Middle: Interactive Timeline Controller & Scrubber */}
              <div className="rounded-xl border border-border/80 bg-background/90 p-4 shadow-md space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRestart}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                      title="Quay lại từ đầu"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow transition ${
                        isPlaying ? "bg-amber-600 hover:bg-amber-500" : "bg-sky-600 hover:bg-sky-500"
                      }`}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlaying ? "TẠM DỪNG" : "PHÁT LẠI HỘP ĐEN"}
                    </button>

                    {/* Speed Selector */}
                    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs font-bold">
                      {([1, 2, 4] as const).map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setPlaySpeed(spd)}
                          className={`rounded px-2.5 py-1 transition ${
                            playSpeed === spd ? "bg-sky-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Relative Time Display */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      Tiến độ: <strong className="text-foreground">{currentIndex + 1}</strong> / {points.length} điểm
                    </span>
                    <div className="rounded-lg bg-sky-950/40 border border-sky-500/30 px-3 py-1 font-mono text-sm font-black text-sky-400">
                      {currentPoint?.timeFormatted || "T+00:00"}
                    </div>
                  </div>
                </div>

                {/* Range Slider Scrubber */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, points.length - 1)}
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(Number(e.target.value))}
                    className="w-full h-2 rounded-lg bg-secondary cursor-pointer accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                    <span>T-00:45 (Khởi hành)</span>
                    <span className="text-rose-400 font-bold">T-00:00 (Va chạm)</span>
                    <span>T+00:35 (SMS ICE)</span>
                    <span>T+01:00 (Điều phối)</span>
                    <span>T+01:55 (Tiếp cận)</span>
                  </div>
                </div>
              </div>

              {/* Lower Section: Event Milestones Log */}
              <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-sky-400" />
                    Các mốc sự kiện pháp chứng quan trọng (Nhấp để tua tới mốc)
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Tổng cộng: {milestones.length} mốc
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {milestones.map((m, idx) => {
                    const isPassed = currentPoint && currentPoint.timeFormatted >= m.time;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const num = m.time.startsWith("T-") ? -parseInt(m.time.slice(4)) : parseInt(m.time.slice(4));
                          handleJumpToRelSec(num);
                        }}
                        className={`flex flex-col text-left rounded-lg border p-2.5 transition ${
                          isPassed
                            ? "border-sky-500/40 bg-sky-950/20 text-foreground"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:bg-accent/40"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-mono text-xs font-bold text-sky-400">{m.time}</span>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground rounded bg-secondary/50 px-1 py-0.2">
                            {m.category}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-foreground line-clamp-1">{m.title}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
