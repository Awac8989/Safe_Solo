import { cn } from "@/lib/utils";

type Tone = "sos" | "duress" | "warning" | "success" | "info" | "muted";

const tones: Record<Tone, string> = {
  sos: "bg-sos/15 text-sos border-sos/30",
  duress: "bg-duress/15 text-duress border-duress/40",
  warning: "bg-warning/15 text-warning border-warning/40",
  success: "bg-success/15 text-success border-success/40",
  info: "bg-info/15 text-info border-info/40",
  muted: "bg-muted text-muted-foreground border-border",
};

const variantMap: Record<string, Tone> = {
  emerald: "success",
  green: "success",
  success: "success",
  rose: "sos",
  red: "sos",
  sos: "sos",
  amber: "warning",
  yellow: "warning",
  warning: "warning",
  sky: "info",
  blue: "info",
  indigo: "info",
  info: "info",
  purple: "duress",
  duress: "duress",
  zinc: "muted",
  muted: "muted",
};

export function Tag({
  tone,
  variant,
  children,
  className,
}: {
  tone?: Tone;
  variant?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const resolvedTone: Tone = tone ?? (variant ? variantMap[variant] ?? "muted" : "muted");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[resolvedTone],
        className,
      )}
    >
      {children}
    </span>
  );
}
