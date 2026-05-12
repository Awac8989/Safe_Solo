import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Download, TrendingUp, Wallet } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchRevenueSummary } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/revenue")({
  head: () => ({ meta: [{ title: "Doanh thu và đối tác - SafeSolo Admin" }] }),
  component: Page,
});

function Page() {
  const revenueQuery = useQuery({
    queryKey: ["revenue-summary"],
    queryFn: fetchRevenueSummary,
  });

  const data = revenueQuery.data?.data;
  const partners = data?.partners ?? [];
  const sparkline = data?.sparkline ?? [];
  const max = Math.max(...sparkline, 1);
  const points = sparkline
    .map((value, index) => `${(index / Math.max(sparkline.length - 1, 1)) * 100},${100 - (value / max) * 100}`)
    .join(" ");

  const handleExport = () => {
    exportWorkbook("safesolo-admin-revenue.xlsx", [
      {
        name: "Tổng quan",
        rows: data
          ? [{
              "Doanh thu AdMob 30 ngày": data.cards.admobRevenue30d,
              "Hoa hồng chưa thanh toán": data.cards.unpaidCommissions,
              "Đối tác đang hoạt động": data.cards.activePartners,
            }]
          : [],
      },
      {
        name: "Đối tác",
        rows: partners.map((partner) => ({
          Tên: partner.name,
          "Khu vực": partner.region,
          "Lượt điều phối": partner.dispatches,
          "Tỷ lệ": partner.rate,
          "Số dư chưa thanh toán": partner.balance,
        })),
      },
      {
        name: "Sparkline",
        rows: sparkline.map((value, index) => ({
          Ngày: index + 1,
          USD: value,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar title="Doanh thu và đối tác" subtitle="Thu nhập AdMob · hoa hồng điều phối y tế" />
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
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Doanh thu AdMob (30 ngày)",
              value: usd(data?.cards.admobRevenue30d || 0),
              icon: TrendingUp,
              tone: "success" as const,
              sub: "Chỉ số tổng hợp cho admin",
            },
            {
              label: "Hoa hồng chưa thanh toán",
              value: vnd(data?.cards.unpaidCommissions || 0),
              icon: Wallet,
              tone: "warning" as const,
              sub: `${partners.length} đối tác đang chờ`,
            },
            {
              label: "Bệnh viện đối tác đang hoạt động",
              value: String(data?.cards.activePartners || 0),
              icon: Building2,
              tone: "info" as const,
              sub: "Danh sách đang vận hành",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold">{item.value}</div>
              <div className="mt-1">
                <Tag tone={item.tone}>{item.sub}</Tag>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Doanh thu quảng cáo AdMob · 30 ngày gần nhất</h2>
              <p className="text-[11px] text-muted-foreground">USD mỗi ngày</p>
            </div>
            <Tag tone="success">Đang tăng</Tag>
          </div>
          <div className="mt-4">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-48 w-full">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.18 220)" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="oklch(0.72 0.18 220)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline points={`0,100 ${points} 100,100`} fill="url(#g)" stroke="none" />
              <polyline points={points} fill="none" stroke="oklch(0.72 0.18 220)" strokeWidth="0.6" />
            </svg>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Hoa hồng điều xe cứu thương</h2>
              <p className="text-[11px] text-muted-foreground">Theo từng bệnh viện đối tác · kỳ hiện tại</p>
            </div>
            <button className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Yêu cầu thanh toán
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Đối tác</th>
                  <th className="px-4 py-2 text-left font-medium">Lượt điều phối thành công</th>
                  <th className="px-4 py-2 text-left font-medium">Tỷ lệ</th>
                  <th className="px-4 py-2 text-left font-medium">Số dư chưa thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.name} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3 font-medium">{partner.name}</td>
                    <td className="px-4 py-3 font-mono">{partner.dispatches}</td>
                    <td className="px-4 py-3">
                      <Tag tone="info">{partner.rate}</Tag>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">{vnd(partner.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function vnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}
