export type AdminRole = "superadmin" | "dispatcher" | "moderator";

const ROLE_ROUTES: Record<AdminRole, string[]> = {
  superadmin: [
    "/",
    "/safepoints",
    "/bloodrelay",
    "/hazards",
    "/vitals",
    "/heroes",
    "/heroshield",
    "/b2b",
    "/kyc",
    "/analytics",
    "/users",
    "/omnichannel",
    "/revenue",
    "/audit",
  ],
  dispatcher: [
    "/",
    "/safepoints",
    "/bloodrelay",
    "/hazards",
    "/vitals",
    "/heroes",
    "/users",
    "/omnichannel",
    "/audit",
  ],
  moderator: [
    "/kyc",
    "/heroshield",
    "/heroes",
    "/users",
    "/hazards",
    "/audit",
    "/",
  ],
};

export function canAccessPath(role: AdminRole | undefined, pathname: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ROUTES[role] || ROLE_ROUTES.dispatcher;
  const normalized = pathname === "" ? "/" : pathname;
  return allowed.includes(normalized);
}

export function getDefaultRouteForRole(role: AdminRole | undefined): string {
  if (role === "moderator") return "/kyc";
  return "/";
}

export function getRoleLabel(role: AdminRole | undefined): string {
  if (role === "superadmin") return "SUPER ADMIN";
  if (role === "dispatcher") return "115 TOC";
  if (role === "moderator") return "KYC MOD";
  return "TOC";
}
