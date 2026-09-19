import { useState, useEffect } from "react";
import { Phone, PhoneCall, PhoneOff, Mic, Send, Check, HeartHandshake, AlertCircle, Stethoscope, Radio } from "lucide-react";

interface DispatchCommsConsoleProps {
  victimName: string;
  victimPhone: string;
  guardianName?: string;
  guardianPhone?: string;
  heroName?: string;
  heroPhone?: string;
}

export function DispatchCommsConsole({
  victimName,
  victimPhone,
  guardianName = "Người thân",
  guardianPhone = "0909001007",
  heroName = "Hiệp sĩ phản ứng nhanh",
  heroPhone = "0913843958",
}: DispatchCommsConsoleProps) {
  const [activeCallTarget, setActiveCallTarget] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState<"CPR" | "FAST" | "RECOVERY">("FAST");
  const [sentMessageNotice, setSentMessageNotice] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (activeCallTarget) {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCallTarget]);

  const handleStartCall = (target: string) => {
    setActiveCallTarget(target);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setActiveCallTarget(null);
  };

  const handleSendProtocol = (protocolName: string) => {
    setSentMessageNotice(`Đã gửi hướng dẫn [${protocolName}] qua Zalo ZNS & SMS tới Người thân & Hiệp sĩ!`);
    setTimeout(() => setSentMessageNotice(null), 4000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const [isPttMode, setIsPttMode] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [pttChannel, setPttChannel] = useState<"VICTIM" | "HEROES">("HEROES");
  const [transcripts, setTranscripts] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: "Trực ban (SUP-0137)", text: "SafeSolo TOC gọi Hiệp sĩ Lê Hữu Phước và Phan Thị Mai, có nạn nhân AFib nhịp tim 124 cách vị trí 320m.", time: "14:24:10" },
    { sender: "Hiệp sĩ Lê Hữu Phước", text: "Rõ! Tôi đang di chuyển qua đường Nguyễn Tri Phương, ETA 1 phút 30 giây.", time: "14:24:25" },
  ]);

  const handlePttStart = () => {
    setIsTransmitting(true);
  };

  const handlePttEnd = () => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    const now = new Date().toLocaleTimeString("vi-VN");
    const msg = pttChannel === "HEROES"
      ? "Lệnh điều phối: Xe 115 Chợ Rẫy đã xuất phát, các hiệp sĩ tiếp cận mở đường ưu tiên."
      : "Trực ban đang nói: Bạn hãy giữ bình tĩnh, nằm yên tại chỗ, đội cứu hộ SafeSolo đang đến gần bạn 200m.";
    setTranscripts((prev) => [...prev, { sender: "Trực ban (Phát thanh PTT)", text: msg, time: now }]);
  };

  return (
    <div className="rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-md backdrop-blur space-y-3">
      {/* 1. Header with Mode Toggle */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <PhoneCall className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tổng Đài Đàm Thoại & Bộ Đàm Web PTT
            </span>
            <p className="text-[10px] text-muted-foreground">Phát thanh hiện trường 2 chiều & Cẩm nang sơ cấp cứu ban đầu</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPttMode(false)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              !isPttMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            CUỘC GỌI
          </button>
          <button
            onClick={() => setIsPttMode(true)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              isPttMode ? "bg-amber-600 text-white animate-pulse" : "text-amber-400 bg-amber-950/20 hover:bg-amber-950/40"
            }`}
          >
            <Radio className="h-3 w-3" /> BỘ ĐÀM PTT
          </button>
        </div>
      </div>

      {/* 2. PTT Mode vs Call Mode */}
      {isPttMode ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isTransmitting ? "bg-rose-500 animate-ping" : "bg-emerald-500"}`} />
              <span className="text-xs font-bold text-amber-400">
                {isTransmitting ? "🔴 ĐANG PHÁT THANH TRỰC TIẾP (ON AIR)" : "KÊNH BỘ ĐÀM SẴN SÀNG"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setPttChannel("HEROES")}
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  pttChannel === "HEROES" ? "bg-emerald-600 text-white" : "text-muted-foreground bg-background"
                }`}
              >
                Kênh Hiệp Sĩ (3 người)
              </button>
              <button
                onClick={() => setPttChannel("VICTIM")}
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  pttChannel === "VICTIM" ? "bg-sky-600 text-white" : "text-muted-foreground bg-background"
                }`}
              >
                Loa Ngoài Nạn Nhân
              </button>
            </div>
          </div>

          {/* Waveform Visualizer & Push-To-Talk Trigger */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/60 bg-[#070b14] space-y-2">
            <div className="flex items-center gap-1 h-6">
              {[12, 24, 18, 28, 14, 30, 22, 16, 26, 12, 20, 32, 15, 25, 10].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isTransmitting ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"
                  }`}
                  style={{ height: isTransmitting ? `${(h * (1 + (i % 3) * 0.2)).toFixed(0)}px` : "4px" }}
                />
              ))}
            </div>

            <button
              onMouseDown={handlePttStart}
              onMouseUp={handlePttEnd}
              onTouchStart={handlePttStart}
              onTouchEnd={handlePttEnd}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xl transition select-none active:scale-95 ${
                isTransmitting
                  ? "bg-rose-600 ring-4 ring-rose-500/50 animate-pulse"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90"
              }`}
            >
              <Mic className={`h-4 w-4 ${isTransmitting ? "animate-bounce" : ""}`} />
              {isTransmitting ? "NHẢ CHUỘT ĐỂ DỪNG PHÁT" : "GIỮ ĐỂ NÓI (PUSH TO TALK)"}
            </button>
            <p className="text-[10px] text-muted-foreground">Giữ chuột hoặc ngón tay để phát giọng nói HD 16kHz</p>
          </div>

          {/* Live Audio Transcript Box */}
          <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1.5 max-h-28 overflow-y-auto">
            <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
              <span>Bản Ghi Bóc Tách Đàm Thoại (Live Transcription):</span>
              <span className="text-emerald-400 font-mono">AI WHISPER ON</span>
            </div>
            {transcripts.map((t, idx) => (
              <div key={idx} className="text-[11px] leading-tight flex items-start gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{t.time}</span>
                <span className="font-bold text-sky-400 shrink-0">[{t.sender}]:</span>
                <span className="text-foreground">{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : activeCallTarget ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
                <Mic className="h-4 w-4 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400">
                  ĐANG ĐÀM THOẠI TRỰC TIẾP VỚI [{activeCallTarget.toUpperCase()}]
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Thời lượng: <strong className="text-foreground">{formatDuration(callDuration)}</strong> · HD Voice 16kHz
                </div>
              </div>
            </div>
            <button
              onClick={handleEndCall}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-rose-500 transition"
            >
              <PhoneOff className="h-3.5 w-3.5" /> GÁC MÁY
            </button>
          </div>
        </div>
      ) : (
        /* 3 Quick Dial Buttons */
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => handleStartCall(`Nạn nhân: ${victimName}`)}
            className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-left hover:bg-sky-500/20 transition"
          >
            <div>
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1">
                <Phone className="h-3 w-3" /> Gọi Nạn nhân
              </div>
              <div className="text-[10px] text-muted-foreground">{victimPhone || "Chưa có SĐT"}</div>
            </div>
            <span className="text-[10px] font-semibold text-sky-300 bg-sky-500/20 px-1.5 py-0.5 rounded">GỌI</span>
          </button>

          <button
            onClick={() => handleStartCall(`Người thân: ${guardianName}`)}
            className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-2 text-left hover:bg-accent/40 transition"
          >
            <div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1">
                <Phone className="h-3 w-3 text-amber-400" /> Gọi Người thân
              </div>
              <div className="text-[10px] text-muted-foreground">{guardianPhone}</div>
            </div>
            <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">GỌI</span>
          </button>

          <button
            onClick={() => handleStartCall(`Hiệp sĩ: ${heroName}`)}
            className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-left hover:bg-emerald-500/20 transition"
          >
            <div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Phone className="h-3 w-3" /> Gọi Hiệp sĩ
              </div>
              <div className="text-[10px] text-muted-foreground">{heroPhone}</div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">GỌI</span>
          </button>
        </div>
      )}

      {/* 3. Emergency First-Aid Protocols Sheet */}
      <div className="rounded-xl border border-border/80 bg-card/40 p-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-rose-400" />
            Cẩm Nang Sơ Cấp Cứu Y Tế 1-Chạm
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedProtocol("FAST")}
              className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                selectedProtocol === "FAST"
                  ? "bg-rose-500 text-white"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              ĐỘT QUỴ F.A.S.T
            </button>
            <button
              onClick={() => setSelectedProtocol("CPR")}
              className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                selectedProtocol === "CPR"
                  ? "bg-rose-500 text-white"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              ÉP TIM CPR
            </button>
            <button
              onClick={() => setSelectedProtocol("RECOVERY")}
              className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                selectedProtocol === "RECOVERY"
                  ? "bg-rose-500 text-white"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              NẰM NGHIÊNG AN TOÀN
            </button>
          </div>
        </div>

        {/* Content for selected protocol */}
        {selectedProtocol === "FAST" && (
          <div className="space-y-1.5 text-xs text-foreground/90">
            <div className="font-semibold text-rose-400">Quy chuẩn F.A.S.T xử trí Nghi ngờ Đột quỵ cấp:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
              <li><strong>F (Face)</strong>: Kiểm tra mặt nạn nhân có bị méo, xệ một bên miệng khi cười không.</li>
              <li><strong>A (Arms)</strong>: Yêu cầu giơ 2 tay lên, nếu một tay bị rũ xuống là dấu hiệu liệt nửa người.</li>
              <li><strong>S (Speech)</strong>: Giọng nói ngọng nghịu, ú ớ hoặc không nhắc lại được câu đơn giản.</li>
              <li><strong>T (Time)</strong>: Đặt nạn nhân nằm đầu cao 30 độ, KHÔNG cho uống nước/thuốc, đợi 115.</li>
            </ul>
          </div>
        )}

        {selectedProtocol === "CPR" && (
          <div className="space-y-1.5 text-xs text-foreground/90">
            <div className="font-semibold text-rose-400">Quy chuẩn Hồi sức Tim Phổi (CPR) Ép tim ngoài lồng ngực:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
              <li>Đặt nạn nhân nằm ngửa trên nền cứng phẳng, kiểm tra dị vật đường thở.</li>
              <li>Đặt gót bàn tay vào chính giữa xương ức, đan chéo 2 bàn tay, cánh tay thẳng góc 90 độ.</li>
              <li>Ép mạnh và nhanh với tần số <strong>100 - 120 nhịp/phút</strong>, độ lún 5-6 cm.</li>
              <li>Duy trì liên tục không ngắt quãng cho đến khi lực lượng Cấp cứu 115 tiếp quản.</li>
            </ul>
          </div>
        )}

        {selectedProtocol === "RECOVERY" && (
          <div className="space-y-1.5 text-xs text-foreground/90">
            <div className="font-semibold text-rose-400">Tư thế Hồi sức Nằm Nghiêng An Toàn (Recovery Position):</div>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
              <li>Dành cho nạn nhân bất tỉnh nhưng vẫn còn thở tự nhiên đều đặn.</li>
              <li>Gập cánh tay phía đối diện qua ngực, co chân đối diện lên rồi xoay cả người nghiêng sang một bên.</li>
              <li>Ngửa nhẹ đầu nạn nhân ra sau để giữ đường thở luôn thông thoáng, ngăn dịch nôn sặc vào phổi.</li>
              <li>Theo dõi nhịp thở mỗi 1 phút một lần cho đến khi Hiệp sĩ hoặc Y tế đến nơi.</li>
            </ul>
          </div>
        )}

        {/* Action Button to Broadcast Protocol */}
        <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2">
          {sentMessageNotice ? (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> {sentMessageNotice}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              Gửi tin nhắn mẫu hướng dẫn này trực tiếp tới điện thoại người hỗ trợ hiện trường.
            </span>
          )}
          <button
            onClick={() => handleSendProtocol(selectedProtocol)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 transition"
          >
            <Send className="h-3.5 w-3.5" /> Gửi Chỉ Dẫn Hiện Trường
          </button>
        </div>
      </div>
    </div>
  );
}
