import { Mood } from "@/state/AppState";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onSelect: (m: Mood) => void;
  onClose: () => void;
}

const opts: { mood: Exclude<Mood, null>; emoji: string; label: string }[] = [
  { mood: "happy", emoji: "😊", label: "Vui vẻ" },
  { mood: "ok", emoji: "😐", label: "Bình thường" },
  { mood: "sick", emoji: "🤒", label: "Mệt / Ốm" },
];

export default function MoodPrompt({ open, onSelect, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-card">
        <h3 className="text-xl font-extrabold text-center">Hôm nay bạn cảm thấy thế nào?</h3>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Người bảo hộ sẽ thấy tâm trạng của bạn
        </p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {opts.map((o) => (
            <button
              key={o.mood}
              onClick={() => onSelect(o.mood)}
              className="bg-secondary rounded-2xl py-4 flex flex-col items-center hover:bg-primary-soft transition-colors active:scale-95"
            >
              <span className="text-4xl">{o.emoji}</span>
              <span className="text-xs font-semibold mt-2">{o.label}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="w-full mt-3 rounded-2xl" onClick={onClose}>
          Bỏ qua
        </Button>
      </div>
    </div>
  );
}
