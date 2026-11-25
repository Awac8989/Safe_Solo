const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
export const ADMIN_SESSION_STORAGE_KEY = "safesolo_admin_session_v1";

export function getStoredAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return typeof parsed?.token === "string" && parsed.token.trim().length > 0 ? parsed.token.trim() : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAdminToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "default-public-api-key-123",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  const data = await response.json().catch(() => null);
  if (response.status === 401 && !path.startsWith("/admin/auth/login") && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("safesolo:admin-unauthorized", { detail: data }));
    } catch {}
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

export type AdminLoginUserPayload = {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "dispatcher" | "moderator";
  roleTitle: string;
  badgeNumber: string;
  shiftStartTime: string;
  token?: string;
};

export const loginAdminPortal = async (email: string, password: string) => {
  return request<{
    success: true;
    data: {
      token: string;
      expiresInSeconds: number;
      user: AdminLoginUserPayload;
    };
  }>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
};

export const fetchAdminSession = async () => {
  return request<{
    success: true;
    data: {
      user: AdminLoginUserPayload;
    };
  }>("/admin/auth/me");
};

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
      userId?: string | null;
      type: "SOS" | "DURESS" | "MEDICAL";
      severity: number;
      status: string;
      name: string;
      age: number | null;
      blood: string;
      allergies: string;
      chronicConditions?: string;
      address: string;
      microAddress?: string | null;
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
        isOffWrist?: boolean;
        svmG?: number;
        steps?: number;
        fallDetected?: boolean;
        gForceWaveform?: number[];
        ppgWaveform?: number[];
        fusion?: {
          phase?: string;
          peakSvmG?: number;
          stillnessRatio?: number;
          isOffWrist?: boolean;
          ppgAnomalyReason?: string;
          confidence?: number;
          falseAlarmsBlockedCount?: number;
          rejectedReason?: string;
        } | null;
      } | null;
      hitl?: HitlTriage;
      clinicalActions?: ClinicalAction[];
      sbarHandoff?: SbarHandoff | null;
      nearbyHeroes?: NearbyHero[];
      nearestHospital?: NearestHospital;
    }>;
  };
};

export type ClinicalAction = {
  code: string;
  title: string;
  description: string;
  performedAt: string;
  performer: string;
  vitalImpact: string;
};

export type SbarHandoff = {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  ambulancePlate: string;
  paramedicName: string;
  qrVerificationHash: string;
  handedOverAt: string;
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
    | "TIER3_AMBULANCE_DISPATCH"
    | "NEWS2_TRIAGE_APPLIED";
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
  tone: "info" | "sos" | "warning" | "success";
  metadata?: Record<string, any>;
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
  professionCategory?: "MEDICAL_NURSE" | "POLICE_SECURITY" | "FIRE_RESCUE" | "WILDERNESS_EXPLORER" | "RED_CROSS_FIRST_AID" | "UNQUALIFIED_CIVILIAN" | string;
  credentialName?: string;
  credentialNumber?: string | null;
  issuingAuthority?: string;
  workingUnit?: string;
  yearsOfExperience?: number;
  credentialImageUrl?: string | null;
  certificateImageUrl?: string | null;
  certificateNumber?: string | null;
  issuingOrganization?: string;
  certificateType?: string;
  specialtyTier?: "TIER_PARAMEDIC_MEDIC" | "TIER_POLICE_SECURITY" | "TIER_FIRE_RESCUE" | "TIER_WILDERNESS_EXPLORER" | "TIER_BLS_FIRST_AID" | "TIER_1_BLS" | "TIER_2_PHTLS" | "TIER_3_MEDIC" | "UNVERIFIED" | "NONE" | string;
  skillsList?: string[];
  expiryDate?: string | null;
  theoryExamScore?: number;
  theoryExamPassed?: boolean;
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

export const runClinicalSop = async (
  incidentId: string,
  payload?: { heroName?: string; heroPhone?: string },
) => {
  return request<{
    success: true;
    incidentId: string;
    clinicalActions: ClinicalAction[];
    sbarHandoff: SbarHandoff;
    vitalsAfterRescue: {
      spo2: number;
      heartRate: number;
      status: string;
    };
    timestamp: string;
  }>(`/admin/incidents/${incidentId}/run-clinical-sop`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
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

export const updateKycStatus = async (
  documentId: string,
  action: "APPROVE" | "REJECT",
  options?: string | { tier?: string; reason?: string },
) => {
  const payload =
    typeof options === "string"
      ? { action, tier: options }
      : { action, tier: options?.tier, reason: options?.reason };
  return request<{ success: true; data: unknown }>(`/admin/kyc/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const fetchChannelHealth = async () => {
  return request<{
    success: true;
    data: {
      channels: ChannelHealth[];
      policy: Array<{ step: number; name: string; tone: string }>;
      meta?: {
        botUsername?: string;
        gmailAccount?: string;
        activePolling?: boolean;
        smtpConnected?: boolean;
      };
    };
  }>("/admin/channels");
};

export type TestDispatchPayload = {
  victimName: string;
  phoneNumber: string;
  targetEmail: string;
  address: string;
  lat: number;
  lng: number;
  emergencyType: string;
  medicalNotes: string;
};

export type TestDispatchResult = {
  success: true;
  data: {
    success: true;
    testLogId: string;
    dispatchedAt: string;
    channels: Array<{
      channel: string;
      vendor: string;
      status: "DELIVERED" | "FAILED" | "QUEUED";
      latencyMs: number;
      detail: string;
    }>;
  };
};

export const testDispatchOmnichannel = async (payload: TestDispatchPayload) => {
  return request<TestDispatchResult>("/admin/channels/test-dispatch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const fetchRevenueSummary = async () => {
  return request<{ success: true; data: RevenueSummary }>("/admin/revenue");
};

export const settlePartnerCommission = async (payload: {
  partnerName: string;
  amount: number;
  bankAccount: string;
  bankName: string;
  beneficiaryName: string;
  note: string;
}) => {
  return request<{
    success: true;
    data: {
      settlementId: string;
      partnerName: string;
      amount: number;
      bankAccount: string;
      bankName: string;
      beneficiaryName: string;
      settledAt: string;
      status: string;
      message: string;
    };
  }>("/admin/revenue/settle-partner", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const pingB2BWorker = async (payload: {
  workerName: string;
  enterpriseCode: string;
  post: string;
}) => {
  return request<{
    success: true;
    data: {
      workerName: string;
      enterpriseCode: string;
      telegramStatus: string;
      timestamp: string;
      message: string;
    };
  }>("/admin/b2b/ping-worker", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export function resolveAssetUrl(value?: string | null) {
  if (!value) {
    return "";
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

export type HeroRadarItem = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  statusLabel: string;
  trustScore: number;
  rescuesCount: number;
  battery: number;
  location: {
    lat: number;
    lng: number;
    district?: string;
  };
  equipment: string[];
  skills: string[];
  lastSeenAt: string;
  isDispatched?: boolean;
  isArrived?: boolean;
};

export type SafeHavenItem = {
  id: string;
  name: string;
  type: "HOSPITAL" | "POLICE" | "CONVENIENCE";
  typeLabel: string;
  phone: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  available247: boolean;
  specialty: string;
};

export type ThankYouNoteItem = {
  id: string;
  victimName: string;
  heroName: string;
  heroId?: string;
  rating: number;
  message: string;
  date: string;
  tags: string[];
};

export type IncidentDossier = {
  dossierId: string;
  incidentId: string;
  generatedAt: string;
  legalVerificationHash: string;
  jurisdiction: string;
  incidentType: string;
  severity: number;
  victim: {
    name: string;
    phone: string;
    bloodType: string;
    allergies: string;
    approxLocation: string;
    exactGps?: { lat: number; lng: number };
    emergencyContact?: {
      name: string;
      phone: string;
    };
  };
  vitalsTelemetry: {
    device: string;
    heartRate: number;
    spo2: number;
    hrvRmssd: number;
    battery: number;
    strokeRisk: string;
    fallDetected: boolean;
  };
  timeline: Array<{
    time: string;
    event: string;
  }>;
  assignedHeroes: NearbyHero[];
  handoffRecord?: {
    ambulancePlate: string;
    paramedicName: string;
    handedOverAt: string;
    qrVerificationHash: string;
    notes: string;
    proofImageUrl?: string;
    cprCyclesCount?: number;
    patientStatusOnTransfer?: string;
  };
  supervisorSignature: {
    supervisorName: string;
    supervisorId: string;
    digitalSeal: string;
    auditStandard: string;
  };
};

export const fetchHeroRadar = async () => {
  return request<{ success: true; data: HeroRadarItem[] }>("/admin/heroes/radar");
};

export const fetchSafeHavens = async () => {
  return request<{ success: true; data: SafeHavenItem[] }>("/admin/safe-havens");
};

export const fetchThankYouNotes = async () => {
  return request<{ success: true; data: ThankYouNoteItem[] }>("/admin/thank-you-notes");
};

export const fetchIncidentDossier = async (incidentId: string) => {
  return request<{ success: true; data: IncidentDossier }>(`/admin/incidents/${incidentId}/dossier`);
};

export type HazardItem = {
  id: string;
  title: string;
  description: string;
  category: "DARK_ROAD" | "SUSPICIOUS_PERSON" | "ROAD_HAZARD" | "FLOODING" | "ACCIDENT" | "OTHER";
  lat: number;
  lng: number;
  address: string;
  status: "ACTIVE" | "RESOLVED" | "EXPIRED";
  authorName: string;
  confirmCount: number;
  resolvedCount: number;
  timemarkPhotoUrl?: string;
  timemarkMeta?: {
    timestamp: string;
    lat: number;
    lng: number;
    address: string;
    hash?: string;
    device?: string;
  } | null;
  severity?: "P1_CRITICAL" | "P2_URGENT" | "P3_SUPPORT";
  victimCount?: string;
  victimCondition?: string;
  reportedByPhone?: string;
  createdAt: string;
};

export type HazardsResponse = {
  success: true;
  data: {
    hazards: HazardItem[];
    stats: {
      total: number;
      active: number;
      resolved: number;
      darkRoads: number;
      floodings: number;
      accidents: number;
      suspicious: number;
    };
  };
};

export const fetchHazards = async () => {
  return request<HazardsResponse>("/admin/hazards");
};

export const verifyHazard = async (hazardId: string, action: "VERIFY" | "RESOLVE") => {
  return request<{ success: true; data: any }>(`/admin/hazards/${hazardId}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
};

export const createHazard = async (payload: Partial<HazardItem>) => {
  return request<{ success: true; data: any }>("/admin/hazards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export type MultiVictimVitalsItem = {
  incidentId: string;
  userId?: string | null;
  victimName: string;
  victimPhone: string;
  age: number;
  blood: string;
  priority: "P1_CRITICAL" | "P2_URGENT" | "P3_MONITORING";
  severity: number;
  status: string;
  address: string;
  location?: { lat: number; lng: number } | null;
  receivedAt: string;
  vitals: {
    heartRate: number;
    spo2: number;
    hrvRmssd: number;
    strokeRisk: string;
    fallDetected: boolean;
    isOffWrist?: boolean;
    svmG?: number;
    steps?: number;
    battery: number;
    device: string;
    watchPaired?: boolean;
    watchDeviceId?: string | null;
    status: string;
    syncTime: string;
  };
  iceProfile?: {
    bloodGroup: string;
    allergies: string;
    chronicDiseases: string;
    bhytNumber: string;
    cccdNumber: string;
    safeTagNfcId: string;
    primaryGuardian: {
      name: string;
      phone: string;
      relation: string;
    };
    secondaryGuardian?: {
      name: string;
      phone: string;
      relation: string;
    };
  };
};

export const fetchMultiVictimVitals = async () => {
  return request<{ success: true; data: MultiVictimVitalsItem[] }>("/admin/vitals/active");
};

export const instantDispatchVictim = async (
  incidentId: string,
  payload: {
    ambulanceUnit: string;
    dispatchNotes: string;
    targetSop: string;
    broadcastChannels: string[];
  }
) => {
  return request<{
    success: true;
    data: {
      dispatchId: string;
      dispatchedAt: string;
      telegramStatus: string;
      watchNotification?: string;
      sbarSummary: string;
    };
  }>(`/admin/vitals/${incidentId}/instant-dispatch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// Galaxy Watch 5 <-> Web Admin Bi-directional Bridge APIs
export type WatchDeviceSnapshot = {
  deviceId: string;
  deviceModel: string;
  paired: boolean;
  pairedAt: string | null;
  userId: string | null;
  userName: string;
  userPhone: string | null;
  userStatus: string | null;
  pendingWatchCommands: number;
  vitals: {
    heartRate: number;
    spO2: number;
    battery: number;
    steps: number;
    isOffWrist: boolean;
    svmG: number;
    tiltAngle: number;
    updatedAt: number;
  } | null;
};

export type WatchEventEntry = {
  id: string;
  timestamp: string;
  type: string;
  sender: string;
  deviceId: string;
  userId?: string | null;
  note?: string;
  payload?: Record<string, unknown>;
};

export type WatchDevicesResponse = {
  devices: WatchDeviceSnapshot[];
  recentEvents: WatchEventEntry[];
  sseClientCount: number;
};

export const getWatchStreamUrl = () =>
  `${API_BASE_URL}/watch/stream?api_key=default-public-api-key-123`;

export const fetchWatchDevices = async () => {
  return request<{ success: true; data: WatchDevicesResponse }>("/watch/devices");
};

export const quickPairWatchToUser = async (payload: {
  deviceId?: string;
  deviceModel?: string;
  userId: string;
  forceReassign?: boolean;
}) => {
  return request<{
    success: true;
    paired: boolean;
    deviceId: string;
    deviceModel: string;
    userId: string;
  }>("/watch/pair/auto-pair", {
    method: "POST",
    body: JSON.stringify({ forceReassign: true, ...payload }),
  });
};

export const sendWatchCommand = async (payload: {
  deviceId?: string;
  userId?: string | null;
  action:
    | "FIND_WATCH_PING"
    | "INSTANT_MEASURE_REQ"
    | "TOC_DISPATCH_ACK"
    | "TIMER_SYNC"
    | "ALERT_CANCELLED";
  payload?: Record<string, unknown>;
  issuedBy?: string;
}) => {
  return request<{
    success: true;
    data: {
      deviceId: string;
      userId: string | null;
      pendingWatchQueueSize: number;
      packet: {
        messageId: string;
        action: string;
        timestamp: string;
      };
    };
  }>("/watch/command", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const pingUserCheckin = async (userId: string, reason?: string) => {
  return request<{
    success: true;
    data: {
      userId: string;
      userName: string;
      telegramStatus: string;
      message: string;
      timestamp: string;
    };
  }>(`/admin/users/${userId}/ping-checkin`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const escalateUserGuardian = async (userId: string, reason?: string) => {
  return request<{
    success: true;
    data: {
      userId: string;
      userName: string;
      guardiansNotified: number;
      telegramStatus: string;
      message: string;
      timestamp: string;
    };
  }>(`/admin/users/${userId}/escalate-guardian`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
};

export const broadcastHazardTelegram = async (hazardId: string, message?: string) => {
  return request<{
    success: true;
    data: {
      hazardId: string;
      telegramStatus: string;
      broadcastTimestamp: string;
    };
  }>(`/admin/hazards/${hazardId}/broadcast-telegram`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
};

export type B2BEnterprise = {
  id: string;
  name: string;
  code: string;
  industry: string;
  activeWorkers: number;
  totalWorkers: number;
  checkInInterval: number;
  complianceRate: number;
  alertsToday: number;
  contactPerson: string;
  contactPhone: string;
  servicePlan: string;
  activeShifts: Array<{
    workerName: string;
    post: string;
    deadline: string;
    status: string;
    battery: number;
  }>;
};

export type B2BOverviewResponse = {
  success: true;
  data: {
    stats: {
      totalEnterprises: number;
      totalMonitoredWorkers: number;
      averageComplianceRate: number;
      activeShiftsCount: number;
      alertsTodayCount: number;
      systemHealth: string;
    };
    enterprises: B2BEnterprise[];
  };
};

export const fetchB2BOverview = async () => {
  return request<B2BOverviewResponse>("/admin/b2b/overview");
};

export type HeroFleetItem = {
  id: string;
  name: string;
  phone: string;
  trustScore: number;
  rescuesCount: number;
  status: "ON_DUTY" | "AVAILABLE" | "ON_MISSION" | "RESTING";
  location: { lat: number; lng: number; district?: string };
  zone: string;
  responseEta: string;
  battery: number;
  equippedGear: string[];
  availableBountyVND: number;
  ratingStars: number;
};

export type HeroFleetResponse = {
  success: true;
  data: {
    fleet: HeroFleetItem[];
    stats: {
      totalHeroes: number;
      onDutyCount: number;
      onMissionCount: number;
      totalRescuesThisMonth: number;
      averageResponseTimeMinutes: number;
      bountyFundPoolVND: number;
      bountyDisbursedThisMonthVND: number;
    };
    safeHavensInventory: Array<{
      name: string;
      aedStatus: string;
      oxygenStatus: string;
      firstAidKit: string;
    }>;
  };
};

export const fetchHeroFleet = async () => {
  return request<HeroFleetResponse>("/admin/heroes/fleet");
};

export const disburseHeroBounty = async (heroId: string, amount: number, reason: string) => {
  return request<{ success: true; data: any }>(`/admin/heroes/${heroId}/bounty`, {
    method: "POST",
    body: JSON.stringify({ amount, reason }),
  });
};

export const sendHeroDirectMessage = async (
  heroId: string,
  message: string,
  urgency: "NORMAL" | "HIGH" = "NORMAL"
) => {
  return request<{ success: true; data: any }>(`/admin/heroes/${heroId}/message`, {
    method: "POST",
    body: JSON.stringify({ message, urgency }),
  });
};

// ==========================================
// P1: Incident Timeline Playback (Flight Recorder)
// ==========================================
export type PlaybackPoint = {
  relSec: number;
  timeFormatted: string;
  lat: number;
  lng: number;
  speedKmH: number;
  heartRate: number;
  spo2: number;
  gForce: number;
  decibel: number;
  eventLabel: string | null;
};

export type PlaybackMilestone = {
  time: string;
  title: string;
  desc: string;
  category: string;
};

export type IncidentPlaybackData = {
  incidentId: string;
  incidentType: string;
  victimName: string;
  deviceModel: string;
  durationSeconds: number;
  startSec: number;
  endSec: number;
  baseLocation: { lat: number; lng: number; address: string };
  blackboxHash: string;
  timelinePoints: PlaybackPoint[];
  eventMilestones: PlaybackMilestone[];
  generatedAt: string;
};

export const fetchIncidentPlayback = async (incidentId: string) => {
  return request<{ success: true; data: IncidentPlaybackData }>(`/admin/incidents/${incidentId}/playback`);
};

// ==========================================
// P2: Dynamic Danger Geofences
// ==========================================
export type DangerGeofenceItem = {
  id: string;
  name: string;
  category: "FLOODING" | "DARK_ROAD" | "ROAD_HAZARD" | "CRIME_HOTSPOT" | "CONSTRUCTION";
  severity: "CRITICAL" | "WARNING" | "ADVISORY";
  center: {
    lat: number;
    lng: number;
  };
  radiusMeters: number;
  address: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  expiresAt: string;
  activePeopleCount: number;
  broadcastCount: number;
  description: string;
};

export type DangerGeofencesResponse = {
  success: true;
  data: {
    geofences: DangerGeofenceItem[];
    stats: {
      total: number;
      active: number;
      totalMonitoredUsers: number;
      totalBroadcastsDispatched: number;
    };
  };
};

export const fetchDangerGeofences = async () => {
  return request<DangerGeofencesResponse>("/admin/geofences");
};

export const createDangerGeofence = async (payload: Partial<DangerGeofenceItem> & { durationHours?: number }) => {
  return request<{ success: true; data: DangerGeofenceItem }>("/admin/geofences", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const toggleDangerGeofence = async (geofenceId: string) => {
  return request<{ success: true; data: DangerGeofenceItem }>(`/admin/geofences/${geofenceId}/toggle`, {
    method: "PATCH",
  });
};

export const deleteDangerGeofence = async (geofenceId: string) => {
  return request<{ success: true; data: { success: true; removedId: string } }>(`/admin/geofences/${geofenceId}`, {
    method: "DELETE",
  });
};

export const broadcastGeofenceAlert = async (geofenceId: string, message?: string) => {
  return request<{
    success: true;
    geofenceId: string;
    geofenceName: string;
    recipientsCount: number;
    broadcastTimestamp: string;
    message: string;
  }>(`/admin/geofences/${geofenceId}/broadcast`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
};

// ==========================================
// P3: AI Incident Briefing & SOP Engine
// ==========================================
export type SopStepItem = {
  code: string;
  label: string;
  status: "COMPLETED" | "PENDING";
  autoExecuted: boolean;
  completedAt?: string;
  actor?: string;
  canExecute?: boolean;
  description: string;
  note?: string;
};

export type AiBriefingData = {
  incidentId: string;
  victimName: string;
  incidentType: string;
  credibilityScore: number;
  credibilityVerdict: string;
  riskLevel: string;
  multimodalAnalysis: {
    audio: {
      decibelPeak: number;
      detectedKeywords: string[];
      transcript: string;
      ambientStatus: string;
    };
    motion: {
      impactG: number;
      freeFallDurationMs: number;
      postImpactImmobilitySeconds: number;
      status: string;
    };
    biometrics: {
      baselineHr: number;
      peakHr: number;
      currentHr: number;
      spo2: number;
      rhythm: string;
    };
    medicalContext: {
      bloodType: string;
      allergies: string;
      chronicConditions: string;
      emergencyContact: string;
    };
  };
  goldenHourPrognosis: {
    remainingMinutes: number;
    risk: string;
    advice: string;
  };
  sopSteps: SopStepItem[];
  generatedAt: string;
};

export const fetchAiIncidentBriefing = async (incidentId: string) => {
  return request<{ success: true; data: AiBriefingData }>(`/admin/incidents/${incidentId}/ai-briefing`);
};

export const executeSopAction = async (incidentId: string, actionCode: string, payload?: Record<string, any>) => {
  return request<{
    success: true;
    incidentId: string;
    actionCode: string;
    updatedStep: SopStepItem;
    sopSteps: SopStepItem[];
    executedAt: string;
  }>(`/admin/incidents/${incidentId}/sop-action`, {
    method: "POST",
    body: JSON.stringify({ actionCode, ...(payload || {}) }),
  });
};

export type DisasterAlertItem = {
  id: string;
  title: string;
  description: string;
  category: "FLOODING" | "LANDSLIDE" | "CRITICAL_DANGER" | "STORM_SURGE" | "ROAD_HAZARD" | "DARK_ROAD";
  severity: "CRITICAL" | "WARNING" | "ADVISORY";
  lat: number;
  lng: number;
  radiusMeters: number;
  address: string;
  safetyAdvice: string;
  evacuationRouteTip: string;
  status: "ACTIVE" | "RESOLVED";
  issuedBy: string;
  broadcastCount: number;
  createdAt: string;
  resolvedAt?: string | null;
};

export const fetchDisasterAlerts = async () => {
  return request<{ success: true; data: DisasterAlertItem[] }>("/admin/disaster-alerts");
};

export const createDisasterAlert = async (payload: Partial<DisasterAlertItem>) => {
  return request<{ success: true; data: DisasterAlertItem }>("/admin/disaster-alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const resolveDisasterAlert = async (id: string) => {
  return request<{ success: true; data: { alert: DisasterAlertItem } }>(`/admin/disaster-alerts/${id}/resolve`, {
    method: "PATCH",
  });
};

// ─── Analytics Dashboard ────────────────────────────────────────────────────

export type AnalyticsDashboardResponse = {
  success: true;
  data: {
    period: { days: number; generatedAt: string };
    kpis: {
      totalUsers: number;
      monitoredUsers: number;
      activeUsersToday: number;
      checkinsToday: number;
      activeIncidents: number;
      alertsToday: number;
    };
    checkinTrend: Array<{ date: string; total: number; onTime: number; late: number }>;
    checkinMethods: Array<{ method: string; count: number }>;
    incidentMetrics: {
      byType: Array<{ type: string; count: number; resolved: number }>;
      dailyTrend: Array<{ date: string; incidents: number }>;
      responseTime: {
        avgSeconds: number;
        minSeconds: number;
        maxSeconds: number;
        resolvedCount: number;
      };
    };
    escalationBreakdown: Array<{ level: string; count: number }>;
    falseAlarmRate: {
      totalIncidents: number;
      totalAlerts: number;
      resolvedCount: number;
      falseAlarmRatePercent: number;
    };
    vitalsSummary: {
      heartRate: { avg: number; min: number; max: number; readings: number } | null;
      spo2: { avg: number; min: number; max: number; readings: number } | null;
    };
  };
};

export const fetchAnalyticsDashboard = async (days = 30) => {
  return request<AnalyticsDashboardResponse>(`/admin/analytics?days=${days}`);
};

// ─── SafePoint & OpenAED Network ───────────────────────────────────────────

export type SafePointAssetItem = {
  _id: string;
  name: string;
  code: string;
  type: "AED" | "FIRST_AID_KIT" | "OXYGEN_TANK" | "TRAUMA_KIT" | "MULTI_PURPOSE_CABINET";
  status: "ACTIVE" | "MAINTENANCE" | "OFFLINE" | "IN_USE";
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
    address: string;
    buildingName?: string;
    floor?: string;
    accessNotes?: string;
  };
  operationalHours: {
    is24x7: boolean;
    openTime?: string;
    closeTime?: string;
  };
  hardwareState: {
    cabinetLocked: boolean;
    batteryLevelPercent: number;
    padExpiryDate?: string;
    lastInspectionDate?: string;
    cabinetDoorSensor: "CLOSED" | "OPEN";
  };
  unlockMechanism: {
    type: "TOTP_KEYPAD" | "REMOTE_RELAY" | "BLE_BEACON" | "PHYSICAL_KEY";
    totpPeriodSeconds: number;
  };
  managingOrganization?: string;
  emergencyContactPhone?: string;
};

export const fetchSafePointsNearby = async (params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  type?: string;
}) => {
  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    ...(params.radiusMeters ? { radiusMeters: params.radiusMeters.toString() } : {}),
    ...(params.type ? { type: params.type } : {}),
  });
  return request<{ success: true; count: number; data: SafePointAssetItem[] }>(`/safepoints/nearby?${query.toString()}`);
};

export const fetchOptimalAedWaypoint = async (params: {
  victimLat: number;
  victimLng: number;
  heroLat: number;
  heroLng: number;
}) => {
  const query = new URLSearchParams({
    victimLat: params.victimLat.toString(),
    victimLng: params.victimLng.toString(),
    heroLat: params.heroLat.toString(),
    heroLng: params.heroLng.toString(),
  });
  return request<{
    success: boolean;
    data: {
      aedStation: SafePointAssetItem;
      distanceHeroToAedMeters: number;
      distanceAedToVictimMeters: number;
      directDistanceMeters: number;
      estimatedDetourSeconds: number;
      recommendation: string;
    } | null;
  }>(`/safepoints/optimal-aed?${query.toString()}`);
};

export const requestSafePointUnlock = async (id: string, payload: {
  rescuerId: string;
  incidentId?: string;
  purpose?: string;
}) => {
  return request<{
    success: true;
    data: {
      safePointId: string;
      stationName: string;
      unlockOtp: string;
      validSeconds: number;
      expiresAt: string;
      instructions: string;
    };
  }>(`/safepoints/${id}/unlock-request`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const confirmSafePointUnlock = async (id: string, payload: {
  unlockOtp: string;
  rescuerId: string;
}) => {
  return request<{ success: true; message: string; safePointId: string }>(`/safepoints/${id}/unlock-confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ─── SafeBlood Urgent Relay ────────────────────────────────────────────────

export type BloodRelayItem = {
  _id: string;
  requestCode: string;
  patientId?: string;
  targetBloodGroup: "O_MINUS" | "O_PLUS" | "A_MINUS" | "A_PLUS" | "B_MINUS" | "B_PLUS" | "AB_MINUS" | "AB_PLUS";
  compatibleBloodGroups: string[];
  unitsRequired: number;
  urgencyLevel: "EXTREME_IMMEDIATE" | "URGENT_1_HOUR" | "HIGH_PRIORITY_4_HOURS";
  hospitalLocation: {
    hospitalName: string;
    address: string;
    roomOrDepartment?: string;
    contactPhone: string;
    coordinates: [number, number]; // [lng, lat]
  };
  clinicalJustification: string;
  requestedBloodType?: string;
  hospitalName?: string;
  status: "PENDING_DONORS" | "SEARCHING" | "DONORS_COMMITTED" | "IN_TRANSIT" | "DELIVERED_AND_FULFILLED" | "CANCELLED";
  matchedDonors: Array<{
    donorId: string;
    donorName?: string;
    bloodGroup: string;
    contactPhone?: string;
    committedUnits: number;
    status: "NOTIFIED" | "ACCEPTED" | "ARRIVED" | "DONATED" | "DECLINED";
    etaMinutes?: number;
    distanceKm?: number;
    fastTrackCode?: string;
  }>;
  createdAt: string;
};

export const fetchActiveBloodRelays = async (hospitalLat?: number, hospitalLng?: number) => {
  const query = new URLSearchParams({
    ...(hospitalLat !== undefined ? { hospitalLat: hospitalLat.toString() } : {}),
    ...(hospitalLng !== undefined ? { hospitalLng: hospitalLng.toString() } : {}),
  });
  const url = query.toString() ? `/blood-relay/active?${query.toString()}` : `/blood-relay/active`;
  return request<{ success: true; count: number; data: BloodRelayItem[] }>(url);
};

export const createBloodRelayRequest = async (payload: {
  targetBloodGroup: string;
  unitsRequired: number;
  urgencyLevel: string;
  hospitalLocation: {
    hospitalName: string;
    address: string;
    roomOrDepartment?: string;
    contactPhone: string;
    coordinates: [number, number];
  };
  clinicalJustification: string;
}) => {
  return request<{ success: true; message: string; data: BloodRelayItem }>(`/blood-relay/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const acceptBloodRelayRequest = async (requestId: string, payload: {
  donorId: string;
  etaMinutes?: number;
}) => {
  return request<{ success: true; message: string; data: BloodRelayItem }>(`/blood-relay/${requestId}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const fulfillBloodRelayRequest = async (requestId: string, payload: {
  donorId: string;
  hospitalStaffNote?: string;
}) => {
  return request<{ success: true; message: string; data: BloodRelayItem }>(`/blood-relay/${requestId}/fulfill`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export type MatchingDonor = {
  donorUserId: string;
  donorName: string;
  donorBloodType: string;
  contactPhone: string;
  distanceKm: number;
  etaMinutes: number;
  trustScore: number;
};

export const fetchMatchingBloodDonors = async (
  requestId: string,
  lat?: number,
  lng?: number,
  radius?: number
) => {
  const query = new URLSearchParams({
    ...(lat !== undefined ? { lat: lat.toString() } : {}),
    ...(lng !== undefined ? { lng: lng.toString() } : {}),
    ...(radius !== undefined ? { radius: radius.toString() } : {}),
  });
  const url = query.toString()
    ? `/blood-relay/${requestId}/donors?${query.toString()}`
    : `/blood-relay/${requestId}/donors`;
  return request<{ success: true; count: number; data: MatchingDonor[] }>(url);
};

// ─── HeroShield Welfare & Restock ──────────────────────────────────────────

export type HeroPolicyItem = {
  _id: string;
  policyNumber: string;
  heroId: string;
  incidentId: string;
  coverageType: "GOOD_SAMARITAN_STATUTORY" | "COMPREHENSIVE_FIRST_RESPONDER" | "VOLUNTEER_ACCIDENT_TIER1";
  legalShieldActive: boolean;
  statutoryLegalBasis: string;
  insuranceUnderwriter: string;
  status: "ACTIVE" | "EXPIRED" | "CLAIM_FILED" | "SETTLED";
  coverageLimits: {
    maxLegalDefenseFundVND: number;
    maxMedicalExpenseVND: number;
    maxThirdPartyLiabilityVND: number;
  };
  effectiveFrom: string;
  expiresAt: string;
};

export type RestockVoucherItem = {
  voucherCode: string;
  heroId: string;
  incidentId: string;
  sbarHandoffId?: string;
  status: "ISSUED" | "REDEEMED" | "EXPIRED";
  itemsApproved: Array<{
    itemName: string;
    quantity: number;
    unitPriceEstimateVND: number;
  }>;
  totalEstimatedValueVND: number;
  partnerPharmacyNetwork: string;
  issuedAt: string;
  expiresAt: string;
};

export type HeroCandidateOption = {
  id: string;
  name: string;
  phone: string;
  tier: string;
  trustScore: number;
  rescuesCount: number;
  walletBalance: number;
};

export type HeroShieldClaimItem = {
  _id: string;
  policyId: string;
  policyNumber: string;
  incidentId: string;
  heroId: string;
  heroName: string;
  heroPhone: string;
  heroTier: string;
  claimType: string;
  claimTypeLabel: string;
  legalBasis: string;
  estimatedLossVND: number;
  payoutAmountVND: number;
  claimStatus: "FILED" | "UNDER_REVIEW" | "APPROVED" | "PAID_OUT" | "REJECTED";
  hospitalReportUrl?: string;
  doctorDiagnosis?: string;
  filedAt: string;
  settledAt?: string | null;
};

export const fetchHeroShieldCandidates = async () => {
  return request<{ success: true; count: number; data: HeroCandidateOption[] }>(`/heroshield/heroes-list`);
};

export const fetchHeroPolicies = async (heroId: string) => {
  return request<{ success: true; count: number; data: HeroPolicyItem[] }>(`/heroshield/policies/${heroId || "ALL"}`);
};

export const fetchHeroRestockVouchers = async (heroId: string) => {
  return request<{ success: true; count: number; data: RestockVoucherItem[] }>(`/heroshield/vouchers/${heroId || "ALL"}`);
};

export const fetchHeroClaims = async (heroId?: string) => {
  return request<{ success: true; count: number; data: HeroShieldClaimItem[] }>(`/heroshield/claims/${heroId || "ALL"}`);
};

export const settleHeroClaim = async (policyId: string, payoutAmountVND: number) => {
  return request<{ success: true; message: string; data: any }>(`/heroshield/claims/${policyId}/settle`, {
    method: "POST",
    body: JSON.stringify({ payoutAmountVND }),
  });
};

export const redeemHeroRestockVoucher = async (voucherCode: string) => {
  return request<{ success: true; message: string; voucherCode: string; status: string }>(
    `/heroshield/vouchers/${voucherCode}/redeem`,
    {
      method: "POST",
    }
  );
};

export const issueRestockVoucherFromSbar = async (payload: {
  heroId: string;
  incidentId: string;
  sbarHandoffId?: string;
  consumedSuppliesNote?: string;
}) => {
  return request<{ success: true; message: string; data: RestockVoucherItem }>(`/heroshield/restock-voucher`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ─── SafeTag Offline ICE Lookup ───────────────────────────────────────────

export const lookupSafeTagPublicIce = async (tagUid: string) => {
  return request<{
    success: true;
    tagUid: string;
    securityTier: string;
    data: {
      fullName: string;
      bloodType: string;
      allergiesSummary: string;
      emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
      dnrOrder: boolean;
      organDonor: boolean;
      chronicDiseasesMasked: string;
      tagStatus: string;
      complianceNote: string;
    };
  }>(`/safetags/public-ice/${tagUid}`);
};

// ─── Digital Blood Donor Certificate ──────────────────────────────────────

export type BloodDonorCertificate = {
  success: boolean;
  certificateNumber: string;
  issuedAt: string;
  donorName: string;
  bloodGroup: string;
  hospitalName: string;
  hospitalDepartment: string;
  unitsDonated: number;
  purpose: string;
  legalBasis: string;
  digitalSeal: {
    issuer: string;
    verified: boolean;
    blockchainProofHash: string;
  };
};

export const fetchBloodDonorCertificate = async (requestId: string, donorId: string) => {
  return request<BloodDonorCertificate>('/blood-relay/' + requestId + '/certificate/' + donorId);
};

// ─── SBAR Protocol Public QR Verification ─────────────────────────────────

export type SbarHandoffVerification = {
  success: boolean;
  data: {
    status: string;
    standard: string;
    incidentId: string;
    verificationHash: string;
    victim: {
      name: string;
      bloodType?: string;
      allergies?: string;
    };
    volunteer: {
      name: string;
      phone: string;
    } | null;
    clinicalVitals: {
      avpu: string;
      tourniquetTimeApplied: string | null;
      cprCycles: number;
      aedShockDelivered: boolean;
    };
    sbarDossier: {
      situation: string;
      background: string;
      assessment: string;
      recommendation: string;
      ambulancePlate: string;
      paramedicName: string;
      handedOverAt: string;
      notes?: string;
      proofImageUrl?: string;
    };
    legalProtection: {
      decree: string;
      immunityClause: string;
    };
  };
};

export const verifySbarHandoffPublic = async (hash: string) => {
  return request<SbarHandoffVerification>('/radar/sbar-verify/' + hash);
};

export const resolveSafePointTamper = async (id: string, notes?: string) => {
  return request<{ success: true; message: string }>(`/safepoints/${id}/tamper-resolve`, {
    method: "POST",
    body: JSON.stringify({ resolutionNotes: notes }),
  });
};

export const fetchAedFleetHealth = async () => {
  return request<{
    success: true;
    data: {
      totalStations: number;
      readyStations: number;
      inUseStations: number;
      maintenanceStations: number;
      tamperAlertStations: number;
      lowBatteryStations: number;
      operationalReadinessPercent: number;
    };
  }>("/safepoints/fleet-health");
};

export const declareMciIncident = async (incidentId: string, payload: { dispatcherName: string; estimatedCasualties: number; incidentNotes?: string }) => {
  return request<{ success: true; isMCI: boolean; casualtyCounts: { red: number; yellow: number; green: number; black: number } }>(`/emergencies/${incidentId}/mci-declare`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const connectDoctorTeleFirstAid = async (payload: { incidentId: string; doctorProfile: { doctorId: string; doctorName: string; hospitalName: string } }) => {
  return request<{ success: true; sessionId: string; videoStreamUrl: string; status: string }>("/radar/tele-consult/doctor-join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const issueVerbalMedicalOrderApi = async (payload: { incidentId: string; orderData: { orderText: string; dosageOrAction: string; issuedBy: string } }) => {
  return request<{ success: true; orderIndex: number; orderText: string; status: string }>("/radar/tele-consult/issue-order", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};


export const fetchOxygenStation = async (lat = 10.7769, lng = 106.7009) => {
  return request<{
    success: true;
    data: {
      station: unknown;
      distanceMeters: number;
      oxygenPressureBar: number;
      capacityLiters: number;
      isReady: boolean;
      protocolGuidance: string;
    };
  }>("/safepoints/oxygen/locate", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
};

export const fetchEpiPenStation = async (lat = 10.7769, lng = 106.7009) => {
  return request<{
    success: true;
    data: {
      station: unknown;
      distanceMeters: number;
      doseMg: number;
      isAvailable: boolean;
      recommendation: string;
    };
  }>("/safepoints/epipen/locate", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
};

export const fetchTraumaHospitals = async () => {
  return request<{ success: true; count: number; data: unknown[] }>("/hospitals");
};

export const recommendTraumaHospital = async (incidentId: string, condition = "POLYTRAUMA") => {
  return request<{
    success: true;
    data: {
      conditionCategory: string;
      recommendedHospital: {
        hospitalCode: string;
        hospitalName: string;
        distanceKm: number;
        etaMinutes: number;
        matchScore: number;
        emergencyDepartmentStatus: { availableIcuBeds: number; status: string };
      };
      triageDecisionRationale: string;
    };
  }>(`/hospitals/recommend/${incidentId}?condition=${condition}`);
};

export const notifyTraumaHospitalPreArrival = async (
  incidentId: string,
  payload: { hospitalCode: string; etaMinutes: number; chiefComplaint: string },
) => {
  return request<{ success: true; hospitalCode: string; hospitalName: string; etaMinutes: number }>(
    `/hospitals/pre-arrival/${incidentId}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};

export const recordDrowningCareApi = async (
  incidentId: string,
  payload: { submersionMinutes: number; waterType: string; fiveInitialRescueBreathsGiven: boolean },
) => {
  return request<{ success: true; waterType: string; fiveInitialRescueBreathsGiven: boolean; pathophysiologyGuidance: string }>(
    `/emergencies/${incidentId}/drowning-care`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};

export const initiateSecondaryDrowningWatchdogApi = async (incidentId: string) => {
  return request<{ success: true; monitoringActive: boolean; message: string }>(
    `/emergencies/${incidentId}/secondary-drowning/initiate`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
};

export const treatHeatstrokeApi = async (
  incidentId: string,
  payload: { initialCoreTempCelsius: number; currentCoreTempCelsius: number; isExertional: boolean },
) => {
  return request<{ success: true; classification: string; targetTempReached: boolean; clinicalOutcome: string }>(
    `/emergencies/${incidentId}/heatstroke-care`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};

export const evaluateFastEdStrokeApi = async (
  incidentId: string,
  payload: { lastKnownWellMinutesAgo: number; facialPalsy: number; armWeakness: number; speechChanges: number; eyeDeviation: number; denialNeglect: number },
) => {
  return request<{ success: true; isLargeVesselOcclusionRisk: boolean; strokeCodeRedActive: boolean; fastEdScore: { totalScore: number } }>(
    `/emergencies/${incidentId}/stroke-fasted`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};

export const locateHeatstrokeStation = async (lat = 10.7769, lng = 106.7009) => {
  return request<{
    success: true;
    data: {
      station: unknown;
      distanceMeters: number;
      icePacksAvailable: boolean;
      icePacksCount: number;
      oralElectrolytesPackets: number;
    };
  }>("/safepoints/heatstroke/locate", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
};


// ==================== PHÂN HỆ 22: SAFETAG OTP & PARAMEDIC BYPASS ====================

export const requestSafeTagOtpApi = async (tagCode: string) => {
  return request<{
    success: true;
    tagCode: string;
    maskedPhone: string;
    expiresAt: string;
    message: string;
  }>(`/safetags/request-otp/${tagCode}`, {
    method: "POST",
  });
};

export const verifySafeTagOtpApi = async (tagCode: string, otp: string) => {
  return request<{
    success: true;
    tagCode: string;
    accessTier: string;
    victim: unknown;
    fullMedicalHistory: unknown;
    digitalSignature: string;
  }>(`/safetags/verify-otp/${tagCode}`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
};

export const emergencyBypassSafeTagApi = async (
  tagCode: string,
  payload: {
    paramedicLicense: string;
    clinicalJustification: string;
    paramedicId?: string;
    emergencyIncidentId?: string;
  },
) => {
  return request<{
    success: true;
    tagCode: string;
    accessMode: string;
    paramedicLicense: string;
    victim: unknown;
    fullMedicalHistory: unknown;
    guardianNotified: boolean;
  }>(`/safetags/emergency-bypass/${tagCode}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 23: BẢN ĐỒ CỨU HỘ LỤT LỘI & NGẬP NƯỚC ====================

export const fetchFloodZonesApi = async () => {
  return request<{
    success: true;
    count: number;
    data: Array<{
      zoneCode: string;
      zoneName: string;
      currentWaterDepthCm: number;
      passabilityStatus: string;
      electrocutionRisk: boolean;
      activeWarnings: string[];
    }>;
  }>("/flood/zones");
};

export const updateFloodDepthApi = async (
  zoneCode: string,
  payload: {
    depthCm: number;
    tideState?: string;
    electrocutionRisk?: boolean;
    groundTransformerSubmerged?: boolean;
  },
) => {
  return request<{
    success: true;
    data: unknown;
  }>(`/flood/zones/${zoneCode}/depth`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const calculateFloodSafeRouteApi = async (payload: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  vehicleType?: string;
}) => {
  return request<{
    success: true;
    isDirectPassable: boolean;
    detourRecommended: boolean;
    detourPenaltyMinutes: number;
    maxEncounteredDepthCm: number;
    blockedZones: Array<{
      zoneCode: string;
      zoneName: string;
      waterDepthCm: number;
      reason: string;
    }>;
    safeCorridorGuidance: string;
  }>("/flood/route/safe-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const triggerFloodSosApi = async (payload: {
  userId: string;
  lat: number;
  lng: number;
  indoorWaterDepthCm?: number;
  electrocutionHazard?: boolean;
}) => {
  return request<{
    success: true;
    incidentId: string;
    category: string;
    evnGridShutdownNoticeDispatched: boolean;
    safetyInstructionsForVictim: string[];
  }>("/flood/sos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 24: CẤP CỨU THẢM HỌA & START TRIAGE ====================

export const declareMciApi = async (payload: {
  title: string;
  incidentType?: string;
  initialVictimEstimate?: number;
  lat?: number;
  lng?: number;
}) => {
  return request<{
    success: true;
    data: {
      _id: string;
      mciCode: string;
      title: string;
      mciLevel: string;
      status: string;
    };
  }>("/mci/declare", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const performStartTriageApi = async (
  mciId: string,
  assessmentData: {
    victimTagId: string;
    canWalk?: boolean;
    spontaneousBreathing?: boolean;
    airwayRepositioned?: boolean;
    breathsAfterAirwayOpen?: boolean;
    respiratoryRate?: number;
    capillaryRefillSec?: number;
    radialPulsePresent?: boolean;
    canFollowSimpleCommands?: boolean;
  },
) => {
  return request<{
    success: true;
    mciCode: string;
    victimTagId: string;
    triageCategory: "RED" | "YELLOW" | "GREEN" | "BLACK";
    priorityRank: number;
    triageRationale: string;
    colorHex: string;
    immediateFirstAidAction: string;
    casualtyTally: {
      red: number;
      yellow: number;
      green: number;
      black: number;
      totalTagged: number;
    };
  }>(`/mci/${mciId}/triage`, {
    method: "POST",
    body: JSON.stringify({ assessmentData }),
  });
};

export const autoBalanceMciEvacuationApi = async (mciId: string) => {
  return request<{
    success: true;
    mciCode: string;
    status: string;
    totalEvacuatedCount: number;
    evacuationAssignments: Array<{
      victimTagId: string;
      triageCategory: string;
      hospitalCode: string;
      hospitalName: string;
    }>;
  }>(`/mci/${mciId}/balance-evacuation`, {
    method: "POST",
  });
};


// ==================== PHÂN HỆ 25: CẤP CỨU RẮN CẮN ĐỘC (SNAKEBITE TRIAGE) ====================

export const recordSnakebiteCareApi = async (
  incidentId: string,
  payload: {
    biteLocation?: string;
    snakeFamily?: "ELAPIDAE_NEUROTOXIC" | "VIPERIDAE_HEMOTOXIC" | "UNKNOWN";
    pressureImmobilizationApplied?: boolean;
    systemicSymptoms?: Record<string, boolean>;
  },
) => {
  return request<{
    success: true;
    snakeFamily: string;
    isNeurotoxic: boolean;
    isHemotoxic: boolean;
    pressureImmobilizationApplied: boolean;
    firstAidGuidance: string;
    antivenomType: string;
    recommendedDestination: string;
  }>(`/emergencies/${incidentId}/snakebite-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateAntivenomHospitalApi = async (payload: {
  lat?: number;
  lng?: number;
  antivenomType?: string;
}) => {
  return request<{
    success: true;
    antivenomType: string;
    hospitalCode: string;
    hospitalName: string;
    vialsAvailable: number;
    distanceMeters: number;
    etaMinutes: number;
    clinicalGuidance: string;
  }>("/hospitals/antivenom/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 26: SƠ CỨU BỎNG NHIỆT & CÔNG THỨC PARKLAND ====================

export const recordBurnCareApi = async (
  incidentId: string,
  payload: {
    burnEtiology?: string;
    tbsaPercentage: number;
    burnDegree?: string;
    waterIrrigation20MinApplied?: boolean;
    patientWeightKg?: number;
    inhalationInjurySuspected?: boolean;
  },
) => {
  return request<{
    success: true;
    burnEtiology: string;
    tbsaPercentage: number;
    burnDegree: string;
    isSevereBurn: boolean;
    waterIrrigation20MinApplied: boolean;
    inhalationInjurySuspected: boolean;
    parklandFormula: {
      patientWeightKg: number;
      totalFluid24hMl: number;
      first8hFluidRateMlPerHour: number;
    };
    clinicalActionDirectives: string[];
  }>(`/emergencies/${incidentId}/burn-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateBurnCenterApi = async (payload: { lat?: number; lng?: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    availableBurnBeds: number;
    distanceMeters: number;
    etaMinutes: number;
    preHospitalAdvice: string;
  }>("/hospitals/burn-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 27: HỘI CHỨNG VÙI LẤP & SẬP ĐỔ CÔNG TRÌNH ====================

export const manageCrushSyndromeApi = async (
  incidentId: string,
  payload: {
    trappedStructure?: string;
    trappedMuscleGroup?: string;
    compressionDurationMinutes?: number;
    ivHydrationPreExtricationStarted?: boolean;
    provisionalTourniquetAppliedBeforeLifting?: boolean;
  },
) => {
  return request<{
    success: true;
    compressionDurationMinutes: number;
    crushSyndromeRisk: string;
    ivHydrationPreExtricationStarted: boolean;
    reperfusionCardiacArrestPrevented: boolean;
    usarRescueDirective: string;
  }>(`/emergencies/${incidentId}/crush-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 28: CHẤN THƯƠNG NGỰC HỞ & TRÀN KHÍ MÀNG PHỔI ÁP LỰC ====================

export const recordChestTraumaApi = async (
  incidentId: string,
  payload: {
    hasSuckingChestWound?: boolean;
    ventedChestSealApplied?: boolean;
    chestSealBurped?: boolean;
    tensionPneumothoraxSuspected?: boolean;
    needleDecompressionPerformed?: boolean;
    needleInsertionSite?: string;
    needleGauge?: string;
    airHissDecompressionConfirmed?: boolean;
  },
) => {
  return request<{
    success: true;
    hemodynamicStabilized: boolean;
    needleDecompressionPerformed: boolean;
    airHissDecompressionConfirmed: boolean;
    clinicalDirectives: string[];
    guidanceMessage: string;
  }>(`/emergencies/${incidentId}/chest-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 29: BẤT ĐỘNG CỘT SỐNG CỔ (SMR) & SỐC THẦN KINH ====================

export const recordSpinalTraumaApi = async (
  incidentId: string,
  payload: {
    mechanismHighRisk?: boolean;
    patientAge?: number;
    extremityParesthesia?: boolean;
    cervicalCollarApplied?: boolean;
    cervicalCollarSize?: string;
    manualInLineStabilizationMaintained?: boolean;
    logRollTechniqueUsed?: boolean;
    vacuumMattressSecured?: boolean;
    systolicBp?: number;
    heartRateBpm?: number;
    skinCondition?: string;
  },
) => {
  return request<{
    success: true;
    canadianCSpineRisk: string;
    cervicalCollarApplied: boolean;
    neurogenicShockSuspected: boolean;
    shockType: string;
    smrGuidance: string;
    shockDirectives: string;
  }>(`/emergencies/${incidentId}/spinal-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 30: HẠ ĐƯỜNG HUYẾT NẶNG & HÔN MÊ TIỂU ĐƯỜNG ====================

export const recordDiabeticEmergencyApi = async (
  incidentId: string,
  payload: {
    bloodGlucoseMmolL?: number;
    bloodGlucoseMgDl?: number;
    isConscious?: boolean;
    swallowReflexIntact?: boolean;
    ruleOf15Applied?: boolean;
    glucagonOrIvDextroseAdministered?: boolean;
    medicationType?: string;
    postTreatmentGlucoseMmolL?: number;
  },
) => {
  return request<{
    success: true;
    bloodGlucoseMmolL: number;
    hypoglycemiaSeverity: string;
    oralIntakeContraindicated: boolean;
    patientConsciousnessRegained: boolean;
    firstAidDirectives: string;
  }>(`/emergencies/${incidentId}/diabetic-emergency`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 31: HÓC DỊ VẬT ĐƯỜNG THỞ TRẺ EM (FBAO) ====================

export const recordPediatricChokingApi = async (
  incidentId: string,
  payload: {
    patientAgeMonths?: number;
    isUnconscious?: boolean;
    backBlowsAndChestThrustsApplied?: boolean;
    abdominalThrustsHeimlichApplied?: boolean;
    foreignBodyExpelled?: boolean;
    airwayClear?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    patientAgeMonths: number;
    isInfantUnder1Year: boolean;
    abdominalThrustsContraindicatedInfant: boolean;
    blindFingerSweepProhibited: boolean;
    backBlowsAndChestThrustsApplied: boolean;
    abdominalThrustsHeimlichApplied: boolean;
    foreignBodyExpelled: boolean;
    airwayClear: boolean;
    clinicalProtocol: string;
    safetyWarnings: string[];
  }>(`/emergencies/${incidentId}/choking-fbao`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 32: ĐỘNG KINH & CO GIẬT LIÊN TỤC (STATUS EPILEPTICUS) ====================

export const recordSeizureCareApi = async (
  incidentId: string,
  payload: {
    seizureDurationMinutes?: number;
    headProtectedWithPadding?: boolean;
    recoveryPositionPlacedPostIctal?: boolean;
    midazolamOrDiazepamAdministered?: boolean;
    convulsionCeased?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    seizureDurationMinutes: number;
    isStatusEpilepticus: boolean;
    oralObjectInsertionContraindicated: boolean;
    physicalRestraintContraindicated: boolean;
    headProtectedWithPadding: boolean;
    recoveryPositionPlacedPostIctal: boolean;
    midazolamOrDiazepamAdministered: boolean;
    convulsionCeased: boolean;
    statusSeverity: string;
    rescueInstructions: string[];
  }>(`/emergencies/${incidentId}/seizure-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 33: ĐIỆN GIẬT & AN TOÀN CAO THẾ (STEP POTENTIAL) ====================

export const recordElectricalCareApi = async (
  incidentId: string,
  payload: {
    voltageCategory?: string;
    scenePowerCutConfirmed?: boolean;
    safetyCordonMaintained10Meters?: boolean;
    stepPotentialHopExitUsed?: boolean;
    cardiacRhythmAssessed?: string;
    aedShockDelivered?: boolean;
    deepTissueBurnSuspected?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    voltageCategory: string;
    scenePowerCutConfirmed: boolean;
    safetyCordonMaintained10Meters: boolean;
    stepPotentialHopExitUsed: boolean;
    cardiacRhythmAssessed: string;
    aedShockDelivered: boolean;
    deepTissueBurnSuspected: boolean;
    sceneSafetyDirectives: string;
    stepPotentialWarning: string;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/electrical-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 34: NGỘ ĐỘC KHÍ CO & KHÓI CHÁY CHUNG CƯ ====================

export const recordCoSmokeCareApi = async (
  incidentId: string,
  payload: {
    sourceCategory?: string;
    sootInNarisOrOralCavity?: boolean;
    highFlowOxygen100Applied?: boolean;
    oxygenFlowRateLpm?: number;
    estimatedHbCoPercent?: number;
    isPregnant?: boolean;
    isUnconscious?: boolean;
    cyanideAntidoteAdministered?: boolean;
    antidoteType?: string;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    sourceCategory: string;
    sootInNarisOrOralCavity: boolean;
    highFlowOxygen100Applied: boolean;
    hyperbaricOxygenIndicated: boolean;
    cyanideAntidoteAdministered: boolean;
    antidoteType: string;
    oxygenHalfLifeReduction: string;
    hbotAdvice: string;
    cyanideDirectives: string;
  }>(`/emergencies/${incidentId}/co-smoke-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 35: CHẤN THƯƠNG MẮT & BỎNG HÓA CHẤT MẮT ====================

export const recordOcularTraumaCareApi = async (
  incidentId: string,
  payload: {
    injuryCategory?: string;
    immediateIrrigationPerformed?: boolean;
    irrigationDurationMinutes?: number;
    irrigationFluidVolumeMl?: number;
    measuredConjunctivalPh?: number;
    rigidEyeShieldApplied?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    injuryCategory: string;
    immediateIrrigationPerformed: boolean;
    irrigationDurationMinutes: number;
    targetPhNeutralized: boolean;
    rigidEyeShieldApplied: boolean;
    globePressureProhibited: boolean;
    irrigationProtocol: string;
    penetratingTraumaWarnings: string[];
  }>(`/emergencies/${incidentId}/ocular-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 36: SƠ CỨU ĐỨT LÌA CHI & BẢO QUẢN VI PHẪU ====================

export const recordAmputationCareApi = async (
  incidentId: string,
  payload: {
    amputationType?: string;
    anatomicalPart?: string;
    stumpHemostasisApplied?: boolean;
    hemostasisMethod?: string;
    amputatedPartRetrieved?: boolean;
    threeTierPreservationApplied?: boolean;
    ischemiaType?: string;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    amputationType: string;
    anatomicalPart: string;
    stumpHemostasisApplied: boolean;
    hemostasisMethod: string;
    amputatedPartRetrieved: boolean;
    threeTierPreservationApplied: boolean;
    directIceContactProhibited: boolean;
    goldenWindowHours: number;
    preservationProtocol: string;
    prohibitions: string[];
    surgicalTransportAdvice: string;
  }>(`/emergencies/${incidentId}/amputation-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateEyeCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    preHospitalDirectives: string;
  }>("/hospitals/eye-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateMicrovascularCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    replantationAdvice: string;
  }>("/hospitals/microvascular-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateHyperbaricCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    hbotGuidance: string;
  }>("/hospitals/hyperbaric-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 37: CHẤN THƯƠNG BỤNG & VỠ PHÌNH ĐM CHỦ BỤNG ====================

export const recordAbdominalTraumaCareApi = async (
  incidentId: string,
  payload: {
    traumaType?: string;
    sterileMoistDressingApplied?: boolean;
    occlusiveMoistureBarrierApplied?: boolean;
    kneesFlexedPositionMaintained?: boolean;
    actualSystolicBp?: number;
    excessiveFluidAvoided?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    traumaType: string;
    organReinsertionProhibited: boolean;
    sterileMoistDressingApplied: boolean;
    occlusiveMoistureBarrierApplied: boolean;
    kneesFlexedPositionMaintained: boolean;
    actualSystolicBp: number;
    permissiveHypotensionTargetSbp: number;
    excessiveFluidAvoided: boolean;
    eviscerationProtocol: string;
    aaaRuptureDirectives: string;
  }>(`/emergencies/${incidentId}/abdominal-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 38: NGỘ ĐỘC THUỐC TRỪ SÂU PHOSPHO HỮU CƠ ====================

export const recordToxicologyCareApi = async (
  incidentId: string,
  payload: {
    toxinCategory?: string;
    dermalDecontaminationPerformed?: boolean;
    clothingSafelyDisposedInBags?: boolean;
    pinpointPupilsObserved?: boolean;
    bronchorrheaSecretionsSuctioned?: boolean;
    atropineAdministeredMg?: number;
    atropinizationAchieved?: boolean;
    pralidoximePamAdministeredGrams?: number;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    toxinCategory: string;
    dermalDecontaminationPerformed: boolean;
    clothingSafelyDisposedInBags: boolean;
    pinpointPupilsObserved: boolean;
    bronchorrheaSecretionsSuctioned: boolean;
    atropineAdministeredMg: number;
    atropinizationAchieved: boolean;
    pralidoximePamAdministeredGrams: number;
    toxicologyDirectives: string[];
  }>(`/emergencies/${incidentId}/toxicology-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 39: VỠ KHUNG CHẬU & ĐAI KẸP CẦM MÁU ====================

export const recordPelvicTraumaCareApi = async (
  incidentId: string,
  payload: {
    fracturePattern?: string;
    pelvicBinderApplied?: boolean;
    pelvicBinderPlacementSite?: string;
    kneesAndFeetTiedTogether?: boolean;
    scoopStretcherUsed?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    fracturePattern: string;
    repeatedPelvicRockingProhibited: boolean;
    pelvicBinderApplied: boolean;
    pelvicBinderPlacementSite: string;
    isCorrectPlacement: boolean;
    kneesAndFeetTiedTogether: boolean;
    retroperitonealBleedingRisk: string;
    scoopStretcherUsed: boolean;
    clinicalGuidance: string;
    criticalDirectives: string[];
  }>(`/emergencies/${incidentId}/pelvic-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateToxicologyCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    antidoteGuidance: string;
  }>("/hospitals/toxicology-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateVascularCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    surgicalGuidance: string;
  }>("/hospitals/vascular-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locatePelvicCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    pelvicCareDirectives: string;
  }>("/hospitals/pelvic-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 40: CHẤN THƯƠNG SỌ NÃO NẶNG & TỤT KẸT NÃO ====================

export const recordTbiCareApi = async (
  incidentId: string,
  payload: {
    gcsScore?: number;
    systolicBloodPressure?: number;
    heartRateBpm?: number;
    respiratoryPattern?: string;
    dilatedPupilDiameterMm?: number;
    headElevated30Degrees?: boolean;
    controlledHyperventilationApplied?: boolean;
    hypotensionHypoxiaPrevented?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    gcsScore: number;
    cushingsTriadObserved: boolean;
    anisocoriaPupilDilation: boolean;
    cerebralHerniationImminent: boolean;
    headElevated30Degrees: boolean;
    controlledHyperventilationApplied: boolean;
    targetEtCo2MmHg: number;
    prophylacticHyperventilationAvoided: boolean;
    hypotensionHypoxiaPrevented: boolean;
    neurosurgeryTransferInitiated: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/tbi-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateNeurosurgeryCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    surgicalGuidance: string;
  }>("/hospitals/neurosurgery-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 41: SẢN PHỤ CHẤN THƯƠNG & NGỪNG TIM THAI PHỤ ====================

export const recordMaternalCareApi = async (
  incidentId: string,
  payload: {
    gestationalAgeWeeks?: number;
    manualLeftUterineDisplacementApplied?: boolean;
    cardiacArrestDurationMinutes?: number;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    gestationalAgeWeeks: number;
    uterineFundusAboveUmbilicus: boolean;
    manualLeftUterineDisplacementApplied: boolean;
    tiltWholeBodyProhibited: boolean;
    aortocavalCompressionRelieved: boolean;
    cardiacArrestDurationMinutes: number;
    perimortemCesareanIndicated: boolean;
    targetDeliveryWithin5Minutes: boolean;
    maternalFetalSpecialtyHospitalNotified: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/maternal-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateObstetricCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    maternalGuidance: string;
  }>("/hospitals/obstetric-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 42: TAI BIẾN LẶN BIỂN & BỆNH GIẢM ÁP KHÍ NÉN ====================

export const recordDecompressionCareApi = async (
  incidentId: string,
  payload: {
    exposureCategory?: string;
    symptomType?: string;
    highFlowOxygen100Applied?: boolean;
    oxygenFlowRateLpm?: number;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    exposureCategory: string;
    symptomType: string;
    highFlowOxygen100Applied: boolean;
    oxygenFlowRateLpm: number;
    inWaterRecompressionStrictlyProhibited: boolean;
    lowAltitudeEvacuationEnforced: boolean;
    maximumFlightAltitudeMeters: number;
    recompressionChamberIndicated: boolean;
    usNavyTable6ProtocolReady: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/decompression-care`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateRecompressionCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    hyperbaricDirectives: string;
  }>("/hospitals/recompression-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 43: SỐC MẤT MÁU NẶNG & DCR / TXA CRASH-2 / MTP 1:1:1 ====================

export const recordHemorrhagicShockCareApi = async (
  incidentId: string,
  payload: {
    shockClass?: string;
    estimatedBloodLossMl?: number;
    systolicBp?: number;
    heartRate?: number;
    injuryToTxaIntervalMinutes?: number;
    crystalloidLimitedUnder1000Ml?: boolean;
    mtpProtocol111Activated?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    shockClass: string;
    estimatedBloodLossMl: number;
    systolicBp: number;
    heartRate: number;
    injuryToTxaIntervalMinutes: number;
    txaAdministeredWithin3Hours: boolean;
    txaContraindicatedAfter3Hours: boolean;
    txaDoseGrams: number;
    crystalloidLimitedUnder1000Ml: boolean;
    mtpProtocol111Activated: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/hemorrhagic-shock`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateTransfusionCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    transfusionGuidance: string;
  }>("/hospitals/transfusion-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 44: HẠ THÂN NHIỆT SÂU & LÀM ẤM CHỦ ĐỘNG ====================

export const recordSevereHypothermiaCareApi = async (
  incidentId: string,
  payload: {
    coreTemperatureCelsius?: number;
    gentleHandlingMaintained?: boolean;
    activeExternalCoreRewarmingApplied?: boolean;
    activeInternalRewarmingApplied?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    coreTemperatureCelsius: number;
    hypothermiaStage: string;
    gentleHandlingMaintained: boolean;
    activeExternalCoreRewarmingApplied: boolean;
    extremityRewarmingProhibitedBeforeCore: boolean;
    rewarmingAfterdropPrevented: boolean;
    activeInternalRewarmingApplied: boolean;
    noOneDeadUntilWarmAndDeadRule: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/hypothermia-rewarming`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateHypothermiaCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    ecmoGuidance: string;
  }>("/hospitals/hypothermia-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 45: CƠN BÃO GIÁP TRẠNG & HÔN MÊ SUY GIÁP ====================

export const recordEndocrineCrisisCareApi = async (
  incidentId: string,
  payload: {
    crisisType?: string;
    burchWartofskyScore?: number;
    coreTemperatureCelsius?: number;
    heartRateBpm?: number;
    betaBlockerAdministered?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    crisisType: string;
    burchWartofskyScore: number;
    coreTemperatureCelsius: number;
    heartRateBpm: number;
    aspirinStrictlyProhibited: boolean;
    safeCoolingMethod: string;
    betaBlockerAdministered: boolean;
    levothyroxineHydrocortisoneReady: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/endocrine-crisis`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateEndocrineCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    endocrineGuidance: string;
  }>("/hospitals/endocrine-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 46: NGỘ ĐỘC KHÍ ĐỘC CÔNG NGHIỆP H2S & CLO ====================

export const recordIndustrialGasCareApi = async (
  incidentId: string,
  payload: {
    gasType?: string;
    rescuerHasScba?: boolean;
    highFlowOxygen100Administered?: boolean;
    antidoteAdministered?: string;
    upwindEvacuationMaintained?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    gasType: string;
    scbaEntryRequired: boolean;
    rescuerEntryBlockedWithoutScba: boolean;
    olfactoryFatigueWarningIssued: boolean;
    highFlowOxygen100Administered: boolean;
    antidoteAdministered: string;
    upwindEvacuationMaintained: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/industrial-gas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateIndustrialToxicologyCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    toxicologyGuidance: string;
  }>("/hospitals/industrial-toxicology-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 47: SỐC TIM CẤP & PHÙ PHỔI CẤP HUYẾT ĐỘNG ====================

export const recordCardiogenicShockCareApi = async (
  incidentId: string,
  payload: {
    killipClass?: string;
    systolicBp?: number;
    cpapBiPapPositivePressureApplied?: boolean;
    cpapPressureCmH2O?: number;
    nitroglycerinAdministered?: boolean;
    pde5InhibitorOrRvInfarctionScreened?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    killipClass: string;
    patientPositioning: string;
    cpapBiPapPositivePressureApplied: boolean;
    cpapPressureCmH2O: number;
    systolicBp: number;
    nitroglycerinAdministered: boolean;
    nitroglycerinContraindicated: boolean;
    pde5InhibitorOrRvInfarctionScreened: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/cardiogenic-shock`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateCardiogenicCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    cardiologyGuidance: string;
  }>("/hospitals/cardiogenic-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 48: SỐC NHIỄM KHUẨN & GÓI GIỜ VÀNG SEPSIS ====================

export const recordSepticShockCareApi = async (
  incidentId: string,
  payload: {
    respiratoryRatePerMin?: number;
    systolicBp?: number;
    gcsScore?: number;
    crystalloidBolusMlPerKg?: number;
    patientWeightKg?: number;
    lactateMmolL?: number;
    vasopressorNoradrenalineStarted?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    qSofaScore: number;
    respiratoryRatePerMin: number;
    systolicBp: number;
    gcsScore: number;
    crystalloidBolusMlPerKg: number;
    totalCrystalloidInfusedMl: number;
    lactateMmolL: number;
    vasopressorNoradrenalineStarted: boolean;
    targetMeanArterialPressureMmHg: number;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/septic-shock`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateSepsisCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    sepsisGuidance: string;
  }>("/hospitals/sepsis-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 49: CHẤN THƯƠNG MẠCH MÁU GIÁP RANH & HỘI CHỨNG KHOANG ====================

export const recordJunctionalVascularCareApi = async (
  incidentId: string,
  payload: {
    injuryLocation?: string;
    hemostaticWoundPackingApplied?: boolean;
    junctionalTourniquetApplied?: boolean;
    directPressureDurationMinutes?: number;
    ischemiaTimeMinutes?: number;
    compartmentSyndromeSuspected?: boolean;
    passiveStretchPainPresent?: boolean;
    elevationProhibitedIfCompartment?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    injuryLocation: string;
    hemostaticWoundPackingApplied: boolean;
    junctionalTourniquetApplied: boolean;
    directPressureDurationMinutes: number;
    ischemiaTimeMinutes: number;
    compartmentSyndromeSuspected: boolean;
    passiveStretchPainPresent: boolean;
    elevationProhibitedIfCompartment: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/junctional-vascular`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateVascularInterventionCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    vascularGuidance: string;
  }>("/hospitals/vascular-intervention-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 50: TĂNG THÂN NHIỆT ÁC TÍNH & HỘI CHỨNG SEROTONIN ====================

export const recordHyperthermiaSerotoninCareApi = async (
  incidentId: string,
  payload: {
    syndromeType?: string;
    hunterCriteriaClonusPresent?: boolean;
    leadPipeRigidityPresent?: boolean;
    coreTemperatureCelsius?: number;
    antidoteAdministered?: string;
    physicalRestraintsProhibited?: boolean;
    activeExternalCoolingApplied?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    syndromeType: string;
    hunterCriteriaClonusPresent: boolean;
    leadPipeRigidityPresent: boolean;
    coreTemperatureCelsius: number;
    antidoteAdministered: string;
    physicalRestraintsProhibited: boolean;
    activeExternalCoolingApplied: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/hyperthermia-serotonin`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateDantroleneCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    hyperthermiaGuidance: string;
  }>("/hospitals/dantrolene-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 51: HỒI SINH TIM PHỔI NGOÀI CƠ THỂ TIỀN VIỆN (ECPR) ====================

export const recordEcprCareApi = async (
  incidentId: string,
  payload: {
    witnessedArrest?: boolean;
    bystanderCprStartedWithin5Min?: boolean;
    initialRhythmShockable?: boolean;
    refractoryShocksCount?: number;
    mechanicalCprDeviceActive?: boolean;
    estimatedTimeToCannulationMinutes?: number;
    ecprPreAlertAcknowledged?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    witnessedArrest: boolean;
    bystanderCprStartedWithin5Min: boolean;
    initialRhythmShockable: boolean;
    refractoryShocksCount: number;
    mechanicalCprDeviceActive: boolean;
    estimatedTimeToCannulationMinutes: number;
    ecprPreAlertAcknowledged: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/ecpr-arrest`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateEcprCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    ecprGuidance: string;
  }>("/hospitals/ecpr-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 52: CHẤN THƯƠNG CỘT SỐNG NGỰC - THẮT LƯNG & LIỆT TỦY ====================

export const recordThoracolumbarCareApi = async (
  incidentId: string,
  payload: {
    asiaImpairmentScale?: string;
    logRoll4PersonTechniqueApplied?: boolean;
    vacuumMattressApplied?: boolean;
    rigidSpineBoardRemovedWithin30Min?: boolean;
    priapismOrSphincterLossDetected?: boolean;
    spinalShockWatchdogActive?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    asiaImpairmentScale: string;
    logRoll4PersonTechniqueApplied: boolean;
    vacuumMattressApplied: boolean;
    rigidSpineBoardRemovedWithin30Min: boolean;
    priapismOrSphincterLossDetected: boolean;
    spinalShockWatchdogActive: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/thoracolumbar-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateSpineSurgeryCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    spineGuidance: string;
  }>("/hospitals/spine-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 53: PHÙ NÃO & PHÙ PHỔI ĐỘ CAO (HACE & HAPE) ====================

export const recordHighAltitudeCareApi = async (
  incidentId: string,
  payload: {
    altitudeMeters?: number;
    lakeLouiseScore?: number;
    immediateDescentStarted?: boolean;
    descentAltitudeMeters?: number;
    gamowHyperbaricBagApplied?: boolean;
    dexamethasoneAdministered?: boolean;
    nifedipineAdministered?: boolean;
    highFlowOxygenApplied?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    altitudeMeters: number;
    lakeLouiseScore: number;
    immediateDescentStarted: boolean;
    descentAltitudeMeters: number;
    gamowHyperbaricBagApplied: boolean;
    dexamethasoneAdministered: boolean;
    nifedipineAdministered: boolean;
    highFlowOxygenApplied: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/high-altitude`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateAltitudeCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    altitudeGuidance: string;
  }>("/hospitals/altitude-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 54: SƠ CỨU BỎNG LẠNH & KHÍ HÓA LỎNG ====================

export const recordCryogenicFrostbiteCareApi = async (
  incidentId: string,
  payload: {
    frostbiteDegree?: string;
    rapidRewarmingWaterTempCelsius?: number;
    frictionRubbingStrictlyProhibited?: boolean;
    refreezingRiskPrevented?: boolean;
    thromboxaneInhibitorIbuprofenGiven?: boolean;
    aloeVeraSterileDressingApplied?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    frostbiteDegree: string;
    rapidRewarmingWaterTempCelsius: number;
    frictionRubbingStrictlyProhibited: boolean;
    refreezingRiskPrevented: boolean;
    thromboxaneInhibitorIbuprofenGiven: boolean;
    aloeVeraSterileDressingApplied: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/cryogenic-frostbite`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateCryogenicCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    cryogenicGuidance: string;
  }>("/hospitals/cryogenic-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 55: VIÊM CÂN MẠC HOẠI TỬ & SỐC ĐỘC TỐ LRINEC ====================

export const recordNecrotizingFasciitisCareApi = async (
  incidentId: string,
  payload: {
    lrinecScore?: number;
    painOutOfProportion?: boolean;
    subcutaneousCrepitusPresent?: boolean;
    clindamycinToxinInhibitionGiven?: boolean;
    emergencySurgicalDebridementAlerted?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    lrinecScore: number;
    painOutOfProportion: boolean;
    subcutaneousCrepitusPresent: boolean;
    clindamycinToxinInhibitionGiven: boolean;
    emergencySurgicalDebridementAlerted: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/necrotizing-fasciitis`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateNecrotizingCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    necrotizingFasciitisGuidance: string;
  }>("/hospitals/necrotizing-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 56: KHỐI MÁU TỤ HỐC MẮT & MỞ GÓC MẮT NGOÀI ====================

export const recordRetrobulbarHematomaCareApi = async (
  incidentId: string,
  payload: {
    rockHardProptosis?: boolean;
    relativeAfferentPupillaryDefect?: boolean;
    intraocularPressureMmHg?: number;
    ischemiaTimeMinutes?: number;
    lateralCanthotomyCantholysisPrepared?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    rockHardProptosis: boolean;
    relativeAfferentPupillaryDefect: boolean;
    intraocularPressureMmHg: number;
    ischemiaTimeMinutes: number;
    lateralCanthotomyCantholysisPrepared: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/retrobulbar-hematoma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateOrbitalCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    orbitalGuidance: string;
  }>("/hospitals/orbital-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 57: NGỘ ĐỘC THUỐC TÊ & NHŨ DỊCH LIPID 20% ====================

export const recordLastToxicityLipidCareApi = async (
  incidentId: string,
  payload: {
    localAnestheticAgent?: string;
    perioralNumbnessMetallicTaste?: boolean;
    seizuresOrRefractoryArrhythmia?: boolean;
    lipidEmulsion20PercentBolusGiven?: boolean;
    lipidInfusionRateMlKgMin?: number;
    vasopressinAndCalciumBlockersProhibited?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    localAnestheticAgent: string;
    perioralNumbnessMetallicTaste: boolean;
    seizuresOrRefractoryArrhythmia: boolean;
    lipidEmulsion20PercentBolusGiven: boolean;
    lipidInfusionRateMlKgMin: number;
    vasopressinAndCalciumBlockersProhibited: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/last-lipid-rescue`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateLipidRescueCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    lipidRescueGuidance: string;
  }>("/hospitals/lipid-rescue-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 58: THUYÊN TẮC PHỔI DIỆN RỘNG & TẮC MẠCH ỐI ====================

export const recordMassivePulmonaryEmbolismCareApi = async (
  incidentId: string,
  payload: {
    wellsScore?: number;
    isAmnioticFluidEmbolism?: boolean;
    acuteRightHeartStrainSigns?: boolean;
    systemicThrombolysisIndicated?: boolean;
    cautiousFluidsUnder500Ml?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    wellsScore: number;
    isAmnioticFluidEmbolism: boolean;
    acuteRightHeartStrainSigns: boolean;
    systemicThrombolysisIndicated: boolean;
    cautiousFluidsUnder500Ml: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/massive-pulmonary-embolism`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locatePulmonaryEmbolismCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    pulmonaryEmbolismGuidance: string;
  }>("/hospitals/pulmonary-embolism-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 59: VỠ THỰC QUẢN BOERHAAVE & TRÀN KHÍ TRUNG THẤT ====================

export const recordEsophagealRuptureCareApi = async (
  incidentId: string,
  payload: {
    macklerTriadPresent?: boolean;
    hammanSignCrunchPresent?: boolean;
    strictNpoProhibitedOralIntake?: boolean;
    blindNasogastricTubeProhibited?: boolean;
    broadSpectrumAntibioticsGiven?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    macklerTriadPresent: boolean;
    hammanSignCrunchPresent: boolean;
    strictNpoProhibitedOralIntake: boolean;
    blindNasogastricTubeProhibited: boolean;
    broadSpectrumAntibioticsGiven: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/esophageal-rupture`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateEsophagealCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    esophagealSurgeryGuidance: string;
  }>("/hospitals/esophageal-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

// ==================== PHÂN HỆ 60: VỠ BÀNG QUANG & ĐỨT NIỆU ĐẠO PHỨC TẠP ====================

export const recordBladderUrethralTraumaCareApi = async (
  incidentId: string,
  payload: {
    bloodAtUrethralMeatus?: boolean;
    butterflyPerinealHematoma?: boolean;
    blindFoleyCatheterizationStrictlyProhibited?: boolean;
    retrogradeUrethrographyIndicated?: boolean;
    suprapubicCystostomyPrepared?: boolean;
  },
) => {
  return request<{
    success: true;
    incidentId: string;
    bloodAtUrethralMeatus: boolean;
    butterflyPerinealHematoma: boolean;
    blindFoleyCatheterizationStrictlyProhibited: boolean;
    retrogradeUrethrographyIndicated: boolean;
    suprapubicCystostomyPrepared: boolean;
    clinicalDirectives: string[];
  }>(`/emergencies/${incidentId}/bladder-urethral-trauma`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const locateUrologyCenterApi = async (payload: { lat: number; lng: number }) => {
  return request<{
    success: true;
    hospitalCode: string;
    hospitalName: string;
    specialty: string;
    distanceMeters: number;
    etaMinutes: number;
    urologyTraumaGuidance: string;
  }>("/hospitals/urology-center/locate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const testSafePointIot = async (
  id: string,
  payload: { action: "PING_SENSOR" | "TEST_SIREN"; actorName?: string },
) => {
  return request<{
    success: true;
    data: {
      stationId: string;
      serialNumber: string;
      stationName: string;
      action: string;
      doorState: string;
      batteryPercent: number;
      latencyMs: number;
      sirenDb: number;
      lastPingAt: string;
      message: string;
    };
  }>(`/safepoints/${id}/test-iot`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};
