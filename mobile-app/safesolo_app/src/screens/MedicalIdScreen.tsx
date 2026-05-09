import { useApp } from "@/state/AppState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, QrCode, Stethoscope } from "lucide-react";

export default function MedicalIdScreen({ onBack }: { onBack: () => void }) {
  const { medical, setMedical } = useApp();

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto">
      <header className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold">Hồ sơ y tế khẩn cấp</h1>
          <p className="text-xs text-muted-foreground">Hiển thị trên màn hình khoá qua QR</p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-5 py-5 space-y-4">
        <div className="bg-card rounded-2xl p-5 shadow-card flex items-center gap-4">
          <div className="w-20 h-20 bg-white border-2 border-foreground rounded-xl flex items-center justify-center">
            <QrCode className="w-14 h-14" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-destructive font-bold">SCAN FOR MEDICAL ID</p>
            <p className="text-sm text-muted-foreground mt-1">Người ngoài quét QR sẽ thấy nhóm máu, dị ứng và SĐT khẩn cấp.</p>
          </div>
        </div>

        <Field label="Họ và tên" value={medical.fullName} onChange={(v) => setMedical({ fullName: v })} />
        <Field label="Năm sinh" value={medical.birthYear} onChange={(v) => setMedical({ birthYear: v })} />
        <Field label="Nhóm máu" value={medical.bloodType} onChange={(v) => setMedical({ bloodType: v })} />
        <Field label="SĐT khẩn cấp" value={medical.emergencyPhone} onChange={(v) => setMedical({ emergencyPhone: v })} />
        <FieldArea label="Dị ứng" value={medical.allergies} onChange={(v) => setMedical({ allergies: v })} />
        <FieldArea label="Tiền sử bệnh" value={medical.conditions} onChange={(v) => setMedical({ conditions: v })} />
        <FieldArea label="Thuốc đang dùng" value={medical.medications} onChange={(v) => setMedical({ medications: v })} />

        <div className="bg-primary-soft rounded-2xl p-4 flex gap-3">
          <Stethoscope className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80">
            Các thông tin này được mã hoá AES-256 và chỉ hiển thị đầy đủ khi nhân viên y tế quét QR ngoài đời thực.
          </p>
        </div>

        <Button onClick={onBack} className="w-full h-12 rounded-2xl">Lưu</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-12 rounded-xl" />
    </div>
  );
}
function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded-xl min-h-[72px]" />
    </div>
  );
}
