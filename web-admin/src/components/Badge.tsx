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

export function Tag({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
