import { useState } from "react";
import { Award, MessageCircle, Star, Trophy, Heart, ShieldCheck, Zap, Map as MapIcon, ArrowLeft, Send, Pin, Siren, Flag, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { toast } from "sonner";

type View = "home" | "profile" | "inbox" | "chat";
type ChatId = "family" | "rescue";

const heroes = [
  { rank: 1, name: "Đoàn Minh Quân", area: "Thủ Dầu Một", saves: 12, score: 4.9, verified: true },
  { rank: 2, name: "Lê Hữu Phước", area: "Dĩ An", saves: 9, score: 4.8, verified: true },
  { rank: 3, name: "Nguyễn Bảo An", area: "Thuận An", saves: 7, score: 4.9, verified: true },
  { rank: 4, name: "Phan Thị Mai", area: "Bến Cát", saves: 5, score: 4.7, verified: false },
  { rank: 5, name: "Võ Quang Huy", area: "Tân Uyên", saves: 4, score: 4.6, verified: true },
];

const heatPoints: { pos: [number, number]; r: number }[] = [
  { pos: [10.9804, 106.6519], r: 14 },
  { pos: [10.9760, 106.6470], r: 10 },
  { pos: [10.9700, 106.6600], r: 12 },
  { pos: [10.9850, 106.6420], r: 8 },
  { pos: [10.9900, 106.6550], r: 16 },
];

export default function HeroesScreen() {
  const [view, setView] = useState<View>("home");
  const [chatId, setChatId] = useState<ChatId>("family");

  if (view === "profile") return <HeroProfile onBack={() => setView("home")} />;
  if (view === "inbox") return <Inbox onBack={() => setView("home")} onOpen={(id) => { setChatId(id); setView("chat"); }} />;
  if (view === "chat") return <ChatRoom id={chatId} onBack={() => setView("inbox")} />;

  return (
    <div className="flex-1 px-5 pt-6 pb-6 max-w-md mx-auto w-full">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-warning" /> Heroes
          </h1>
          <p className="text-sm text-muted-foreground">Tường vinh danh cộng đồng</p>
        </div>
        <Button size="icon" variant="outline" className="rounded-2xl h-11 w-11" onClick={() => setView("inbox")}>
          <MessageCircle className="w-5 h-5" />
        </Button>
      </header>

      {/* My quick card */}
      <button
        onClick={() => setView("profile")}
        className="w-full bg-card rounded-2xl p-4 shadow-card flex items-center gap-3 mb-4 text-left active:scale-[0.99] transition"
      >
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xl font-extrabold">Q</div>
          <ShieldCheck className="w-5 h-5 absolute -bottom-1 -right-1 text-blue-500 bg-card rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">Đoàn Minh Quân</p>
          <p className="text-xs text-primary font-semibold">Hiệp sĩ khu vực Thủ Dầu Một</p>
        </div>
        <div className="text-right">
          <p className="text-warning font-extrabold flex items-center gap-1"><Star className="w-4 h-4 fill-warning" />4.9</p>
          <p className="text-[11px] text-muted-foreground">Profile của bạn</p>
        </div>
      </button>

      <Tabs defaultValue="leaderboard">
        <TabsList className="grid grid-cols-2 w-full h-12 rounded-2xl bg-secondary p-1">
          <TabsTrigger value="leaderboard" className="rounded-xl gap-2 h-full">
            <Award className="w-4 h-4" /> Bảng vàng
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="rounded-xl gap-2 h-full">
            <MapIcon className="w-4 h-4" /> Hiệp sĩ quanh tôi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="space-y-2 mt-4">
          {heroes.map((h) => (
            <div key={h.rank} className="bg-card rounded-2xl p-3 shadow-card flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold ${
                h.rank === 1 ? "bg-warning/20 text-warning" : h.rank === 2 ? "bg-muted-foreground/15 text-muted-foreground" : "bg-secondary text-secondary-foreground"
              }`}>{h.rank}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate flex items-center gap-1.5">
                  {h.name}
                  {h.verified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                </p>
                <p className="text-xs text-muted-foreground">{h.area} · {h.saves} lần cứu</p>
              </div>
              <div className="text-right">
                <p className="text-warning text-sm font-bold flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-warning" />{h.score}</p>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="heatmap" className="mt-4">
          <div className="bg-card rounded-2xl shadow-card overflow-hidden">
            <div className="h-64 relative">
              <MapContainer center={[10.9804, 106.6519]} zoom={13} scrollWheelZoom={false} className="absolute inset-0 z-0">
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" attribution="&copy; CARTO" />
                {heatPoints.map((p, i) => (
                  <CircleMarker key={i} center={p.pos} radius={p.r}
                    pathOptions={{ color: "transparent", fillColor: "#16a34a", fillOpacity: 0.35 }} />
                ))}
              </MapContainer>
            </div>
            <div className="p-4">
              <p className="font-bold">37 Hiệp sĩ đang online</p>
              <p className="text-sm text-muted-foreground">trong bán kính 3km quanh bạn</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Xung quanh bạn có rất nhiều người tốt đang dùng "Alive?". Bạn không cô đơn.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------- Hero Profile --------- */
function HeroProfile({ onBack }: { onBack: () => void }) {
  const badges = [
    { id: "wings", label: "Đôi cánh", desc: "Cứu 10 người", icon: <Trophy className="w-7 h-7" />, on: true, color: "text-warning bg-warning/15" },
    { id: "bolt", label: "Tia chớp", desc: "Đến < 5 phút", icon: <Zap className="w-7 h-7" />, on: true, color: "text-blue-500 bg-blue-500/15" },
    { id: "shield", label: "Khiên xác thực", desc: "KYC CCCD", icon: <ShieldCheck className="w-7 h-7" />, on: true, color: "text-primary bg-primary-soft" },
    { id: "heart", label: "Trái tim", desc: "100% phản hồi", icon: <Heart className="w-7 h-7" />, on: false, color: "text-muted-foreground bg-muted" },
  ];
  const thanks = [
    { from: "Ẩn danh (Con trai nạn nhân)", text: "Cảm ơn anh Quân đã phá cửa vào sơ cứu cho mẹ tôi kịp thời. Gia đình mang ơn anh!", likes: 124 },
    { from: "Ẩn danh (Cháu nội)", text: "Anh đến cực nhanh, gọi xe cấp cứu giúp ông tôi. Nhà tôi luôn biết ơn anh.", likes: 87 },
    { from: "Ẩn danh (Vợ nạn nhân)", text: "Anh ở lại đến khi xe 115 tới mới về. Cảm ơn anh nhiều!", likes: 56 },
  ];

  return (
    <div className="flex-1 max-w-md mx-auto w-full">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-extrabold text-lg">Hồ sơ Hiệp sĩ</h1>
      </div>

      {/* Header */}
      <div className="px-5 flex flex-col items-center text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full gradient-safe text-primary-foreground flex items-center justify-center text-4xl font-extrabold shadow-safe">Q</div>
          <ShieldCheck className="w-7 h-7 absolute bottom-0 right-0 text-blue-500 bg-card rounded-full" />
        </div>
        <h2 className="text-xl font-extrabold mt-3">Đoàn Minh Quân</h2>
        <p className="text-primary font-semibold text-sm">Hiệp sĩ khu vực Thủ Dầu Một</p>
      </div>

      {/* Trust stats */}
      <div className="mx-5 mt-5 bg-card rounded-3xl shadow-card p-4 grid grid-cols-3 divide-x divide-border">
        <Stat big="12" small="Mạng đã cứu" />
        <Stat big="100%" small="Phản hồi SOS" />
        <Stat big="★ 4.9" small="Đánh giá" warn />
      </div>

      {/* Badges */}
      <div className="mx-5 mt-5">
        <h3 className="font-extrabold mb-2">Tủ huy hiệu</h3>
        <div className="grid grid-cols-4 gap-2">
          {badges.map((b) => (
            <div key={b.id} className={`rounded-2xl p-3 flex flex-col items-center text-center ${b.on ? b.color : "bg-muted text-muted-foreground grayscale"}`}>
              {b.icon}
              <p className="text-[11px] font-bold mt-1 leading-tight">{b.label}</p>
              <p className="text-[10px] opacity-80">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wall of Thanks */}
      <div className="mx-5 mt-5 mb-6">
        <h3 className="font-extrabold mb-2">Bức tường tri ân</h3>
        <div className="space-y-2">
          {thanks.map((t, i) => (
            <div key={i} className="bg-card rounded-2xl p-3 shadow-card">
              <p className="text-xs text-muted-foreground font-semibold">{t.from}</p>
              <p className="text-sm mt-1">"{t.text}"</p>
              <button className="mt-2 inline-flex items-center gap-1 text-destructive text-xs font-bold">
                <Heart className="w-3.5 h-3.5 fill-destructive" /> {t.likes}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ big, small, warn }: { big: string; small: string; warn?: boolean }) {
  return (
    <div className="text-center px-2">
      <p className={`text-xl font-extrabold ${warn ? "text-warning" : "text-foreground"}`}>{big}</p>
      <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{small}</p>
    </div>
  );
}

/* --------- Inbox --------- */
function Inbox({ onBack, onOpen }: { onBack: () => void; onOpen: (id: ChatId) => void }) {
  const items = [
    {
      id: "rescue" as ChatId,
      pinned: true,
      title: "Hiệp sĩ Đoàn Minh Quân",
      sub: "Tôi đã đến trước cửa, đang bấm chuông",
      time: "vừa xong",
      verified: true,
    },
    {
      id: "family" as ChatId,
      pinned: false,
      title: "Gia đình ❤️",
      sub: "Mẹ: Bố vừa đi tập dưỡng sinh về rồi",
      time: "08:42",
      verified: false,
    },
  ];
  return (
    <div className="flex-1 max-w-md mx-auto w-full">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-extrabold text-lg flex-1">Alive Messenger</h1>
        <Button size="icon" variant="outline" className="rounded-xl"><Plus className="w-4 h-4" /></Button>
      </div>
      <div className="px-3 space-y-2">
        {items.map((it) => (
          <button key={it.id} onClick={() => onOpen(it.id)}
            className={`w-full text-left rounded-2xl p-3 shadow-card flex items-center gap-3 ${
              it.pinned ? "bg-warning/10 border border-warning/40" : "bg-card"
            }`}>
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center font-extrabold">
                {it.title[0]}
              </div>
              {it.pinned && (
                <Siren className="w-4 h-4 absolute -top-1 -right-1 text-warning animate-blink" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold truncate">{it.title}</p>
                {it.verified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                {it.pinned && <Pin className="w-3 h-3 text-warning" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{it.sub}</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{it.time}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-6 px-8">
        🔒 Chat với tình nguyện viên sẽ tự khóa sau 24 giờ kể từ khi ca cứu hộ kết thúc, để bảo vệ địa chỉ nhà bạn.
      </p>
    </div>
  );
}

/* --------- Chat Room --------- */
function ChatRoom({ id, onBack }: { id: ChatId; onBack: () => void }) {
  const isRescue = id === "rescue";
  const [msgs, setMsgs] = useState<{ from: string; text: string; sys?: boolean; me?: boolean }[]>(
    isRescue
      ? [
          { from: "system", sys: true, text: "Hệ thống: Khung chat mở khi tình nguyện viên nhận lời cứu (14:32)." },
          { from: "Quân (TNV)", text: "Tôi đang cách 800m, sẽ tới trong 3 phút." },
          { from: "Bạn", me: true, text: "Cảm ơn anh, cửa cổng không khóa đâu anh cứ đẩy vào." },
          { from: "system", sys: true, text: "Hệ thống: Tình nguyện viên Quân đã đến khu vực bán kính 50m." },
          { from: "Quân (TNV)", text: "Tôi đã đến trước cửa, đang bấm chuông." },
        ]
      : [
          { from: "Mẹ", text: "Bố vừa đi tập dưỡng sinh về rồi con nhé." },
          { from: "Bạn", me: true, text: "Dạ con rõ, con cảm ơn mẹ ❤️" },
        ]
  );
  const [draft, setDraft] = useState("");
  const send = () => {
    if (!draft.trim()) return;
    setMsgs((m) => [...m, { from: "Bạn", me: true, text: draft.trim() }]);
    setDraft("");
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-[#F9FAFB]">
      <div className="px-3 py-3 flex items-center gap-2 bg-card border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-extrabold">
          {isRescue ? "Q" : "M"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate flex items-center gap-1.5">
            {isRescue ? "Hiệp sĩ Đoàn Minh Quân" : "Mẹ"}
            {isRescue && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
          </p>
          <p className="text-[11px] text-primary font-semibold">{isRescue ? "Đang trong ca cứu hộ" : "Online"}</p>
        </div>
        {isRescue && (
          <Button size="icon" variant="ghost" className="text-primary"><Phone className="w-5 h-5" /></Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => toast("Đã báo cáo / chặn người dùng")}>
          <Flag className="w-5 h-5 text-destructive" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ fontSize: "1.1rem" }}>
        {msgs.map((m, i) =>
          m.sys ? (
            <p key={i} className="text-center text-xs text-muted-foreground bg-card border border-border rounded-full px-3 py-1 mx-auto w-fit">
              {m.text}
            </p>
          ) : (
            <div key={i} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                m.me ? "bg-primary text-primary-foreground" : "bg-card shadow-card"
              }`}>
                {!m.me && <p className="text-[11px] font-bold opacity-70 mb-0.5">{m.from}</p>}
                <p>{m.text}</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="border-t border-border bg-card p-2 space-y-2">
        <div className="flex gap-2 overflow-x-auto px-1">
          <QuickAction icon={<MapIcon className="w-4 h-4" />} label="Gửi vị trí" />
          <QuickAction icon={<Heart className="w-4 h-4" />} label="Yêu cầu Check-in" />
          <QuickAction icon={<Phone className="w-4 h-4" />} label="Gọi nhanh" />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tin nhắn..." className="rounded-2xl h-12 text-base" />
          <Button type="submit" size="icon" className="rounded-2xl h-12 w-12"><Send className="w-5 h-5" /></Button>
        </form>
      </div>
    </div>
  );
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button onClick={() => toast(label)}
      className="shrink-0 inline-flex items-center gap-1.5 bg-primary-soft text-primary text-xs font-bold px-3 py-2 rounded-full">
      {icon} {label}
    </button>
  );
}
