import { Link, useRouterState } from "@tanstack/react-router";
import {
  Radio,
  Users,
  Network,
  DollarSign,
  ScrollText,
  ShieldAlert,
  Smartphone,
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

const items = [
  { title: "Trung tam dieu phoi", url: "/", icon: Radio },
  { title: "Nguoi dung ung dung", url: "/users", icon: Smartphone },
  { title: "Nguoi dung va KYC", url: "/kyc", icon: Users },
  { title: "Kenh lien lac", url: "/omnichannel", icon: Network },
  { title: "Doanh thu va doi tac", url: "/revenue", icon: DollarSign },
  { title: "Nhat ky he thong", url: "/audit", icon: ScrollText },
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
                Dieu phoi khan cap
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dieu hanh</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
              Tat ca he thong dang hoat dong
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
