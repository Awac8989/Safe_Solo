import { useApp } from "@/state/AppState";
import { ArrowLeft, Award, Flame, Heart, Shield, Sparkles, Wand2, Zap } from "lucide-react";

const ALL = [
  { id: "streak7", title: "Khởi đầu", desc: "7 ngày check-in liên tục", icon: Flame },
  { id: "streak30", title: "Bền bỉ", desc: "30 ngày liên tục", icon: Flame },
  { id: "streak100", title: "Kiên trì", desc: "100 ngày liên tục", icon: Award },
  { id: "medical", title: "Người Cẩn Thận", desc: "Hoàn thiện hồ sơ y tế", icon: Heart },
  { id: "automation", title: "Tự Động Hoá", desc: "Bật cảm biến lắc/té ngã", icon: Zap },
  { id: "duress", title: "Vô Hình", desc: "Cài mã PIN giả mạo", icon: Shield },
  { id: "guardians3", title: "Đội Trưởng", desc: "Có đủ 3 người bảo hộ", icon: Sparkles },
  { id: "stealth", title: "Ngụy Trang", desc: "Bật chế độ ẩn danh", icon: Wand2 },
];

export default function AchievementsScreen({ onBack }: { onBack: () => void }) {
  const { badges } = useApp();

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto">
      <header className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold">Huy hiệu</h1>
          <p className="text-xs text-muted-foreground">{badges.length}/{ALL.length} đã đạt</p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 py-5 grid grid-cols-2 gap-3">
        {ALL.map(({ id, title, desc, icon: Icon }) => {
          const unlocked = badges.includes(id);
          return (
            <div
              key={id}
              className={`rounded-2xl p-4 shadow-card flex flex-col items-center text-center ${
                unlocked ? "bg-card" : "bg-muted opacity-60"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-2 ${
                  unlocked ? "gradient-safe text-primary-foreground shadow-safe" : "bg-secondary text-muted-foreground"
                }`}
              >
                <Icon className="w-8 h-8" />
              </div>
              <p className="font-bold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
