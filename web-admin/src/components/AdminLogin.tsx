import React, { useState } from "react";
import {
  ShieldAlert,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Radio,
  Users,
  ShieldCheck,
  ArrowRight,
  Shield,
} from "lucide-react";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "dispatcher" | "moderator";
  roleTitle: string;
  badgeNumber: string;
  avatar?: string;
  shiftStartTime: string;
}

const DEMO_PRESETS: {
  user: AdminUser;
  pass: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    user: {
      id: "admin_01",
      name: "Đoàn Minh Quân (Chỉ Huy Trưởng)",
      email: "admin@safesolo.vn",
      role: "superadmin",
      roleTitle: "Tổng Chỉ Huy Hệ Thống (Super Admin)",
      badgeNumber: "TOC-ADMIN-01",
      shiftStartTime: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    },
    pass: "admin123",
    description: "Toàn quyền quản trị hạ tầng, doanh thu B2B, hệ thống & bản đồ",
    icon: ShieldAlert,
    color: "from-red-500/20 to-orange-500/10 border-red-500/30 text-red-400",
  },
  {
    user: {
      id: "dispatch_02",
      name: "Nguyễn Văn Hùng (Trưởng Ca 115)",
      email: "dispatch@safesolo.vn",
      role: "dispatcher",
      roleTitle: "Trưởng Ca Điều Phối 115 / SOS",
      badgeNumber: "DISPATCH-115-09",
      shiftStartTime: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    },
    pass: "dispatch123",
    description: "Tiếp nhận ca SOS, điều phối Hiệp Sĩ, radar sinh tồn đa nạn nhân",
    icon: Radio,
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400",
  },
  {
    user: {
      id: "mod_03",
      name: "Lê Thị Mai (Chuyên Viên Pháp Lý & KYC)",
      email: "moderator@safesolo.vn",
      role: "moderator",
      roleTitle: "Kiểm Duyệt Viên KYC & Pháp Lý",
      badgeNumber: "MOD-KYC-22",
      shiftStartTime: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    },
    pass: "mod123",
    description: "Thẩm định hồ sơ CCCD Hiệp Sĩ tình nguyện & Thẻ y tế khẩn cấp",
    icon: ShieldCheck,
    color: "from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400",
  },
];

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const applyPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setEmail(preset.user.email);
    setPassword(preset.pass);
    setSelectedPresetId(preset.user.id);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Tìm xem có khớp với preset nào không hoặc cho phép tài khoản hợp lệ
      const matched = DEMO_PRESETS.find(
        (p) => p.user.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (matched) {
        if (password === matched.pass) {
          onLoginSuccess(matched.user);
          setIsLoading(false);
          return;
        } else {
          setError("Mật khẩu ca trực không chính xác. Vui lòng thử lại!");
          setIsLoading(false);
          return;
        }
      }

      // Nếu nhập tài khoản hợp lệ định dạng email
      if (email.includes("@") && password.length >= 6) {
        const customUser: AdminUser = {
          id: `custom_${Date.now()}`,
          name: email.split("@")[0].toUpperCase(),
          email: email.trim(),
          role: "dispatcher",
          roleTitle: "Điều Phối Viên Hiện Trường",
          badgeNumber: `TOC-${Math.floor(1000 + Math.random() * 9000)}`,
          shiftStartTime: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        };
        onLoginSuccess(customUser);
        setIsLoading(false);
      } else {
        setError("Email hoặc mật khẩu không hợp lệ (Mật khẩu tối thiểu 6 ký tự).");
        setIsLoading(false);
      }
    }, 450);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Background Cyber Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b18_1px,transparent_1px),linear-gradient(to_bottom,#1e293b18_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-red-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[250px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl mx-4 my-8 grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
        
        {/* Left Column: Branding & Role Presets */}
        <div className="lg:col-span-5 p-8 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/90">
          <div>
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold tracking-wider uppercase mb-5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              CỔNG ĐIỀU HÀNH KHẨN CẤP TOC
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-900/40 border border-red-400/30">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  SafeSolo <span className="text-red-500">TOC</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Tactical Operations Center & Admin Portal
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Hệ thống giám sát sinh tồn, bản đồ hiểm họa thời gian thực và điều phối lực lượng cứu hộ hiệp sĩ toàn quốc.
            </p>

            {/* Quick Shift Selection Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                  Chọn tài khoản ca trực nhanh:
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Demo Ready</span>
              </div>

              <div className="space-y-2.5">
                {DEMO_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedPresetId === preset.user.id;
                  return (
                    <button
                      key={preset.user.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 bg-gradient-to-r flex items-start gap-3 ${
                        preset.color
                      } ${
                        isSelected
                          ? "ring-2 ring-white/30 scale-[1.01] shadow-lg shadow-black/40"
                          : "hover:border-slate-700 hover:bg-slate-800/40 opacity-85 hover:opacity-100"
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-white/10 shrink-0 mt-0.5">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-white truncate">
                            {preset.user.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-300 border border-white/5">
                            {preset.user.badgeNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5 font-medium truncate">
                          {preset.user.roleTitle}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                          {preset.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Security Assurance footer */}
          <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Mã hóa TLS 1.3 · AES-256 E2E
            </div>
            <span>v1.0.0 (Build 2026)</span>
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-center bg-slate-900/40">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Đăng nhập phiên trực chỉ huy
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Nhập thông tin nhân sự điều phối hoặc chọn một vị trí ca trực bên trái để truy cập nhanh.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 animate-shake">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email ca trực / Định danh nhân sự
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ví dụ: admin@safesolo.vn"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Mật khẩu bảo mật ca trực
                  </label>
                  <span className="text-[10px] text-slate-500">Mặc định: admin123</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-400">Duy trì phiên trực trong ca làm việc</span>
                </label>
                <button
                  type="button"
                  onClick={() => alert("Vui lòng liên hệ Quản trị viên Kỹ thuật TOC để cấp lại mã truy cập nội bộ.")}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Quên mã truy cập?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 border border-red-400/30 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Đang xác thực phiên trực...
                  </>
                ) : (
                  <>
                    Bắt đầu ca trực điều phối
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Note box */}
            <div className="mt-6 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300">Lưu ý nghiệp vụ:</span> Mọi hành động điều phối, kích hoạt cảnh báo sơ tán hay duyệt hồ sơ Hiệp Sĩ đều được lưu vết trong Nhật Ký Hệ Thống (Audit Trail) phục vụ công tác thanh tra.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
