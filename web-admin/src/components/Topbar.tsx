import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, ShieldAlert, X, ArrowRight, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { fetchAdminOverview } from "@/lib/api";
import { canAccessPath, getRoleLabel } from "@/lib/rbac";

const QUICK_ROUTES = [
  { title: "Trung tâm điều phối SOS (TOC)", path: "/", keywords: "sos dieu phoi toc ban do" },
  { title: "Trạm cứu hộ SafePoint & AED", path: "/safepoints", keywords: "aed tram cuu ho totp tu so cuu" },
  { title: "Ngân hàng máu SafeBlood STAT", path: "/bloodrelay", keywords: "mau safeblood cho ray hien mau" },
  { title: "Bản đồ hiểm họa & TimeMark", path: "/hazards", keywords: "hiem hoa ngap lut timemark geofence" },
  { title: "Sinh tồn đa nạn nhân & Watch 5", path: "/vitals", keywords: "sinh ton ecg spo2 nhip tim watch" },
  { title: "Đội ngũ Hiệp sĩ cứu hộ", path: "/heroes", keywords: "hiep si doi ngu dieu dong" },
  { title: "Phúc lợi & Bảo hiểm HeroShield", path: "/heroshield", keywords: "heroshield bao hiem voucher pep sbar" },
  { title: "Cổng doanh nghiệp B2B", path: "/b2b", keywords: "b2b doanh nghiep lone worker iso" },
  { title: "Thẩm định KYC & CCCD Hiệp sĩ", path: "/kyc", keywords: "kyc cccd van bang tham dinh" },
  { title: "Phân tích dữ liệu & Cấp cứu 115", path: "/analytics", keywords: "phan tich bao cao thong ke 115" },
  { title: "Người dùng ứng dụng SafeSolo", path: "/users", keywords: "nguoi dung check in guardian" },
  { title: "Kênh liên lạc & Telegram Bot", path: "/omnichannel", keywords: "omnichannel telegram gmail sms voice" },
  { title: "Doanh thu & Bệnh viện đối tác", path: "/revenue", keywords: "doanh thu vinmec fv benh vien hoa hong" },
  { title: "Nhật ký kiểm toán SHA-256", path: "/audit", keywords: "audit nhat ky kiem toan sha256" },
];

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<Date | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);

  const { adminUser } = useAdminAuth();
  const navigate = useNavigate();

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    staleTime: 10_000,
  });

  const activeIncidents = overviewQuery.data?.data.incidents ?? [];
  const activeCount = overviewQuery.data?.data.stats.activeIncidents ?? activeIncidents.length;

  useEffect(() => {
    setMounted(true);
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const matchedRoutes = QUICK_ROUTES.filter(
      (r) =>
        canAccessPath(adminUser?.role, r.path) &&
        (!q || r.title.toLowerCase().includes(q) || r.keywords.includes(q)),
    ).slice(0, 5);

    const matchedIncidents = q
      ? activeIncidents
          .filter(
            (inc) =>
              inc.name.toLowerCase().includes(q) ||
              inc.address.toLowerCase().includes(q) ||
              inc.nearestHospital?.name?.toLowerCase().includes(q),
          )
          .slice(0, 4)
      : [];

    return { matchedRoutes, matchedIncidents };
  }, [searchTerm, adminUser?.role, activeIncidents]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="flex flex-col leading-tight min-w-0">
        <h1 className="text-sm font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>

      <div className="ml-auto flex items-center gap-3 relative">
        {/* Global Quick Search */}
        <div className="relative hidden md:block">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs focus-within:border-primary transition-colors">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onFocus={() => {
                setSearchOpen(true);
                setAlertsOpen(false);
              }}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Tìm sự cố, người dùng, bệnh viện..."
              className="w-56 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-border bg-card p-2 shadow-2xl z-50 space-y-1.5">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Điều hướng & Tìm nhanh</span>
                <button type="button" onClick={() => setSearchOpen(false)} className="hover:text-foreground">
                  Đóng
                </button>
              </div>
              {searchResults.matchedIncidents.length > 0 && (
                <div className="space-y-1 border-b border-border pb-1.5">
                  <div className="px-2 text-[10px] font-bold text-rose-400">SỰ CỐ ĐANG MỞ</div>
                  {searchResults.matchedIncidents.map((inc) => (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        void navigate({ to: "/" });
                      }}
                      className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{inc.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{inc.address}</div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {searchResults.matchedRoutes.map((r) => (
                <button
                  key={r.path}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchTerm("");
                    void navigate({ to: r.path });
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <span className="truncate">{r.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{r.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="font-mono text-xs text-muted-foreground" suppressHydrationWarning>
          {mounted && time ? time.toLocaleTimeString("vi-VN") : "--:--:--"}
        </div>

        {/* Notifications Bell Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAlertsOpen((prev) => !prev);
              setSearchOpen(false);
            }}
            aria-label="Cảnh báo khẩn cấp"
            className="relative rounded-md border border-border p-1.5 hover:bg-accent cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {activeCount > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-sos pulse-sos" />}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-border bg-card p-3 shadow-2xl z-50 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold flex items-center gap-1.5 text-rose-400">
                  <ShieldAlert className="h-4 w-4" />
                  Cảnh báo khẩn cấp ({activeCount})
                </span>
                <button
                  type="button"
                  onClick={() => setAlertsOpen(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Đóng
                </button>
              </div>
              {activeIncidents.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">Không có sự cố SOS đang mở.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {activeIncidents.slice(0, 5).map((inc) => (
                    <button
                      key={inc.id}
                      type="button"
                      onClick={() => {
                        setAlertsOpen(false);
                        void navigate({ to: "/" });
                      }}
                      className="w-full rounded-lg border border-border/70 bg-background/50 p-2 text-left hover:bg-accent transition"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="truncate text-foreground">{inc.name}</span>
                        <span className="text-[10px] font-mono text-rose-400 shrink-0">
                          {inc.vitals?.spo2 ? `SpO2 ${inc.vitals.spo2}%` : inc.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{inc.address}</div>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setAlertsOpen(false);
                  void navigate({ to: "/" });
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-600/30"
              >
                <Radio className="h-3.5 w-3.5" />
                Mở Bàn Điều Phối TOC
              </button>
            </div>
          )}
        </div>

        {/* Synced Operator Profile */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-rose-500 to-sky-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="text-xs leading-tight">
            <div className="font-medium leading-none truncate max-w-[170px]">
              {adminUser?.name || "Điều phối viên TOC"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[170px]">
              {getRoleLabel(adminUser?.role)} · {adminUser?.badgeNumber || "TOC-LIVE"}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
