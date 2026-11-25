import { useEffect, useRef, useState } from "react";
import { Activity, BatteryCharging, HeartPulse, ShieldAlert, ShieldCheck, Watch, Wifi } from "lucide-react";

interface WatchFusionMeta {
  phase?: string;
  peakSvmG?: number;
  stillnessRatio?: number;
  isOffWrist?: boolean;
  ppgAnomalyReason?: string;
  confidence?: number;
  falseAlarmsBlockedCount?: number;
  rejectedReason?: string;
}

interface LiveVitalsTelemetryProps {
  heartRate?: number;
  spo2?: number;
  hrvRmssd?: number;
  strokeRisk?: string;
  battery?: number;
  device?: string;
  isAlert?: boolean;
  svmG?: number;
  isOffWrist?: boolean;
  gForceWaveform?: number[];
  ppgWaveform?: number[];
  fusion?: WatchFusionMeta | null;
}

export function LiveVitalsTelemetry({
  heartRate = 124,
  spo2 = 91,
  hrvRmssd = 18,
  strokeRisk = "NGUY CƠ CAO (Rung nhĩ AFib)",
  battery = 78,
  device = "Samsung Galaxy Watch 5 (WearOS)",
  isAlert = true,
  svmG = 1.0,
  isOffWrist = false,
  gForceWaveform,
  ppgWaveform,
  fusion,
}: LiveVitalsTelemetryProps) {
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gForceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [liveBpm, setLiveBpm] = useState(heartRate);

  useEffect(() => {
    setLiveBpm(heartRate);
    const interval = setInterval(() => {
      const delta = Math.floor(Math.random() * 5) - 2;
      setLiveBpm(Math.max(40, Math.min(180, heartRate + delta)));
    }, 2000);
    return () => clearInterval(interval);
  }, [heartRate]);

  // Real-time PPG / ECG waveform canvas (integrates real hardware ppgWaveform samples when streamed)
  useEffect(() => {
    const canvas = ecgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;
    const points: number[] = new Array(width).fill(midY);
    const realPpg = Array.isArray(ppgWaveform) && ppgWaveform.length > 0 ? ppgWaveform : null;
    let step = 0;

    const render = () => {
      step++;
      let y = midY;
      if (realPpg && step % 3 === 0) {
        const sample = realPpg[Math.floor(step / 3) % realPpg.length] ?? 0.2;
        y = midY + 18 - sample * (isAlert ? 44 : 34);
      } else {
        const beatCycle = Math.max(15, Math.round(3600 / liveBpm));
        const pos = step % beatCycle;
        if (pos === 2) y = midY - 6;
        else if (pos === 4) y = midY + 4;
        else if (pos === 5) y = midY - (isAlert ? 28 : 20);
        else if (pos === 6) y = midY + 12;
        else if (pos === 9) y = midY - 8;
        else y = midY + (Math.random() * 2 - 1);
      }

      points[x] = y;
      x = (x + 1) % width;

      ctx.fillStyle = "rgba(10, 15, 29, 0.25)";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(14, 165, 233, 0.08)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 15) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isAlert ? "#f43f5e" : "#10b981";
      ctx.shadowColor = isAlert ? "#f43f5e" : "#10b981";
      ctx.shadowBlur = 6;

      for (let i = 0; i < width; i++) {
        const idx = (x + i) % width;
        const py = points[idx];
        if (i === 0) ctx.moveTo(i, py);
        else ctx.lineTo(i, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(x, points[x], 3, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [liveBpm, isAlert, ppgWaveform]);

  // Real-time 3-Axis IMU G-Force SVM Waveform + 2.5G Impact Threshold Canvas
  useEffect(() => {
    const canvas = gForceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const samples =
      Array.isArray(gForceWaveform) && gForceWaveform.length > 1
        ? gForceWaveform
        : [1.0, 1.01, 0.99, 1.02, Number((svmG ?? 1.0).toFixed(2)), 1.01, 0.99, 1.0];

    const maxG = Math.max(4.5, ...samples, svmG ?? 1.0);
    const toY = (g: number) => height - 8 - ((Math.min(maxG, Math.max(0, g)) / maxG) * (height - 16));

    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, width, height);

    // 1.0G calm band
    const y1g = toY(1.0);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y1g);
    ctx.lineTo(width, y1g);
    ctx.stroke();

    // 2.5G Impact threshold dashed line
    const y25g = toY(2.5);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.75)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, y25g);
    ctx.lineTo(width, y25g);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#fda4af";
    ctx.font = "9px monospace";
    ctx.fillText("2.5G IMPACT", 6, Math.max(10, y25g - 3));

    // Plot G-force trace
    ctx.beginPath();
    ctx.lineWidth = 2;
    const hasImpact = Math.max(...samples, svmG ?? 1.0) >= 2.5;
    ctx.strokeStyle = hasImpact ? "#f59e0b" : "#38bdf8";
    samples.forEach((g, idx) => {
      const px = (idx / Math.max(1, samples.length - 1)) * (width - 12) + 6;
      const py = toY(g);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Peak markers >= 2.5G
    samples.forEach((g, idx) => {
      if (g >= 2.5) {
        const px = (idx / Math.max(1, samples.length - 1)) * (width - 12) + 6;
        const py = toY(g);
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [gForceWaveform, svmG]);

  const isCriticalSpo2 = spo2 < 92;
  const isHighRisk = strokeRisk.includes("CAO") || strokeRisk.includes("AFib");
  const effectivePeakG = Number((fusion?.peakSvmG ?? svmG ?? 1.0).toFixed(2));
  const fusionPhase = fusion?.phase ?? (effectivePeakG >= 2.5 ? "PPG_AND_COUNTDOWN" : "IDLE_MONITORING");
  const blockedCount = fusion?.falseAlarmsBlockedCount ?? 0;

  return (
    <div className="rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-md backdrop-blur">
      {/* 1. Header: WearOS Telemetry & Hardware Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
            <Watch className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <span>{device}</span>
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-400">
                <Wifi className="h-2.5 w-2.5" /> Wear BT + Relay
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">PPG + IMU G-Force & Bộ lọc Fusion 3 pha thời gian thực</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" /> {battery}%
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isOffWrist
              ? "bg-amber-500/20 text-amber-300"
              : "bg-rose-500/20 text-rose-400 animate-pulse"
          }`}>
            {isOffWrist ? "THÁO TAY · OFF-BODY" : "ON-WRIST · ICU ACTIVE"}
          </span>
        </div>
      </div>

      {/* 2. Waveform Canvas & Live Metrics Display */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Animated PPG/ECG Waveform */}
        <div className="relative overflow-hidden rounded-lg border border-sky-500/20 bg-[#070b14] p-2">
          <div className="absolute left-2.5 top-2 z-10 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-wider text-sky-400">
              <Activity className="h-3 w-3 animate-pulse text-sky-400" /> SÓNG XUNG PPG / ECG LEAD II
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {Array.isArray(ppgWaveform) && ppgWaveform.length > 0 ? "LIVE STREAM" : "25mm/s"}
            </span>
          </div>

          <canvas ref={ecgCanvasRef} width={340} height={88} className="w-full h-[88px] block" />

          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
            <span>HRV RMSSD: <strong className="text-sky-400">{hrvRmssd} ms</strong></span>
            <span>Rung nhĩ: <strong className={isHighRisk ? "text-rose-400" : "text-emerald-400"}>{isHighRisk ? "PHÁT HIỆN" : "ÂM TÍNH"}</strong></span>
          </div>
        </div>

        {/* Vital Gauges */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col justify-between rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-400">
              <HeartPulse className="h-3.5 w-3.5 animate-pulse" /> NHỊP TIM (BPM)
            </div>
            <div className="my-1 text-2xl font-black font-mono text-rose-400 tracking-tight">
              {liveBpm}
            </div>
            <div className="text-[10px] text-rose-300/80 font-medium">
              {liveBpm > 100 ? "Nhịp nhanh kịch phát" : liveBpm < 60 ? "Nhịp chậm" : "Bình thường"}
            </div>
          </div>

          <div className={`flex flex-col justify-between rounded-lg border p-2.5 text-center ${
            isCriticalSpo2
              ? "border-rose-500/40 bg-rose-950/30 text-rose-400"
              : "border-sky-500/30 bg-sky-950/20 text-sky-400"
          }`}>
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
              NỒNG ĐỘ SpO2
            </div>
            <div className={`my-1 text-2xl font-black font-mono tracking-tight ${isCriticalSpo2 ? "text-rose-400 animate-pulse" : "text-sky-300"}`}>
              {spo2}%
            </div>
            <div className="text-[10px] font-medium">
              {isCriticalSpo2 ? "Thiếu oxy cấp (<92%)" : "Độ bão hòa tốt"}
            </div>
          </div>
        </div>
      </div>

      {/* 2.5. IMU G-Force 3-Phase Sensor Fusion Waveform */}
      <div className="mt-2.5 rounded-lg border border-amber-500/25 bg-[#070b14] p-2.5 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
          <span className="font-bold text-amber-300 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            G-FORCE IMU SVM &amp; BỘ LỌC FUSION 3 PHA
          </span>
          <span className="text-muted-foreground">
            Peak: <strong className={effectivePeakG >= 2.5 ? "text-rose-400" : "text-emerald-400"}>{effectivePeakG}G</strong>
            {" · "}Pha: <strong className="text-sky-300">{fusionPhase}</strong>
            {" · "}Chặn báo giả: <strong className="text-emerald-400">{blockedCount}</strong>
          </span>
        </div>

        <canvas ref={gForceCanvasRef} width={520} height={64} className="w-full h-[64px] block rounded" />

        <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono">
          <div className={`rounded px-1.5 py-1 border ${effectivePeakG >= 2.5 ? "border-rose-500/40 bg-rose-500/15 text-rose-300" : "border-border/50 bg-background/40 text-muted-foreground"}`}>
            Pha 1: IMU ≥ 2.5G ({effectivePeakG}G)
          </div>
          <div className={`rounded px-1.5 py-1 border ${!isOffWrist ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/15 text-amber-300"}`}>
            Pha 2: {isOffWrist ? "THÁO TAY (Bỏ qua)" : "Đeo tay + Bất động 4s"}
          </div>
          <div className="rounded px-1.5 py-1 border border-sky-500/35 bg-sky-500/10 text-sky-300 truncate">
            Pha 3: PPG + 15s hủy
          </div>
        </div>
        {fusion?.rejectedReason && (
          <div className="text-[10px] text-amber-300 font-medium">
            Anti-False-Alarm: {fusion.rejectedReason}
          </div>
        )}
      </div>

      {/* 3. Clinical Warning Banner */}
      {isHighRisk && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 animate-bounce" />
          <div className="leading-snug">
            <strong className="text-rose-400">CHẨN ĐOÁN LÂM SÀNG TỰ ĐỘNG: </strong>
            <span>{strokeRisk}. Cần ưu tiên mở đường thở, duy trì tư thế nằm nghiêng an toàn và gọi 115 ngay.</span>
          </div>
        </div>
      )}
    </div>
  );
}
