const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "default-public-api-key-123",
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
  certificateImageUrl?: string | null;
  certificateNumber?: string | null;
  issuingOrganization?: string;
  certificateType?: string;
  specialtyTier?: "TIER_1_BLS" | "TIER_2_PHTLS" | "TIER_3_MEDIC" | "NONE";
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
  tier?: string,
) => {
  return request<{ success: true; data: unknown }>(`/admin/kyc/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify({ action, tier }),
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
  status: "PENDING_DONORS" | "DONORS_COMMITTED" | "IN_TRANSIT" | "DELIVERED_AND_FULFILLED" | "CANCELLED";
  matchedDonors: Array<{
    donorId: string;
    donorName?: string;
    bloodGroup: string;
    contactPhone?: string;
    committedUnits: number;
    status: "NOTIFIED" | "ACCEPTED" | "ARRIVED" | "DONATED" | "DECLINED";
    etaMinutes?: number;
    distanceKm?: number;
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

export const fetchHeroPolicies = async (heroId: string) => {
  return request<{ success: true; count: number; data: HeroPolicyItem[] }>(`/heroshield/policies/${heroId}`);
};

export const fetchHeroRestockVouchers = async (heroId: string) => {
  return request<{ success: true; count: number; data: RestockVoucherItem[] }>(`/heroshield/vouchers/${heroId}`);
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

