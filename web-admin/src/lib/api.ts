const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

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
      location?: {
        lat: number;
        lng: number;
        updatedAt?: string;
      } | null;
      vitals?: {
        spo2: number;
        heartRate: number;
        device: string;
        battery?: number;
        status?: string;
        syncTime?: string;
        hrvRmssd?: number;
        strokeRisk?: string;
      } | null;
      hitl?: HitlTriage;
      nearbyHeroes?: NearbyHero[];
      nearestHospital?: NearestHospital;
    }>;
  };
};

export type HitlTriage = {
  priority: "P1_CRITICAL" | "P2_URGENT" | "P3_MONITORING";
  priorityScore: number;
  confidence: string;
  aiSummary: string;
  recommendedAction: string;
  countdownSeconds: number;
  autoDispatchThreshold: number;
  state: "COUNTDOWN_ACTIVE" | "DISPATCHED" | "CANCELLED_FALSE_ALARM" | "PAUSED" | "AMBULANCE_DISPATCHED";
  supervisorAction?: {
    name: string;
    id: string;
    reason?: string;
    hash: string;
    tier: number;
  } | null;
  tier1Status: "COMPLETED" | "PENDING";
  tier2Status: "COMPLETED" | "PENDING_COUNTDOWN" | "CANCELLED" | "MANUAL_ONLY";
  tier3Status: "COMPLETED" | "STRICT_GATE_LOCKED";
};

export type NearbyHero = {
  name: string;
  distance: string;
  phone: string;
  trustScore: number;
  eta: string;
};

export type NearestHospital = {
  name: string;
  distance: string;
  phone: string;
  eta: string;
};

export type HitlActionPayload = {
  action:
    | "INSTANT_DISPATCH"
    | "CANCEL_FALSE_ALARM"
    | "PAUSE_COUNTDOWN"
    | "RESUME_COUNTDOWN"
    | "AUTO_DISPATCH_TIMEOUT"
    | "TIER3_AMBULANCE_DISPATCH";
  reason?: string;
  supervisorName?: string;
  supervisorId?: string;
  tier?: number;
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
  status: "pending" | "approved" | "rejected";
  match: number;
  region: string;
  phone: string;
  selfieImageUrl: string;
  frontImageUrl: string;
  backImageUrl: string;
  identityNumber: string;
  identityAddress: string;
  documentLabel: string;
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
  source: "mongo" | "sqlite" | "store";
  role: string;
  currentStatus: string;
  timerIntervalMinutes: number;
  nextCheckinDeadline: string | null;
  lastCheckInAt: string | null;
  emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
  quietHoursStart: string;
  quietHoursEnd: string;
  falseAlertGraceMinutes: number;
  trustScore?: number;
  rescuesCount?: number;
  isKycVerified?: boolean;
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

export const submitHitlAction = async (incidentId: string, payload: HitlActionPayload) => {
  return request<{
    success: true;
    data: {
      incidentId: string;
      state: string;
      action: string;
      supervisorName: string;
      hash: string;
      timestamp: string;
      actionDescription: string;
    };
  }>(`/admin/incidents/${incidentId}/hitl-action`, {
    method: "POST",
    body: JSON.stringify(payload),
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

export function resolveAssetUrl(value: string) {
  if (!value) {
    return value;
  }
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }
  if (value.startsWith("/")) {
    return `${API_ORIGIN}${value}`;
  }
  return `${API_ORIGIN}/${value}`;
}

export const sendDeviceSignal = async (
  userId: string,
  signalType: string,
  payload: Record<string, unknown>,
) => {
  return request<{ message: string; action: string }>(`/users/${userId}/device-signals`, {
    method: "POST",
    body: JSON.stringify({ signalType, payload }),
  });
};
