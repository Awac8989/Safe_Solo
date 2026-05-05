import { useState } from "react";
import { Heart, Clock, BookOpen, ChevronRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Slide {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: string;
}

const slides: Slide[] = [
  {
    icon: <Heart className="w-16 h-16" />,
    title: "I'm Alive · Tôi vẫn ổn",
    desc: "Mỗi ngày bạn chỉ cần chạm một nút để báo cho người thân biết bạn vẫn an toàn.",
    accent: "gradient-safe",
  },
  {
    icon: <Clock className="w-16 h-16" />,
    title: "Time's Up · Quá hạn",
    desc: "Nếu bạn không phản hồi trong thời gian ân hạn, người bảo hộ sẽ nhận được tín hiệu và vị trí.",
    accent: "gradient-warn",
  },
  {
    icon: <BookOpen className="w-16 h-16" />,
    title: "User Manual · Két sắt sinh tử",
    desc: "Mật khẩu, di chúc, chỉ dẫn — chỉ được mở khoá khi sự cố thực sự xảy ra.",
    accent: "gradient-danger",
  },
];

interface Props {
  onDone: () => void;
}

export default function Onboarding({ onDone }: Props) {
  const [i, setI] = useState(0);
  const last = i === slides.length - 1;
  const s = slides[i];

  return (
    <div className="min-h-screen flex flex-col gradient-bg">
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2 mb-12 text-primary">
          <ShieldCheck className="w-7 h-7" />
          <span className="text-xl font-extrabold tracking-tight">SafeSolo</span>
        </div>

        <div
          key={i}
          className={`${s.accent} text-primary-foreground w-44 h-44 rounded-[2rem] flex items-center justify-center shadow-card mb-10 animate-fade-in-up`}
        >
          {s.icon}
        </div>

        <h1 className="text-3xl font-extrabold text-center mb-3 animate-fade-in-up">
          {s.title}
        </h1>
        <p className="text-center text-muted-foreground text-lg leading-relaxed animate-fade-in-up">
          {s.desc}
        </p>

        <div className="flex gap-2 mt-10">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-8 bg-primary" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto w-full space-y-3">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-2xl"
          onClick={() => (last ? onDone() : setI(i + 1))}
        >
          {last ? "Bắt đầu" : "Tiếp tục"}
          <ChevronRight className="ml-1 w-5 h-5" />
        </Button>
        {!last && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onDone}
          >
            Bỏ qua
          </Button>
        )}
      </div>
    </div>
  );
}
