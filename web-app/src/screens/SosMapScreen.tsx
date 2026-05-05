import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { X, Navigation, Phone, AlertTriangle, MapPin, MessageCircle, Battery, Send, Megaphone, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import PushToTalkButton from "@/components/PushToTalkButton";
import VoiceNoteBubble from "@/components/VoiceNoteBubble";
import { toast } from "sonner";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  victimName: string;
  onClose: () => void;
}

const victim: [number, number] = [10.9804, 106.6519];
const guardian: [number, number] = [10.9521, 106.6418];

interface Msg { from: string; text: string; system?: boolean }

export default function SosMapScreen({ victimName, onClose, onBroadcast }: Props & { onBroadcast?: (reason: string, note: string) => void }) {
  const [tab, setTab] = useState<"map" | "chat">("map");
  const [castOpen, setCastOpen] = useState(false);
  const [reason, setReason] = useState("Cấp cứu y tế");
  const [note, setNote] = useState("Cửa nhà không khóa, xin hãy vào giúp bố tôi!");
  const [memo, setMemo] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "system", system: true, text: "🔴 SOS được kích hoạt lúc 14:32" },
    { from: "system", system: true, text: "🔋 Pin của thiết bị nạn nhân chỉ còn 8%" },
    { from: "Anh Trai (G1)", text: "Tôi đang trên đường tới đó, ETA 8 phút." },
    { from: "Mẹ (G2)", text: "Tôi đã gọi 115." },
  ]);
  const [draft, setDraft] = useState("");

  const distance = (L.latLng(victim).distanceTo(L.latLng(guardian)) / 1000).toFixed(2);

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { from: "Bạn", text: t.trim() }]);
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="gradient-danger text-primary-foreground px-4 py-3 flex items-center gap-3 shadow-danger">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-blink">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold opacity-90">SOS · Cần giải cứu</p>
          <p className="font-extrabold truncate">{victimName}</p>
        </div>
        <div className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-1">
          <Battery className="w-3.5 h-3.5" /> 8%
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center" aria-label="Đóng">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border flex">
        {(["map", "chat"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${
              tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t === "map" ? <><MapPin className="w-4 h-4" /> Bản đồ</> : <><MessageCircle className="w-4 h-4" /> Chat khẩn cấp</>}
          </button>
        ))}
      </div>

      {tab === "map" ? (
        <>
          <div className="flex-1 relative">
            <MapContainer
              center={[(victim[0] + guardian[0]) / 2, (victim[1] + guardian[1]) / 2]}
              zoom={13}
              scrollWheelZoom
              className="absolute inset-0 z-0"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline positions={[guardian, victim]} pathOptions={{ color: "#1f9d6b", weight: 5, opacity: 0.7, dashArray: "8 8" }} />
              <CircleMarker center={guardian} radius={10}
                pathOptions={{ color: "#1f9d6b", fillColor: "#1f9d6b", fillOpacity: 0.9 }}>
                <Popup>Vị trí của bạn</Popup>
              </CircleMarker>
              <CircleMarker center={victim} radius={20}
                pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.3, weight: 3 }}
                className="animate-blink" />
              <Marker position={victim}>
                <Popup><strong>{victimName}</strong><br />Phường Thủ Dầu Một, Bình Dương</Popup>
              </Marker>
            </MapContainer>
          </div>

          <div className="bg-card border-t border-border p-5 max-w-md mx-auto w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold leading-tight">Phường Thủ Dầu Một, Bình Dương</p>
                <p className="text-sm text-muted-foreground mt-0.5">Cách bạn {distance} km · ước tính 8 phút</p>
              </div>
            </div>

            {/* Emergency Voice Memo */}
            <div className="rounded-2xl p-4 border-2 border-destructive/40 bg-destructive/5 flex items-center gap-3">
              <PushToTalkButton
                size="lg"
                onSend={(d) => { setMemo(d); toast.success("Đã gửi ghi âm khẩn cấp tới gia đình & cộng đồng"); }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-sm flex items-center gap-1">
                  <Mic className="w-4 h-4 text-destructive" /> Ghi âm khẩn cấp
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nhấn giữ để mô tả nhanh tình trạng — sẽ gửi cùng tọa độ GPS
                </p>
                {memo && (
                  <div className="mt-2"><VoiceNoteBubble duration={memo} /></div>
                )}
              </div>
            </div>

            {/* Broadcast to community — Highlighted box (cam sẫm) */}
            <div className="rounded-2xl p-4 border-2 border-warning bg-warning/10">
              <div className="flex items-start gap-2">
                <Megaphone className="w-5 h-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="font-extrabold text-sm">Bạn đang ở quá xa?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Kêu gọi cộng đồng "Alive?" trong bán kính 3km tới hỗ trợ ngay.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setCastOpen(true)}
                className="mt-3 w-full h-12 rounded-2xl gradient-warn border-0 text-warning-foreground font-extrabold gap-2"
              >
                📢 KÊU GỌI CỘNG ĐỒNG BÁN KÍNH 3KM
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 rounded-2xl gap-2"><Phone className="w-4 h-4" /> Gọi 115</Button>
              <Button className="h-12 rounded-2xl gap-2 gradient-safe text-primary-foreground border-0">
                <Navigation className="w-4 h-4" /> Chỉ đường
              </Button>
            </div>
          </div>

          {/* Quick form broadcast */}
          <Dialog open={castOpen} onOpenChange={setCastOpen}>
            <DialogContent className="rounded-3xl max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-warning" /> Kêu gọi cộng đồng
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Chọn nhanh tình trạng để cộng đồng biết cách giúp:</p>
                <div className="flex flex-wrap gap-2">
                  {["Cấp cứu y tế", "Có thể bị ngã", "Nghi ngờ đột nhập"].map((r) => (
                    <button key={r} onClick={() => setReason(r)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                        reason === r ? "bg-warning text-warning-foreground border-warning" : "bg-card border-border text-foreground"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm cho người tới giúp..."
                  className="rounded-2xl min-h-[80px]" />
                <Button
                  className="w-full h-12 rounded-2xl gradient-warn border-0 text-warning-foreground font-extrabold"
                  onClick={() => {
                    setCastOpen(false);
                    toast.success("Đã gửi cảnh báo tới 37 người dùng quanh khu vực");
                    onBroadcast?.(reason, note);
                  }}
                >
                  Phát cảnh báo ngay
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Chỉ tình nguyện viên đã xác thực CCCD mới thấy địa chỉ chính xác sau khi nhận lời.
                </p>
              </div>
            </DialogContent>
          </Dialog>

        </>
      ) : (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) =>
              m.system ? (
                <p key={i} className="text-center text-xs text-muted-foreground bg-muted rounded-full px-3 py-1 mx-auto w-fit">
                  {m.text}
                </p>
              ) : (
                <div key={i} className={`flex ${m.from === "Bạn" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    m.from === "Bạn" ? "bg-primary text-primary-foreground" : "bg-card shadow-card"
                  }`}>
                    {m.from !== "Bạn" && <p className="text-[10px] font-bold opacity-70 mb-0.5">{m.from}</p>}
                    <p className="text-sm">{m.text}</p>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="border-t border-border p-3 space-y-2 bg-card">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["Tôi đang đến", "Đã gọi cấp cứu", "Có ai liên lạc được không?"].map((q) => (
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
          </div>
        </div>
      )}
    </div>
  );
}
