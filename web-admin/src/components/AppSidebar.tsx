import { Link, useRouterState } from "@tanstack/react-router";
import {
  Radio,
  Users,
  Network,
  DollarSign,
  ScrollText,
  ShieldAlert,
  Smartphone,
  AlertTriangle,
  HeartPulse,
  Briefcase,
  ShieldCheck,
  LogOut,
  BarChart3,
  Compass,
  Droplets,
  Scale,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const operationItems = [
  { title: "Trung tâm điều phối", url: "/", icon: Radio },
  { title: "Trạm cứu hộ SafePoint", url: "/safepoints", icon: Compass },
  { title: "Ngân hàng máu SafeBlood", url: "/bloodrelay", icon: Droplets },
  { title: "Bản đồ hiểm họa", url: "/hazards", icon: AlertTriangle },
  { title: "Sinh tồn đa nạn nhân", url: "/vitals", icon: HeartPulse },
];

const fleetAndB2bItems = [
  { title: "Đội ngũ hiệp sĩ", url: "/heroes", icon: ShieldCheck },
  { title: "Phúc lợi HeroShield", url: "/heroshield", icon: Scale },
  { title: "Cổng doanh nghiệp B2B", url: "/b2b", icon: Briefcase },
  { title: "Người dùng & KYC", url: "/kyc", icon: Users },
];

const systemItems = [
  { title: "Phân tích dữ liệu", url: "/analytics", icon: BarChart3 },
  { title: "Người dùng ứng dụng", url: "/users", icon: Smartphone },
  { title: "Kênh liên lạc & PTT", url: "/omnichannel", icon: Network },
  { title: "Doanh thu & Đối tác", url: "/revenue", icon: DollarSign },
  { title: "Nhật ký hệ thống", url: "/audit", icon: ScrollText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { adminUser, logout } = useAdminAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sos/15 text-sos pulse-sos">
            <ShieldAlert className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-wide">Alive?</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Điều phối khẩn cấp
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Group 1: Tác chiến */}
        <SidebarGroup>
          <SidebarGroupLabel>Tác chiến khẩn cấp</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Group 2: Lực lượng & Doanh nghiệp */}
        <SidebarGroup>
          <SidebarGroupLabel>Lực lượng & Doanh nghiệp</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {fleetAndB2bItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Group 3: Hệ thống & Báo cáo */}
        <SidebarGroup>
          <SidebarGroupLabel>Hệ thống & Báo cáo</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-2">
        {!collapsed ? (
          <div className="space-y-2">
            {adminUser && (
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-white truncate max-w-[130px]">
                    {adminUser.name}
                  </span>
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/40 uppercase">
                    {adminUser.role === "superadmin" ? "SUPER" : adminUser.role === "dispatcher" ? "115 TOC" : "KYC MOD"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate mb-2">
                  Ca trực từ: {adminUser.shiftStartTime}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Bạn có chắc chắn muốn kết thúc ca trực và đăng xuất khỏi cổng TOC?")) {
                      logout();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-red-950/40 hover:bg-red-900/60 border border-red-800/30 text-red-300 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="h-3 w-3" />
                  Đăng xuất ca trực
                </button>
              </div>
            )}
            <div className="px-1 text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Máy chủ TOC sẵn sàng (TLS 1.3)</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={logout}
              title="Đăng xuất ca trực"
              className="p-2 rounded-md hover:bg-red-950/60 text-red-400 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
