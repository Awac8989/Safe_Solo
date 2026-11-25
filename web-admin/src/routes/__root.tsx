import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import "../i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Trang bạn tìm không tồn tại.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Quay về trung tâm điều phối
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Hệ thống gặp lỗi</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SafeSolo - Trung tâm Điều phối Khẩn cấp (TOC)" },
      {
        name: "description",
        content: "Bảng điều phối khẩn cấp thời gian thực & tác chiến cứu hộ ngoại viện SafeSolo.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { AdminAuthProvider, useAdminAuth } from "@/context/AdminAuthContext";
import { AdminLogin } from "@/components/AdminLogin";
import { useRouterState } from "@tanstack/react-router";
import { canAccessPath, getDefaultRouteForRole, getRoleLabel } from "@/lib/rbac";

function AdminRootLayout() {
  const { isAuthenticated, adminUser, login } = useAdminAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={login} />;
  }

  const allowed = canAccessPath(adminUser?.role, pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {allowed ? (
            <Outlet />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-amber-500/30 bg-card p-6 text-center shadow-xl space-y-3">
                <div className="mx-auto inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30">
                  PHÂN QUYỀN RBAC · {getRoleLabel(adminUser?.role)}
                </div>
                <h2 className="text-lg font-bold text-foreground">Khu vực ngoài phạm vi ca trực</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tài khoản <strong>{adminUser?.name}</strong> ({adminUser?.roleTitle}) không được cấp quyền truy cập phân hệ{" "}
                  <code className="font-mono text-amber-300">{pathname}</code>.
                </p>
                <div className="pt-2">
                  <Link
                    to={getDefaultRouteForRole(adminUser?.role)}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Quay về Phân hệ Chính
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <AdminRootLayout />
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
