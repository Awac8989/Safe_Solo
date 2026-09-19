import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  Brain,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  HeartPulse,
  Lock,
  Mic,
  PhoneCall,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import {
  fetchAiIncidentBriefing,
  executeSopAction,
  type AiBriefingData,
  type SopStepItem,
} from "@/lib/api";

interface AiIncidentCopilotDrawerProps {
  incidentId: string;
  onClose: () => void;
}

export function AiIncidentCopilotDrawer({ incidentId, onClose }: AiIncidentCopilotDrawerProps) {
  const queryClient = useQueryClient();
  const [activeStepAction, setActiveStepAction] = useState<string | null>(null);
  const [supervisorNote, setSupervisorNote] = useState("");
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const briefingQuery = useQuery({
    queryKey: ["ai-briefing", incidentId],
    queryFn: () => fetchAiIncidentBriefing(incidentId),
  });

  const data = briefingQuery.data?.data;
  const mm = data?.multimodalAnalysis;
  const sopSteps = data?.sopSteps ?? [];

  const sopMutation = useMutation({
    mutationFn: ({ actionCode, note }: { actionCode: string; note?: string }) =>
      executeSopAction(incidentId, actionCode, { note, supervisorName: "Đoàn Minh Quân (Trưởng ca SUP-0137)" }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-briefing", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      setActiveStepAction(null);
      setSupervisorNote("");
      setActionSuccessNotice(`Thực thi thành công bước: ${res.data.updatedStep.label}`);
      setTimeout(() => setActionSuccessNotice(null), 3000);
    },
  });

  const handleExecute = (code: string) => {
    sopMutation.mutate({ actionCode: code, note: supervisorNote || "Điều phối viên xác thực 1-chạm" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-sky-500/30 bg-card shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-6 py-3.5 backdrop-blur shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <Brain className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide text-foreground">
                  TRỢ LÝ AI COPILOT & QUY TRÌNH CHUẨN (SOP)
                </span>
                <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-400">
                  {incidentId}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tình báo sự cố đa phương thức · Chống báo động giả & Tự động hóa tác chiến 1-chạm
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice Toast */}
        {actionSuccessNotice && (
          <div className="bg-emerald-950/40 border-b border-emerald-500/30 px-6 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {briefingQuery.isLoading ? (
            <div className="p-16 text-center text-sm text-muted-foreground animate-pulse">
              AI Copilot đang phân tích tín hiệu âm thanh và nhịp sinh tồn...
            </div>
          ) : data ? (
            <>
              {/* Top Banner: Credibility Score & Golden Hour */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Score Card */}
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Điểm Tin Cậy AI (Anti-False Alarm Score)
                    </div>
                    <div className="text-xl font-black text-foreground mt-0.5 flex items-center gap-2">
                      <span className="text-emerald-400">{data.credibilityScore}%</span>
                      <span className="text-xs font-semibold text-muted-foreground">· Sự cố thật</span>
                    </div>
                    <p className="text-[10px] text-emerald-300/80 mt-0.5">
                      {data.credibilityVerdict}
                    </p>
                  </div>
                </div>

                {/* Golden Hour Clock */}
                <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                    <Clock className="h-6 w-6 animate-spin-slow" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                      Tiên Lượng Thời Gian Vàng (Golden Hour)
                    </div>
                    <div className="text-xl font-black text-rose-400 mt-0.5">
                      Còn {data.goldenHourPrognosis.remainingMinutes} phút vàng
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      {data.goldenHourPrognosis.advice}
                    </p>
                  </div>
                </div>
              </div>

              {/* Multimodal Intelligence 4-Pillars Matrix */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                  Phân Tích Đa Phương Thức AI (Multimodal Signal Intelligence)
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {/* Pillar 1: Audio Signals */}
                  <div className="rounded-xl border border-border/80 bg-background/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-400">
                      <span className="flex items-center gap-1.5">
                        <Mic className="h-3.5 w-3.5" /> Âm thanh khẩn cấp (Microphone Safe Vault)
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{mm?.audio.decibelPeak} dB đỉnh</span>
                    </div>
                    <div className="rounded-lg bg-card/70 p-2 text-xs border border-border/50 text-foreground/90 italic">
                      "{mm?.audio.transcript}"
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {mm?.audio.detectedKeywords.map((kw, i) => (
                        <span key={i} className="rounded bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 text-[9px] font-bold text-rose-400">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pillar 2: Motion & Impact */}
                  <div className="rounded-xl border border-border/80 bg-background/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" /> Cảm biến chuyển động & Va đập (IMU)
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{mm?.motion.impactG} g lực</span>
                    </div>
                    <div className="rounded-lg bg-card/70 p-2 text-xs border border-border/50 text-foreground/90">
                      <strong>Tình trạng:</strong> {mm?.motion.status}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Thời gian rơi tự do: {mm?.motion.freeFallDurationMs}ms · Bất động sau va chạm: {mm?.motion.postImpactImmobilitySeconds}s
                    </div>
                  </div>

                  {/* Pillar 3: Biometrics Telemetry */}
                  <div className="rounded-xl border border-border/80 bg-background/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                      <span className="flex items-center gap-1.5">
                        <HeartPulse className="h-3.5 w-3.5" /> Sinh trắc học Wear OS (Vitals)
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{mm?.biometrics.currentHr} bpm</span>
                    </div>
                    <div className="rounded-lg bg-card/70 p-2 text-xs border border-border/50 text-foreground/90">
                      <strong>Rối loạn nhịp:</strong> {mm?.biometrics.rhythm}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Nhịp cơ bản: {mm?.biometrics.baselineHr} bpm ➔ Đỉnh nhịp: {mm?.biometrics.peakHr} bpm · SpO2: {mm?.biometrics.spo2}%
                    </div>
                  </div>

                  {/* Pillar 4: Medical Context */}
                  <div className="rounded-xl border border-border/80 bg-background/70 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" /> Hồ sơ Y tế & Liên lạc ICE
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">Nhóm máu {mm?.medicalContext.bloodType}</span>
                    </div>
                    <div className="rounded-lg bg-card/70 p-2 text-xs border border-border/50 text-foreground/90">
                      <strong>Bệnh nền:</strong> {mm?.medicalContext.chronicConditions || "Không có"} · <strong>Dị ứng:</strong> {mm?.medicalContext.allergies}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Người thân khẩn cấp: {mm?.medicalContext.emergencyContact}
                    </div>
                  </div>
                </div>
              </div>

              {/* SOP Action Checklist */}
              <div className="rounded-xl border border-border/80 bg-background/80 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-sky-400" />
                      Quy Trình Ứng Phó Tiêu Chuẩn (Standard Operating Procedures - SOP)
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Các bước hành động khẩn cấp được khuyến nghị bởi AI và thực thi có sự giám sát của Trưởng ca
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-sky-400">
                    {sopSteps.filter((s) => s.status === "COMPLETED").length} / {sopSteps.length} Hoàn tất
                  </span>
                </div>

                <div className="space-y-2.5">
                  {sopSteps.map((step, index) => {
                    const isDone = step.status === "COMPLETED";

                    return (
                      <div
                        key={step.code}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                          isDone
                            ? "border-emerald-500/30 bg-emerald-950/15"
                            : "border-border/80 bg-card/60 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 mt-0.5 ${
                              isDone ? "bg-emerald-500 text-black" : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">{step.label}</span>
                              {step.autoExecuted && (
                                <span className="rounded bg-sky-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-sky-400">
                                  Tự động
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {step.description}
                            </p>
                            {isDone && step.actor && (
                              <div className="mt-1 text-[10px] font-mono text-emerald-400/90">
                                ✓ Xác thực bởi {step.actor} lúc {new Date(step.completedAt || "").toLocaleTimeString("vi-VN")}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> ĐÃ THỰC THI
                            </span>
                          ) : (
                            <button
                              onClick={() => handleExecute(step.code)}
                              disabled={sopMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500 shadow-md transition disabled:opacity-50"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              Thực Thi 1-Chạm
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
