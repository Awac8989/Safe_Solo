import { useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock,
  HeartPulse,
  Lock,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
  FileText,
} from "lucide-react";
import { Tag } from "@/components/Badge";
import type { AdminOverviewResponse, HitlActionPayload } from "@/lib/api";
import { LiveVitalsTelemetry } from "@/components/LiveVitalsTelemetry";
import { DispatchCommsConsole } from "@/components/DispatchCommsConsole";
import { IncidentDossierModal } from "@/components/IncidentDossierModal";

type IncidentItem = AdminOverviewResponse["data"]["incidents"][number];

interface HitlDispatchPanelProps {
  incident: IncidentItem;
  onAction: (payload: HitlActionPayload) => Promise<void>;
  isPending: boolean;
}

export function HitlDispatchPanel({ incident, onAction, isPending }: HitlDispatchPanelProps) {
  const hitl = incident.hitl;
  const initialSeconds = hitl?.countdownSeconds ?? 30;

  const [timeLeft, setTimeLeft] = useState<number>(initialSeconds);
  const [isPaused, setIsPaused] = useState<boolean>(hitl?.state === "PAUSED");
  const [showFalseAlarmModal, setShowFalseAlarmModal] = useState(false);
  const [falseAlarmReason, setFalseAlarmReason] = useState("Nạn nhân bấm nhầm");
  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [supervisorCode, setSupervisorCode] = useState("SUP-0137");

  const currentState = hitl?.state || "COUNTDOWN_ACTIVE";
  const isCountdownActive = currentState === "COUNTDOWN_ACTIVE" && !isPaused && timeLeft > 0;
  const isDispatched = currentState === "DISPATCHED" || currentState === "AMBULANCE_DISPATCHED";
  const isCancelled = currentState === "CANCELLED_FALSE_ALARM";

  // Countdown timer effect
  useEffect(() => {
    setTimeLeft(initialSeconds);
    setIsPaused(currentState === "PAUSED");
  }, [incident.id, initialSeconds, currentState]);

  useEffect(() => {
    if (!isCountdownActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Trigger fail-safe auto dispatch
          void onAction({
            action: "AUTO_DISPATCH_TIMEOUT",
            supervisorName: "Hệ thống Fail-Safe SafeSolo",
            tier: 2,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCountdownActive, onAction]);

  const progressPercentage = Math.min(100, Math.max(0, (timeLeft / (hitl?.autoDispatchThreshold || 30)) * 100));

  const handlePauseToggle = async () => {
    if (isPaused) {
      setIsPaused(false);
      await onAction({ action: "RESUME_COUNTDOWN" });
    } else {
      setIsPaused(true);
      await onAction({ action: "PAUSE_COUNTDOWN" });
    }
  };

  const handleConfirmFalseAlarm = async () => {
    setShowFalseAlarmModal(false);
    await onAction({
      action: "CANCEL_FALSE_ALARM",
      reason: falseAlarmReason,
      supervisorName: "Đoàn Minh Quân (Trưởng ca)",
      tier: 1,
    });
  };

  const handleConfirmAmbulance = async () => {
    setShowAmbulanceModal(false);
    await onAction({
      action: "TIER3_AMBULANCE_DISPATCH",
      reason: `Điều xe cấp cứu 115 - Xác nhận bởi mã điều phối [${supervisorCode}]`,
      supervisorName: `Đoàn Minh Quân (${supervisorCode})`,
      tier: 3,
    });
  };

  return (
    <div className="mx-5 my-3 space-y-3 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-card to-background p-4 shadow-xl">
      {/* 1. Header Bar: HITL Status & Priority */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
            <ShieldAlert className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Điều phối Bán Tự Động (HITL)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                <UserCheck className="h-3 w-3" /> Con người giám sát
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tự động hóa phản ứng nhanh · Chốt an toàn ngăn chặn báo động giả
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tag tone={hitl?.priority === "P1_CRITICAL" ? "sos" : hitl?.priority === "P2_URGENT" ? "warning" : "info"}>
            {hitl?.priority === "P1_CRITICAL"
              ? "P1 · NGUY KỊCH"
              : hitl?.priority === "P2_URGENT"
              ? "P2 · KHẨN CẤP"
              : "P3 · THEO DÕI"}
          </Tag>
          <span className="font-mono text-xs text-muted-foreground">
            Độ tin cậy AI: <strong className="text-emerald-400">{hitl?.confidence || "96%"}</strong>
          </span>
        </div>
      </div>

      {/* 2. Grace Period Countdown Gauge Bar */}
      <div className="rounded-xl border border-border/80 bg-background/80 p-3.5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${isCountdownActive ? "animate-spin text-rose-500" : "text-muted-foreground"}`} />
            <span className="text-xs font-semibold">
              {isCancelled ? (
                <span className="text-amber-400">ĐÃ HỦY · Báo động giả</span>
              ) : isDispatched ? (
                <span className="text-emerald-400">ĐÃ KÍCH HOẠT ĐIỀU PHỐI CỨU HỘ</span>
              ) : isPaused ? (
                <span className="text-amber-400">ĐÃ TẠM DỪNG BỞI NGƯỜI GIÁM SÁT</span>
              ) : (
                <span>
                  Tự động điều phối sau: <strong className="text-sm font-extrabold text-rose-500">{timeLeft}s</strong>
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isCountdownActive && (
              <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 animate-pulse">
                ĐANG CHẠY
              </span>
            )}
            {hitl?.supervisorAction && (
              <span className="font-mono text-[10px] text-muted-foreground">
                Hash: <span className="text-sky-400">{hitl.supervisorAction.hash}</span>
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        {!isCancelled && !isDispatched && (
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary/50 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                timeLeft <= 10
                  ? "bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 animate-pulse"
                  : "bg-gradient-to-r from-amber-500 via-emerald-400 to-sky-400"
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* 3. AI Triage & Bio-Signals Matrix */}
      <div className="space-y-2.5">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Phân tích lâm sàng & Đề xuất AI</span>
          </div>
          <p className="mt-1 text-xs text-foreground/90 leading-relaxed">
            {hitl?.aiSummary || "Nghi ngờ Đột quỵ cấp / Nguy kịch (Rung nhĩ AFib, SpO2 91%, Nhịp tim 124 bpm) kèm ngã chấn thương."}
          </p>
          <div className="mt-1 text-[11px] text-sky-300/80 font-medium">
            Khuyến nghị: <strong>{hitl?.recommendedAction || "Điều 115 Cấp cứu & 2 Hiệp sĩ SafeSolo (<850m)"}</strong>
          </div>
        </div>

        {/* Real-time Dynamic ECG & WearOS Telemetry */}
        <LiveVitalsTelemetry
          heartRate={incident.vitals?.heartRate ?? 124}
          spo2={incident.vitals?.spo2 ?? 91}
          hrvRmssd={incident.vitals?.hrvRmssd ?? 18}
          strokeRisk={incident.vitals?.strokeRisk ?? "NGUY CƠ CAO (Rung nhĩ AFib)"}
          battery={incident.vitals?.battery ?? 78}
          device={incident.vitals?.device ?? "Samsung Galaxy Watch 5 (WearOS)"}
          isAlert={Boolean(incident.vitals?.spo2 && incident.vitals.spo2 < 92)}
        />
      </div>

      {/* 4. 3-Tier Security Gates Matrix */}
      <div className="rounded-xl border border-border/80 bg-background/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Phân tầng Quyền hạn & Bảo mật (3-Tier Security Gates)
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">Chuẩn ISO 27001 & HITL</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 text-center text-xs">
          {/* Tier 1 */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-left">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 text-[11px]">Tier 1 · Tự động 100%</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Ghi log SHA-256, ping vị trí GPS mờ hóa & gửi tin người thân đã ủy quyền.
            </p>
          </div>

          {/* Tier 2 */}
          <div className={`rounded-lg border p-2 text-left ${
            isDispatched
              ? "border-emerald-500/30 bg-emerald-500/10"
              : isCancelled
              ? "border-border bg-muted/20"
              : "border-amber-500/30 bg-amber-500/10"
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-bold text-[11px] ${isDispatched ? "text-emerald-400" : "text-amber-400"}`}>
                Tier 2 · Bán Tự Động
              </span>
              <ShieldCheck className={`h-3.5 w-3.5 ${isDispatched ? "text-emerald-400" : "text-amber-400"}`} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Điều phối 2-3 Hiệp sĩ SafeSolo lân cận (Kích hoạt sau 30s nếu không bị hủy).
            </p>
          </div>

          {/* Tier 3 */}
          <div className={`rounded-lg border p-2 text-left ${
            currentState === "AMBULANCE_DISPATCHED"
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-rose-500/30 bg-rose-500/10"
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400 text-[11px]">Tier 3 · Chốt Nghiêm Ngặt</span>
              <Lock className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Gọi Cấp cứu 115 / Công an 113. Bắt buộc Điều phối viên ký xác nhận. Cấm AI tự ý gọi.
            </p>
          </div>
        </div>
      </div>

      {/* 4.5. Lực lượng Hiệp sĩ SafeSolo lân cận thực tế (Đồng bộ MongoDB) */}
      {incident.nearbyHeroes && incident.nearbyHeroes.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Hiệp sĩ SafeSolo lân cận sẵn sàng cứu hộ ({incident.nearbyHeroes.length})
            </span>
            <span className="text-[10px] text-emerald-400/90 font-medium">Đã xác thực CCCD & KYC</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {incident.nearbyHeroes.map((hero, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-border/80 bg-background/80 p-2.5">
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    {hero.name}
                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-semibold text-emerald-400">
                      Hiệp sĩ
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    📞 {hero.phone || "0913843958"} · Cách vị trí: <strong className="text-foreground">{hero.distance}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-400">⭐ {hero.trustScore || 4.9}</div>
                  <div className="text-[10px] font-semibold text-sky-400">Đến trong: {hero.eta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4.8. Bàn Đàm Thoại & Chỉ Dẫn Sơ Cấp Cứu Y Tế 1-Chạm */}
      <DispatchCommsConsole
        victimName={incident.name}
        victimPhone={incident.phoneNumber}
        guardianName={incident.emergencyContactName}
        guardianPhone={incident.emergencyContactPhone}
        heroName={incident.nearbyHeroes?.[0]?.name}
        heroPhone={incident.nearbyHeroes?.[0]?.phone}
      />

      {/* 5. Supervisor Action Bar (Quyền Can Thiệp Của Người Giám Sát) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Nút Hủy / Báo động giả */}
        <button
          onClick={() => setShowFalseAlarmModal(true)}
          disabled={isPending || isCancelled}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" /> HỦY / BÁO ĐỘNG GIẢ
        </button>

        {/* Nút Tạm dừng / Tiếp tục */}
        {!isCancelled && !isDispatched && (
          <button
            onClick={handlePauseToggle}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isPaused ? "TIẾP TỤC ĐẾM" : "TẠM DỪNG"}
          </button>
        )}

        {/* Nút Duyệt Ngay (Bypass Countdown) */}
        {!isDispatched && !isCancelled && (
          <button
            onClick={() =>
              onAction({
                action: "INSTANT_DISPATCH",
                supervisorName: "Đoàn Minh Quân (Trưởng ca)",
                tier: 2,
              })
            }
            disabled={isPending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" /> DUYỆT ĐIỀU PHỐI NGAY
          </button>
        )}

        {/* Nút Tier 3: Điều Xe Cấp Cứu 115 */}
        {currentState !== "AMBULANCE_DISPATCHED" && !isCancelled && (
          <button
            onClick={() => setShowAmbulanceModal(true)}
            disabled={isPending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-rose-500 animate-pulse"
          >
            <Ambulance className="h-4 w-4" /> ĐIỀU XE 115 (TIER 3)
          </button>
        )}

        {/* Nút Xuất Hồ sơ Bằng chứng Pháp lý (Dossier) */}
        <button
          onClick={() => setShowDossierModal(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2.5 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition"
        >
          <FileText className="h-4 w-4" /> XUẤT HỒ SƠ (DOSSIER)
        </button>
      </div>

      {/* Modal: Xác nhận Báo động giả */}
      {showFalseAlarmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertOctagon className="h-6 w-6" />
              <h3 className="text-base font-bold">Xác nhận Hủy / Báo Động Giả</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Hành động này sẽ hủy bộ đếm ngược và dừng lệnh điều phối. Lý do sẽ được ghi vĩnh viễn vào Hộp đen Kiểm toán SHA-256.
            </p>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-foreground">Chọn lý do hủy:</label>
              <select
                value={falseAlarmReason}
                onChange={(e) => setFalseAlarmReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none"
              >
                <option value="Nạn nhân bấm nhầm (False tap)">Nạn nhân bấm nhầm (False tap)</option>
                <option value="Đã liên hệ điện thoại xác nhận an toàn">Đã liên hệ điện thoại xác nhận an toàn</option>
                <option value="Đánh rơi thiết bị khi chơi thể thao">Đánh rơi thiết bị khi chơi thể thao</option>
                <option value="Kiểm tra kỹ thuật / Test hệ thống">Kiểm tra kỹ thuật / Test hệ thống</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowFalseAlarmModal(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
              >
                Đóng
              </button>
              <button
                onClick={handleConfirmFalseAlarm}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                Xác nhận Hủy sự cố
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác thực Chữ ký Điều xe 115 (Tier 3 Gate) */}
      {showAmbulanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <Ambulance className="h-6 w-6" />
              <h3 className="text-base font-bold">Xác Thực Điều Xe Cấp Cứu 115 (Tier 3 Gate)</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Theo quy định pháp luật về dịch vụ khẩn cấp công, AI <strong>không được tự ý gọi 115</strong>. Bắt buộc Điều phối viên nhập mã xác thực chịu trách nhiệm.
            </p>
            <div className="mt-3 space-y-2">
              <label className="text-xs font-medium text-foreground">Mã định danh Điều phối viên (Supervisor Code):</label>
              <input
                type="text"
                value={supervisorCode}
                onChange={(e) => setSupervisorCode(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs font-bold outline-none"
                placeholder="VD: SUP-0137"
              />
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                Đơn vị cấp cứu tiếp nhận: <strong>{incident.nearestHospital?.name || "Bệnh viện Chợ Rẫy"}</strong> (Cách {incident.nearestHospital?.distance || "1.2km"})
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAmbulanceModal(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmAmbulance}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                Ký duyệt & Điều xe 115
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hồ Sơ Bằng Chứng Sự Cố Pháp Lý */}
      {showDossierModal && (
        <IncidentDossierModal
          incidentId={incident.id}
          onClose={() => setShowDossierModal(false)}
        />
      )}
    </div>
  );
}
