import React, { useState, useMemo } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  Info,
  Layers,
  Printer,
  ShieldAlert,
  Stethoscope,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Tag } from "@/components/Badge";

/// ============================================================================
/// SAFESOLO WEB ADMIN - BẢNG PHÂN LOẠI LÂM SÀNG NEWS2 CHUẨN QUỐC TẾ
/// (National Early Warning Score 2 - Clinical Triage Engine)
///
/// Tác giả: Đoàn Minh Quân - MSSV: 2224801030137 - KTPM03
/// Phục vụ: Đánh giá phân tầng mức độ nguy kịch của nạn nhân theo chuẩn
/// Royal College of Physicians (RCP London), hỗ trợ Bác sĩ/Trực ban ra quyết
/// định điều xe Cấp cứu 115 hoặc Hiệp sĩ SafeSolo chuẩn xác.
/// ============================================================================

interface News2ClinicalTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentName: string;
  incidentId: string;
  initialHeartRate?: number;
  initialSpo2?: number;
  onApplyTriageToDispatch?: (score: number, riskLevel: string, actionPlan: string) => void;
}

export function News2ClinicalTriageModal({
  isOpen,
  onClose,
  incidentName,
  incidentId,
  initialHeartRate = 124,
  initialSpo2 = 91,
  onApplyTriageToDispatch,
}: News2ClinicalTriageModalProps) {
  // 7 Thông số lâm sàng chuẩn NEWS2:
  const [respirationRate, setRespirationRate] = useState<number>(26); // Nhịp thở (lần/phút)
  const [spo2, setSpo2] = useState<number>(initialSpo2); // SpO2 (%)
  const [airOrOxygen, setAirOrOxygen] = useState<"AIR" | "OXYGEN">("AIR"); // Thở khí trời hay có trợ thở oxy
  const [systolicBp, setSystolicBp] = useState<number>(142); // Huyết áp tâm thu (mmHg)
  const [heartRate, setHeartRate] = useState<number>(initialHeartRate); // Nhịp tim (bpm)
  const [consciousness, setConsciousness] = useState<"A" | "CVPU">("CVPU"); // A=Alert, CVPU=Confusion/Voice/Pain/Unresponsive
  const [temperature, setTemperature] = useState<number>(37.2); // Thân nhiệt (°C)

  // 1. Tính điểm từng tham số:
  const scoreRespiration = useMemo(() => {
    if (respirationRate <= 8) return 3;
    if (respirationRate >= 9 && respirationRate <= 11) return 1;
    if (respirationRate >= 12 && respirationRate <= 20) return 0;
    if (respirationRate >= 21 && respirationRate <= 24) return 2;
    return 3; // >= 25
  }, [respirationRate]);

  const scoreSpo2 = useMemo(() => {
    if (spo2 <= 91) return 3;
    if (spo2 >= 92 && spo2 <= 93) return 2;
    if (spo2 >= 94 && spo2 <= 95) return 1;
    return 0; // >= 96
  }, [spo2]);

  const scoreOxygen = useMemo(() => {
    return airOrOxygen === "OXYGEN" ? 2 : 0;
  }, [airOrOxygen]);

  const scoreBp = useMemo(() => {
    if (systolicBp <= 90) return 3;
    if (systolicBp >= 91 && systolicBp <= 100) return 2;
    if (systolicBp >= 101 && systolicBp <= 110) return 1;
    if (systolicBp >= 111 && systolicBp <= 219) return 0;
    return 3; // >= 220
  }, [systolicBp]);

  const scorePulse = useMemo(() => {
    if (heartRate <= 40) return 3;
    if (heartRate >= 41 && heartRate <= 50) return 1;
    if (heartRate >= 51 && heartRate <= 90) return 0;
    if (heartRate >= 91 && heartRate <= 110) return 1;
    if (heartRate >= 111 && heartRate <= 130) return 2;
    return 3; // >= 131
  }, [heartRate]);

  const scoreConsciousness = useMemo(() => {
    return consciousness === "A" ? 0 : 3;
  }, [consciousness]);

  const scoreTemp = useMemo(() => {
    if (temperature <= 35.0) return 3;
    if (temperature >= 35.1 && temperature <= 36.0) return 1;
    if (temperature >= 36.1 && temperature <= 38.0) return 0;
    if (temperature >= 38.1 && temperature <= 39.0) return 1;
    return 2; // >= 39.1
  }, [temperature]);

  // Tổng điểm NEWS2
  const totalNews2Score =
    scoreRespiration +
    scoreSpo2 +
    scoreOxygen +
    scoreBp +
    scorePulse +
    scoreConsciousness +
    scoreTemp;

  const hasExtremeSingleScore =
    scoreRespiration === 3 ||
    scoreSpo2 === 3 ||
    scoreBp === 3 ||
    scorePulse === 3 ||
    scoreConsciousness === 3 ||
    scoreTemp === 3;

  // Phân tầng rủi ro lâm sàng
  const triageTier = useMemo(() => {
    if (totalNews2Score >= 7) {
      return {
        level: "HIGH_RISK",
        label: "NGUY CƠ KHẨN CẤP / ĐE DỌA TÍNH MẠNG (RED ALERT)",
        badgeTone: "sos" as const,
        color: "text-rose-400",
        border: "border-rose-500/50",
        bg: "bg-rose-500/10",
        responseTime: "NGAY LẬP TỨC (< 8 PHÚT)",
        actionPlan:
          "Kích hoạt Báo động Đỏ điều Cấp cứu 115 có Bác sĩ Hồi sức Cấp cứu (ICU Mobile). Điều động khẩn 2 Hiệp sĩ SafeSolo hỗ trợ mở đường và ép tim ngoài lồng ngực/thở oxy nếu nạn nhân ngừng thở.",
      };
    }
    if (totalNews2Score >= 5 || hasExtremeSingleScore) {
      return {
        level: "MEDIUM_RISK",
        label: "NGUY CƠ TRUNG BÌNH (URGENT CLINICAL RESPONSE)",
        badgeTone: "warning" as const,
        color: "text-amber-400",
        border: "border-amber-500/50",
        bg: "bg-amber-500/10",
        responseTime: "DƯỚI 15 PHÚT",
        actionPlan:
          "Điều phối khẩn 2 Hiệp sĩ SafeSolo lân cận (<850m) tiếp cận hiện trường đo lại huyết áp & SpO2. Gọi điện thoại video hướng dẫn người thân sơ cứu tư thế hồi sức an toàn.",
      };
    }
    return {
      level: "LOW_RISK",
      label: "NGUY CƠ THẤP / THEO DÕI ĐỊNH KỲ (LOW CLINICAL RISK)",
      badgeTone: "success" as const,
      color: "text-emerald-400",
      border: "border-emerald-500/50",
      bg: "bg-emerald-500/10",
      responseTime: "THEO DÕI 4 - 6 GIỜ",
      actionPlan:
        "Bệnh nhân trong tầm kiểm soát an toàn. Bật chế độ DeadMan giám sát sinh tồn từ xa qua Samsung Galaxy Watch 5, cảnh báo người nhà theo dõi.",
    };
  }, [totalNews2Score, hasExtremeSingleScore]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-sky-500/40 bg-[#0B132B] shadow-2xl text-foreground">
        {/* Header Modal */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-[#0B132B]/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                  HỆ THỐNG PHÂN LOẠI CẤP CỨU NEWS2 QUỐC TẾ
                </span>
                <Tag tone="info">ROYAL COLLEGE OF PHYSICIANS</Tag>
              </div>
              <h2 className="text-base font-extrabold text-white">
                Đánh giá Sinh tồn Lâm sàng · Nạn nhân: {incidentName} ({incidentId})
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* BANNER TỔNG ĐIỂM NEWS2 */}
          <div className={`rounded-2xl border ${triageTier.border} ${triageTier.bg} p-5 shadow-lg`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  TỔNG ĐIỂM SỐ NGUY CƠ LÂM SÀNG (NEWS2 SCORE)
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className={`text-4xl font-black ${triageTier.color}`}>
                    {totalNews2Score} / 20
                  </span>
                  <Tag tone={triageTier.badgeTone}>{triageTier.label}</Tag>
                </div>
                <p className="mt-2 text-xs text-foreground/90 max-w-2xl leading-relaxed">
                  <strong>Khuyến nghị điều phối:</strong> {triageTier.actionPlan}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-right min-w-[180px]">
                <div className="text-[11px] text-muted-foreground font-medium">THỜI GIAN ĐÁP ỨNG MỤC TIÊU</div>
                <div className="text-lg font-extrabold text-white mt-0.5">{triageTier.responseTime}</div>
                <div className="text-[10px] text-sky-400 font-mono mt-1">KTPM03 · SUP-0137 VALIDATED</div>
              </div>
            </div>
          </div>

          {/* BẢNG 7 THAM SỐ SINH TỒN NEWS2 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-sky-400" />
                Ma trận 7 Thông Số Sinh Trắc Đo Lường
              </h3>
              <span className="text-[11px] text-muted-foreground font-medium">
                Dữ liệu đo tự động từ cảm biến BioActive PPG & IMU Galaxy Watch 5
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* 1. Nhịp thở */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <Wind className="h-3.5 w-3.5 text-sky-400" /> Nhịp thở (Respiration)
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getScoreBadgeClass(scoreRespiration)}`}>
                    +{scoreRespiration} điểm
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-white">{respirationRate}</span>
                  <span className="text-xs text-muted-foreground">lần/phút</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="38"
                  value={respirationRate}
                  onChange={(e) => setRespirationRate(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
                <div className="text-[10px] text-muted-foreground">Chuẩn: 12 - 20 (0đ) · Thở dốc &gt;24 (+3đ)</div>
              </div>

              {/* 2. SpO2 */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <Activity className="h-3.5 w-3.5 text-rose-400" /> Nồng độ Oxy SpO2
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getScoreBadgeClass(scoreSpo2)}`}>
                    +{scoreSpo2} điểm
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-white">{spo2}%</span>
                  <span className="text-xs text-muted-foreground">Khí trời (Scale 1)</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="100"
                  value={spo2}
                  onChange={(e) => setSpo2(Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
                <div className="text-[10px] text-muted-foreground">Chuẩn: &ge;96% (0đ) · Tụt oxy &le;91% (+3đ)</div>
              </div>

              {/* 3. Trợ thở Oxy */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <Zap className="h-3.5 w-3.5 text-amber-400" /> Bổ sung Oxy Trợ Thở
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getScoreBadgeClass(scoreOxygen)}`}>
                    +{scoreOxygen} điểm
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setAirOrOxygen("AIR")}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      airOrOxygen === "AIR"
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/50"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Khí trời (0đ)
                  </button>
                  <button
                    onClick={() => setAirOrOxygen("OXYGEN")}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      airOrOxygen === "OXYGEN"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Thở Oxy (+2đ)
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground">Có can thiệp bình thở oxy/mask: +2 điểm</div>
              </div>

              {/* 4. Huyết áp tâm thu */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <HeartPulse className="h-3.5 w-3.5 text-sky-400" /> Huyết Áp Tâm Thu
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getScoreBadgeClass(scoreBp)}`}>
                    +{scoreBp} điểm
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-white">{systolicBp}</span>
                  <span className="text-xs text-muted-foreground">mmHg</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="240"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
                <div className="text-[10px] text-muted-foreground">Chuẩn: 111 - 219 (0đ) · Tụt huyết áp &le;90 (+3đ)</div>
              </div>

              {/* 5. Nhịp tim */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <HeartPulse className="h-3.5 w-3.5 text-rose-400" /> Nhịp Tim (Pulse/HR)
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getScoreBadgeClass(scorePulse)}`}>
                    +{scorePulse} điểm
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-white">{heartRate}</span>
                  <span className="text-xs text-muted-foreground">bpm (Galaxy Watch 5)</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="170"
                  value={heartRate}
                  onChange={(e) => setHeartRate(Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
                <div className="text-[10px] text-muted-foreground">Chuẩn: 51 - 90 (0đ) · Nhịp nhanh kịch phát &gt;130 (+3đ)</div>
              </div>

              {/* 6. Ý thức (ACVPU) */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Thang Ý Thức (ACVPU)
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getScoreBadgeClass(scoreConsciousness)}`}>
                    +{scoreConsciousness} điểm
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setConsciousness("A")}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      consciousness === "A"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Tỉnh táo (Alert - 0đ)
                  </button>
                  <button
                    onClick={() => setConsciousness("CVPU")}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      consciousness === "CVPU"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/50"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Mê / Lú lẫn (+3đ)
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground">Lơ mơ / gọi không đáp ứng / đau: +3 điểm</div>
              </div>
            </div>
          </div>

          {/* 7. Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-sky-400" />
              <span>Khóa luận tốt nghiệp KTPM03: <strong>Đoàn Minh Quân - MSSV: 2224801030137</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-accent transition"
              >
                <Printer className="h-3.5 w-3.5" /> In Biên Bản Y Tế
              </button>

              <button
                onClick={() => {
                  if (onApplyTriageToDispatch) {
                    onApplyTriageToDispatch(totalNews2Score, triageTier.level, triageTier.actionPlan);
                  }
                  onClose();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-extrabold text-white shadow-lg hover:bg-sky-400 transition"
              >
                <CheckCircle2 className="h-4 w-4" /> Áp Dụng Vào Lệnh Điều Phối HITL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getScoreBadgeClass(score: number): string {
  if (score === 0) return "bg-emerald-500/20 text-emerald-400";
  if (score === 1) return "bg-sky-500/20 text-sky-400";
  if (score === 2) return "bg-amber-500/20 text-amber-400";
  return "bg-rose-500/20 text-rose-400 animate-pulse";
}
