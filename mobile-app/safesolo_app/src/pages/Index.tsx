import { useEffect, useState } from "react";
import { useApp } from "@/state/AppState";
import Onboarding from "@/screens/Onboarding";
import AuthScreen from "@/screens/AuthScreen";
import PermissionsScreen from "@/screens/PermissionsScreen";
import HomeScreen from "@/screens/HomeScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import HeroesScreen from "@/screens/HeroesScreen";
import CircleScreen from "@/screens/CircleScreen";
import MessengerScreen from "@/screens/MessengerScreen";
import BottomNav, { Tab } from "@/components/BottomNav";
import SosMapScreen from "@/screens/SosMapScreen";
import CommunityRadarScreen from "@/screens/CommunityRadarScreen";
import StealthScreen from "@/screens/StealthScreen";
import { Siren } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { user, onboarded, permissionsGranted, completeOnboarding, grantPermissions, signIn, security } =
    useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [sosFor, setSosFor] = useState<string | null>(null);
  const [communityCall, setCommunityCall] = useState<{ reason: string; note: string } | null>(null);

  // Demo push notification once after login
  useEffect(() => {
    if (!user) return;
    const seen = sessionStorage.getItem("safesolo:demo-push");
    if (seen) return;
    const t = setTimeout(() => {
      sessionStorage.setItem("safesolo:demo-push", "1");
      toast.custom(
        (id) => (
          <button
            onClick={() => {
              toast.dismiss(id);
              setCommunityCall({ reason: "Cấp cứu y tế", note: "Người cao tuổi cần trợ giúp gấp" });
            }}
            className="w-full text-left bg-destructive text-destructive-foreground rounded-2xl p-3 shadow-danger flex items-start gap-3 max-w-sm"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-blink shrink-0">
              <Siren className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase opacity-90">🚨 SOS gần bạn · 800m</p>
              <p className="text-sm font-bold leading-snug">
                Cấp cứu y tế cho người cao tuổi. Người nhà đang khẩn thiết nhờ cộng đồng trợ giúp!
              </p>
            </div>
          </button>
        ),
        { duration: 12000 }
      );
    }, 4000);
    return () => clearTimeout(t);
  }, [user]);

  if (security.stealthMode) return <StealthScreen />;
  if (!onboarded) return <Onboarding onDone={completeOnboarding} />;
  if (!user) return <AuthScreen onSignIn={(email) => signIn(email)} />;
  if (!permissionsGranted) return <PermissionsScreen onGrant={grantPermissions} />;

  return (
    <div className="min-h-screen flex flex-col gradient-bg">
      {tab === "home" && <HomeScreen onOpenSos={() => setSosFor("Hồ Văn Tài")} />}
      {tab === "circle" && <CircleScreen />}
      {tab === "messages" && <MessengerScreen />}
      {tab === "heroes" && <HeroesScreen />}
      {tab === "settings" && <SettingsScreen />}
      <BottomNav active={tab} onChange={setTab} />
      {sosFor && (
        <SosMapScreen
          victimName={sosFor}
          onClose={() => setSosFor(null)}
          onBroadcast={(reason, note) => {
            setSosFor(null);
            setCommunityCall({ reason, note });
          }}
        />
      )}
      {communityCall && (
        <CommunityRadarScreen
          reason={communityCall.reason}
          note={communityCall.note}
          onClose={() => setCommunityCall(null)}
        />
      )}
    </div>
  );
};

export default Index;
