import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Search,
  ShieldCheck,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Layers,
  Activity,
  DollarSign,
  UserCheck,
  Cpu,
  X,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchAuditLogs, type AuditLog } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Nhật ký hệ thống - SafeSolo Admin" }] }),
  component: Page,
});

const categories = [
  { label: "Tất cả", value: "All", icon: Layers },
  { label: "Điều phối (Dispatch)", value: "Dispatch", icon: Activity },
  { label: "KYC Hiệp sĩ", value: "KYC", icon: UserCheck },
  { label: "Tài chính & Hoa hồng", value: "Finance", icon: DollarSign },
  { label: "Hệ thống & AED", value: "System", icon: Cpu },
];

function Page() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ["audit-logs", query, category],
    queryFn: () => fetchAuditLogs({ q: query, category }),
  });

  const logs = logsQuery.data?.data ?? [];

  // Thống kê nhanh
  const stats = {
    total: logs.length,
    dispatch: logs.filter((l) => l.category?.toLowerCase() === "dispatch").length,
    kyc: logs.filter((l) => l.category?.toLowerCase() === "kyc").length,
    finance: logs.filter((l) => l.category?.toLowerCase() === "finance").length,
    system: logs.filter((l) => l.category?.toLowerCase() === "system").length,
  };

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExport = () => {
    exportWorkbook("safesolo-admin-audit-logs.xlsx", [
      {
        name: "AuditLogs",
        rows: logs.map((log) => ({
          ID: log.id,
          "Thời gian": log.ts,
          "Người thực hiện": log.actor,
          "Hành động": log.action,
          "Đối tượng": log.target,
          "Danh mục": log.category || "Hệ thống",
          "Mức cảnh báo": log.tone || "info",
          "Mã băm SHA-256": log.hash,
          "Chi tiết bổ sung": JSON.stringify(log.metadata || {}),
        })),
      },
    ]);
  };

  const getCategoryBadge = (cat?: string) => {
    const normalized = (cat || "").toLowerCase();
    if (normalized === "dispatch") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Activity className="h-3 w-3" /> Điều phối
        </span>
      );
    }
    if (normalized === "kyc") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <UserCheck className="h-3 w-3" /> KYC
        </span>
      );
    }
    if (normalized === "finance") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <DollarSign className="h-3 w-3" /> Tài chính
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <Cpu className="h-3 w-3" /> Hệ thống
      </span>
    );
  };

  return (
    <>
      <Topbar
        title="Nhật ký hệ thống & Kiểm toán bất biến"
        subtitle="Hồ sơ kiểm toán SHA-256 bất biến phục vụ đối soát Cấp cứu 115 & Luật Khám chữa bệnh 2023"
      />
      <div className="space-y-4 p-4 md:p-6">
        {/* KPI Thống Kê & Bất Biến */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Tổng bản ghi</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">{stats.total}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Lệnh điều phối 115</p>
              <p className="text-xl font-bold font-mono text-rose-400 mt-0.5">{stats.dispatch}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Phê duyệt KYC</p>
              <p className="text-xl font-bold font-mono text-blue-400 mt-0.5">{stats.kyc}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Đối soát tài chính</p>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{stats.finance}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Mã hóa chuỗi SHA-256</p>
              <p className="text-xs font-bold text-success flex items-center gap-1 mt-1">
                <ShieldCheck className="h-3.5 w-3.5" /> 100% Bất biến
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Thanh công cụ tìm kiếm và lọc */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-1 min-w-[260px] items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo người thực hiện, hành động, ID sự cố, mã băm..."
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => setCategory(item.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    category === item.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleExport}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium hover:bg-accent cursor-pointer transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Xuất Excel
          </button>
        </div>

        {/* Bảng Dữ Liệu Nhật Ký */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                  <th className="px-3 py-3 text-left font-semibold">Danh mục</th>
                  <th className="px-4 py-3 text-left font-semibold">Người thực hiện</th>
                  <th className="px-4 py-3 text-left font-semibold">Hành động</th>
                  <th className="px-4 py-3 text-left font-semibold">Đối tượng</th>
                  <th className="px-4 py-3 text-left font-semibold">Mã băm SHA-256</th>
                  <th className="px-3 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logsQuery.isLoading && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      <div className="inline-flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Đang đồng bộ chuỗi kiểm toán hệ thống SafeSolo...
                      </div>
                    </td>
                  </tr>
                )}
                {logsQuery.isError && (
                  <tr>
                    <td className="px-4 py-6 text-center text-destructive" colSpan={7}>
                      Không thể tải dữ liệu: {logsQuery.error.message}
                    </td>
                  </tr>
                )}
                {!logsQuery.isLoading && !logsQuery.isError && logs.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      Không tìm thấy bản ghi kiểm toán nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
                {!logsQuery.isLoading &&
                  !logsQuery.isError &&
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                        {formatTs(log.ts)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                        {log.actor}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Tag tone={log.tone}>{log.action}</Tag>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px] truncate max-w-[180px]">
                        {log.target}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground/80 whitespace-nowrap">
                        <span className="bg-muted/40 px-1.5 py-0.5 rounded border border-border">
                          {log.hash ? `${log.hash.slice(0, 14)}...` : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                        >
                          <ExternalLink className="h-3 w-3" /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Chi Tiết Nhật Ký Kiểm Toán */}
        {selectedLog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Bản ghi kiểm toán bảo mật
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Hồ sơ bất biến lưu trữ tuân thủ ISO 27001 & Điều 87 Luật Khám chữa bệnh
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-3 rounded-xl border border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Thời gian ghi nhận</p>
                    <p className="font-mono font-medium text-foreground mt-0.5">
                      {new Date(selectedLog.ts).toLocaleString("vi-VN", {
                        hour12: false,
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}{" "}
                      (ICT)
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Danh mục</p>
                    <div className="mt-0.5">{getCategoryBadge(selectedLog.category)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-3 rounded-xl border border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Người thực hiện</p>
                    <p className="font-medium text-foreground mt-0.5">{selectedLog.actor}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Mức độ hành động</p>
                    <div className="mt-0.5">
                      <Tag tone={selectedLog.tone}>{selectedLog.action}</Tag>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/20 p-3 rounded-xl border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Đối tượng tác động</p>
                  <p className="font-mono text-foreground font-semibold mt-0.5">{selectedLog.target}</p>
                </div>

                <div className="bg-muted/20 p-3 rounded-xl border border-border space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Mã băm SHA-256 (Hash)</p>
                    <button
                      onClick={() => handleCopy(selectedLog.hash)}
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-mono cursor-pointer"
                    >
                      {copiedHash === selectedLog.hash ? (
                        <>
                          <Check className="h-3 w-3 text-success" /> Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Sao chép SHA-256
                        </>
                      )}
                    </button>
                  </div>
                  <div className="rounded-lg bg-background/80 p-2 font-mono text-[11px] text-emerald-400 break-all border border-border">
                    {selectedLog.hash}
                  </div>
                </div>

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div className="bg-muted/20 p-3 rounded-xl border border-border space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Metadata & Tham số điều phối</p>
                    <pre className="max-h-36 overflow-auto rounded-lg bg-background/80 p-2 font-mono text-[10px] text-muted-foreground border border-border">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3 text-success" /> Chuỗi khối bất biến (Immutable Record)
                </span>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg bg-muted px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function formatTs(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

