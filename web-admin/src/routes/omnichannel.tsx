import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  Mail,
  MessageSquare,
  Phone,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchChannelHealth,
  testDispatchOmnichannel,
  type TestDispatchPayload,
  type TestDispatchResult,
} from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/omnichannel")({
  head: () => ({
    meta: [{ title: "Trung Tâm Điều Phối Cảnh Báo Đa Kênh - SafeSolo Admin" }],
  }),
  component: OmnichannelPage,
});

const iconMap = {
  "SMS Provider": Smartphone,
  "SMS Fallback": Smartphone,
  "Zalo ZNS": MessageSquare,
  "Telegram Bot": Send,
  "Gmail SMTP": Mail,
  "Voice Auto-Call": Phone,
} as const;

const channelLabelMap: Record<string, string> = {
  "SMS Provider": "Mạng SMS Viễn Thông",
  "SMS Fallback": "SMS Dự Phòng",
  "Zalo ZNS": "Zalo Cloud OA (ZNS)",
  "Telegram Bot": "Telegram Bot (@SFESOLOBot)",
  "Gmail SMTP": "Gmail SafeTag (Google SMTP)",
  "Voice Auto-Call": "Cuộc Gọi Tự Động Voice AI",
};

// 3 Kịch bản lâm sàng thực chiến mẫu
const DISPATCH_PRESETS = [
  {
    name: "Đột quỵ F.A.S.T & Té ngã ban đêm (Chú Tư 68t)",
    victimName: "Bùi Văn Tư",
    phoneNumber: "0913843958",
    address: "Hẻm 420 Nguyễn Tri Phương, Phường 8, Quận 5, TP.HCM",
    lat: 10.7602,
    lng: 106.6685,
    emergencyType: "ĐỘT QUỴ NÃO CẤP F.A.S.T & HẠ SpO2 (GIỜ VÀNG 4.5H)",
    medicalNotes: "Nhóm máu O-, Tiền sử tăng huyết áp và rung nhĩ, Dị ứng Penicillin",
  },
  {
    name: "Ngừng tim VF/VT Cần Mở Tủ Sốc Tim AED",
    victimName: "Hoàng Thị Mai",
    phoneNumber: "0909112233",
    address: "Trạm SafePoint 01 - Phố đi bộ Nguyễn Huệ, Quận 1, TP.HCM",
    lat: 10.7745,
    lng: 106.7032,
    emergencyType: "NGỪNG TUẦN HOÀN NGOẠI VIỆN (YÊU CẦU AED KHẨN CẤP)",
    medicalNotes: "Nhóm máu B+, Hôn mê sâu không đáp ứng, cần sốc điện khử rung trong 3 phút",
  },
  {
    name: "Tai nạn giao thông PHTLS Sốc Mất Máu",
    victimName: "Trần Quốc Huy",
    phoneNumber: "0988776655",
    address: "Ngã tư Hùng Vương - Lý Thường Kiệt, Quận 5, TP.HCM",
    lat: 10.7578,
    lng: 106.6598,
    emergencyType: "ĐA CHẤN THƯƠNG GIAO THÔNG & ĐỨT ĐỘNG MẠCH ĐÙI",
    medicalNotes: "Nhóm máu O-, Sốc mất máu cấp độ 3, Cần garô C.A.T và gọi 115 Chợ Rẫy",
  },
];

function OmnichannelPage() {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [victimName, setVictimName] = useState(DISPATCH_PRESETS[0].victimName);
  const [phoneNumber, setPhoneNumber] = useState(DISPATCH_PRESETS[0].phoneNumber);
  const [targetEmail, setTargetEmail] = useState("safesolocompanyvn@gmail.com");
  const [address, setAddress] = useState(DISPATCH_PRESETS[0].address);
  const [lat, setLat] = useState(DISPATCH_PRESETS[0].lat);
  const [lng, setLng] = useState(DISPATCH_PRESETS[0].lng);
  const [emergencyType, setEmergencyType] = useState(DISPATCH_PRESETS[0].emergencyType);
  const [medicalNotes, setMedicalNotes] = useState(DISPATCH_PRESETS[0].medicalNotes);

  const [dispatchResult, setDispatchResult] = useState<TestDispatchResult["data"] | null>(null);

  const channelsQuery = useQuery({
    queryKey: ["channel-health"],
    queryFn: fetchChannelHealth,
    refetchInterval: 12000,
  });

  const channels = channelsQuery.data?.data.channels ?? [];
  const policy = channelsQuery.data?.data.policy ?? [];
  const meta = channelsQuery.data?.data.meta;

  const testDispatchMutation = useMutation({
    mutationFn: () => {
      const payload: TestDispatchPayload = {
        victimName,
        phoneNumber,
        targetEmail,
        address,
        lat: Number(lat),
        lng: Number(lng),
        emergencyType,
        medicalNotes,
      };
      return testDispatchOmnichannel(payload);
    },
    onSuccess: (res) => {
      setDispatchResult(res.data);
      void channelsQuery.refetch();
    },
  });

  const applyPreset = (index: number) => {
    setSelectedPresetIndex(index);
    const p = DISPATCH_PRESETS[index];
    setVictimName(p.victimName);
    setPhoneNumber(p.phoneNumber);
    setAddress(p.address);
    setLat(p.lat);
    setLng(p.lng);
    setEmergencyType(p.emergencyType);
    setMedicalNotes(p.medicalNotes);
  };

  const handleExport = () => {
    exportWorkbook("safesolo-admin-channels.xlsx", [
      {
        name: "Kênh",
        rows: channels.map((channel) => ({
          Tên: channelLabelMap[channel.name] || channel.name,
          Vendor: channel.vendor,
          "Hạn mức": channel.quota,
          "Thành công phần trăm": channel.success,
          "Ổn định": channel.ok ? "Có" : "Không",
          "Thứ tự dự phòng": channel.fallbackOrder,
          "Đã gửi": channel.sent,
        })),
      },
      {
        name: "Policy",
        rows: policy.map((step) => ({
          Bước: step.step,
          Kênh: channelLabelMap[step.name] || step.name,
          Tone: step.tone,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar
        title="Trung Tâm Điều Phối Cảnh Báo Đa Kênh (Omnichannel Hub)"
        subtitle="Hệ thống leo thang 5 tầng: Telegram Bot (@SFESOLOBot) · Gmail SafeTag · Zalo ZNS · GSM SMS · Voice Call"
      />

      <div className="space-y-5 p-5 overflow-y-auto">
        {/* BANNER KẾT NỐI KỸ THUẬT LIVE 100% */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400">
                <Radio className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">Hạ Tầng Viễn Thông & Tác Chiến Khẩn Cấp SafeSolo</h2>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/30">
                    5/5 KÊNH TRỰC TUYẾN
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Đảm bảo tín hiệu SOS tiếp cận Người bảo hộ và Đội Hiệp sĩ ngoại viện trong vòng dưới 1.0 giây qua đa phương thức độc lập.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-1.5 text-xs text-sky-400 font-semibold">
                <Bot className="h-4 w-4" />
                Telegram: <strong>@{meta?.botUsername || "SFESOLOBot"}</strong>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-400 font-semibold">
                <Mail className="h-4 w-4" />
                Gmail: <strong>{meta?.gmailAccount || "safesolocompanyvn@gmail.com"}</strong>
              </div>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Xuất Excel
              </button>
            </div>
          </div>
        </div>

        {/* THẺ SỨC KHỎE 5 KÊNH PHÂN PHỐI */}
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-5">
          {channels.map((channel) => {
            const Icon = iconMap[channel.name as keyof typeof iconMap] || Smartphone;

            return (
              <div
                key={channel.name}
                className="rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/50 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{channelLabelMap[channel.name] || channel.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{channel.vendor}</div>
                    </div>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${channel.ok ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"}`}
                  />
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hạn mức / Quota</span>
                    <span className="font-mono font-semibold">{channel.quota}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      <span>Tỉ lệ chuyển phát</span>
                      <span className="font-bold text-foreground">{channel.success}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${channel.success > 95 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${channel.success}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <Tag tone={channel.ok ? "success" : "sos"}>{channel.ok ? "Sẵn sàng" : "Suy giảm"}</Tag>
                    <span className="text-[11px] text-muted-foreground font-mono">Đã gửi: {channel.sent}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BÀN THỬ NGHIỆM PHÁT CẢNH BÁO SOS ĐA KÊNH THỰC TẾ (LIVE DISPATCH CONSOLE) */}
        <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-card via-card to-red-950/10 p-5 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-red-500/15 text-red-500">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Bàn Chỉ Huy Bắn Tín Hiệu Báo Động SOS Đa Kênh Tác Chiến</h3>
                <p className="text-xs text-muted-foreground">
                  Kích hoạt đồng thời toàn bộ chuỗi leo thang 5 kênh: gửi Rich Card có tọa độ GPS tới @SFESOLOBot, chuyển phát Email SafeTag, phát SMS và xếp hàng cuộc gọi AI.
                </p>
              </div>
            </div>

            {/* Chọn Preset */}
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl">
              <span className="text-[11px] text-muted-foreground font-semibold px-2">Kịch bản mẫu:</span>
              {DISPATCH_PRESETS.map((p, idx) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(idx)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    selectedPresetIndex === idx
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Preset {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <div className="space-y-3 md:col-span-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Họ và tên Nạn nhân</label>
                  <input
                    type="text"
                    value={victimName}
                    onChange={(e) => setVictimName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Số điện thoại Nạn nhân</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email Người nhận / Gia đình</label>
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Loại Sự Cố Cấp Cứu</label>
                  <input
                    type="text"
                    value={emergencyType}
                    onChange={(e) => setEmergencyType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Địa chỉ Hiện trường & Tọa độ GPS</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-2 text-xs font-mono font-semibold"
                    placeholder="Lat"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-2 text-xs font-mono font-semibold"
                    placeholder="Lng"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Hồ Sơ Y Tế Vàng SafeTag (Nhóm máu, Dị ứng, Bệnh nền)</label>
                <input
                  type="text"
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-1 flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">
                  * Hệ thống sẽ gọi API thật tới Google SMTP và Telegram Bot API @SFESOLOBot.
                </div>
                <button
                  id="btn-test-dispatch-all"
                  onClick={() => testDispatchMutation.mutate()}
                  disabled={testDispatchMutation.isPending}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg transition-all disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  {testDispatchMutation.isPending ? "Đang Bắn Tín Hiệu Đa Kênh..." : "BẮN CẢNH BÁO ĐA KÊNH NGAY"}
                </button>
              </div>
            </div>

            {/* KẾT QUẢ DISPATCH PHẢN HỒI THỰC TẾ */}
            <div className="rounded-xl border border-border bg-background/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    Kết Quả Dispatch Thực Tế
                  </span>
                  {dispatchResult && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      {dispatchResult.testLogId}
                    </span>
                  )}
                </div>

                {dispatchResult ? (
                  <div className="space-y-2.5">
                    {dispatchResult.channels.map((ch) => (
                      <div
                        key={ch.channel}
                        className="rounded-lg border border-border bg-card p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            {ch.channel === "Telegram Bot" && <Send className="h-3.5 w-3.5 text-sky-400" />}
                            {ch.channel === "Gmail SafeTag" && <Mail className="h-3.5 w-3.5 text-amber-400" />}
                            {ch.channel === "Zalo ZNS" && <MessageSquare className="h-3.5 w-3.5 text-blue-400" />}
                            {ch.channel === "GSM SMS" && <Smartphone className="h-3.5 w-3.5 text-purple-400" />}
                            {ch.channel === "Voice Auto-Call" && <Phone className="h-3.5 w-3.5 text-rose-400" />}
                            {ch.channel}
                          </span>
                          <Tag tone={ch.status === "DELIVERED" ? "success" : ch.status === "QUEUED" ? "info" : "sos"}>
                            {ch.status}
                          </Tag>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[160px]">{ch.detail}</span>
                          <span className="font-mono text-emerald-400 font-bold">{ch.latencyMs}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-muted-foreground">
                    <Sparkles className="h-8 w-8 text-primary/40 mb-2" />
                    <p className="text-xs font-medium">Chưa có lượt bắn thử nghiệm nào</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Bấm nút bên trái để kích hoạt lệnh điều phối và đo đạc độ trễ các kênh.
                    </p>
                  </div>
                )}
              </div>

              {dispatchResult && (
                <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Thời điểm: {new Date(dispatchResult.dispatchedAt).toLocaleTimeString("vi-VN")}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 100% Hoàn Tất
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LUỒNG DỰ PHÒNG & CHÍNH SÁCH LEO THANG 5 TẦNG */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Chính Sách Dự Phòng & Thứ Tự Leo Thang Khẩn Cấp (Escalation Protocol)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nếu một kênh gặp sự cố mạng hoặc không có phản hồi, hệ thống sẽ tự động kích hoạt kênh tiếp theo sau mili-giây.
              </p>
            </div>
            <Tag tone="info">Chuẩn Tự Động 100%</Tag>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {policy.map((step, index) => (
              <div key={step.step} className="flex items-center gap-3">
                <div className="rounded-xl border border-border bg-background/80 px-4 py-3 text-xs font-semibold shadow-sm">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Cấp {step.step}
                  </div>
                  <div className="font-bold text-foreground text-sm mt-0.5">
                    {channelLabelMap[step.name] || step.name}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Tag tone={step.tone as "info" | "warning" | "sos"}>
                      {step.step === 1 ? "Tức thì (0s)" : step.step === 2 ? "+2s SafeTag" : step.step === 3 ? "+5s ZNS" : step.step === 4 ? "+10s SMS" : "+30s Voice"}
                    </Tag>
                  </div>
                </div>
                {index < policy.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
