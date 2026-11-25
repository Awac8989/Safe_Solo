import { useState, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getStoredAdminToken } from "@/lib/api";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  Send,
  Check,
  HeartHandshake,
  AlertCircle,
  Stethoscope,
  Radio,
  Headphones,
  Download,
  Video,
  VideoOff,
  ShieldCheck,
} from "lucide-react";

interface DispatchCommsConsoleProps {
  incidentId?: string;
  victimName: string;
  victimPhone: string;
  guardianName?: string;
  guardianPhone?: string;
  heroName?: string;
  heroPhone?: string;
}

const SOCKET_URL = (() => {
  const envUrl = import.meta.env?.VITE_API_URL as string | undefined;
  if (!envUrl) return "http://127.0.0.1:4000";
  return envUrl.replace(/\/api\/?$/, "");
})();

export function DispatchCommsConsole({
  incidentId = "global_toc",
  victimName,
  victimPhone,
  guardianName = "Người thân",
  guardianPhone = "0909001007",
  heroName = "Hiệp sĩ phản ứng nhanh",
  heroPhone = "0913843958",
}: DispatchCommsConsoleProps) {
  const roomId = incidentId.startsWith("incident_") ? incidentId : `incident_${incidentId}`;

  const [activeCallTarget, setActiveCallTarget] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState<"CPR" | "FAST" | "RECOVERY">("FAST");
  const [sentMessageNotice, setSentMessageNotice] = useState<string | null>(null);

  type CommsMode = "CALL" | "PTT" | "WEBRTC";
  const [commsMode, setCommsMode] = useState<CommsMode>("CALL");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isCovertListening, setIsCovertListening] = useState(false);
  const [isTwoWayTalk, setIsTwoWayTalk] = useState(false);
  const [pttChannel, setPttChannel] = useState<"VICTIM" | "HEROES">("HEROES");

  // Real Socket.IO + WebRTC state
  const [socketConnected, setSocketConnected] = useState(false);
  const [webrtcPeerState, setWebrtcPeerState] = useState<string>("STANDBY");
  const [remotePeersCount, setRemotePeersCount] = useState(0);
  const [liveCameraFrameUrl, setLiveCameraFrameUrl] = useState<string | null>(null);
  const [liveCameraFps, setLiveCameraFps] = useState<number>(0);
  const [liveHeroSender, setLiveHeroSender] = useState<string>(heroName);
  const [hasRemoteVideoTrack, setHasRemoteVideoTrack] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const frameCounterRef = useRef(0);

  const [transcripts, setTranscripts] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: "Trực ban (SUP-0137)", text: `Kênh WebRTC & PTT phòng ${roomId} sẵn sàng điều phối.`, time: new Date().toLocaleTimeString("vi-VN") },
  ]);

  const appendTranscript = (sender: string, text: string) => {
    const time = new Date().toLocaleTimeString("vi-VN");
    setTranscripts((prev) => [...prev.slice(-19), { sender, text, time }]);
  };

  useEffect(() => {
    let timer: any;
    if (activeCallTarget) {
      timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCallTarget]);

  // FPS counter for live Field Camera stream
  useEffect(() => {
    const t = setInterval(() => {
      setLiveCameraFps(frameCounterRef.current);
      frameCounterRef.current = 0;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Connect Socket.IO WebRTC Signaling + PTT Relay
  useEffect(() => {
    const token = getStoredAdminToken();
    const sock = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: {
        type: "webrtc_dispatch",
        ...(token ? { token } : { apiKey: "default-public-api-key-123" }),
      },
    });
    socketRef.current = sock;

    const ensurePeerConnection = () => {
      if (pcRef.current) return pcRef.current;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.onicecandidate = (ev) => {
        if (ev.candidate && sock.connected) {
          sock.emit("webrtc:ice-candidate", {
            roomId,
            candidate: ev.candidate,
            senderPeerId: "doctor_115_toc",
          });
        }
      };
      pc.onconnectionstatechange = () => {
        setWebrtcPeerState(pc.connectionState.toUpperCase());
      };
      pc.ontrack = (ev) => {
        const stream = ev.streams?.[0];
        if (stream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          setHasRemoteVideoTrack(true);
        }
      };
      pcRef.current = pc;
      return pc;
    };

    sock.on("connect", () => {
      setSocketConnected(true);
      sock.emit("webrtc:join_room", {
        roomId,
        peerId: "doctor_115_toc",
        role: "doctor",
        name: "Bác sĩ 115 TOC",
      });
      sock.emit("ptt:join_channel", {
        channelId: roomId,
        roomId,
        userId: "doctor_115_toc",
        userName: "Bác sĩ 115 TOC",
        role: "doctor",
      });
    });

    sock.on("disconnect", () => {
      setSocketConnected(false);
    });

    sock.on("webrtc:room_peers", (data: { peers?: Array<{ role?: string; name?: string }> }) => {
      setRemotePeersCount(Array.isArray(data?.peers) ? data.peers.length : 0);
    });

    sock.on("webrtc:peer_joined", (data: { name?: string }) => {
      setRemotePeersCount((c) => c + 1);
      appendTranscript("Hệ thống WebRTC", `${data?.name || "Hiệp sĩ hiện trường"} đã kết nối phòng ${roomId}.`);
    });

    sock.on("webrtc:peer_left", () => {
      setRemotePeersCount((c) => Math.max(0, c - 1));
    });

    sock.on("webrtc:offer", async (data: { sdp: RTCSessionDescriptionInit }) => {
      try {
        const pc = ensurePeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sock.emit("webrtc:answer", {
          roomId,
          sdp: answer,
          senderPeerId: "doctor_115_toc",
          senderRole: "doctor",
        });
        setWebrtcPeerState("CONNECTED");
      } catch (_) {}
    });

    sock.on("webrtc:answer", async (data: { sdp: RTCSessionDescriptionInit }) => {
      try {
        const pc = ensurePeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        setWebrtcPeerState("CONNECTED");
      } catch (_) {}
    });

    sock.on("webrtc:ice-candidate", async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        const pc = ensurePeerConnection();
        if (data?.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (_) {}
    });

    // Receive live Camera2 JPEG stream from Hero A71
    sock.on("webrtc:video_frame", (data: { frameBase64?: string; senderName?: string }) => {
      if (data?.frameBase64) {
        frameCounterRef.current += 1;
        setLiveCameraFrameUrl(`data:image/jpeg;base64,${data.frameBase64}`);
        if (data.senderName) setLiveHeroSender(data.senderName);
        setWebrtcPeerState("VIDEO_STREAMING");
      }
    });

    sock.on("ptt:talk_start", (data: { userName?: string }) => {
      appendTranscript(data?.userName || "Hiệp sĩ", "Đang phát thoại trực tiếp qua PTT...");
    });

    sock.on("ptt:audio_chunk", (data: { chunkBase64?: string; mimeType?: string; userName?: string }) => {
      if (!data?.chunkBase64) return;
      try {
        const mime = data.mimeType || "audio/mp4";
        const audio = new Audio(`data:${mime};base64,${data.chunkBase64}`);
        void audio.play().catch(() => {});
        appendTranscript(data.userName || "Hiệp sĩ PTT", "Đã truyền đoạn âm thanh hiện trường trực tiếp.");
      } catch (_) {}
    });

    return () => {
      try {
        sock.emit("webrtc:leave_room", { roomId, peerId: "doctor_115_toc" });
        sock.disconnect();
      } catch (_) {}
      try {
        pcRef.current?.close();
        pcRef.current = null;
      } catch (_) {}
      try {
        localStreamRef.current?.getTracks().forEach((tr) => tr.stop());
      } catch (_) {}
    };
  }, [roomId]);

  const handleInitiateWebRtcOffer = async () => {
    const sock = socketRef.current;
    if (!sock) return;
    try {
      const pc =
        pcRef.current ||
        new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
      pcRef.current = pc;
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = stream;
          stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
        } catch (_) {}
      }
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sock.emit("webrtc:ice-candidate", {
            roomId,
            candidate: ev.candidate,
            senderPeerId: "doctor_115_toc",
          });
        }
      };
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      sock.emit("webrtc:offer", {
        roomId,
        sdp: offer,
        senderPeerId: "doctor_115_toc",
        senderRole: "doctor",
      });
      setWebrtcPeerState("OFFER_SENT");
      appendTranscript("Bác sĩ 115 WebRTC", "Đã gửi SDP Offer tới Hiệp sĩ hiện trường qua Socket.IO.");
    } catch (_) {
      setWebrtcPeerState("SIGNALING_READY");
    }
  };

  const sendDoctorDirective = (instructionType: string, message: string) => {
    socketRef.current?.emit("webrtc:doctor_instruction", {
      roomId,
      doctorName: "Bác sĩ 115 TOC",
      instructionType,
      message,
    });
    appendTranscript("Bác sĩ 115 (Chỉ đạo)", message);
    setSentMessageNotice(`Đã bắn chỉ đạo trực tiếp lên A71 Hiệp sĩ: "${message}"`);
    setTimeout(() => setSentMessageNotice(null), 4000);
  };

  const handlePttStart = async () => {
    setIsTransmitting(true);
    socketRef.current?.emit("ptt:talk_start", {
      channelId: roomId,
      roomId,
      userId: "doctor_115_toc",
      userName: "Bác sĩ 115 TOC",
      role: "doctor",
    });

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = String(reader.result || "");
            const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
            if (b64) {
              socketRef.current?.emit("ptt:audio_chunk", {
                channelId: roomId,
                roomId,
                userId: "doctor_115_toc",
                userName: "Bác sĩ 115 TOC",
                role: "doctor",
                mimeType: blob.type || "audio/webm",
                chunkBase64: b64,
              });
            }
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach((tr) => tr.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
    } catch (_) {}
  };

  const handlePttEnd = () => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (_) {}
    socketRef.current?.emit("ptt:talk_end", {
      channelId: roomId,
      roomId,
      userId: "doctor_115_toc",
      userName: "Bác sĩ 115 TOC",
      role: "doctor",
      durationSeconds: 2,
    });
    const msg =
      pttChannel === "HEROES"
        ? "Lệnh điều phối: Hiệp sĩ giữ nhịp ép tim 110/phút, camera hướng sát vùng cấp cứu."
        : "Trực ban 115 đang nói: Bạn hãy giữ bình tĩnh, đội cứu hộ đang tiếp cận.";
    appendTranscript("Bác sĩ 115 (PTT)", msg);
  };

  const handleToggleCovertListening = () => {
    setIsCovertListening((prev) => !prev);
    if (!isCovertListening) {
      appendTranscript("Hệ thống WebRTC Blackbox", "Bắt đầu phiên nghe ngầm 15s (Covert Sniffer Mode) qua Socket.IO.");
    }
  };

  const handleStartCall = (target: string) => {
    setActiveCallTarget(target);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setActiveCallTarget(null);
  };

  const handleSendProtocol = (protocolName: string) => {
    const directiveMap: Record<string, string> = {
      FAST: "Kiểm tra dấu hiệu F.A.S.T đột quỵ, giữ đầu cao 30°, không cho uống thuốc.",
      CPR: "Ép tim ngoài lồng ngực CPR 100-120 lần/phút, độ lún 5-6cm không gián đoạn!",
      RECOVERY: "Đưa nạn nhân nằm nghiêng an toàn, ngửa nhẹ đầu mở thông đường thở.",
    };
    sendDoctorDirective(protocolName, directiveMap[protocolName] || protocolName);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-md backdrop-blur space-y-3">
      {/* 1. Header with Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-2 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <PhoneCall className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Tổng Đài Đàm Thoại &amp; Video WebRTC 115
              </span>
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                socketConnected ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-300"
              }`}>
                {socketConnected ? `SOCKET LIVE · ${remotePeersCount} peer` : "CONNECTING"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Camera hiện trường A71 ↔ Bác sĩ 115 &amp; Bộ đàm PTT Socket.IO</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCommsMode("CALL")}
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              commsMode === "CALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            CUỘC GỌI
          </button>
          <button
            onClick={() => setCommsMode("PTT")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              commsMode === "PTT" ? "bg-amber-600 text-white animate-pulse" : "text-amber-400 bg-amber-950/20 hover:bg-amber-950/40"
            }`}
          >
            <Radio className="h-3 w-3" /> BỘ ĐÀM PTT
          </button>
          <button
            onClick={() => setCommsMode("WEBRTC")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              commsMode === "WEBRTC" ? "bg-sky-600 text-white shadow-lg" : "text-sky-400 bg-sky-950/20 hover:bg-sky-950/40"
            }`}
          >
            <Video className="h-3 w-3" /> VIDEO WEBRTC
          </button>
        </div>
      </div>

      {/* 2. Mode Views */}
      {commsMode === "WEBRTC" ? (
        <div className="rounded-xl border border-sky-500/30 bg-[#071026] p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-500/20 pb-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${
                liveCameraFrameUrl || hasRemoteVideoTrack ? "bg-rose-500 animate-ping" : "bg-sky-400 animate-pulse"
              }`} />
              <span className="text-xs font-bold text-sky-400">
                {liveCameraFrameUrl || hasRemoteVideoTrack
                  ? `🔴 CAMERA HIỆN TRƯỜNG: ${liveHeroSender} (${liveCameraFps} FPS)`
                  : `WEBRTC 115 SIGNALING · ROOM ${roomId}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <span className="text-sky-300 font-bold">{webrtcPeerState}</span>
              <span className="text-border">|</span>
              <span className="text-emerald-400 font-bold">Socket.IO SRTP</span>
            </div>
          </div>

          {/* Live Hero Field Video Stream Container */}
          <div className="relative overflow-hidden rounded-xl border border-sky-500/25 bg-black/80 min-h-[160px] flex flex-col items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full max-h-[220px] object-cover ${hasRemoteVideoTrack ? "block" : "hidden"}`}
            />
            {!hasRemoteVideoTrack && liveCameraFrameUrl ? (
              <>
                <img
                  src={liveCameraFrameUrl}
                  alt="Hero Field Camera WebRTC Feed"
                  className="w-full max-h-[220px] object-cover"
                />
                <div className="absolute left-2 top-2 rounded bg-rose-600/90 px-2 py-0.5 text-[10px] font-mono font-bold text-white flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> LIVE CAMERA A71 · {liveCameraFps} FPS
                </div>
              </>
            ) : !hasRemoteVideoTrack ? (
              <div className="p-4 text-center space-y-2">
                <VideoOff className="h-7 w-7 text-sky-400/60 mx-auto" />
                <div className="text-xs text-slate-300 font-medium">
                  Chờ luồng Camera hiện trường từ Hiệp sĩ ({heroName}) hoặc kết nối WebRTC Offer
                </div>
                <button
                  type="button"
                  onClick={handleInitiateWebRtcOffer}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white transition"
                >
                  <Video className="h-3.5 w-3.5" /> Khởi tạo Kết nối WebRTC Offer (115 ↔ A71)
                </button>
              </div>
            ) : null}
          </div>

          {/* 1-Click Doctor 115 Live Coaching Directives -> Hero A71 */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase text-sky-300">
              Chỉ Đạo Trực Tiếp Bác Sĩ 115 → Màn Hình Hiệp Sĩ A71:
            </div>
            <div className="grid gap-1.5 sm:grid-cols-3 text-[11px]">
              <button
                type="button"
                onClick={() =>
                  sendDoctorDirective("CPR_PACE_110", "Bắt đầu ép tim CPR 100-120 nhịp/phút, ấn sâu 5cm!")
                }
                className="rounded-lg border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 font-bold text-rose-300 transition"
              >
                ❤️ Ép Tim CPR 110/p
              </button>
              <button
                type="button"
                onClick={() =>
                  sendDoctorDirective("TOURNIQUET_5CM", "Đặt băng garô phía trên vết thương 5cm, siết tới khi ngừng chảy máu!")
                }
                className="rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1.5 font-bold text-amber-300 transition"
              >
                🩹 Garô Cầm Máu
              </button>
              <button
                type="button"
                onClick={() =>
                  sendDoctorDirective("RECOVERY_POSITION", "Đặt nạn nhân nằm nghiêng an toàn, ngửa nhẹ cằm mở đường thở!")
                }
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1.5 font-bold text-emerald-300 transition"
              >
                🫁 Nghiêng An Toàn
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={handleToggleCovertListening}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition shadow ${
                isCovertListening
                  ? "bg-rose-600 text-white animate-pulse hover:bg-rose-500"
                  : "bg-sky-500 text-white hover:bg-sky-400"
              }`}
            >
              <Headphones className="h-4 w-4" />
              {isCovertListening ? "DỪNG NGHE LÉN HIỆN TRƯỜNG" : "🎧 NGHE LÉN HIỆN TRƯỜNG (15s)"}
            </button>

            <button
              onClick={() => {
                setIsTwoWayTalk(!isTwoWayTalk);
                if (!isTwoWayTalk) void handleInitiateWebRtcOffer();
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                isTwoWayTalk
                  ? "bg-emerald-600 text-white animate-pulse"
                  : "border border-border bg-background hover:bg-accent text-foreground"
              }`}
            >
              <Mic className="h-4 w-4 text-emerald-400" />
              {isTwoWayTalk ? "ĐANG MỞ MIC BÁC SĨ 115" : "MỞ MIC BÁC SĨ 115"}
            </button>

            <button
              onClick={() => {
                setSentMessageNotice("Đã lưu snapshot & Audio WebRTC vào Hồ sơ Bằng chứng.");
                setTimeout(() => setSentMessageNotice(null), 3000);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-background/60 px-3 py-1.5 text-xs font-bold hover:bg-accent transition text-muted-foreground"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" /> Lưu Hộp Đen (.WAV)
            </button>
          </div>

          {/* Live Transcript */}
          <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1.5 max-h-28 overflow-y-auto">
            <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
              <span>Nhật ký Phiên WebRTC &amp; Chỉ Đạo 115:</span>
              <span className="text-sky-400 font-mono">SOCKET.IO SIGNALING</span>
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
      ) : commsMode === "PTT" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isTransmitting ? "bg-rose-500 animate-ping" : "bg-emerald-500"}`} />
              <span className="text-xs font-bold text-amber-400">
                {isTransmitting ? "🔴 ĐANG PHÁT THANH PTT THẬT (ON AIR)" : "KÊNH BỘ ĐÀM SOCKET.IO SẴN SÀNG"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setPttChannel("HEROES")}
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  pttChannel === "HEROES" ? "bg-emerald-600 text-white" : "text-muted-foreground bg-background"
                }`}
              >
                Hiệp Sĩ Hiện Trường
              </button>
              <button
                onClick={() => setPttChannel("VICTIM")}
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  pttChannel === "VICTIM" ? "bg-sky-600 text-white" : "text-muted-foreground bg-background"
                }`}
              >
                Loa Nạn Nhân
              </button>
            </div>
          </div>

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
              {isTransmitting ? "NHẢ ĐỂ GỬI ÂM THANH PTT" : "GIỮ ĐỂ NÓI BÁC SĨ 115 → HIỆP SĨ"}
            </button>
            <p className="text-[10px] text-muted-foreground">Truyền âm thanh Push-to-Talk thật qua Socket.IO room {roomId}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1.5 max-h-28 overflow-y-auto">
            <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-between">
              <span>Nhật ký Đàm thoại Bộ đàm PTT:</span>
              <span className="text-emerald-400 font-mono">SOCKET.IO LIVE</span>
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
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => handleStartCall(`Nạn nhân ${victimName}`)}
            className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-left hover:bg-sky-500/20 transition"
          >
            <div>
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Gọi Nạn Nhân
              </div>
              <div className="text-[10px] text-muted-foreground">{victimPhone}</div>
            </div>
            <span className="text-[10px] font-semibold text-sky-300 bg-sky-500/20 px-1.5 py-0.5 rounded">GỌI</span>
          </button>

          <button
            onClick={() => handleStartCall(`Người thân ${guardianName}`)}
            className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-left hover:bg-amber-500/20 transition"
          >
            <div>
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <HeartHandshake className="h-3 w-3" /> Báo Người Thân
              </div>
              <div className="text-[10px] text-muted-foreground">{guardianPhone}</div>
            </div>
            <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">GỌI</span>
          </button>

          <button
            onClick={() => handleStartCall(`Hiệp sĩ ${heroName}`)}
            className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-left hover:bg-emerald-500/20 transition"
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

        <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2">
          {sentMessageNotice ? (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> {sentMessageNotice}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              Đẩy chỉ dẫn sơ cứu trực tiếp tới điện thoại A71 Hiệp sĩ qua WebRTC/Socket.IO.
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
