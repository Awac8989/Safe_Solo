import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  MapPin,
  Megaphone,
  Navigation,
  Radio,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import {
  fetchDisasterAlerts,
  createDisasterAlert,
  resolveDisasterAlert,
  type DisasterAlertItem,
} from "@/lib/api";

interface DisasterBroadcastModalProps {
  onClose: () => void;
  defaultCoordinates?: { lat: number; lng: number };
}

export function DisasterBroadcastModal({ onClose, defaultCoordinates }: DisasterBroadcastModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"LIST" | "CREATE">("LIST");
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Form states for new disaster broadcast
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DisasterAlertItem["category"]>("LANDSLIDE");
  const [severity, setSeverity] = useState<DisasterAlertItem["severity"]>("CRITICAL");
  const [radiusMeters, setRadiusMeters] = useState(3000);
  const [lat, setLat] = useState(defaultCoordinates?.lat ?? 11.4720);
  const [lng, setLng] = useState(defaultCoordinates?.lng ?? 107.7260);
  const [address, setAddress] = useState("Đèo Bảo Lộc, QL20, Lâm Đồng");
  const [description, setDescription] = useState(
    "Mưa lớn kéo dài gây sạt trượt đất đá taluy dương, đất bùn tràn qua đường gây nguy cơ ách tắc và tai nạn đặc biệt nghiêm trọng."
  );
  const [safetyAdvice, setSafetyAdvice] = useState(
    "Tuyệt đối không lưu thông qua đèo trong lúc mưa lớn. Tìm nơi dừng đỗ an toàn tại chân đèo hoặc đi vòng theo hướng Tỉnh lộ 725."
  );
  const [evacuationRouteTip, setEvacuationRouteTip] = useState(
    "Đường tránh Tỉnh lộ 725 qua Huyện Đạ Tẻh ➔ Huyện Bảo Lâm."
  );

  const alertsQuery = useQuery({
    queryKey: ["disaster-alerts"],
    queryFn: fetchDisasterAlerts,
    refetchInterval: 10000,
  });

  const alerts = alertsQuery.data?.data ?? [];
  const activeAlerts = alerts.filter((a) => a.status === "ACTIVE");

  const createMutation = useMutation({
    mutationFn: (payload: Partial<DisasterAlertItem>) => createDisasterAlert(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["disaster-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-list"] });
      setActiveTab("LIST");
      setTitle("");
      setActionSuccessNotice("Đã phát lệnh báo động thiên tai tới toàn bộ người dùng SafeSolo!");
      setTimeout(() => setActionSuccessNotice(null), 4000);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveDisasterAlert(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["disaster-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-list"] });
      setActionSuccessNotice("Đã giải tỏa an toàn thành công!");
      setTimeout(() => setActionSuccessNotice(null), 3000);
    },
  });

  const handleCategoryChange = (cat: DisasterAlertItem["category"]) => {
    setCategory(cat);
    if (cat === "LANDSLIDE") {
      setTitle("CẢNH BÁO SẠT LỞ ĐẤT ĐÈO DỐC NGUY CẤP");
      setSafetyAdvice("Dừng ngay việc lưu thông qua sườn núi taluy. Tìm bãi đỗ kiên cố, tránh xa chân đồi đất đá.");
      setEvacuationRouteTip("Chọn tuyến đường tránh chân núi hoặc di chuyển về phía bến xe trung tâm.");
    } else if (cat === "FLOODING") {
      setTitle("CẢNH BÁO TRIỀU CƯỜNG NGẬP NƯỚC SÂU TRÊN 0.6M");
      setSafetyAdvice("Không cố đi xe máy qua vùng nước ngập bánh. Cắt cầu dao điện nếu nước tràn vào nhà.");
      setEvacuationRouteTip("Di chuyển theo tuyến đường trục cao ráo, tránh các đoạn ven sông kênh rạch.");
    } else if (cat === "STORM_SURGE") {
      setTitle("BÁO ĐỘNG LŨ QUÉT VÀ DÔNG LỐC KHẨN CẤP");
      setSafetyAdvice("Di tản ngay lên các tầng cao hoặc điểm tập kết dân sinh kiên cố.");
      setEvacuationRouteTip("Tuyến hành lang an toàn của huyện đội.");
    } else {
      setTitle("CẢNH BÁO KHU VỰC NGUY HIỂM ĐẶC BIỆT");
      setSafetyAdvice("Tránh xa khu vực phong tỏa, tuân thủ hướng dẫn của lực lượng cứu hộ.");
      setEvacuationRouteTip("Theo hướng dẫn phân luồng của CSGT.");
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      category,
      severity,
      radiusMeters,
      lat: Number(lat),
      lng: Number(lng),
      address: address.trim(),
      description: description.trim(),
      safetyAdvice: safetyAdvice.trim(),
      evacuationRouteTip: evacuationRouteTip.trim(),
      issuedBy: "Ban Chỉ Huy PCTT & Trực ban SafeSolo 115",
      broadcastCount: Math.floor(Math.random() * 200) + 150,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-rose-500/40 bg-zinc-950 text-foreground shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-red-950/60 via-zinc-900 to-zinc-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-red-400 border border-red-500/40 shadow-inner">
              <Megaphone className="h-5 w-5 animate-pulse text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Hệ Thống Báo Động Thiên Tai & Hiểm Họa Khẩn Cấp (Emergency Broadcast)
                </h2>
                <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  ADMIN DISPATCH
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Phát thông báo ngập lụt, sạt lở đất đá, nguy hiểm trực tiếp tới ứng dụng SafeSolo của người dân
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-between border-b border-border bg-zinc-900/40 px-6 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("LIST")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "LIST"
                  ? "bg-red-600 text-white shadow"
                  : "text-muted-foreground hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Radio className="h-3.5 w-3.5" /> Các Cảnh Báo Đang Phát Động ({activeAlerts.length})
            </button>
            <button
              onClick={() => setActiveTab("CREATE")}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "CREATE"
                  ? "bg-red-600 text-white shadow"
                  : "text-muted-foreground hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <AlertOctagon className="h-3.5 w-3.5" /> Phát Lệnh Báo Động Mới
            </button>
          </div>

          <div className="text-[11px] text-zinc-400">
            Trạng thái phát sóng: <span className="font-bold text-emerald-400">Sẵn sàng 24/7 (FCM & In-App Flash)</span>
          </div>
        </div>

        {/* Notice toast */}
        {actionSuccessNotice && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-2.5 text-xs font-semibold text-emerald-300 backdrop-blur animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            {actionSuccessNotice}
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "LIST" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
                  <div className="text-[11px] font-medium text-red-400">Cảnh báo Đỏ (Nguy cấp)</div>
                  <div className="mt-1 text-2xl font-bold text-red-400">
                    {alerts.filter((a) => a.severity === "CRITICAL" && a.status === "ACTIVE").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Sạt lở / Ngập nước sâu / Lũ</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
                  <div className="text-[11px] font-medium text-amber-400">Cảnh báo Vàng (Rủi ro cao)</div>
                  <div className="mt-1 text-2xl font-bold text-amber-400">
                    {alerts.filter((a) => a.severity === "WARNING" && a.status === "ACTIVE").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Khuyến cáo né tránh</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                  <div className="text-[11px] font-medium text-emerald-400">Đã giải tỏa an toàn</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-400">
                    {alerts.filter((a) => a.status === "RESOLVED").length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Lực lượng đã kiểm soát</div>
                </div>
              </div>

              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 text-emerald-500/60 mb-2" />
                  <p className="text-sm font-semibold text-white">Chưa có lệnh báo động thiên tai nào</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bấm &quot;Phát Lệnh Báo Động Mới&quot; để tạo cảnh báo ngập lụt hoặc sạt lở đất.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((item) => {
                    const isCritical = item.severity === "CRITICAL";
                    const isLandslide = item.category === "LANDSLIDE";
                    const isFlooding = item.category === "FLOODING";
                    const isActive = item.status === "ACTIVE";

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 transition ${
                          isActive
                            ? isCritical
                              ? "border-red-500/50 bg-red-950/20"
                              : "border-amber-500/40 bg-amber-950/15"
                            : "border-border bg-card/60 opacity-60"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 max-w-2xl">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  isCritical
                                    ? "bg-red-500/30 text-red-300 border border-red-500/50"
                                    : "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                                }`}
                              >
                                {isLandslide ? (
                                  <>
                                    <AlertOctagon className="h-3 w-3" /> SẠT LỞ ĐẤT ĐÁ
                                  </>
                                ) : isFlooding ? (
                                  <>
                                    <Waves className="h-3 w-3" /> NGẬP NƯỚC SÂU
                                  </>
                                ) : (
                                  <>
                                    <ShieldAlert className="h-3 w-3" /> NGUY CƠ KHẨN CẤP
                                  </>
                                )}
                              </span>

                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {isActive ? "ĐANG PHÁT ĐỘNG" : "ĐÃ GIẢI TỎA"}
                              </span>

                              <span className="text-[11px] text-muted-foreground">
                                Bán kính: <strong>{item.radiusMeters}m</strong> · Đã thông báo:{" "}
                                <strong className="text-white">{item.broadcastCount} người</strong>
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

                            <div className="mt-2 rounded-lg bg-black/40 p-2.5 border border-white/5 space-y-1">
                              <div className="text-[11px] text-rose-300 font-semibold flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                                Khuyến cáo an toàn:{" "}
                                <span className="text-white font-normal">{item.safetyAdvice || "Tuân thủ hướng dẫn sơ tán."}</span>
                              </div>
                              {item.evacuationRouteTip && (
                                <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                                  <Navigation className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  Lộ trình sơ tán:{" "}
                                  <span className="text-white font-normal">{item.evacuationRouteTip}</span>
                                </div>
                              )}
                              <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                                Địa điểm: {item.address} ({item.lat}, {item.lng})
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {isActive && (
                              <button
                                onClick={() => resolveMutation.mutate(item.id)}
                                disabled={resolveMutation.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition shadow"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Giải Tỏa An Toàn
                              </button>
                            )}

                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.createdAt).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              -{" "}
                              {new Date(item.createdAt).toLocaleDateString("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-3.5 text-xs text-red-200 flex items-start gap-2">
                <BellRing className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Cơ chế phát sóng khẩn cấp:</strong> Khi gửi lệnh báo động, hệ thống sẽ ghim thẻ đỏ cảnh báo
                  lên đầu màn hình chính của ứng dụng SafeSolo, kích hoạt thông báo đẩy kèm còi rung cảnh báo và hiển
                  thị bản đồ hướng dẫn sơ tán cho cư dân trong bán kính ảnh hưởng.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Loại hiểm họa */}
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Loại thiên tai / Hiểm họa *</label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as DisasterAlertItem["category"])}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium outline-none focus:border-red-500"
                  >
                    <option value="LANDSLIDE">⛰️ Sạt lở đất đá / Đèo dốc (Landslide)</option>
                    <option value="FLOODING">🌊 Ngập lụt sâu / Triều cường (Flooding)</option>
                    <option value="STORM_SURGE">⛈️ Bão lũ / Lốc xoáy / Lũ quét (Storm Surge)</option>
                    <option value="CRITICAL_DANGER">⚠️ Vùng nguy hiểm đặc biệt (Critical Danger)</option>
                    <option value="ROAD_HAZARD">🚧 Sụt lún cầu đường / Bẫy đinh (Road Hazard)</option>
                  </select>
                </div>

                {/* Mức độ báo động */}
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Mức độ nghiêm trọng *</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as DisasterAlertItem["severity"])}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium outline-none focus:border-red-500"
                  >
                    <option value="CRITICAL">🔴 Nguy cấp (Báo động Đỏ - Còi rung + Flash Screen)</option>
                    <option value="WARNING">🟠 Cảnh báo (Báo động Vàng - Banner trang chủ + Radar)</option>
                    <option value="ADVISORY">🟡 Khuyến cáo phòng ngừa (Lưu ý thông tin)</option>
                  </select>
                </div>
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Tiêu đề lệnh báo động *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: CẢNH BÁO SẠT LỞ ĐẤT ĐÈO BẢO LỘC - NGUY CẤP"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-red-400 outline-none focus:border-red-500"
                  required
                />
              </div>

              {/* Tọa độ & Bán kính */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lng}
                    onChange={(e) => setLng(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">Bán kính cảnh báo</label>
                  <select
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-red-500"
                  >
                    <option value={1000}>1,000 mét (1 km)</option>
                    <option value={2000}>2,000 mét (2 km)</option>
                    <option value={3000}>3,000 mét (3 km)</option>
                    <option value={5000}>5,000 mét (5 km - Đèo/Sông)</option>
                    <option value={10000}>10,000 mét (10 km)</option>
                    <option value={0}>Toàn mạng lưới SafeSolo (Toàn TP)</option>
                  </select>
                </div>
              </div>

              {/* Địa bàn */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Địa bàn / Tuyến đường trọng điểm *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ví dụ: Km 104+200 Quốc lộ 20, Đèo Bảo Lộc, Lâm Đồng"
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-red-500"
                  required
                />
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">Chi tiết tình hình thực địa</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả hiện trạng đất sạt trượt, mực nước ngập hoặc chướng ngại..."
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-xs outline-none focus:border-red-500"
                />
              </div>

              {/* Khuyến cáo an toàn & Lộ trình sơ tán */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-rose-300 block mb-1">Khuyến cáo an toàn sinh tồn *</label>
                  <textarea
                    rows={2}
                    value={safetyAdvice}
                    onChange={(e) => setSafetyAdvice(e.target.value)}
                    placeholder="Hướng dẫn phòng tránh cho người dân..."
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs outline-none focus:border-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-emerald-300 block mb-1">Lộ trình tránh né / Sơ tán an toàn</label>
                  <textarea
                    rows={2}
                    value={evacuationRouteTip}
                    onChange={(e) => setEvacuationRouteTip(e.target.value)}
                    placeholder="Tuyến đường thay thế không qua điểm ngập/sạt lở..."
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab("LIST")}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  Quay lại danh sách
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-red-500 transition"
                >
                  <Send className="h-4 w-4" />
                  {createMutation.isPending ? "Đang phát sóng..." : "PHÁT LỆNH BÁO ĐỘNG KHẨN CẤP"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
