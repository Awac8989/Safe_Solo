const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

export type AdminOverviewResponse = {
  success: true;
  data: {
    stats: {
      totalUsers: number;
      monitoredUsers: number;
      activeIncidents: number;
      kycPending: number;
      heroesVerified: number;
      alertsToday: number;
    };
    incidents: Array<{
      id: string;
      type: "SOS" | "DURESS" | "MEDICAL";
      severity: number;
      status: string;
      name: string;
      age: number | null;
      blood: string;
      allergies: string;
      address: string;
      district: string;
      city: string;
      x: number;
      y: number;
      receivedAt: string;
      channel: "App" | "SMS" | "Zalo" | "Telegram";
      phoneNumber: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
    }>;
  };
};

export type AuditLog = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string;
  tone: "info" | "sos" | "warning";
  hash: string;
  category: string;
};

export type KycApplicant = {
  id: string;
  userId: string;
  name: string;
  applied: string;
  status: "pending" | "review" | "flagged";
  match: number;
  region: string;
  phone: string;
  frontImageUrl: string;
  backImageUrl: string;
  isKycVerified: boolean;
  liveness: string;
  trustScore: number;
  rescuesCount: number;
  thankYouCount: number;
};

export type ChannelHealth = {
  name: string;
  vendor: string;
  quota: string;
  success: number;
  ok: boolean;
  fallbackOrder: number;
  sent: number;
};

export type RevenueSummary = {
  cards: {
    admobRevenue30d: number;
    unpaidCommissions: number;
    activePartners: number;
  };
  sparkline: number[];
  partners: Array<{
    name: string;
    dispatches: number;
    rate: string;
    balance: number;
    region: string;
  }>;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  source: "sqlite" | "store";
  role: string;
  currentStatus: string;
  timerIntervalMinutes: number;
  nextCheckinDeadline: string | null;
  lastCheckInAt: string | null;
  emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
  quietHoursStart: string;
  quietHoursEnd: string;
  falseAlertGraceMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export const fetchAdminOverview = async () => {
  return request<AdminOverviewResponse>("/admin/overview");
};

export const fetchAdminUsers = async () => {
  return request<{ success: true; data: AdminUser[] }>("/admin/users");
};

export const fetchAdminIncidents = async (status = "open") => {
  return request<{ success: true; data: AdminOverviewResponse["data"]["incidents"] }>(
    `/admin/incidents?status=${status}`,
  );
};

export const resolveIncident = async (incidentId: string, notes = "") => {
  return request<{ success: true; data: unknown }>(`/admin/incidents/${incidentId}/resolve`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
};

export const fetchIncidentSmsLogs = async (incidentId: string) => {
  return request<{ success: true; data: unknown[] }>(`/admin/incidents/${incidentId}/sms-logs`);
};

export const fetchAuditLogs = async (params?: { q?: string; category?: string }) => {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.category) query.set("category", params.category);
  return request<{ success: true; data: AuditLog[] }>(
    `/admin/audit${query.toString() ? `?${query.toString()}` : ""}`,
  );
};

export const fetchKycQueue = async () => {
  return request<{ success: true; data: KycApplicant[] }>("/admin/kyc");
};

export const updateKycStatus = async (documentId: string, action: "APPROVE" | "REJECT") => {
  return request<{ success: true; data: unknown }>(`/admin/kyc/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
};

export const fetchChannelHealth = async () => {
  return request<{
    success: true;
    data: { channels: ChannelHealth[]; policy: Array<{ step: number; name: string; tone: string }> };
  }>("/admin/channels");
};

export const fetchRevenueSummary = async () => {
  return request<{ success: true; data: RevenueSummary }>("/admin/revenue");
};
