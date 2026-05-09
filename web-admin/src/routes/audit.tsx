import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { Search, Download } from "lucide-react";
import { fetchAuditLogs } from "@/lib/api";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Nhat ky he thong - SafeSolo Admin" }] }),
  component: Page,
});

const categories = [
  { label: "Tat ca", value: "All" },
  { label: "Dieu pho", value: "Dispatch" },
  { label: "KYC", value: "KYC" },
  { label: "He thong", value: "System" },
  { label: "Tai chinh", value: "Finance" },
];

function Page() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const logsQuery = useQuery({
    queryKey: ["audit-logs", query, category],
    queryFn: () => fetchAuditLogs({ q: query, category }),
  });

  const logs = logsQuery.data?.data ?? [];

  return (
    <>
      <Topbar title="Nhat ky he thong" subtitle="Lich su su kien khong the sua phuc vu doi soat" />
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tim theo nguoi thuc hien, hanh dong, ma su co..."
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
          {categories.map((item) => (
            <button
              key={item.value}
              onClick={() => setCategory(item.value)}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                category === item.value ? "border-info bg-info/10 text-info" : "border-border hover:bg-accent"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Xuat CSV
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Thoi gian</th>
                <th className="px-4 py-2 text-left font-medium">Nguoi thuc hien</th>
                <th className="px-4 py-2 text-left font-medium">Hanh dong</th>
                <th className="px-4 py-2 text-left font-medium">Doi tuong</th>
                <th className="px-4 py-2 text-left font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading && (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={5}>
                    Dang tai nhat ky he thong...
                  </td>
                </tr>
              )}
              {logsQuery.isError && (
                <tr>
                  <td className="px-4 py-4 text-sos" colSpan={5}>
                    {logsQuery.error.message}
                  </td>
                </tr>
              )}
              {!logsQuery.isLoading &&
                !logsQuery.isError &&
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-xs">{formatTs(log.ts)}</td>
                    <td className="px-4 py-3">{log.actor}</td>
                    <td className="px-4 py-3">
                      <Tag tone={log.tone}>{log.action}</Tag>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.target}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{log.hash}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function formatTs(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}
