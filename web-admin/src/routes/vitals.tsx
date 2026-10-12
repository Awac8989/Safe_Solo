import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Flame,
  HeartPulse,
  MapPin,
  Phone,
  Printer,
  QrCode,
  Radio,
  Send,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  Volume2,
  Watch,
  Wifi,
  X,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchMultiVictimVitals, instantDispatchVictim, type MultiVictimVitalsItem } from "@/lib/api";
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
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Instant Triage Dispatch State
  const [selectedDispatchVictim, setSelectedDispatchVictim] = useState<MultiVictimVitalsItem | null>(null);
  const [dispatchAmbulanceUnit, setDispatchAmbulanceUnit] = useState<string>(
    "Kíp Cấp Cứu 115 BV Chợ Rẫy (BS. Trần Anh Tuấn - Xe số 08)"
  );
  const [dispatchTargetSop, setDispatchTargetSop] = useState<string>("P1_CARDIAC_ARREST_AED");
  const [dispatchNotes, setDispatchNotes] = useState<string>(
    "Yêu cầu kíp 115 tiếp cận hiện trường < 8 phút. Hiệp sĩ lân cận hỗ trợ mở tủ AED và ép tim CPR."
  );
  const [dispatchChannels, setDispatchChannels] = useState<string[]>(["TELEGRAM", "SMS", "ZALO"]);
  const [dispatchResult, setDispatchResult] = useState<{
    dispatchId: string;
    dispatchedAt: string;
    telegramStatus: string;
    sbarSummary: string;
  } | null>(null);
  const [copiedSbar, setCopiedSbar] = useState(false);

  // SafeTag NFC / ICE Profile State
  const [selectedIceVictim, setSelectedIceVictim] = useState<MultiVictimVitalsItem | null>(null);

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

  const dispatchMutation = useMutation({
    mutationFn: ({
      incidentId,
      payload,
    }: {
      incidentId: string;
      payload: {
        ambulanceUnit: string;
        dispatchNotes: string;
        targetSop: string;
        broadcastChannels: string[];
      };
    }) => instantDispatchVictim(incidentId, payload),
    onSuccess: (res) => {
      setDispatchResult(res.data);
      setActionNotice(`Đã bắn lệnh điều phối STAT thành công! Mã lệnh: ${res.data.dispatchId}`);
      setTimeout(() => setActionNotice(null), 4000);
      void queryClient.invalidateQueries({ queryKey: ["multi-victim-vitals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  const handleOpenDispatch = (v: MultiVictimVitalsItem) => {
    setSelectedDispatchVictim(v);
    setDispatchResult(null);
    setCopiedSbar(false);
    if (v.vitals.fallDetected) {
      setDispatchTargetSop("P1_TRAUMA_HEMORRHAGE");
      setDispatchNotes("Phát hiện va chạm té ngã gia tốc lớn. Ưu tiên nẹp cổ C-Spine và kiểm soát xuất huyết.");
    } else if (v.vitals.spo2 < 92) {
      setDispatchTargetSop("P1_CARDIAC_ARREST_AED");
      setDispatchNotes("SpO2 tụt nguy hiểm. Điều động máy sốc tim AED và kíp thở oxy cao áp 115.");
    } else {
      setDispatchTargetSop("P1_STROKE_FAST");
      setDispatchNotes("Rung nhĩ kịch phát nghi ngờ biến cố mạch máu não. Kích hoạt quy trình FAST BV Chợ Rẫy.");
    }
  };

  const handleExecuteDispatch = () => {
    if (!selectedDispatchVictim) return;
    dispatchMutation.mutate({
      incidentId: selectedDispatchVictim.incidentId,
      payload: {
        ambulanceUnit: dispatchAmbulanceUnit,
        dispatchNotes,
        targetSop: dispatchTargetSop,
        broadcastChannels: dispatchChannels,
      },
    });
  };

  const handleCopySbar = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedSbar(true);
    setTimeout(() => setCopiedSbar(false), 2500);
  };

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
        {/* Toast Notice */}
        {actionNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            {actionNotice}
          </div>
        )}

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
                  className={`relative rounded-2xl border p-4 shadow-lg transition duration-200 overflow-hidden flex flex-col justify-between ${
                    isP1
                      ? "border-rose-500/50 bg-gradient-to-b from-rose-950/20 to-card shadow-rose-950/20"
                      : isP2
                      ? "border-amber-500/40 bg-gradient-to-b from-amber-950/15 to-card"
                      : "border-border bg-card"
                  }`}
                >
                  <div>
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

                  {/* Operational Action Buttons Bar */}
                  <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenDispatch(v)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition shadow-md ${
                        isP1
                          ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 animate-pulse"
                          : "bg-amber-600/90 hover:bg-amber-500 text-white"
                      }`}
                    >
                      <Siren className="h-3.5 w-3.5" /> Điều Phối STAT
                    </button>
                    <button
                      onClick={() => setSelectedIceVictim(v)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold border border-border bg-background/70 hover:bg-accent text-foreground transition"
                    >
                      <QrCode className="h-3.5 w-3.5 text-sky-400" /> SafeTag NFC / ICE
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal 1: Instant Triage Dispatch Console */}
        {selectedDispatchVictim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-2xl rounded-2xl border border-rose-500/50 bg-[#090d16] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <Siren className="h-5 w-5 animate-pulse" />
                  <h3 className="text-base font-bold uppercase tracking-wider text-white">
                    Lệnh Điều Phối Cấp Cứu STAT (115 TOC)
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDispatchVictim(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Victim Quick Triage Header */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-foreground flex items-center gap-2">
                    {selectedDispatchVictim.victimName}
                    <span className="text-xs font-mono font-normal text-muted-foreground">({selectedDispatchVictim.victimPhone || "ID: " + selectedDispatchVictim.incidentId.slice(0, 8)})</span>
                  </div>
                  <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                    {selectedDispatchVictim.priority}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  {selectedDispatchVictim.address}
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono">
                  <span>SpO2: <strong className="text-rose-400">{selectedDispatchVictim.vitals.spo2}%</strong></span>
                  <span>Nhịp tim: <strong className="text-foreground">{selectedDispatchVictim.vitals.heartRate} BPM</strong></span>
                  <span>Nhóm máu: <strong className="text-sky-400">{selectedDispatchVictim.blood}</strong></span>
                  <span>Té ngã: <strong className="text-amber-400">{selectedDispatchVictim.vitals.fallDetected ? "CÓ" : "Không"}</strong></span>
                </div>
              </div>

              {/* Dispatch Form Controls */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Đơn Vị Cấp Cứu Tiếp Nhận (Ambulance Unit):
                  </label>
                  <select
                    value={dispatchAmbulanceUnit}
                    onChange={(e) => setDispatchAmbulanceUnit(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-rose-500"
                  >
                    <option value="Kíp Cấp Cứu 115 BV Chợ Rẫy (BS. Trần Anh Tuấn - Xe số 08)">
                      Kíp Cấp Cứu 115 BV Chợ Rẫy (BS. Trần Anh Tuấn - Xe số 08 - ETA 6p)
                    </option>
                    <option value="Kíp Cấp Cứu 115 BV Nhân Dân 115 (BS. Lê Minh Hoàng - Xe số 02)">
                      Kíp Cấp Cứu 115 BV Nhân Dân 115 (BS. Lê Minh Hoàng - Xe số 02 - ETA 7p)
                    </option>
                    <option value="Đội Hiệp Sĩ Phản Ứng Nhanh SafeSolo & AED (Trạm An Phú Đông - 350m)">
                      Đội Hiệp Sĩ Phản Ứng Nhanh SafeSolo & AED (Trạm An Phú Đông - 350m - ETA 2p)
                    </option>
                    <option value="Kíp Cấp Cứu Bệnh Viện Đa Khoa Sài Gòn (BS. Nguyễn Thành Long)">
                      Kíp Cấp Cứu Bệnh Viện Đa Khoa Sài Gòn (BS. Nguyễn Thành Long - ETA 9p)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Phác Đồ Can Thiệp STAT (Target SOP):
                  </label>
                  <select
                    value={dispatchTargetSop}
                    onChange={(e) => setDispatchTargetSop(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-rose-500"
                  >
                    <option value="P1_CARDIAC_ARREST_AED">
                      P1: Ngừng tim / Rung thất VF/VT (Kích hoạt máy sốc tim AED + Ép tim CPR 30:2)
                    </option>
                    <option value="P1_STROKE_FAST">
                      P1: Đột quỵ FAST cấp tính (Kích hoạt báo động mạch máu não BV Chợ Rẫy & Tiêu sợi huyết)
                    </option>
                    <option value="P1_TRAUMA_HEMORRHAGE">
                      P1: Chấn thương va chạm té ngã / Sốc mất máu (Garô CAT + Bất động cổ C-Spine)
                    </option>
                    <option value="P2_RESPIRATORY_DISTRESS">
                      P2: Suy hô hấp cấp / Tụt Oxy SpO2 & Hỗ trợ thông khí ngoại viện
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Chỉ Đạo Tác Chiến Từ TOC Điều Phối Viên:
                  </label>
                  <textarea
                    rows={2}
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="Nhập hướng dẫn tiếp cận hiện trường..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Các Kênh Phát Sóng Chỉ Huy Đồng Thời:
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dispatchChannels.includes("TELEGRAM")}
                        onChange={(e) => {
                          if (e.target.checked) setDispatchChannels([...dispatchChannels, "TELEGRAM"]);
                          else setDispatchChannels(dispatchChannels.filter((c) => c !== "TELEGRAM"));
                        }}
                        className="rounded accent-rose-500"
                      />
                      <span className="font-mono text-emerald-400">Telegram Bot (@SFESOLOBot) Live</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dispatchChannels.includes("SMS")}
                        onChange={(e) => {
                          if (e.target.checked) setDispatchChannels([...dispatchChannels, "SMS"]);
                          else setDispatchChannels(dispatchChannels.filter((c) => c !== "SMS"));
                        }}
                        className="rounded accent-rose-500"
                      />
                      <span>SMS Cấp Cứu 115</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dispatchChannels.includes("ZALO")}
                        onChange={(e) => {
                          if (e.target.checked) setDispatchChannels([...dispatchChannels, "ZALO"]);
                          else setDispatchChannels(dispatchChannels.filter((c) => c !== "ZALO"));
                        }}
                        className="rounded accent-rose-500"
                      />
                      <span>Zalo ZNS Hotline</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dispatch Result Card */}
              {dispatchResult && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> ĐÃ PHÁT LỆNH THÀNH CÔNG
                    </span>
                    <span className="font-mono text-[11px]">{dispatchResult.dispatchId}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Kênh Telegram Bot: <strong className="text-foreground">{dispatchResult.telegramStatus}</strong> · Thời điểm: {new Date(dispatchResult.dispatchedAt).toLocaleTimeString("vi-VN")}
                  </p>
                  <div className="rounded-lg bg-black/60 p-2.5 font-mono text-[11px] text-zinc-300 whitespace-pre-line border border-border/40">
                    {dispatchResult.sbarSummary}
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleCopySbar(dispatchResult.sbarSummary)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent transition"
                    >
                      {copiedSbar ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedSbar ? "Đã sao chép SBAR" : "Sao chép bản tin SBAR"}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setSelectedDispatchVictim(null)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent transition"
                >
                  {dispatchResult ? "Đóng" : "Hủy Bỏ"}
                </button>
                {!dispatchResult && (
                  <button
                    type="button"
                    disabled={dispatchMutation.isPending}
                    onClick={handleExecuteDispatch}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/60 transition disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {dispatchMutation.isPending ? "Đang Bắn Lệnh..." : "BẮN LỆNH ĐIỀU PHỐI STAT"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: SafeTag NFC & ICE Profile Dossier */}
        {selectedIceVictim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-xl rounded-2xl border border-sky-500/40 bg-[#090d16] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-sky-400">
                  <ShieldCheck className="h-5 w-5" />
                  <h3 className="text-base font-bold uppercase tracking-wider text-white">
                    Hồ Sơ Y Tế Khẩn Cấp SafeTag™ (ICE & NFC)
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedIceVictim(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* High-Tech NFC ICE Card Component */}
              <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 via-card to-background p-5 shadow-xl space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
                      <Radio className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">{selectedIceVictim.victimName}</h4>
                      <p className="text-[11px] font-mono text-sky-400">
                        {selectedIceVictim.iceProfile?.safeTagNfcId || "STAG-" + selectedIceVictim.incidentId.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded-lg bg-rose-600/30 border border-rose-500/50 px-2.5 py-1 text-sm font-black font-mono text-rose-400">
                      MÁU: {selectedIceVictim.iceProfile?.bloodGroup || selectedIceVictim.blood || "O+"}
                    </span>
                    <p className="text-[9px] text-muted-foreground mt-1 font-mono">ISO/IEC 14443 Type A</p>
                  </div>
                </div>

                {/* Identification & Insurance */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-background/60 p-2.5 border border-border/60">
                    <div className="text-[10px] text-muted-foreground">Mã CCCD / VNeID</div>
                    <div className="font-mono font-bold text-foreground mt-0.5">
                      {selectedIceVictim.iceProfile?.cccdNumber || "079201088992"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-background/60 p-2.5 border border-border/60">
                    <div className="text-[10px] text-muted-foreground">Thẻ Bảo Hiểm Y Tế</div>
                    <div className="font-mono font-bold text-sky-400 mt-0.5">
                      {selectedIceVictim.iceProfile?.bhytNumber || "GD479028839210"}
                    </div>
                  </div>
                </div>

                {/* Critical Medical Warnings */}
                <div className="space-y-2 text-xs">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5">
                    <div className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Cảnh Báo Dị Ứng Thuốc (Allergies):
                    </div>
                    <p className="text-[11px] text-foreground font-semibold mt-0.5">
                      {selectedIceVictim.iceProfile?.allergies || "Dị ứng Penicillin, NSAID (Aspirin)"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5">
                    <div className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                      <HeartPulse className="h-3 w-3" /> Tiền Sử Bệnh Nền (Chronic Conditions):
                    </div>
                    <p className="text-[11px] text-foreground font-semibold mt-0.5">
                      {selectedIceVictim.iceProfile?.chronicDiseases || "Rung nhĩ kịch phát (AFib), Tăng huyết áp độ II"}
                    </p>
                  </div>
                </div>

                {/* Guardians Contacts (ICE) */}
                <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-2 text-xs">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">
                    Người Giám Hộ Khẩn Cấp (In Case of Emergency - ICE)
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-foreground">
                        {selectedIceVictim.iceProfile?.primaryGuardian.name || "Nguyễn Thị Kim Loan"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {selectedIceVictim.iceProfile?.primaryGuardian.relation || "Vợ / Chồng"} · {selectedIceVictim.iceProfile?.primaryGuardian.phone || "0908123456"}
                      </div>
                    </div>
                    <a
                      href={`tel:${selectedIceVictim.iceProfile?.primaryGuardian.phone || "0908123456"}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition shadow"
                    >
                      <Phone className="h-3 w-3" /> Gọi ICE
                    </a>
                  </div>
                </div>

                {/* Simulated QR Code for On-scene Responders */}
                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 rounded-lg bg-white p-1 flex items-center justify-center">
                      <QrCode className="h-10 w-10 text-black" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground">Quét mã bằng Camera/NFC</div>
                      <div className="text-[11px] font-semibold text-foreground">Truy cập hồ sơ cấp cứu ngoại viện 115</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">SafeSolo Verified</span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
                >
                  <Printer className="h-3.5 w-3.5" /> In Thẻ Y Tế A4 / Khổ ATM
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIceVictim(null)}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
