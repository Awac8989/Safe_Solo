import { Home, Sparkles, MessageCircle, Award, Settings as SettingsIcon } from "lucide-react";

export type Tab = "home" | "circle" | "messages" | "heroes" | "settings";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
}

const items: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Điểm danh", icon: <Home className="w-5 h-5" /> },
  { id: "circle", label: "Circle", icon: <Sparkles className="w-5 h-5" /> },
  { id: "messages", label: "Tin nhắn", icon: <MessageCircle className="w-5 h-5" /> },
  { id: "heroes", label: "Heroes", icon: <Award className="w-5 h-5" /> },
  { id: "settings", label: "Cài đặt", icon: <SettingsIcon className="w-5 h-5" /> },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="sticky bottom-0 z-30 bg-card/95 backdrop-blur border-t border-border safe-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                  isActive ? "bg-primary-soft" : ""
                }`}
              >
                {it.icon}
              </div>
              <span className="text-[10px] font-semibold">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
