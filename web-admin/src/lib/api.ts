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
    battery: number;
    device: string;
    status: string;
    syncTime: string;
  };
};

export const fetchMultiVictimVitals = async () => {
  return request<{ success: true; data: MultiVictimVitalsItem[] }>("/admin/vitals/active");
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


