import { useState } from "react";
import { Shield, Eye, Plus, Phone, MapPin, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Person {
  name: string;
  relation: string;
  status: "safe" | "warn" | "danger";
  lastSeen: string;
}

const guardians: Person[] = [
  { name: "Nguyễn Thị Lan", relation: "Mẹ", status: "safe", lastSeen: "2 phút trước" },
  { name: "Trần Văn Hùng", relation: "Anh trai", status: "safe", lastSeen: "8 phút trước" },
  { name: "Lê Minh Hoa", relation: "Bạn thân", status: "safe", lastSeen: "32 phút trước" },
];

const watchlist: Person[] = [
  { name: "Đoàn Minh Quân", relation: "Bố", status: "safe", lastSeen: "1 giờ trước" },
  { name: "Phạm Thu Hằng", relation: "Em gái", status: "warn", lastSeen: "20 giờ trước" },
  { name: "Hồ Văn Tài", relation: "Hàng xóm", status: "danger", lastSeen: "Quá hạn 1g 23p" },
];

const dot = (s: Person["status"]) =>
  s === "safe" ? "bg-primary" : s === "warn" ? "bg-warning" : "bg-destructive animate-blink";

export default function NetworkScreen({ onOpenSos }: { onOpenSos: (name: string) => void }) {
  const [tab, setTab] = useState("guardians");

  return (
    <div className="flex-1 px-5 pt-6 pb-6 max-w-md mx-auto w-full">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Mạng lưới</h1>
          <p className="text-sm text-muted-foreground">Người bảo vệ bạn & bạn bảo vệ</p>
        </div>
        <Button size="icon" className="rounded-2xl h-12 w-12">
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full h-12 rounded-2xl bg-secondary p-1">
          <TabsTrigger value="guardians" className="rounded-xl gap-2 h-full">
            <Shield className="w-4 h-4" /> Bảo hộ
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="rounded-xl gap-2 h-full">
            <Eye className="w-4 h-4" /> Theo dõi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guardians" className="space-y-3 mt-4">
          {guardians.map((p) => (
            <PersonCard key={p.name} p={p} action="call" />
          ))}
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-3 mt-4">
          {watchlist.map((p) => (
            <PersonCard
              key={p.name}
              p={p}
              action={p.status === "danger" ? "rescue" : "ping"}
              onRescue={() => onOpenSos(p.name)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );

  function PersonCard({
    p,
    action,
    onRescue,
  }: {
    p: Person;
    action: "call" | "ping" | "rescue";
    onRescue?: () => void;
  }) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-lg">
            {p.name.split(" ").pop()?.[0]}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${dot(
              p.status
            )}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{p.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {p.relation} · {p.lastSeen}
          </p>
        </div>
        {action === "call" && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => toast("Đang gọi " + p.name)}
          >
            <Phone className="w-5 h-5 text-primary" />
          </Button>
        )}
        {action === "ping" && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => toast("Đã gửi rung động hỏi thăm")}
          >
            <MapPin className="w-5 h-5 text-primary" />
          </Button>
        )}
        {action === "rescue" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onRescue}
            className="rounded-xl gap-1"
          >
            <AlertTriangle className="w-4 h-4" /> Cứu
          </Button>
        )}
      </div>
    );
  }
}
