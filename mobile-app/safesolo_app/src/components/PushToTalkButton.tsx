import { useEffect, useRef, useState } from "react";
import { Mic, Trash2 } from "lucide-react";

interface Props {
  onSend: (durationSec: number) => void;
  className?: string;
  size?: "md" | "lg";
}

/**
 * Press-and-hold mic button with cancel-by-swipe.
 * Mock implementation — no real audio capture, simulates a recording session.
 */
export default function PushToTalkButton({ onSend, className = "", size = "md" }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cancelHover, setCancelHover] = useState(false);
  const startX = useRef(0);
  const startTime = useRef(0);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (!recording) return;
    startTime.current = Date.now();
    tick.current = window.setInterval(() => {
      setSeconds((Date.now() - startTime.current) / 1000);
    }, 100);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [recording]);

  const begin = (clientX: number) => {
    startX.current = clientX;
    setSeconds(0);
    setCancelHover(false);
    setRecording(true);
  };
  const move = (clientX: number) => {
    if (!recording) return;
    setCancelHover(startX.current - clientX > 80);
  };
  const end = () => {
    if (!recording) return;
    const dur = seconds;
    setRecording(false);
    if (!cancelHover && dur >= 0.4) onSend(Math.max(1, Math.round(dur)));
    setSeconds(0);
    setCancelHover(false);
  };

  const dim = size === "lg" ? "w-20 h-20" : "w-14 h-14";

  return (
    <>
      <button
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); begin(e.clientX); }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={end}
        onPointerCancel={end}
        className={`${dim} rounded-full flex items-center justify-center shrink-0 select-none touch-none transition-all ${
          recording ? "bg-destructive scale-125 animate-heartbeat-danger" : "bg-primary"
        } text-primary-foreground ${className}`}
        aria-label="Nhấn giữ để ghi âm"
      >
        <Mic className={size === "lg" ? "w-8 h-8" : "w-6 h-6"} />
      </button>

      {recording && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 animate-fade-in-up">
          <div className={`w-40 h-40 rounded-full flex items-center justify-center ${
            cancelHover ? "bg-muted" : "bg-destructive animate-heartbeat-danger"
          } text-primary-foreground mb-6`}>
            {cancelHover ? <Trash2 className="w-12 h-12 text-destructive" /> : <Mic className="w-14 h-14" />}
          </div>
          <p className={`text-2xl font-extrabold tabular-nums ${cancelHover ? "text-muted-foreground" : "text-destructive"}`}>
            {seconds.toFixed(1)}s
          </p>
          <p className="text-base font-bold mt-3 text-destructive">
            {cancelHover ? "Thả tay để HỦY" : "🔴 Đang ghi âm..."}
          </p>
          <p className="text-sm text-muted-foreground mt-1">← Vuốt sang trái để hủy</p>
        </div>
      )}
    </>
  );
}
