import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  Printer,
  QrCode,
  Send,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchRevenueSummary, settlePartnerCommission } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/revenue")({
  head: () => ({ meta: [{ title: "Doanh thu và đối tác - SafeSolo Admin" }] }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<{
    name: string;
    rate: string;
    region: string;
    dispatches: number;
    balance: number;
  } | null>(null);

  const [settleAmount, setSettleAmount] = useState<number>(50000000);
  const [settleBank, setSettleBank] = useState<string>("Techcombank (TCB)");
  const [settleAccount, setSettleAccount] = useState<string>("1903847291028");
  const [settleBeneficiary, setSettleBeneficiary] = useState<string>("CONG TY CP BENH VIEN Y TE");
  const [settleNote, setSettleNote] = useState<string>(
    "Thanh toán hoa hồng điều phối xe cứu thương 115 SafeSolo kỳ hiện tại"
  );
  const [settleResult, setSettleResult] = useState<{
    settlementId: string;
    partnerName: string;
    amount: number;
    settledAt: string;
    status: string;
    message: string;
  } | null>(null);

  const revenueQuery = useQuery({
    queryKey: ["revenue-summary"],
    queryFn: fetchRevenueSummary,
    refetchInterval: 15000,
  });

  const settleMutation = useMutation({
    mutationFn: (payload: {
      partnerName: string;
      amount: number;
      bankAccount: string;
      bankName: string;
      beneficiaryName: string;
      note: string;
    }) => settlePartnerCommission(payload),
    onSuccess: (res) => {
      setSettleResult(res.data);
      setActionNotice(`Đã hoàn tất lệnh ủy nhiệm chi giải ngân: ${res.data.settlementId}`);
      setTimeout(() => setActionNotice(null), 4000);
      void queryClient.invalidateQueries({ queryKey: ["revenue-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  const handleOpenSettle = (partner: {
    name: string;
    rate: string;
    region: string;
    dispatches: number;
    balance: number;
  }) => {
    setSelectedPartner(partner);
    setSettleAmount(partner.balance);
    setSettleBeneficiary(`BỆNH VIỆN ${partner.name.toUpperCase()}`);
    setSettleNote(`Quyết toán ${partner.dispatches} lượt điều xe cấp cứu 115 cho ${partner.name}`);
    setSettleResult(null);
  };

  const handleExecuteSettle = () => {
    if (!selectedPartner) return;
    settleMutation.mutate({
      partnerName: selectedPartner.name,
      amount: settleAmount,
      bankAccount: settleAccount,
      bankName: settleBank,
      beneficiaryName: settleBeneficiary,
      note: settleNote,
    });
  };

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
          ? [
              {
                "Doanh thu AdMob 30 ngày": data.cards.admobRevenue30d,
                "Hoa hồng chưa thanh toán": data.cards.unpaidCommissions,
                "Đối tác đang hoạt động": data.cards.activePartners,
              },
            ]
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
      <Topbar title="Doanh thu và đối tác" subtitle="Thu nhập AdMob · hoa hồng điều phối y tế 115" />
      <div className="space-y-4 p-4 pb-16">
        {/* Toast Notice */}
        {actionNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            {actionNotice}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (partners.length > 0) handleOpenSettle(partners[0]);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Quyết Toán Kỳ Hiện Tại
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent transition"
          >
            <Download className="h-3.5 w-3.5" />
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
              sub: "Thu nhập ròng từ quảng cáo",
            },
            {
              label: "Hoa hồng chưa thanh toán",
              value: vnd(data?.cards.unpaidCommissions || 0),
              icon: Wallet,
              tone: "warning" as const,
              sub: `${partners.length} bệnh viện đối tác đang chờ`,
            },
            {
              label: "Bệnh viện đối tác đang hoạt động",
              value: String(data?.cards.activePartners || 0),
              icon: Building2,
              tone: "info" as const,
              sub: "Mạng lưới kết nối cấp cứu 115",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-foreground">{item.value}</div>
              <div className="mt-1">
                <Tag tone={item.tone}>{item.sub}</Tag>
              </div>
            </div>
          ))}
        </div>

        {/* 30-Day Trend Chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Doanh thu quảng cáo AdMob · 30 ngày gần nhất</h2>
              <p className="text-[11px] text-muted-foreground">USD mỗi ngày</p>
            </div>
            <Tag tone="success">Đang tăng trưởng</Tag>
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

        {/* Hospital Partner Commissions Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Hoa hồng điều xe cứu thương ngoại viện</h2>
              <p className="text-[11px] text-muted-foreground">Theo từng bệnh viện đối tác · kỳ quyết toán hiện tại</p>
            </div>
            <button
              onClick={() => {
                if (partners.length > 0) handleOpenSettle(partners[0]);
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow"
            >
              Yêu cầu thanh toán
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Bệnh viện đối tác</th>
                  <th className="px-4 py-3 text-left font-semibold">Khu vực</th>
                  <th className="px-4 py-3 text-left font-semibold">Lượt điều phối thành công</th>
                  <th className="px-4 py-3 text-left font-semibold">Tỷ lệ hoa hồng</th>
                  <th className="px-4 py-3 text-left font-semibold">Số dư chưa thanh toán</th>
                  <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {partners.map((partner) => (
                  <tr key={partner.name} className="hover:bg-accent/30 transition">
                    <td className="px-4 py-3 font-bold text-foreground flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-sky-400" />
                      {partner.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{partner.region}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{partner.dispatches} lượt</td>
                    <td className="px-4 py-3">
                      <Tag tone="info">{partner.rate}</Tag>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">{vnd(partner.balance)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenSettle(partner)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 transition shadow-sm"
                      >
                        <CreditCard className="h-3 w-3" /> Quyết toán
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commission Settlement Modal */}
        {selectedPartner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg rounded-2xl border border-emerald-500/50 bg-[#090d16] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                  <h3 className="text-base font-bold uppercase tracking-wider text-white">
                    Ủy Nhiệm Chi Giải Ngân Hoa Hồng Y Tế
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Partner Summary Card */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{selectedPartner.name}</h4>
                    <p className="text-[11px] text-muted-foreground">Khu vực: {selectedPartner.region} · Tỷ lệ: {selectedPartner.rate}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Lượt điều xe</span>
                    <strong className="text-sm font-mono text-emerald-400">{selectedPartner.dispatches} chuyến</strong>
                  </div>
                </div>
              </div>

              {/* Settlement Form Controls */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Số Tiền Giải Ngân (VND):
                  </label>
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono font-bold text-emerald-400 text-sm outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Bằng chữ: {vnd(settleAmount)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Ngân Hàng Thụ Hưởng:
                    </label>
                    <select
                      value={settleBank}
                      onChange={(e) => setSettleBank(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-emerald-500"
                    >
                      <option value="Techcombank (TCB)">Techcombank (TCB)</option>
                      <option value="Vietcombank (VCB)">Vietcombank (VCB)</option>
                      <option value="BIDV">BIDV</option>
                      <option value="MBBank">MBBank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Số Tài Khoản Doanh Nghiệp:
                    </label>
                    <input
                      type="text"
                      value={settleAccount}
                      onChange={(e) => setSettleAccount(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Tên Đơn Vị Thụ Hưởng:
                  </label>
                  <input
                    type="text"
                    value={settleBeneficiary}
                    onChange={(e) => setSettleBeneficiary(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs uppercase font-mono outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Nội Dung Giao Dịch Đối Soát:
                  </label>
                  <textarea
                    rows={2}
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Settlement Success Card */}
              {settleResult && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/25 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> ĐÃ DUYỆT ỦY NHIỆM CHI
                    </span>
                    <span className="font-mono text-[11px]">{settleResult.settlementId}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {settleResult.message}
                  </p>
                  <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                    <span>Thời gian: {new Date(settleResult.settledAt).toLocaleString("vi-VN")}</span>
                    <span className="font-mono text-emerald-400">VietQR 24/7 Verified</span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
                >
                  <Printer className="h-3.5 w-3.5" /> In Biên Bản Đối Soát
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPartner(null)}
                    className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent transition"
                  >
                    {settleResult ? "Đóng" : "Hủy"}
                  </button>
                  {!settleResult && (
                    <button
                      type="button"
                      disabled={settleMutation.isPending}
                      onClick={handleExecuteSettle}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-lg transition disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {settleMutation.isPending ? "Đang giải ngân..." : "Xác Nhận Giải Ngân (VietQR)"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
