import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search } from "lucide-react";
import { useEffect, useState } from "react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="flex flex-col leading-tight">
        <h1 className="text-sm font-semibold">{title}</h1>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground md:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Tìm sự cố, người dùng, bệnh viện...</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">{time.toLocaleTimeString("vi-VN")}</div>
        <button className="relative rounded-md border border-border p-1.5 hover:bg-accent">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-sos pulse-sos" />
        </button>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-info to-duress" />
          <div className="text-xs">
            <div className="font-medium leading-none">Điều phối viên 01</div>
            <div className="text-[10px] text-muted-foreground">Ca A · TP.HCM</div>
          </div>
        </div>
      </div>
    </header>
  );
}
