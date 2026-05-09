import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { MessageSquare, Send, Mail, Phone, Smartphone, ArrowRight } from "lucide-react";
import { fetchChannelHealth } from "@/lib/api";

export const Route = createFileRoute("/omnichannel")({
  head: () => ({ meta: [{ title: "Kenh lien lac - SafeSolo Admin" }] }),
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
  "SMS Provider": "Nha cung cap SMS",
  "SMS Fallback": "SMS du phong",
  "Zalo ZNS": "Zalo ZNS",
  "Telegram Bot": "Bot Telegram",
  "Gmail SMTP": "Gmail SMTP",
  "Voice Auto-Call": "Goi tu dong bang giong noi",
};

function Page() {
  const channelsQuery = useQuery({
    queryKey: ["channel-health"],
    queryFn: fetchChannelHealth,
    refetchInterval: 15000,
  });

  const channels = channelsQuery.data?.data.channels ?? [];
  const policy = channelsQuery.data?.data.policy ?? [];

  return (
    <>
      <Topbar title="Kenh lien lac" subtitle="Suc khoe he thong · dinh tuyen gui thong diep" />
      <div className="space-y-3 p-3">
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
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Han muc</div>
                    <div className="font-mono text-sm">{channel.quota}</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>Ti le thanh cong</span>
                      <span>{channel.success}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${channel.success > 95 ? "bg-success" : "bg-warning"}`} style={{ width: `${channel.success}%` }} />
                    </div>
                  </div>
                  <div className="pt-1">
                    <Tag tone={channel.ok ? "success" : "sos"}>{channel.ok ? "On dinh" : "Suy giam"}</Tag>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Luong du phong gui thong diep</h2>
              <p className="text-[11px] text-muted-foreground">
                Neu mot kenh loi, canh bao se tu dong chuyen xuong kenh tiep theo
              </p>
            </div>
            <Tag tone="info">Chinh sach dang ap dung</Tag>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {policy.map((step, index) => (
              <div key={step.step} className="flex items-center gap-3">
                <div className="rounded-lg border border-border bg-background/60 px-4 py-3 text-sm font-semibold">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Buoc {step.step}</div>
                  {channelLabelMap[step.name] || step.name}
                  <div className="mt-1">
                    <Tag tone={step.tone as "info" | "warning" | "sos"}>Du phong</Tag>
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
