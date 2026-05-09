import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Send, MapPin, Image as ImageIcon, Battery, Users2, Siren } from "lucide-react";
import { Input } from "@/components/ui/input";
import VoiceNoteBubble from "@/components/VoiceNoteBubble";
import PushToTalkButton from "@/components/PushToTalkButton";
import { toast } from "sonner";

interface Conversation {
  id: string;
  name: string;
  initials: string;
  preview: string;
  time: string;
  unread?: number;
  battery?: number;
  group?: boolean;
  rescue?: boolean;
}

const CONVOS: Conversation[] = [
  { id: "fam", group: true, name: "Gia đình", initials: "GĐ", preview: "Mẹ: Bố vừa check-in rồi nhé", time: "14:32", unread: 2 },
  { id: "rescue", rescue: true, name: "Hỗ trợ — Hiệp sĩ Minh Anh", initials: "MA", preview: "Tôi đã đến nơi, mở cửa nhé", time: "14:20", unread: 1, battery: 64 },
  { id: "dad", name: "Bố Tài", initials: "T", preview: "Cảm ơn con", time: "Hôm qua", battery: 12 },
  { id: "mom", name: "Mẹ Lan", initials: "L", preview: "🤗", time: "Hôm qua", battery: 85 },
  { id: "sis", name: "Em Linh", initials: "Li", preview: "OK chị", time: "Thứ hai", battery: 47 },
];

interface Msg {
  id: string;
  from: "me" | "them" | "system";
  text?: string;
  voice?: number;
  time: string;
}

const SEED: Record<string, Msg[]> = {
  fam: [
    { id: "1", from: "system", text: "Bố Tài đã check-in an toàn 14:32", time: "" },
    { id: "2", from: "them", text: "Mọi người có khỏe không?", time: "14:30" },
    { id: "3", from: "me", text: "Con khỏe ạ, đang về nhà", time: "14:31" },
    { id: "4", from: "them", voice: 8, time: "14:32" },
  ],
  rescue: [
    { id: "1", from: "system", text: "🚨 Phiên hỗ trợ khẩn cấp — chat sẽ tự khoá sau 24h", time: "" },
    { id: "2", from: "them", text: "Tôi đang cách 500m, sắp đến nơi", time: "14:18" },
    { id: "3", from: "me", text: "Cảm ơn anh rất nhiều!", time: "14:19" },
  ],
  dad: [{ id: "1", from: "them", text: "Cảm ơn con", time: "Hôm qua" }],
  mom: [{ id: "1", from: "them", text: "🤗", time: "Hôm qua" }],
  sis: [{ id: "1", from: "them", text: "OK chị", time: "Thứ hai" }],
};

export default function MessengerScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const convo = CONVOS.find((c) => c.id === openId) ?? null;

  if (convo) return <ChatRoom convo={convo} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex-1 max-w-md mx-auto w-full pb-6">
      <header className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-extrabold">Tin nhắn</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Hộp thư gia đình & hỗ trợ</p>
      </header>

      <section className="px-5 mt-2">
        <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Nhóm gia đình</p>
        <ConvoRow c={CONVOS[0]} onOpen={setOpenId} />
      </section>

      <section className="px-5 mt-5">
        <p className="text-[11px] font-bold uppercase text-warning mb-2 flex items-center gap-1.5">
          <Siren className="w-3.5 h-3.5" /> Hỗ trợ khẩn cấp
        </p>
        <ConvoRow c={CONVOS[1]} onOpen={setOpenId} />
      </section>

      <section className="px-5 mt-5">
        <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Người thân</p>
        <div className="space-y-2">
          {CONVOS.slice(2).map((c) => <ConvoRow key={c.id} c={c} onOpen={setOpenId} />)}
        </div>
      </section>
    </div>
  );
}

function ConvoRow({ c, onOpen }: { c: Conversation; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(c.id)}
      className={`w-full text-left bg-card rounded-2xl shadow-card p-3 flex items-center gap-3 hover-scale ${
        c.rescue ? "ring-2 ring-warning bg-warning/5" : ""
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-extrabold ${
        c.group ? "gradient-safe text-primary-foreground" : c.rescue ? "bg-warning text-warning-foreground" : "bg-primary-soft text-primary"
      }`}>
        {c.group ? <Users2 className="w-5 h-5" /> : c.rescue ? <Siren className="w-5 h-5" /> : c.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-base truncate">{c.name}</p>
          <span className="text-[11px] text-muted-foreground shrink-0">{c.time}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm text-muted-foreground truncate">{c.preview}</p>
          {c.unread ? (
            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
              {c.unread}
            </span>
          ) : null}
        </div>
        {c.battery !== undefined && (
          <p className={`text-[11px] font-bold mt-1 inline-flex items-center gap-1 ${
            c.battery < 20 ? "text-destructive" : "text-muted-foreground"
          }`}>
            <Battery className="w-3 h-3" /> {c.battery}%
          </p>
        )}
      </div>
    </button>
  );
}

function ChatRoom({ convo, onBack }: { convo: Conversation; onBack: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(SEED[convo.id] ?? []);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 999999 });
  }, [msgs]);

  const time = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const sendText = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { id: String(Date.now()), from: "me", text: t.trim(), time: time() }]);
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <header className={`px-3 py-3 flex items-center gap-3 shadow-card ${
        convo.rescue ? "bg-warning text-warning-foreground" : "bg-card"
      }`}>
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold ${
          convo.rescue ? "bg-white/30" : "bg-primary-soft text-primary"
        }`}>
          {convo.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold truncate">{convo.name}</p>
          <p className="text-xs opacity-80 inline-flex items-center gap-1">
            {convo.battery !== undefined && <><Battery className="w-3 h-3" /> {convo.battery}%</>}
            {convo.rescue && <span className="ml-2">🚨 Phiên hỗ trợ — auto khóa 24h</span>}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/40">
        {msgs.map((m) => {
          if (m.from === "system")
            return (
              <p key={m.id} className="text-center text-xs text-muted-foreground bg-card rounded-full px-3 py-1 mx-auto w-fit shadow-card">
                {m.text}
              </p>
            );
          const mine = m.from === "me";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="flex flex-col items-end gap-0.5 max-w-[80%]">
                {m.voice ? (
                  <VoiceNoteBubble duration={m.voice} variant={mine ? "primary" : "light"} />
                ) : (
                  <div className={`rounded-3xl px-4 py-2.5 text-[17px] leading-snug ${
                    mine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card shadow-card rounded-bl-md"
                  }`}>
                    {m.text}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground px-2">{m.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-card p-3 flex items-center gap-2">
        <button
          onClick={() => toast("Tuỳ chọn: Gửi vị trí / Hình ảnh")}
          className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0"
          aria-label="Thêm"
        >
          <Plus className="w-5 h-5" />
        </button>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendText(draft); }}
          placeholder="Nhắn tin..."
          className="flex-1 h-11 rounded-full text-base"
        />
        {draft.trim() ? (
          <button
            onClick={() => sendText(draft)}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <PushToTalkButton
            onSend={(d) => setMsgs((m) => [...m, { id: String(Date.now()), from: "me", voice: d, time: time() }])}
          />
        )}
      </div>
      <div className="px-4 pb-3 bg-card flex gap-2 overflow-x-auto">
        {[
          { l: "📍 Vị trí", v: "Đã gửi vị trí hiện tại" },
          { l: "🖼 Ảnh", v: "Đã gửi 1 ảnh" },
          { l: "📞 Gọi nhanh", v: "Đang gọi..." },
        ].map((q) => (
          <button key={q.l} onClick={() => toast(q.v)}
            className="shrink-0 text-xs font-semibold bg-muted px-3 py-1.5 rounded-full">
            {q.l}
          </button>
        ))}
      </div>
    </div>
  );
}
