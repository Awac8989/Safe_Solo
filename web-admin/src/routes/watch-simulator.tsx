import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Watch,
  Activity,
  Heart,
  Flame,
  Footprints,
  BatteryCharging,
  AlertTriangle,
  Radio,
  Send,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchAdminUsers, sendDeviceSignal, type AdminUser } from "@/lib/api";

export const Route = createFileRoute("/watch-simulator")({
  head: () => ({
    meta: [{ title: "Giả lập Samsung Galaxy Watch 5 - SafeSolo Admin" }],
  }),
  component: WatchSimulatorPage,
});

type TelemetryLog = {
  id: string;
  time: string;
  signalType: string;
  payload: Record<string, unknown>;
  action: string;
  success: boolean;
};

export function WatchSimulatorPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [spO2, setSpO2] = useState<number>(98);
  const [heartRate, setHeartRate] = useState<number>(78);
  const [steps, setSteps] = useState<number>(3420);
  const [battery, setBattery] = useState<number>(85);
  const [isOffWrist, setIsOffWrist] = useState<boolean>(false);
  const [time, setTime] = useState<Date>(new Date());
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLog[]>([]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });

  const users: AdminUser[] = usersQuery.data?.data ?? [];

  // Auto-select first user if none selected
  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [selectedUserId, users]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId]
  );

  const calories = Math.round(steps * 0.04);
  const distanceKm = (steps * 0.00075).toFixed(2);

  // Send signal handler
  const triggerSignal = async (signalType: string, customPayload?: Record<string, unknown>) => {
    if (!selectedUserId) {
      alert("Vui lòng chọn một người dùng để gắn thiết bị giả lập!");
      return;
    }

    setIsTransmitting(true);
    const now = new Date();
    const payload = customPayload || {
      spO2,
      heartRate,
      steps,
      calories,
      distanceKm: parseFloat(distanceKm),
      battery,
      isOffWrist,
      watchModel: "Samsung Galaxy Watch 5 (WearOS 4.0)",
      sensorType: "BioActive Sensor (PPG + BIA + ECG)",
      timestamp: now.toISOString(),
    };

    try {
      const res = await sendDeviceSignal(selectedUserId, signalType, payload);
      const newLog: TelemetryLog = {
        id: Math.random().toString(36).substring(2, 9),
        time: now.toLocaleTimeString("vi-VN"),
        signalType,
        payload,
        action: res.action || "RECORDED",
        success: true,
      };
      setTelemetryLogs((prev) => [newLog, ...prev.slice(0, 49)]);

      if (res.action === "SOS_TRIGGERED" || signalType.includes("SOS") || signalType.includes("FALL")) {
        setActiveAlert(`Đã kích hoạt cấp cứu khẩn cấp qua ${signalType}!`);
        setTimeout(() => setActiveAlert(null), 8000);
      }
    } catch (err: any) {
      const errLog: TelemetryLog = {
        id: Math.random().toString(36).substring(2, 9),
        time: now.toLocaleTimeString("vi-VN"),
        signalType,
        payload,
        action: err?.message || "ERROR",
        success: false,
      };
      setTelemetryLogs((prev) => [errLog, ...prev.slice(0, 49)]);
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleHardFall = () => {
    triggerSignal("WATCH_FALL_DETECTED", {
      spO2,
      heartRate: Math.max(heartRate, 115),
      steps,
      battery,
      gForce: 4.8,
      accVector: { x: 0.8, y: 3.9, z: 2.7 },
      impactConfidence: 0.94,
      watchModel: "Samsung Galaxy Watch 5",
      sensor: "Tri-axis MEMS Accelerometer & Gyroscope",
    });
  };

  const handleHardwareSos = () => {
    triggerSignal("WATCH_EMERGENCY_SOS", {
      spO2,
      heartRate,
      steps,
      battery,
      triggerReason: "HARDWARE_KEY_HOLD_3SEC",
      watchModel: "Samsung Galaxy Watch 5",
    });
  };

  const handleCriticalSpO2 = () => {
    setSpO2(84);
    setHeartRate(128);
    triggerSignal("WATCH_CRITICAL_SPO2", {
      spO2: 84,
      heartRate: 128,
      steps,
      battery,
      warningLevel: "HYPOXIA_CRITICAL",
      threshold: "<90%",
      watchModel: "Samsung Galaxy Watch 5 (BioActive Sensor)",
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar
        title="Phần mềm Giả lập Samsung Galaxy Watch 5 (WearOS)"
        subtitle="Liên kết cảm biến BioActive 3-trong-1, con quay hồi chuyển MEMS và truyền dữ liệu thời gian thực"
      />

      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        {/* Banner Alert */}
        {activeAlert && (
          <div className="flex items-center justify-between rounded-xl border border-destructive/50 bg-destructive/15 p-4 text-destructive shadow-lg animate-bounce">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-destructive animate-pulse" />
              <div>
                <h4 className="font-bold text-sm">CẢNH BÁO KHẨN CẤP ĐÃ ĐƯỢC GỬI LÊN HỆ THỐNG!</h4>
                <p className="text-xs">{activeAlert}</p>
              </div>
            </div>
            <Link
              to="/"
              className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 flex items-center gap-1.5"
            >
              <span>Xem trên Live Map</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: REALISTIC GALAXY WATCH 5 AMOLED FACE */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl border border-border bg-card/60 backdrop-blur shadow-xl relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between w-full mb-4">
              <div className="flex items-center gap-2">
                <Watch className="h-5 w-5 text-sky-400" />
                <span className="font-semibold text-sm tracking-wide">Samsung Galaxy Watch 5 (44mm)</span>
              </div>
              <Tag tone={isOffWrist ? "warning" : "success"}>
                {isOffWrist ? "Đã tháo đồng hồ" : "Đang đeo trên tay"}
              </Tag>
            </div>

            {/* WATCH HARDWARE HOUSING & DISPLAY */}
            <div className="relative my-4 flex items-center justify-center">
              {/* Hardware buttons on right side */}
              <button
                onClick={handleHardFall}
                title="Bấm mô phỏng ngã"
                className="absolute -right-4 top-20 w-3 h-10 bg-gradient-to-r from-zinc-700 to-zinc-600 rounded-r-md border-r border-y border-zinc-500 hover:w-3.5 transition-all cursor-pointer shadow-md flex items-center justify-center"
              >
                <div className="w-1 h-6 bg-red-500 rounded-full" />
              </button>
              <button
                onClick={handleHardwareSos}
                title="Giữ nút SOS cứng 3s"
                className="absolute -right-4 bottom-20 w-3 h-10 bg-gradient-to-r from-zinc-700 to-zinc-600 rounded-r-md border-r border-y border-zinc-500 hover:w-3.5 transition-all cursor-pointer shadow-md flex items-center justify-center"
              >
                <div className="w-1 h-6 bg-amber-400 rounded-full" />
              </button>

              {/* Outer Titanium Bezel */}
              <div className="w-80 h-80 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-3.5 shadow-2xl border-4 border-zinc-700/80 flex items-center justify-center relative">
                {/* Sapphire Glass Ring */}
                <div className="w-full h-full rounded-full bg-black p-4 flex flex-col items-center justify-between border-2 border-zinc-800 relative overflow-hidden text-white select-none">
                  
                  {/* Top Watch Status Bar */}
                  <div className="flex items-center justify-between w-full px-6 pt-2 text-[11px] text-zinc-400 font-medium">
                    <div className="flex items-center gap-1">
                      <BatteryCharging className={`h-3.5 w-3.5 ${battery <= 20 ? 'text-rose-400' : 'text-emerald-400'}`} />
                      <span>{battery}%</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-sky-400 font-bold">WearOS 4.0</span>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>LIVE</span>
                    </div>
                  </div>

                  {/* Center Digital Face */}
                  <div className="flex flex-col items-center text-center my-auto">
                    <div className="text-4xl font-extrabold tracking-tight font-mono text-white">
                      {time.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                    <div className="text-xs text-zinc-400 font-medium mt-0.5">
                      {time.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </div>

                    {/* BioActive Vitals Row */}
                    <div className="grid grid-cols-2 gap-3 mt-3 w-48 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                      {/* SpO2 */}
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 text-[11px] text-sky-400 font-semibold">
                          <Activity className="h-3 w-3" />
                          <span>SpO2</span>
                        </div>
                        <div className={`text-lg font-bold font-mono ${spO2 < 90 ? 'text-rose-500 animate-pulse' : spO2 < 95 ? 'text-amber-400' : 'text-sky-300'}`}>
                          {spO2}%
                        </div>
                        <div className="text-[9px] text-zinc-400">
                          {spO2 < 90 ? 'Nguy cấp' : spO2 < 95 ? 'Cảnh báo' : 'Bình thường'}
                        </div>
                      </div>

                      {/* Heart Rate BPM */}
                      <div className="flex flex-col items-center border-l border-zinc-800">
                        <div className="flex items-center gap-1 text-[11px] text-rose-400 font-semibold">
                          <Heart className="h-3 w-3 text-rose-500 fill-rose-500 animate-ping" />
                          <span>BPM</span>
                        </div>
                        <div className={`text-lg font-bold font-mono ${heartRate > 120 ? 'text-rose-500' : 'text-rose-300'}`}>
                          {heartRate}
                        </div>
                        <div className="text-[9px] text-zinc-400">Nhịp tim</div>
                      </div>
                    </div>

                    {/* Steps & Calories Pill */}
                    <div className="flex items-center justify-center gap-3 mt-2.5 px-3 py-1 bg-zinc-900/60 rounded-full border border-zinc-800/80 text-[10px] text-zinc-300">
                      <div className="flex items-center gap-1">
                        <Footprints className="h-3 w-3 text-emerald-400" />
                        <span>{steps.toLocaleString()} bước</span>
                      </div>
                      <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-400" />
                        <span>{calories} kcal</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Sensor Badge */}
                  <div className="pb-2 text-[10px] text-zinc-500 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-sky-400" />
                    <span>BioActive Sensor Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick device spec caption */}
            <div className="text-center text-xs text-muted-foreground mt-2">
              Chế độ mô phỏng phần cứng thực tế Samsung Galaxy Watch 5 SM-R910. Dữ liệu đồng bộ trực tiếp tới máy chủ SafeSolo và ứng dụng Mobile.
            </div>
          </div>

          {/* RIGHT COLUMN: CONTROL PANEL & TELEMETRY STREAM */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* CARD 1: USER LINK & HARDWARE ACTIONS */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-sm">Cấu hình kết nối & Tác vụ khẩn cấp</h3>
                </div>
                {selectedUser && (
                  <span className="text-xs text-muted-foreground">
                    SĐT: {selectedUser.phoneNumber || "Chưa có"}
                  </span>
                )}
              </div>

              {/* User Selector Dropdown */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Chọn người dùng ghép nối đồng hồ SafeSolo:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {users.length === 0 ? (
                    <option value="">Đang tải danh sách người dùng...</option>
                  ) : (
                    users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.phoneNumber || u.email || u.id}) - Trạng thái: {u.currentStatus}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Hardware Actions Trigger Grid */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Kích hoạt kịch bản khẩn cấp giả lập (Hardware Event Triggers):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={handleHardFall}
                    disabled={isTransmitting}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-semibold text-xs transition-all text-left"
                  >
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                      <div>Mô phỏng té ngã mạnh</div>
                      <div className="text-[10px] font-normal opacity-80">Gia tốc 4.8g & Gyroscope MEMS</div>
                    </div>
                  </button>

                  <button
                    onClick={handleHardwareSos}
                    disabled={isTransmitting}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-semibold text-xs transition-all text-left"
                  >
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <div>
                      <div>Bấm nút cứng SOS (3s)</div>
                      <div className="text-[10px] font-normal opacity-80">Gửi tọa độ GPS & Kêu cứu</div>
                    </div>
                  </button>

                  <button
                    onClick={handleCriticalSpO2}
                    disabled={isTransmitting}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-semibold text-xs transition-all text-left"
                  >
                    <Activity className="h-5 w-5 shrink-0" />
                    <div>
                      <div>Mô phỏng SpO2 tụt (84%)</div>
                      <div className="text-[10px] font-normal opacity-80">Suy hô hấp / Thiếu oxy mô</div>
                    </div>
                  </button>

                  <button
                    onClick={() => triggerSignal("WATCH_METRICS_UPDATE")}
                    disabled={isTransmitting}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs transition-all text-left"
                  >
                    <RefreshCw className={`h-5 w-5 shrink-0 ${isTransmitting ? 'animate-spin' : ''}`} />
                    <div>
                      <div>Đồng bộ sinh tồn định kỳ</div>
                      <div className="text-[10px] font-normal opacity-80">Gửi SpO2, BPM & Bước chân</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: REALTIME SLIDERS & SENSORS CONTROL */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <h3 className="font-semibold text-sm border-b border-border pb-2">
                Điều chỉnh tham số cảm biến BioActive thời gian thực
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SpO2 Slider */}
                <div className="space-y-1.5 p-3 rounded-xl bg-background/50 border border-border">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-sky-400">
                      <Activity className="h-3.5 w-3.5" /> Nồng độ Oxy SpO2
                    </span>
                    <span className="font-mono font-bold">{spO2}%</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="100"
                    value={spO2}
                    onChange={(e) => setSpO2(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>70% (Suy hô hấp)</span>
                    <span>95% (Chuẩn)</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Heart Rate BPM Slider */}
                <div className="space-y-1.5 p-3 rounded-xl bg-background/50 border border-border">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-rose-400">
                      <Heart className="h-3.5 w-3.5" /> Nhịp tim (BPM)
                    </span>
                    <span className="font-mono font-bold">{heartRate} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="180"
                    value={heartRate}
                    onChange={(e) => setHeartRate(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>40 (Chậm)</span>
                    <span>75 (Bình thường)</span>
                    <span>180 (Nhịp nhanh)</span>
                  </div>
                </div>

                {/* Steps Controller */}
                <div className="space-y-1.5 p-3 rounded-xl bg-background/50 border border-border">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Footprints className="h-3.5 w-3.5" /> Bộ đếm bước chân
                    </span>
                    <span className="font-mono font-bold">{steps} bước</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setSteps((s) => s + 25)}
                      className="flex-1 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs font-medium"
                    >
                      +25
                    </button>
                    <button
                      onClick={() => setSteps((s) => s + 100)}
                      className="flex-1 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs font-medium"
                    >
                      +100
                    </button>
                    <button
                      onClick={() => setSteps((s) => s + 500)}
                      className="flex-1 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs font-medium"
                    >
                      +500
                    </button>
                  </div>
                </div>

                {/* Battery & Off-wrist */}
                <div className="space-y-1.5 p-3 rounded-xl bg-background/50 border border-border">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-amber-400">
                      <BatteryCharging className="h-3.5 w-3.5" /> Mức pin Watch 5
                    </span>
                    <span className="font-mono font-bold">{battery}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={battery}
                    onChange={(e) => setBattery(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">Cảm biến tháo tay:</span>
                    <button
                      onClick={() => setIsOffWrist((v) => !v)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isOffWrist ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                    >
                      {isOffWrist ? "Đã tháo" : "Đang đeo"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: TELEMETRY STREAM LOG */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
                  <h3 className="font-semibold text-sm">Nhật ký truyền tín hiệu IoT (Telemetry Live Log)</h3>
                </div>
                <span className="text-xs text-muted-foreground">{telemetryLogs.length} gói tin</span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 font-mono text-xs pr-1">
                {telemetryLogs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs font-sans">
                    Chưa có tín hiệu gửi lên. Bấm một trong các nút mô phỏng ở trên để bắt đầu truyền dữ liệu!
                  </div>
                ) : (
                  telemetryLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg border border-border bg-background/60 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-400 flex items-center gap-1.5">
                          <Send className="h-3 w-3" /> {log.signalType}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{log.time}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.action === "SOS_TRIGGERED"
                                ? "bg-rose-500 text-white"
                                : log.success
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-destructive/20 text-destructive"
                            }`}
                          >
                            {log.action}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Payload: {JSON.stringify(log.payload)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
