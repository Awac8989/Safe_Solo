import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Printer,
  Copy,
  Check,
  X,
  ShieldCheck,
  Clock,
  HeartPulse,
  Activity,
  User,
  MapPin,
  Lock,
} from "lucide-react";
import { fetchIncidentDossier, type IncidentDossier } from "@/lib/api";

interface IncidentDossierModalProps {
  incidentId: string;
  onClose: () => void;
}

export function IncidentDossierModal({ incidentId, onClose }: IncidentDossierModalProps) {
  const [copied, setCopied] = useState(false);

  const dossierQuery = useQuery({
    queryKey: ["incident-dossier", incidentId],
    queryFn: () => fetchIncidentDossier(incidentId),
  });

  const dossier = dossierQuery.data?.data;

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-6">
        {/* Modal Top Action Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-6 py-3.5 backdrop-blur">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-400" />
            <span className="text-sm font-bold tracking-wide">
              Hồ Sơ Bằng Chứng Sự Cố Khẩn Cấp (Legal Incident Dossier)
            </span>
            <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-400">
              {dossier?.dossierId || `DOS-${incidentId}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
            >
              <Printer className="h-3.5 w-3.5" /> In / Lưu PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Dossier Document Body */}
        <div className="p-6 md:p-8 space-y-6 text-foreground bg-background/50 print:bg-white print:text-black">
          {dossierQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Đang tổng hợp dữ liệu mật mã và hồ sơ bằng chứng...
            </div>
          ) : dossier ? (
            <>
              {/* Document Header */}
              <div className="border-b-2 border-border pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-sky-500">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM · SAFESOLO DISPATCH COMMAND
                  </div>
                  <h1 className="text-xl font-black mt-1">
                    BIÊN BẢN ĐIỀU PHỐI & GIÁM SÁT SỰ CỐ KHẨN CẤP
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mã lưu trữ điện tử: <strong>{dossier.dossierId}</strong> · Thời gian lập: {new Date(dossier.generatedAt).toLocaleString("vi-VN")}
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 text-right">
                  <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-sky-400">
                    <Lock className="h-3.5 w-3.5" /> CHỮ KÝ SỐ SHA-256
                  </div>
                  <div className="mt-1 font-mono text-xs font-semibold text-foreground break-all max-w-xs">
                    {dossier.legalVerificationHash}
                  </div>
                  <button
                    onClick={() => handleCopyHash(dossier.legalVerificationHash)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Đã sao chép" : "Sao chép mã hash"}
                  </button>
                </div>
              </div>

              {/* Victim & Emergency Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-sky-400" /> THÔNG TIN NẠN NHÂN
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Họ tên:</span>
                      <div className="font-bold">{dossier.victim.name}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Số điện thoại:</span>
                      <div className="font-bold">{dossier.victim.phone || "Không có"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nhóm máu:</span>
                      <div className="font-bold text-rose-400">{dossier.victim.bloodType}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tiền sử dị ứng/bệnh:</span>
                      <div className="font-bold">{dossier.victim.allergies}</div>
                    </div>
                  </div>
                  <div className="text-xs pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Vị trí xảy ra sự cố:</span>
                    <div className="font-semibold flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-rose-500" /> {dossier.victim.approxLocation}
                    </div>
                  </div>
                </div>

                {/* WearOS Telemetry Snapshot */}
                <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-rose-400" /> THÔNG SỐ SINH TỒN THỜI ĐIỂM SỰ CỐ
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Thiết bị đo:</span>
                      <div className="font-semibold">{dossier.vitalsTelemetry.device}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tình trạng pin:</span>
                      <div className="font-bold text-emerald-400">{dossier.vitalsTelemetry.battery}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nhịp tim (BPM):</span>
                      <div className="font-black text-rose-400 text-sm">{dossier.vitalsTelemetry.heartRate} bpm</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nồng độ SpO2:</span>
                      <div className="font-black text-sky-400 text-sm">{dossier.vitalsTelemetry.spo2}%</div>
                    </div>
                  </div>
                  <div className="text-xs pt-1 border-t border-border/50 text-rose-400 font-bold">
                    Cảnh báo: {dossier.vitalsTelemetry.strokeRisk} (Phát hiện té ngã: CÓ)
                  </div>
                </div>
              </div>

              {/* Timeline Table */}
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-400" /> NHẬT KÝ DIỄN TIẾN TỪNG GIÂY (CHRONOLOGICAL EVENT LOG)
                </div>
                <div className="space-y-2">
                  {dossier.timeline.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <span className="font-mono font-bold text-sky-400 shrink-0 w-20">{item.time}</span>
                      <span className="text-foreground leading-relaxed">{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned Responders */}
              <div className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> HIỆP SĨ ĐƯỢC ĐIỀU ĐỘNG TIẾP CẬN
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {dossier.assignedHeroes.map((hero, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-background/60 p-2.5 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold flex items-center gap-1">
                          {hero.name} <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded">Hiệp sĩ</span>
                        </div>
                        <div className="text-muted-foreground text-[11px]">SĐT: {hero.phone} · Cách: {hero.distance}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-400">⭐ {hero.trustScore}</div>
                        <div className="text-[10px] text-sky-400">ETA: {hero.eta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Digital Seal & Signature */}
              <div className="border-t-2 border-border pt-4 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Biên bản được lập tự động từ Hệ thống Trung tâm Điều phối Khẩn cấp SafeSolo.</div>
                  <div>Tiêu chuẩn an toàn dữ liệu: <strong>{dossier.supervisorSignature.auditStandard}</strong></div>
                  <div>Mã con dấu điện tử: <strong className="font-mono text-sky-400">{dossier.supervisorSignature.digitalSeal}</strong></div>
                </div>

                <div className="text-center p-3 rounded-xl border border-border bg-background/80 min-w-[220px]">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    NGƯỜI XÁC THỰC BIÊN BẢN
                  </div>
                  <div className="my-2 h-10 flex items-center justify-center">
                    <span className="font-serif italic font-bold text-emerald-400 text-lg">Đoàn Minh Quân</span>
                  </div>
                  <div className="text-xs font-bold">{dossier.supervisorSignature.supervisorName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Mã giám sát: {dossier.supervisorSignature.supervisorId}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-sm text-sos">Không tìm thấy dữ liệu hồ sơ sự cố.</div>
          )}
        </div>
      </div>
    </div>
  );
}
