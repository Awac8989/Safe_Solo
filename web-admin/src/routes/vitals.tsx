import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Download,
  Flame,
  HeartPulse,
  MapPin,
  Phone,
  Radio,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Volume2,
  Watch,
  Wifi,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchMultiVictimVitals, type MultiVictimVitalsItem } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/vitals")({
  head: () => ({ meta: [{ title: "Bảng Vitals Đa Nạn Nhân - SafeSolo Admin" }] }),
  component: MultiVictimVitalsPage,
});

// Mini real-time ECG wave canvas component for each card
function MiniEcgCanvas({ bpm = 80, isCritical = false }: { bpm: number; isCritical: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;
    const points: number[] = new Array(width).fill(midY);
    let step = 0;

    const render = () => {
      step++;
      const beatCycle = Math.max(12, Math.round(3200 / bpm));
      const pos = step % beatCycle;
      let y = midY;

      if (pos === 2) y = midY - 4; // P wave
      else if (pos === 4) y = midY + 3; // Q
      else if (pos === 5) y = midY - (isCritical ? 24 : 16); // R
      else if (pos === 6) y = midY + 9; // S
      else if (pos === 9) y = midY - 6; // T
      else y = midY + (Math.random() * 1.5 - 0.75);

      points[x] = y;
      x = (x + 1) % width;

      ctx.fillStyle = "rgba(9, 14, 26, 0.35)";
      ctx.fillRect(0, 0, width, height);

      // wave
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isCritical ? "#f43f5e" : "#10b981";

      for (let i = 0; i < width; i++) {
        const idx = (x + i) % width;
        const py = points[idx];
        if (i === 0) ctx.moveTo(i, py);
        else ctx.lineTo(i, py);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [bpm, isCritical]);

  return <canvas ref={canvasRef} width={280} height={60} className="w-full h-14 rounded-lg bg-[#070b14]" />;
}

function MultiVictimVitalsPage() {
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  const vitalsQuery = useQuery({
    queryKey: ["multi-victim-vitals"],
    queryFn: fetchMultiVictimVitals,
    refetchInterval: 6000,
  });

  const victims = vitalsQuery.data?.data ?? [];

  const filtered = victims.filter((v) => {
    if (priorityFilter === "ALL") return true;
    return v.priority === priorityFilter;
  });

  const criticalCount = victims.filter((v) => v.priority === "P1_CRITICAL").length;
  const urgentCount = victims.filter((v) => v.priority === "P2_URGENT").length;
  const monitoringCount = victims.filter((v) => v.priority === "P3_MONITORING").length;

  const handleExport = () => {
    exportWorkbook("safesolo-vitals-telemetry.xlsx", [
      {
        name: "Sinh tồn đa nạn nhân",
        rows: victims.map((v) => ({
          "Mã sự cố": v.incidentId,
          "Họ tên": v.victimName,
          SĐT: v.victimPhone,
          "Mức độ ưu tiên": v.priority,
          "Nhịp tim (BPM)": v.vitals.heartRate,
          "SpO2 (%)": v.vitals.spo2,
          "HRV RMSSD (ms)": v.vitals.hrvRmssd,
          "Nguy cơ Đột quỵ": v.vitals.strokeRisk,
          "Té ngã": v.vitals.fallDetected ? "CÓ PHÁT HIỆN" : "Không",
          "Thiết bị đeo": v.vitals.device,
          "Pin (%)": v.vitals.battery,
          "Địa chỉ": v.address,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar title="Bảng Sinh Tồn Đa Nạn Nhân (Multi-Victim Telemetry Grid)" subtitle="Giám sát y tế khẩn cấp theo thời gian thực qua WearOS & 4G eSIM" />
      <div className="space-y-4 p-4 pb-16">
        {/* 1. Header Triage Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              TRUNG TÂM PHÂN LOẠI Y TẾ (TRIAGE INTENSIVE CARE)
            </span>
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground font-mono">Đồng bộ: 6 giây/lần</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPriorityFilter("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                priorityFilter === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              Tất cả ({victims.length})
            </button>
            <button
              onClick={() => setPriorityFilter("P1_CRITICAL")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                priorityFilter === "P1_CRITICAL"
                  ? "bg-rose-600 text-white font-bold"
                  : "text-rose-400 bg-rose-950/20 hover:bg-rose-950/40"
              }`}
            >
              <Flame className="h-3 w-3" /> P1 Nguy Kịch ({criticalCount})
            </button>
            <button
              onClick={() => setPriorityFilter("P2_URGENT")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                priorityFilter === "P2_URGENT"
                  ? "bg-amber-600 text-white font-bold"
                  : "text-amber-400 bg-amber-950/20 hover:bg-amber-950/40"
              }`}
            >
              P2 Khẩn Cấp ({urgentCount})
            </button>
            <button
              onClick={() => setPriorityFilter("P3_MONITORING")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                priorityFilter === "P3_MONITORING"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-sky-400 bg-sky-950/20 hover:bg-sky-950/40"
              }`}
            >
              P3 Giám Sát ({monitoringCount})
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-accent transition"
            >
              <Download className="h-3 w-3" /> Xuất Excel
            </button>
          </div>
        </div>

        {/* 2. Victims Vitals Grid */}
        {vitalsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Đang kết nối tín hiệu sinh tồn từ đồng hồ thông minh WearOS...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
            <Stethoscope className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-semibold">Hiện không có ca sự cố nào trong bộ lọc này</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => {
              const isP1 = v.priority === "P1_CRITICAL";
              const isP2 = v.priority === "P2_URGENT";

              return (
                <div
                  key={v.incidentId}
                  className={`relative rounded-2xl border p-4 shadow-lg transition duration-200 overflow-hidden ${
                    isP1
                      ? "border-rose-500/50 bg-gradient-to-b from-rose-950/20 to-card"
                      : isP2
                      ? "border-amber-500/40 bg-gradient-to-b from-amber-950/15 to-card"
                      : "border-border bg-card"
                  }`}
                >
                  {/* Priority Strip */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          isP1 ? "bg-rose-600 text-white animate-pulse" : "bg-sky-600/20 text-sky-400"
                        }`}
                      >
                        <HeartPulse className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">{v.victimName}</h4>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {v.victimPhone || "ID: " + v.incidentId.slice(0, 8)} · Nhóm máu: <strong className="text-foreground">{v.blood}</strong>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider ${
                        isP1
                          ? "bg-rose-500/25 text-rose-400 border border-rose-500/40 animate-pulse"
                          : isP2
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-sky-500/15 text-sky-400 border border-sky-500/25"
                      }`}
                    >
                      {v.priority}
                    </span>
                  </div>

                  {/* Real-time ECG Wave */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Activity className="h-3 w-3" /> ECG Lead II (Real-time)
                      </span>
                      <span>16-bit 250Hz</span>
                    </div>
                    <MiniEcgCanvas bpm={v.vitals.heartRate} isCritical={isP1} />
                  </div>

                  {/* 4 Primary Biometric Readouts */}
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl border border-border/60 bg-background/60 p-2">
                      <div className="text-[10px] text-muted-foreground">Nhịp tim</div>
                      <div className={`text-base font-bold font-mono ${isP1 ? "text-rose-400" : "text-foreground"}`}>
                        {v.vitals.heartRate}
                      </div>
                      <div className="text-[9px] text-muted-foreground">BPM</div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/60 p-2">
                      <div className="text-[10px] text-muted-foreground">SpO2</div>
                      <div className={`text-base font-bold font-mono ${v.vitals.spo2 < 92 ? "text-rose-400 font-extrabold" : "text-foreground"}`}>
                        {v.vitals.spo2}%
                      </div>
                      <div className="text-[9px] text-muted-foreground">Oxy máu</div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/60 p-2">
                      <div className="text-[10px] text-muted-foreground">HRV RMSSD</div>
                      <div className={`text-base font-bold font-mono ${v.vitals.hrvRmssd < 20 ? "text-amber-400" : "text-foreground"}`}>
                        {v.vitals.hrvRmssd}
                      </div>
                      <div className="text-[9px] text-muted-foreground">ms</div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-background/60 p-2">
                      <div className="text-[10px] text-muted-foreground">Pin Watch</div>
                      <div className="text-base font-bold font-mono text-foreground flex items-center justify-center gap-0.5">
                        <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                        {v.vitals.battery}%
                      </div>
                      <div className="text-[9px] text-muted-foreground">Galaxy Watch</div>
                    </div>
                  </div>

                  {/* Stroke & Fall Warning Flags */}
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-sky-400" /> Nguy cơ Đột quỵ / AFib:
                      </span>
                      <strong className={`text-[11px] ${isP1 ? "text-rose-400 font-bold" : "text-foreground"}`}>
                        {v.vitals.strokeRisk}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-400" /> Trạng thái té ngã (G-Sensor):
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          v.vitals.fallDetected ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "text-muted-foreground"
                        }`}
                      >
                        {v.vitals.fallDetected ? "CẢNH BÁO TÉ NGÃ CHẤN THƯƠNG" : "Không phát hiện va chạm"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate pt-1">
                      <MapPin className="h-3 w-3 text-rose-400 shrink-0" />
                      <span className="truncate">{v.address}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
