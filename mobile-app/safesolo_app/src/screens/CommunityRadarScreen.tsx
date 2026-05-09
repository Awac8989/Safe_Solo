import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Circle, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { X, Siren, MapPin, Phone, Send, Home as HomeIcon, BadgeCheck, Star, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  onClose: () => void;
  distanceM?: number;
  reason?: string;
  note?: string;
}

const me: [number, number] = [10.9760, 106.6470];
const victim: [number, number] = [10.9804, 106.6519];

interface Msg { from: "Bạn" | "Người nhà" | "system"; text: string }

export default function CommunityRadarScreen({ onClose, distanceM = 800, reason = "Cấp cứu y tế", note }: Props) {
  const [stage, setStage] = useState<"radar" | "operation">("radar");
  const [resolved, setResolved] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "system", text: "🔓 Hệ thống đã mở khóa địa chỉ chính xác." },
    { from: "Người nhà", text: "Cảm ơn anh đã nhận lời! Cửa cổng không khóa, anh cứ đẩy vào nhé." },
  ]);
  const [draft, setDraft] = useState("");

  // dark tile
  const darkTile = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { from: "Bạn", text: t.trim() }]);
    setDraft("");
  };

  // Auto-arrive system message after 8s
  useEffect(() => {
    if (stage !== "operation") return;
    const t = setTimeout(() => {
      setMsgs((m) => [...m, { from: "system", text: "📍 Tình nguyện viên Quân đã đến bán kính 50m." }]);
    }, 6000);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className="fixed inset-0 z-[60] bg-[#0b1020] flex flex-col text-white">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/10 bg-[#0b1020]">
        <div className="w-10 h-10 rounded-full bg-destructive/20 text-destructive flex items-center justify-center animate-blink">
          <Siren className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold opacity-70">SOS GẦN BẠN · Cộng đồng "Alive?"</p>
          <p className="font-extrabold truncate">
            {stage === "radar" ? `Cách bạn ${distanceM}m` : "Đang trên đường giải cứu"}
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Đóng">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[(me[0] + victim[0]) / 2, (me[1] + victim[1]) / 2]}
          zoom={15}
          scrollWheelZoom
          className="absolute inset-0 z-0"
        >
          <TileLayer url={darkTile} attribution='&copy; OSM &copy; CARTO' />
          {stage === "radar" ? (
            <Circle
              center={victim}
              radius={50}
              pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.35, weight: 2 }}
            />
          ) : (
            <>
              <Polyline positions={[me, victim]} pathOptions={{ color: "#22c55e", weight: 5, opacity: 0.85 }} />
              <Marker
                position={victim}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="background:#ef4444;border:3px solid white;border-radius:8px;padding:6px;box-shadow:0 4px 12px rgba(0,0,0,.4)">🏠</div>`,
                  iconSize: [36, 36],
                  iconAnchor: [18, 18],
                })}
              >
                <Popup>123 Đường Bạch Đằng, P. Phú Cường, Thủ Dầu Một</Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      {/* Bottom card */}
      {stage === "radar" ? (
        <div className="bg-card text-card-foreground rounded-t-3xl p-5 max-w-md mx-auto w-full space-y-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Siren className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-destructive">{reason}</p>
              <p className="font-extrabold text-lg leading-tight mt-0.5">Nạn nhân Nam, 70 tuổi</p>
              <p className="text-sm text-muted-foreground mt-0.5">Cách bạn ~3 phút di chuyển</p>
              {note && <p className="text-sm mt-2 bg-warning/10 text-warning-foreground/90 p-2 rounded-lg border border-warning/30">"{note}"</p>}
            </div>
          </div>

          <Button
            size="lg"
            onClick={() => setStage("operation")}
            className="w-full h-16 rounded-2xl text-lg font-extrabold gradient-safe text-primary-foreground border-0 shadow-safe"
          >
            ✋ TÔI SẼ ĐI CỨU
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            Vùng đỏ là khu vực ước tính. Địa chỉ chính xác chỉ mở khi bạn nhận lời.
          </p>
        </div>
      ) : (
        <div className="bg-card text-card-foreground max-w-md mx-auto w-full flex flex-col" style={{ maxHeight: "55vh" }}>
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <HomeIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase text-destructive">Địa chỉ đã mở khóa</p>
              <p className="font-bold truncate text-sm">123 Bạch Đằng, Phú Cường, TDM</p>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl gap-1">
              <Phone className="w-4 h-4" /> Gọi
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/40">
            {msgs.map((m, i) =>
              m.from === "system" ? (
                <p key={i} className="text-center text-[11px] text-muted-foreground bg-muted rounded-full px-3 py-1 mx-auto w-fit">
                  {m.text}
                </p>
              ) : (
                <div key={i} className={`flex ${m.from === "Bạn" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    m.from === "Bạn" ? "bg-primary text-primary-foreground" : "bg-card shadow-card"
                  }`}>
                    {m.from !== "Bạn" && <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.from}</p>}
                    {m.text}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="border-t border-border p-3 space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["Tôi đã đến cửa", "Đang bấm chuông", "Đã vào được nhà"].map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="shrink-0 text-xs font-semibold bg-primary-soft text-primary px-3 py-1.5 rounded-full">
                  {q}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex gap-2">
              <Input value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="Nhập tin nhắn..." className="rounded-2xl h-11" />
              <Button type="submit" size="icon" className="rounded-2xl h-11 w-11"><Send className="w-4 h-4" /></Button>
            </form>
            <Button variant="outline" className="w-full rounded-2xl mt-1" onClick={() => setResolved(true)}>
              Người bảo hộ xác nhận an toàn
            </Button>
          </div>
        </div>
      )}

      {/* Confetti success */}
      <Dialog open={resolved} onOpenChange={(o) => { if (!o) { setResolved(false); onClose(); } }}>
        <DialogContent className="rounded-3xl text-center max-w-xs">
          <DialogHeader>
            <DialogTitle className="sr-only">Cảm ơn</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-20 h-20 rounded-full gradient-safe flex items-center justify-center shadow-safe">
              <PartyPopper className="w-10 h-10 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-extrabold">Cảm ơn bạn!</h3>
            <p className="text-sm text-muted-foreground">
              Hành động của bạn hôm nay có thể đã cứu một mạng người.
            </p>
            <div className="flex items-center gap-2 mt-2 bg-primary-soft text-primary rounded-2xl px-3 py-2">
              <BadgeCheck className="w-4 h-4" />
              <span className="text-sm font-bold">+1 Huy hiệu "Thiên thần hộ mệnh"</span>
            </div>
            <div className="flex items-center gap-1 text-warning text-sm font-bold">
              <Star className="w-4 h-4 fill-warning" /> +50 Trust Score
            </div>
            <Button className="w-full mt-2 rounded-2xl" onClick={() => { setResolved(false); onClose(); }}>
              Hoàn tất
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
