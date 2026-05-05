import { useState } from "react";
import { useApp } from "@/state/AppState";
import { useCountdown, fmt2 } from "@/hooks/useCountdown";
import { Check, AlertTriangle, HeartPulse, UserCircle2, Activity, Flame, Plane, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import MoodPrompt from "@/components/MoodPrompt";

const weekdays = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const moodEmoji = { happy: "😊", ok: "😐", sick: "🤒" } as const;

export default function HomeScreen({ onOpenSos }: { onOpenSos: () => void }) {
  const { user, lastCheckIn, graceHours, checkIn, streak, mood, isVacation, vacationUntil, endVacation, automation } = useApp();
  const c = useCountdown(lastCheckIn, graceHours);
  const [askMood, setAskMood] = useState(false);

  const status: "safe" | "warn" | "danger" | "vacation" =
    isVacation ? "vacation" : c.expired ? "danger" : c.pctRemaining < 0.15 ? "warn" : "safe";

  const styles = {
    safe: { grad: "gradient-safe", shadow: "shadow-safe", anim: "animate-heartbeat-safe", label: "✓ Đã điểm danh", sub: "Bạn đang an toàn" },
    warn: { grad: "gradient-warn", shadow: "shadow-warn", anim: "animate-heartbeat-warn", label: "Sắp hết hạn", sub: "Vui lòng điểm danh lại" },
    danger: { grad: "gradient-danger", shadow: "shadow-danger", anim: "animate-heartbeat-danger", label: "Cảnh báo SOS", sub: "Người bảo hộ đang được thông báo" },
    vacation: { grad: "bg-muted-foreground/80", shadow: "shadow-card", anim: "", label: "Tạm ngưng báo động", sub: "Đang ở Chế độ Nghỉ phép" },
  }[status];

  const now = new Date();
  const lastDate = new Date(lastCheckIn);
  const lastTime = `${fmt2(lastDate.getHours())}:${fmt2(lastDate.getMinutes())}`;

  const handleHeartbeat = () => {
    if (isVacation) {
      toast("Đang trong chế độ Nghỉ phép");
      return;
    }
    checkIn();
    setAskMood(true);
  };

  const vacEnds = vacationUntil ? new Date(vacationUntil).toLocaleDateString("vi-VN") : "";

  return (
    <div className="flex-1 px-5 pt-4 pb-6 max-w-md mx-auto w-full">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-muted-foreground font-medium">
            {weekdays[now.getDay()]}, {now.getDate()}/{now.getMonth() + 1}/{now.getFullYear()}
          </p>
          <h1 className="text-2xl font-extrabold leading-tight mt-0.5 flex items-center gap-2">
            Xin chào, {user?.name ?? "bạn"}!
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 bg-warning/15 text-warning text-sm font-bold px-2 py-0.5 rounded-full">
                <Flame className="w-3.5 h-3.5" /> {streak}
              </span>
            )}
          </h1>
        </div>
        <button className="w-12 h-12 rounded-2xl bg-card shadow-card flex items-center justify-center text-primary">
          <UserCircle2 className="w-7 h-7" />
        </button>
      </header>

      {isVacation && (
        <div className="bg-card rounded-2xl p-3 shadow-card flex items-center gap-3 mb-4 border border-warning/30">
          <Plane className="w-5 h-5 text-warning" />
          <p className="text-sm flex-1">Nghỉ phép đến <b>{vacEnds}</b></p>
          <Button size="sm" variant="ghost" onClick={endVacation}>Kết thúc</Button>
        </div>
      )}

      <div className="flex flex-col items-center mt-2">
        <button
          onClick={handleHeartbeat}
          className={`${styles.grad} ${styles.shadow} ${styles.anim} text-primary-foreground rounded-full w-72 h-72 flex flex-col items-center justify-center transition-transform active:scale-95`}
        >
          {status === "safe" ? <Check className="w-14 h-14 mb-2" strokeWidth={3} />
            : status === "warn" ? <HeartPulse className="w-14 h-14 mb-2" strokeWidth={2.5} />
            : status === "danger" ? <AlertTriangle className="w-14 h-14 mb-2" strokeWidth={2.5} />
            : <Plane className="w-14 h-14 mb-2" strokeWidth={2.5} />}
          <p className="text-xl font-extrabold">{styles.label}</p>
          <p className="text-sm opacity-90 mt-1">{styles.sub}</p>
        </button>

        <div className="mt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {isVacation ? "Đã tạm ngưng" : c.expired ? "Đã quá hạn" : "Còn lại"}
          </p>
          <p className="text-5xl font-black tabular-nums mt-2 text-foreground">
            {isVacation ? "—:—:—" : `${fmt2(c.hours)}:${fmt2(c.minutes)}:${fmt2(c.seconds)}`}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Lần điểm danh cuối: {lastTime}
            {mood && <> · Tâm trạng {moodEmoji[mood]}</>}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full mt-8">
          <Stat icon={<Activity className="w-4 h-4" />} label="Streak" value={`${streak}d`} />
          <Stat icon={<HeartPulse className="w-4 h-4" />} label="Bảo hộ" value="3" />
          <Stat icon={<Pill className="w-4 h-4" />} label="Uống thuốc" value={automation.pillReminder ? automation.pillTime : "Tắt"} />
        </div>

        {status === "danger" && (
          <Button variant="destructive" size="lg" onClick={onOpenSos}
            className="mt-6 w-full h-14 rounded-2xl text-base font-semibold">
            Mở bản đồ giải cứu
          </Button>
        )}
      </div>

      <MoodPrompt
        open={askMood}
        onSelect={(m) => { checkIn(m); setAskMood(false); toast.success("Đã ghi nhận tâm trạng"); }}
        onClose={() => setAskMood(false)}
      />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 shadow-card">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-semibold uppercase">
        {icon} {label}
      </div>
      <p className="text-lg font-extrabold mt-1 truncate">{value}</p>
    </div>
  );
}
