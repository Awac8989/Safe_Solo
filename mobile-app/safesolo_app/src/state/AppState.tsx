import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { api } from "@/lib/api";

type User = { name: string; email: string };
export type Mood = "happy" | "ok" | "sick" | null;

export interface MedicalId {
  fullName: string;
  birthYear: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  medications: string;
  emergencyPhone: string;
}

export interface Automation {
  shakeSos: boolean;
  shakeSensitivity: number; // 1..5
  fallDetection: boolean;
  geofenceAutoCheckin: boolean;
  pillReminder: boolean;
  pillTime: string; // "08:00"
}

export interface Security {
  realPin: string;
  duressPin: string;
  stealthMode: boolean; // disguise as Calculator
  autoWipeDays: number; // 0 = off
}

interface AppState {
  user: User | null;
  onboarded: boolean;
  permissionsGranted: boolean;
  lastCheckIn: number;
  graceHours: number;
  // new
  streak: number;
  mood: Mood;
  vacationUntil: number | null; // timestamp
  highContrast: boolean;
  medical: MedicalId;
  automation: Automation;
  security: Security;
  badges: string[]; // ids unlocked
  // actions
  signIn: (email: string, name?: string) => Promise<void>;
  signOut: () => void;
  completeOnboarding: () => void;
  grantPermissions: () => void;
  checkIn: (mood?: Mood) => Promise<void>;
  setGraceHours: (h: number) => void;
  setMood: (m: Mood) => void;
  startVacation: (days: number) => void;
  endVacation: () => void;
  setHighContrast: (b: boolean) => void;
  setMedical: (m: Partial<MedicalId>) => Promise<void>;
  setAutomation: (a: Partial<Automation>) => void;
  setSecurity: (s: Partial<Security>) => void;
  isVacation: boolean;
}

const Ctx = createContext<AppState | null>(null);
const KEY = "safesolo:state:v2";

const defaultMedical: MedicalId = {
  fullName: "", birthYear: "", bloodType: "O+",
  allergies: "", conditions: "", medications: "", emergencyPhone: "",
};
const defaultAutomation: Automation = {
  shakeSos: false, shakeSensitivity: 3,
  fallDetection: false, geofenceAutoCheckin: false,
  pillReminder: false, pillTime: "08:00",
};
const defaultSecurity: Security = {
  realPin: "", duressPin: "", stealthMode: false, autoWipeDays: 0,
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<number>(Date.now());
  const [graceHours, setGraceHoursState] = useState(24);
  const [streak, setStreak] = useState(12);
  const [mood, setMoodState] = useState<Mood>(null);
  const [vacationUntil, setVacationUntil] = useState<number | null>(null);
  const [highContrast, setHighContrastState] = useState(false);
  const [medical, setMedicalState] = useState<MedicalId>(defaultMedical);
  const [automation, setAutomationState] = useState<Automation>(defaultAutomation);
  const [security, setSecurityState] = useState<Security>(defaultSecurity);
  const [badges, setBadges] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setUser(s.user ?? null);
        setOnboarded(!!s.onboarded);
        setPermissionsGranted(!!s.permissionsGranted);
        setLastCheckIn(s.lastCheckIn ?? Date.now());
        setGraceHoursState(s.graceHours ?? 24);
        setStreak(s.streak ?? 12);
        setMoodState(s.mood ?? null);
        setVacationUntil(s.vacationUntil ?? null);
        setHighContrastState(!!s.highContrast);
        setMedicalState({ ...defaultMedical, ...(s.medical ?? {}) });
        setAutomationState({ ...defaultAutomation, ...(s.automation ?? {}) });
        setSecurityState({ ...defaultSecurity, ...(s.security ?? {}) });
        setBadges(s.badges ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({
      user, onboarded, permissionsGranted, lastCheckIn, graceHours,
      streak, mood, vacationUntil, highContrast, medical, automation, security, badges,
    }));
  }, [user, onboarded, permissionsGranted, lastCheckIn, graceHours, streak, mood, vacationUntil, highContrast, medical, automation, security, badges]);

  // Apply high contrast theme on root
  useEffect(() => {
    document.documentElement.classList.toggle("hc", highContrast);
  }, [highContrast]);

  const isVacation = !!vacationUntil && vacationUntil > Date.now();

  // unlock badges
  useEffect(() => {
    const next = new Set(badges);
    if (streak >= 7) next.add("streak7");
    if (streak >= 30) next.add("streak30");
    if (streak >= 100) next.add("streak100");
    if (medical.bloodType && medical.allergies && medical.emergencyPhone) next.add("medical");
    if (automation.shakeSos || automation.fallDetection) next.add("automation");
    if (security.duressPin) next.add("duress");
    const arr = Array.from(next);
    if (arr.length !== badges.length) setBadges(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak, medical, automation, security]);

  const value: AppState = useMemo(() => ({
    user, onboarded, permissionsGranted, lastCheckIn, graceHours,
    streak, mood, vacationUntil, highContrast, medical, automation, security, badges,
    isVacation,
    signIn: async (email, name) => {
      // 2-step: login (request OTP), then verifyOTP (get token)
      setUser(null);
      try {
        const loginRes = await api.login(email);
        if (!loginRes.success) throw new Error('Login failed');
        // Prompt for OTP (replace with UI prompt in real app)
        let otp = window.prompt('Nhập mã OTP gửi về email:');
        if (!otp) throw new Error('OTP required');
        const verifyRes = await api.verifyOTP(email, otp);
        if (!verifyRes.success) throw new Error('OTP verification failed');
        setUser({ email, name: name ?? email.split("@")[0].replace(/\./g, " ") });
      } catch {
        // fallback: local login for demo
        setUser({ email, name: name ?? email.split("@")[0].replace(/\./g, " ") });
      }
    },
    signOut: () => {
      setUser(null);
      localStorage.removeItem('safesolo_token');
    },
    completeOnboarding: () => setOnboarded(true),
    grantPermissions: () => setPermissionsGranted(true),
    checkIn: async (m) => {
      setLastCheckIn(Date.now());
      setStreak((s) => s + 1);
      if (m !== undefined) setMoodState(m);
      try {
        await api.checkin({ lat: 0, lng: 0 });
      } catch {
        // keep local state if API fails
      }
    },
    setGraceHours: (h) => setGraceHoursState(h),
    setMood: (m) => setMoodState(m),
    startVacation: (days) => setVacationUntil(Date.now() + days * 86400_000),
    endVacation: () => setVacationUntil(null),
    setHighContrast: setHighContrastState,
    setMedical: async (m) => {
      setMedicalState((p) => ({ ...p, ...m }));
      try {
        await api.updateMedical({ ...medical, ...m });
      } catch {
        // keep local state if API fails
      }
    },
    setAutomation: (a) => setAutomationState((p) => ({ ...p, ...a })),
    setSecurity: (s) => setSecurityState((p) => ({ ...p, ...s })),
  }), [user, onboarded, permissionsGranted, lastCheckIn, graceHours, streak, mood, vacationUntil, highContrast, medical, automation, security, badges, isVacation]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be inside AppProvider");
  return v;
};
