import { MapPin, MessageSquare, BatteryCharging, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onGrant: () => void;
}

const items = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Truy cập vị trí (GPS)",
    desc: "Để gửi toạ độ chính xác cho người bảo hộ khi cần cứu hộ.",
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Gửi tin nhắn SMS",
    desc: "Gửi cảnh báo qua SMS khi mất kết nối Internet.",
  },
  {
    icon: <BatteryCharging className="w-6 h-6" />,
    title: "Tắt tối ưu hoá pin",
    desc: "Để bộ đếm ngược điểm danh chạy ngầm liên tục, không bị hệ thống ngắt.",
  },
];

export default function PermissionsScreen({ onGrant }: Props) {
  return (
    <div className="min-h-screen flex flex-col gradient-bg">
      <div className="flex-1 px-6 pt-12 pb-6 max-w-md mx-auto w-full">
        <h1 className="text-3xl font-extrabold mb-2">Cấp quyền hệ thống</h1>
        <p className="text-muted-foreground mb-8 text-base">
          Để SafeSolo bảo vệ bạn khi cần, ứng dụng cần các quyền sau:
        </p>

        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="bg-card rounded-2xl p-5 shadow-card flex gap-4 items-start"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
                {it.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-bold mb-1">{it.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {it.desc}
                </p>
              </div>
              <Check className="w-5 h-5 text-primary shrink-0 mt-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="p-6 max-w-md mx-auto w-full">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-2xl"
          onClick={onGrant}
        >
          Cấp quyền & Tiếp tục
        </Button>
      </div>
    </div>
  );
}
