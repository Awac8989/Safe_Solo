import { useState } from "react";
import { ShieldCheck, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  onSignIn: (email: string) => void;
}

const emailSchema = z.string().trim().email("Email không hợp lệ").max(255);

export default function AuthScreen({ onSignIn }: Props) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setStep("otp");
    toast.success("Đã gửi mã 6 số đến email", {
      description: "Demo: nhập 123456 để đăng nhập",
    });
  };

  const verify = () => {
    if (otp.length !== 6) {
      toast.error("Vui lòng nhập đủ 6 số");
      return;
    }
    if (otp !== "123456") {
      toast.error("Mã không đúng. Demo dùng 123456");
      return;
    }
    onSignIn(email);
  };

  return (
    <div className="min-h-screen flex flex-col gradient-bg">
      <div className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2 mb-3 text-primary">
          <ShieldCheck className="w-7 h-7" />
          <span className="text-xl font-extrabold">SafeSolo</span>
        </div>
        <h1 className="text-3xl font-extrabold mb-2">
          {step === "email" ? "Chào mừng bạn" : "Nhập mã xác thực"}
        </h1>
        <p className="text-muted-foreground mb-8 text-base">
          {step === "email"
            ? "Đăng nhập không mật khẩu. Chúng tôi sẽ gửi mã 6 số đến email của bạn."
            : `Mã đã gửi đến ${email}`}
        </p>

        {step === "email" ? (
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ban@vidu.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 pl-12 text-base rounded-2xl bg-card"
              />
            </div>
            <Button
              size="lg"
              disabled={loading}
              className="w-full h-14 text-base font-semibold rounded-2xl"
              onClick={sendCode}
            >
              {loading ? "Đang gửi..." : "Gửi mã"}
              <ArrowRight className="ml-1 w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <InputOTPSlot
                      key={n}
                      index={n}
                      className="w-12 h-14 text-xl font-bold"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold rounded-2xl"
              onClick={verify}
            >
              Xác nhận
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setOtp("");
                setStep("email");
              }}
            >
              Đổi email
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-center text-muted-foreground p-6">
        Bằng việc tiếp tục bạn đồng ý với Điều khoản & Quyền riêng tư của SafeSolo.
      </p>
    </div>
  );
}
