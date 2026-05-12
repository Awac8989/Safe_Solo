import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Mail, MessageSquare, Phone, Send, Smartphone } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchChannelHealth } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/omnichannel")({
  head: () => ({ meta: [{ title: "Kênh liên lạc - SafeSolo Admin" }] }),
  component: Page,
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
  "SMS Provider": "Nhà cung cấp SMS",
  "SMS Fallback": "SMS dự phòng",
  "Zalo ZNS": "Zalo ZNS",
  "Telegram Bot": "Bot Telegram",
  "Gmail SMTP": "Gmail SMTP",
  "Voice Auto-Call": "Gọi tự động bằng giọng nói",
};

function Page() {
  const channelsQuery = useQuery({
    queryKey: ["channel-health"],
    queryFn: fetchChannelHealth,
    refetchInterval: 15000,
  });

  const channels = channelsQuery.data?.data.channels ?? [];
  const policy = channelsQuery.data?.data.policy ?? [];

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
      <Topbar title="Kênh liên lạc" subtitle="Sức khỏe hệ thống · định tuyến gửi thông điệp" />
      <div className="space-y-3 p-3">
        <div className="flex justify-end">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {channels.map((channel) => {
            const Icon = iconMap[channel.name as keyof typeof iconMap] || Smartphone;

            return (
              <div key={channel.name} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-info/10 text-info">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{channelLabelMap[channel.name] || channel.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{channel.vendor}</div>
                    </div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${channel.ok ? "bg-success pulse-sos" : "bg-sos pulse-sos"}`} />
                </div>
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hạn mức</div>
                    <div className="font-mono text-sm">{channel.quota}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>Tỉ lệ thành công</span>
                      <span>{channel.success}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${channel.success > 95 ? "bg-success" : "bg-warning"}`} style={{ width: `${channel.success}%` }} />
                    </div>
                  </div>
                  <div className="pt-1">
                    <Tag tone={channel.ok ? "success" : "sos"}>{channel.ok ? "Ổn định" : "Suy giảm"}</Tag>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Luồng dự phòng gửi thông điệp</h2>
              <p className="text-[11px] text-muted-foreground">
                Nếu một kênh lỗi, cảnh báo sẽ tự động chuyển xuống kênh tiếp theo
              </p>
            </div>
            <Tag tone="info">Chính sách đang áp dụng</Tag>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {policy.map((step, index) => (
              <div key={step.step} className="flex items-center gap-3">
                <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-sm font-semibold">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bước {step.step}</div>
                  {channelLabelMap[step.name] || step.name}
                  <div className="mt-1">
                    <Tag tone={step.tone as "info" | "warning" | "sos"}>Dự phòng</Tag>
                  </div>
                </div>
                {index < policy.length - 1 && <ArrowRight className="h-5 w-5 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
