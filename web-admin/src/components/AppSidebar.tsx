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
} from "lucide-react";
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
  { title: "Bản đồ hiểm họa", url: "/hazards", icon: AlertTriangle },
  { title: "Sinh tồn đa nạn nhân", url: "/vitals", icon: HeartPulse },
];

const fleetAndB2bItems = [
  { title: "Đội ngũ hiệp sĩ", url: "/heroes", icon: ShieldCheck },
  { title: "Cổng doanh nghiệp B2B", url: "/b2b", icon: Briefcase },
  { title: "Người dùng & KYC", url: "/kyc", icon: Users },
];

const systemItems = [
  { title: "Người dùng ứng dụng", url: "/users", icon: Smartphone },
  { title: "Kênh liên lạc & PTT", url: "/omnichannel", icon: Network },
  { title: "Doanh thu & Đối tác", url: "/revenue", icon: DollarSign },
  { title: "Nhật ký hệ thống", url: "/audit", icon: ScrollText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });

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
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="px-2 py-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              Tất cả hệ thống đang hoạt động
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
