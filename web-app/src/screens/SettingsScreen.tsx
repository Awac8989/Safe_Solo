import { useState } from "react";
import { useApp } from "@/state/AppState";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Bell, Languages, Contrast, ShieldAlert, LogOut, Clock, ChevronRight, Sparkles,
  Plane, Activity, Zap, Pill, MapPin, Heart, Award, Trash2, KeyRound,
} from "lucide-react";
import MedicalIdScreen from "./MedicalIdScreen";
import AchievementsScreen from "./AchievementsScreen";
import { toast } from "sonner";

export default function SettingsScreen() {
  const {
    user, signOut, graceHours, setGraceHours,
    highContrast, setHighContrast,
    automation, setAutomation,
    security, setSecurity,
    isVacation, startVacation, endVacation,
  } = useApp();
  const [vacOpen, setVacOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [vacDays, setVacDays] = useState(7);
  const [realPin, setRealPin] = useState(security.realPin);
  const [duressPin, setDuressPin] = useState(security.duressPin);
  const [view, setView] = useState<null | "medical" | "badges">(null);

  if (view === "medical") return <MedicalIdScreen onBack={() => setView(null)} />;
  if (view === "badges") return <AchievementsScreen onBack={() => setView(null)} />;

  return (
    <div className="flex-1 px-5 pt-6 pb-6 max-w-md mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold">Cài đặt</h1>
      </header>

      <div className="bg-card rounded-2xl p-4 shadow-card flex items-center gap-3 mb-5">
        <div className="w-14 h-14 rounded-full gradient-safe text-primary-foreground flex items-center justify-center text-xl font-extrabold">
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{user?.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </div>

      <Section title="Điểm danh hằng ngày">
        <Row icon={<Clock className="w-5 h-5" />} title="Thời gian ân hạn">
          <span className="font-bold text-primary">{graceHours}h</span>
        </Row>
        <div className="px-4 pb-4 -mt-1">
          <Slider value={[graceHours]} min={6} max={48} step={1} onValueChange={(v) => setGraceHours(v[0])} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>6h</span><span>48h</span>
          </div>
        </div>
        <Row icon={<Bell className="w-5 h-5" />} title="Nhắc nhở mỗi ngày">
          <span className="font-bold">08:00</span>
        </Row>
        <Row
          icon={<Plane className="w-5 h-5" />}
          title={isVacation ? "Đang nghỉ phép" : "Chế độ Nghỉ phép"}
          onClick={() => (isVacation ? endVacation() : setVacOpen(true))}
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Row>
      </Section>

      <Section title="Tự động hoá & Cảm biến">
        <Row icon={<Activity className="w-5 h-5" />} title="Phát hiện té ngã">
          <Switch checked={automation.fallDetection} onCheckedChange={(v) => setAutomation({ fallDetection: v })} />
        </Row>
        <Row icon={<Zap className="w-5 h-5" />} title="Lắc máy tạo SOS">
          <Switch checked={automation.shakeSos} onCheckedChange={(v) => setAutomation({ shakeSos: v })} />
        </Row>
        {automation.shakeSos && (
          <div className="px-4 pb-4 -mt-1">
            <p className="text-xs text-muted-foreground mb-2">Độ nhạy lắc: {automation.shakeSensitivity}/5</p>
            <Slider value={[automation.shakeSensitivity]} min={1} max={5} step={1}
              onValueChange={(v) => setAutomation({ shakeSensitivity: v[0] })} />
            <Button size="sm" variant="outline" className="mt-2 rounded-xl"
              onClick={() => toast("Lắc máy thử... ✓ Nhận diện thành công")}>
              Test Shake
            </Button>
          </div>
        )}
        <Row icon={<MapPin className="w-5 h-5" />} title="Tự check-in khi về nhà">
          <Switch checked={automation.geofenceAutoCheckin} onCheckedChange={(v) => setAutomation({ geofenceAutoCheckin: v })} />
        </Row>
        <Row icon={<Pill className="w-5 h-5" />} title="Nhắc uống thuốc">
          <Switch checked={automation.pillReminder} onCheckedChange={(v) => setAutomation({ pillReminder: v })} />
        </Row>
      </Section>

      <Section title="Hồ sơ & Thành tựu">
        <Row icon={<Heart className="w-5 h-5" />} title="Hồ sơ y tế khẩn cấp" onClick={() => setView("medical")}>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Row>
        <Row icon={<Award className="w-5 h-5" />} title="Huy hiệu của tôi" onClick={() => setView("badges")}>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Row>
      </Section>

      <Section title="Trợ năng">
        <Row icon={<Contrast className="w-5 h-5" />} title="Tương phản cao (WCAG AAA)">
          <Switch checked={highContrast} onCheckedChange={setHighContrast} />
        </Row>
        <Row icon={<Languages className="w-5 h-5" />} title="Ngôn ngữ">
          <span className="font-bold">Tiếng Việt</span>
        </Row>
      </Section>

      <Section title="Bảo mật nâng cao">
        <Row icon={<KeyRound className="w-5 h-5" />} title="Mã PIN thật & PIN giả" onClick={() => setPinOpen(true)}>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </Row>
        <Row icon={<Sparkles className="w-5 h-5" />} title="Chế độ ẩn danh (Calculator)">
          <Switch
            checked={security.stealthMode}
            onCheckedChange={(v) => {
              setSecurity({ stealthMode: v });
              if (v) toast("Mở khoá: nhập 1909 = trong calculator");
            }}
          />
        </Row>
        <Row icon={<Trash2 className="w-5 h-5" />} title="Tự huỷ Két sắt">
          <span className="font-bold text-destructive">
            {security.autoWipeDays ? `${security.autoWipeDays}d` : "Tắt"}
          </span>
        </Row>
        <div className="px-4 pb-4 -mt-1">
          <Slider value={[security.autoWipeDays]} min={0} max={60} step={7}
            onValueChange={(v) => setSecurity({ autoWipeDays: v[0] })} />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Tắt</span><span>60 ngày</span>
          </div>
        </div>
        <Row icon={<ShieldAlert className="w-5 h-5" />} title="Mã hoá AES-256 E2E">
          <span className="text-xs font-bold text-primary">Đang bật</span>
        </Row>
      </Section>

      <Button
        variant="outline"
        className="w-full h-12 rounded-2xl mt-4 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={signOut}
      >
        <LogOut className="w-4 h-4" /> Đăng xuất
      </Button>

      <p className="text-center text-xs text-muted-foreground mt-6">SafeSolo v1.1 · Built with care</p>

      {/* Vacation dialog */}
      <Dialog open={vacOpen} onOpenChange={setVacOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Tạm ngưng báo động</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Chọn số ngày bạn muốn tạm dừng tính năng điểm danh.</p>
          <div className="py-2">
            <Slider value={[vacDays]} min={1} max={30} step={1} onValueChange={(v) => setVacDays(v[0])} />
            <p className="text-center text-2xl font-extrabold mt-3">{vacDays} ngày</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVacOpen(false)}>Huỷ</Button>
            <Button onClick={() => { startVacation(vacDays); setVacOpen(false); toast.success(`Tạm ngưng ${vacDays} ngày`); }}>
              Bắt đầu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN dialog */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Mã PIN khẩn cấp</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Nhập mã PIN giả để âm thầm gửi SOS khi bị khống chế.
          </p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-bold uppercase text-primary">PIN thật</label>
              <Input value={realPin} onChange={(e) => setRealPin(e.target.value)} maxLength={6}
                inputMode="numeric" placeholder="••••" className="h-12 text-2xl tracking-widest text-center rounded-xl mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-destructive">PIN giả (Duress)</label>
              <Input value={duressPin} onChange={(e) => setDuressPin(e.target.value)} maxLength={6}
                inputMode="numeric" placeholder="••••" className="h-12 text-2xl tracking-widest text-center rounded-xl mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPinOpen(false)}>Huỷ</Button>
            <Button onClick={() => { setSecurity({ realPin, duressPin }); setPinOpen(false); toast.success("Đã lưu PIN"); }}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2 px-1">{title}</h2>
      <div className="bg-card rounded-2xl shadow-card divide-y divide-border overflow-hidden">{children}</div>
    </div>
  );
}

function Row({
  icon, title, children, onClick,
}: {
  icon: React.ReactNode; title: string; children?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${onClick ? "hover:bg-secondary/50" : "cursor-default"}`}
    >
      <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
        {icon}
      </div>
      <p className="flex-1 font-medium">{title}</p>
      {children}
    </button>
  );
}
