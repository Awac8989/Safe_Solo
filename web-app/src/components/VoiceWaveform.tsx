interface Props {
  bars?: number;
  progress?: number; // 0..1
  className?: string;
  color?: string;
  activeColor?: string;
}

// Deterministic pseudo-random heights so SSR/CSR match and bars feel natural.
function heights(n: number) {
  const arr: number[] = [];
  let seed = 7;
  for (let i = 0; i < n; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    arr.push(0.25 + r * 0.75);
  }
  return arr;
}

export default function VoiceWaveform({
  bars = 28,
  progress = 0,
  className = "",
  color = "currentColor",
  activeColor,
}: Props) {
  const hs = heights(bars);
  const cutoff = Math.round(progress * bars);
  return (
    <div className={`flex items-center gap-[3px] h-7 ${className}`}>
      {hs.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-colors"
          style={{
            height: `${h * 100}%`,
            background: i < cutoff ? activeColor ?? color : color,
            opacity: i < cutoff ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}
