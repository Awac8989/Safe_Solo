import { useEffect, useRef, useState } from "react";
import { Activity, BatteryCharging, HeartPulse, ShieldAlert, Watch, Wifi } from "lucide-react";

interface LiveVitalsTelemetryProps {
  heartRate?: number;
  spo2?: number;
  hrvRmssd?: number;
  strokeRisk?: string;
  battery?: number;
  device?: string;
  isAlert?: boolean;
}

export function LiveVitalsTelemetry({
  heartRate = 124,
  spo2 = 91,
  hrvRmssd = 18,
  strokeRisk = "NGUY CƠ CAO (Rung nhĩ AFib)",
  battery = 78,
  device = "Samsung Galaxy Watch 5 (WearOS)",
  isAlert = true,
}: LiveVitalsTelemetryProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [liveBpm, setLiveBpm] = useState(heartRate);

  // Micro-fluctuation to give realistic life to heart rate display
  useEffect(() => {
    const interval = setInterval(() => {
      const delta = Math.floor(Math.random() * 5) - 2;
      setLiveBpm(Math.max(40, Math.min(180, heartRate + delta)));
    }, 2000);
    return () => clearInterval(interval);
  }, [heartRate]);

  // Real-time animated ECG pulse wave on HTML5 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // Buffer to hold wave history
    const points: number[] = new Array(width).fill(midY);
    let step = 0;

    const render = () => {
      step++;
      // Determine height of QRS complex depending on BPM
      let y = midY;
      const beatCycle = Math.max(15, Math.round(3600 / liveBpm)); // cycle length based on BPM
      const pos = step % beatCycle;

      if (pos === 2) {
        y = midY - 6; // P wave
      } else if (pos === 4) {
        y = midY + 4; // Q dip
      } else if (pos === 5) {
        y = midY - (isAlert ? 28 : 20); // R peak
      } else if (pos === 6) {
        y = midY + 12; // S dip
      } else if (pos === 9) {
        y = midY - 8; // T wave
      } else {
        // slight baseline tremor
        y = midY + (Math.random() * 2 - 1);
      }

      points[x] = y;
      x = (x + 1) % width;

      // Draw ECG Monitor Grid
      ctx.fillStyle = "rgba(10, 15, 29, 0.25)";
      ctx.fillRect(0, 0, width, height);

      // Grid lines
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

      // Draw ECG wave
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isAlert ? "#f43f5e" : "#10b981"; // rose for warning/critical, emerald for normal
      ctx.shadowColor = isAlert ? "#f43f5e" : "#10b981";
      ctx.shadowBlur = 6;

      for (let i = 0; i < width; i++) {
        const idx = (x + i) % width;
        const py = points[idx];
        if (i === 0) {
          ctx.moveTo(i, py);
        } else {
          ctx.lineTo(i, py);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw leading sweep head cursor
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(x, points[x], 3, 0, Math.PI * 2);
      ctx.fill();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [liveBpm, isAlert]);

  const isCriticalSpo2 = spo2 < 92;
  const isHighRisk = strokeRisk.includes("CAO") || strokeRisk.includes("AFib");

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
                <Wifi className="h-2.5 w-2.5" /> 4G LTE Live
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Đồng bộ PPG Sensor thời gian thực (WearOS Direct Stream)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" /> {battery}%
          </span>
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 animate-pulse">
            ICU MONITOR ACTIVE
          </span>
        </div>
      </div>

      {/* 2. Waveform Canvas & Live Metrics Display */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* Animated ECG Waveform */}
        <div className="relative overflow-hidden rounded-lg border border-sky-500/20 bg-[#070b14] p-2">
          <div className="absolute left-2.5 top-2 z-10 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold tracking-wider text-sky-400">
              <Activity className="h-3 w-3 animate-pulse text-sky-400" /> ECG LEAD II (PPG)
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">25mm/s · 10mm/mV</span>
          </div>

          <canvas ref={canvasRef} width={340} height={100} className="w-full h-[100px] block" />

          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
            <span>HRV RMSSD: <strong className="text-sky-400">{hrvRmssd} ms</strong></span>
            <span>Rung nhĩ: <strong className={isHighRisk ? "text-rose-400" : "text-emerald-400"}>{isHighRisk ? "PHÁT HIỆN" : "ÂM TÍNH"}</strong></span>
          </div>
        </div>

        {/* Vital Gauges */}
        <div className="grid grid-cols-2 gap-2">
          {/* Nhịp tim BPM */}
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

          {/* Nồng độ Oxy SpO2 */}
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
