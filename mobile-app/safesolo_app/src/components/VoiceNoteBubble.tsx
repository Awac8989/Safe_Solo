import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import VoiceWaveform from "./VoiceWaveform";

interface Props {
  duration: number; // seconds
  variant?: "light" | "primary";
  className?: string;
}

const fmt = (s: number) => `0:${String(Math.max(0, Math.floor(s))).padStart(2, "0")}`;

export default function VoiceNoteBubble({ duration, variant = "light", className = "" }: Props) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const start = Date.now() - elapsed * 1000;
    ref.current = window.setInterval(() => {
      const t = (Date.now() - start) / 1000;
      if (t >= duration) {
        setElapsed(0);
        setPlaying(false);
      } else setElapsed(t);
    }, 80);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [playing, duration]);

  const isPrimary = variant === "primary";
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full pl-1.5 pr-4 py-1.5 ${
        isPrimary ? "bg-primary text-primary-foreground" : "bg-card shadow-card"
      } ${className}`}
    >
      <button
        onClick={() => setPlaying((p) => !p)}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          isPrimary ? "bg-white/25" : "bg-primary text-primary-foreground"
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <VoiceWaveform
        progress={playing || elapsed > 0 ? elapsed / duration : 0}
        color={isPrimary ? "rgba(255,255,255,0.55)" : "hsl(var(--muted-foreground))"}
        activeColor={isPrimary ? "#fff" : "hsl(var(--primary))"}
        className="w-32"
      />
      <span className={`text-xs font-bold tabular-nums ${isPrimary ? "" : "text-muted-foreground"}`}>
        {fmt(playing ? duration - elapsed : duration)}
      </span>
    </div>
  );
}
