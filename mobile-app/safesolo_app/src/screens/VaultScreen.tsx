import {
  ListChecks,
  ScrollText,
  KeyRound,
  Heart,
  Stethoscope,
  PawPrint,
  FileText,
  Vault,
  Lock,
} from "lucide-react";

const items = [
  { icon: ListChecks, title: "Checklist công việc", count: 14 },
  { icon: ScrollText, title: "Lời trăn trối", count: 1 },
  { icon: KeyRound, title: "Mật khẩu", count: 27 },
  { icon: Heart, title: "Tang lễ", count: 5 },
  { icon: Stethoscope, title: "Hồ sơ y tế", count: 8 },
  { icon: PawPrint, title: "Thú cưng", count: 2 },
  { icon: FileText, title: "Bảo hiểm", count: 4 },
  { icon: Vault, title: "Tài sản", count: 6 },
  { icon: Lock, title: "Khác", count: 0 },
];

export default function VaultScreen() {
  return (
    <div className="flex-1 px-5 pt-6 pb-6 max-w-md mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">Két sắt sinh tử</h1>
        <p className="text-sm text-muted-foreground">
          Mã hoá đầu cuối · Chỉ mở khi sự cố xảy ra
        </p>
      </header>

      <div className="bg-card rounded-2xl p-4 shadow-card mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl gradient-safe flex items-center justify-center text-primary-foreground">
          <Lock className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="font-bold">Két đang được bảo vệ</p>
          <p className="text-xs text-muted-foreground">
            72 giờ sau khi mất liên lạc, dữ liệu sẽ tự động giải mã cho người bảo hộ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {items.map(({ icon: Icon, title, count }) => (
          <button
            key={title}
            className="bg-card rounded-2xl p-4 shadow-card flex flex-col items-center text-center aspect-square justify-center hover:bg-primary-soft transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-2">
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold leading-tight">{title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{count} mục</p>
          </button>
        ))}
      </div>
    </div>
  );
}
