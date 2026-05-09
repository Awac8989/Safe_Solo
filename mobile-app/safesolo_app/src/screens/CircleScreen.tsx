import { useState } from "react";
import { useApp } from "@/state/AppState";
import { Heart, Reply, Sparkles, ShieldCheck, Award, Users2 } from "lucide-react";
import VoiceNoteBubble from "@/components/VoiceNoteBubble";
import { toast } from "sonner";

type Tab = "family" | "community";

interface Post {
  id: string;
  author: string;
  initials: string;
  time: string;
  badge?: "checkin" | "hero" | "rescue";
  emoji?: string;
  emojiText?: string;
  text?: string;
  voice?: number; // duration s
  hugs: number;
  replies: number;
}

const FAMILY: Post[] = [
  {
    id: "1", author: "Bố Tài", initials: "T", time: "2 giờ trước",
    badge: "checkin", emoji: "😊", emojiText: "Cảm thấy khỏe mạnh",
    text: "Sáng nay bố đã đi bộ 30 phút quanh hồ. Trời mát lắm các con!",
    hugs: 4, replies: 2,
  },
  {
    id: "2", author: "Mẹ Lan", initials: "L", time: "5 giờ trước",
    badge: "checkin", emoji: "😐", emojiText: "Hơi mệt nhưng ổn",
    voice: 15, hugs: 7, replies: 3,
  },
  {
    id: "3", author: "Cô Ba", initials: "B", time: "Hôm qua",
    badge: "checkin", emoji: "😊", emojiText: "Bình an",
    text: "Đã uống thuốc đầy đủ ✨", hugs: 9, replies: 1,
  },
];

const COMMUNITY: Post[] = [
  {
    id: "c1", author: "Hiệp sĩ Minh Anh", initials: "M", time: "30 phút trước",
    badge: "rescue",
    text: "Vừa hỗ trợ một cô bị ngã ở P. Hiệp Bình Chánh. Cô đã được đưa vào BV an toàn 🙏",
    hugs: 128, replies: 24,
  },
  {
    id: "c2", author: "Cộng đồng Bình Dương", initials: "C", time: "2 giờ trước",
    badge: "hero",
    text: "Tuần này cộng đồng đã ứng cứu 47 ca SOS. Cảm ơn các tình nguyện viên!",
    hugs: 322, replies: 41,
  },
  {
    id: "c3", author: "Hiệp sĩ Tuấn Khang", initials: "K", time: "Hôm qua",
    badge: "rescue", voice: 22, hugs: 56, replies: 8,
  },
];

export default function CircleScreen() {
  const { user } = useApp();
  const [tab, setTab] = useState<Tab>("family");
  const data = tab === "family" ? FAMILY : COMMUNITY;

  return (
    <div className="flex-1 max-w-md mx-auto w-full pb-6">
      <header className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Alive Circle
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">Bảng tin bình an — chia sẻ sự an toàn mỗi ngày</p>
      </header>

      <div className="px-5">
        <div className="bg-muted rounded-full p-1 grid grid-cols-2 text-sm font-bold">
          {([
            { id: "family", label: "Gia đình", Icon: Users2 },
            { id: "community", label: "Cộng đồng", Icon: Award },
          ] as const).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`py-2 rounded-full flex items-center justify-center gap-1.5 transition-all ${
                tab === id ? "bg-card shadow-card text-primary" : "text-muted-foreground"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "family" && (
        <div className="px-5 mt-4">
          <button
            onClick={() => toast.success("Đã chia sẻ trạng thái với gia đình")}
            className="w-full bg-card rounded-2xl shadow-card p-4 flex items-center gap-3 text-left hover-scale"
          >
            <div className="w-10 h-10 rounded-full gradient-safe text-primary-foreground flex items-center justify-center font-extrabold">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Hôm nay bạn cảm thấy thế nào?</p>
              <p className="text-xs text-muted-foreground">Chia sẻ một trạng thái nhanh để gia đình yên tâm</p>
            </div>
            <div className="text-2xl">😊</div>
          </button>
        </div>
      )}

      <div className="px-5 mt-4 space-y-3">
        {data.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const [hugs, setHugs] = useState(post.hugs);
  const [hugged, setHugged] = useState(false);

  return (
    <article className="bg-card rounded-3xl shadow-card p-4 animate-fade-in-up">
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary-soft text-primary flex items-center justify-center font-extrabold">
          {post.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{post.author}</p>
          <p className="text-[11px] text-muted-foreground">{post.time}</p>
        </div>
        {post.badge === "checkin" && (
          <span className="text-[10px] font-bold bg-primary-soft text-primary px-2 py-1 rounded-full inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Đã check-in
          </span>
        )}
        {post.badge === "rescue" && (
          <span className="text-[10px] font-bold bg-warning/15 text-warning px-2 py-1 rounded-full">
            🦸 Cứu hộ
          </span>
        )}
        {post.badge === "hero" && (
          <span className="text-[10px] font-bold bg-accent text-accent-foreground px-2 py-1 rounded-full">
            ⭐ Cộng đồng
          </span>
        )}
      </header>

      <div className="mt-3 space-y-3">
        {post.emoji && (
          <div className="flex items-center gap-3">
            <span className="text-4xl leading-none">{post.emoji}</span>
            <p className="text-base font-bold">{post.emojiText}</p>
          </div>
        )}
        {post.text && <p className="text-sm leading-relaxed">{post.text}</p>}
        {post.voice && <VoiceNoteBubble duration={post.voice} />}
      </div>

      <footer className="mt-4 pt-3 border-t border-border flex items-center gap-2">
        <button
          onClick={() => { if (hugged) return; setHugged(true); setHugs((h) => h + 1); toast("🤗 Đã gửi cái ôm"); }}
          className={`flex-1 h-10 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
            hugged ? "bg-destructive/10 text-destructive" : "bg-muted hover:bg-primary-soft hover:text-primary"
          }`}
        >
          <Heart className={`w-4 h-4 ${hugged ? "fill-destructive" : ""}`} /> Gửi cái ôm · {hugs}
        </button>
        <button
          onClick={() => toast("Đã mở khung hỏi thăm")}
          className="flex-1 h-10 rounded-2xl bg-muted font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-soft hover:text-primary"
        >
          <Reply className="w-4 h-4" /> Hỏi thăm · {post.replies}
        </button>
      </footer>
    </article>
  );
}
