import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Layers,
  MapPin,
  Moon,
  Plus,
  Radio,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import {
  fetchDangerGeofences,
  createDangerGeofence,
  toggleDangerGeofence,
  deleteDangerGeofence,
  broadcastGeofenceAlert,
  type DangerGeofenceItem,
} from "@/lib/api";

interface DangerGeofenceModalProps {
  onClose: () => void;
  defaultCoordinates?: { lat: number; lng: number };
}

export function DangerGeofenceModal({ onClose, defaultCoordinates }: DangerGeofenceModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"LIST" | "CREATE">("LIST");
  const [broadcastTarget, setBroadcastTarget] = useState<DangerGeofenceItem | null>(null);
  const [customBroadcastMsg, setCustomBroadcastMsg] = useState("");
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Form states for new geofence
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DangerGeofenceItem["category"]>("FLOODING");
  const [severity, setSeverity] = useState<DangerGeofenceItem["severity"]>("WARNING");
  const [radiusMeters, setRadiusMeters] = useState(400);
  const [lat, setLat] = useState(defaultCoordinates?.lat ?? 10.7765);
  const [lng, setLng] = useState(defaultCoordinates?.lng ?? 106.7009);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [durationHours, setDurationHours] = useState(12);

  const geofencesQuery = useQuery({
    queryKey: ["danger-geofences"],
    queryFn: fetchDangerGeofences,
  });

  const geofences = geofencesQuery.data?.data.geofences ?? [];
  const stats = geofencesQuery.data?.data.stats;

  const createMutation = useMutation({
    mutationFn: (payload: any) => createDangerGeofence(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["danger-geofences"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-radar"] });
      setActiveTab("LIST");
      setName("");
      setDescription("");
      setActionSuccessNotice("Đã kích hoạt Vùng Nguy Hiểm Động mới thành công!");
      setTimeout(() => setActionSuccessNotice(null), 3000);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleDangerGeofence(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["danger-geofences"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-radar"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDangerGeofence(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["danger-geofences"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-radar"] });
      setActionSuccessNotice("Đã giải tỏa vùng nguy hiểm thành công!");
      setTimeout(() => setActionSuccessNotice(null), 3000);
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) => broadcastGeofenceAlert(id, message),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["danger-geofences"] });
      setBroadcastTarget(null);
      setActionSuccessNotice(`Đã phát thông báo khẩn cấp tới ${res.data.recipientsCount} người dùng trong vùng!`);
      setTimeout(() => setActionSuccessNotice(null), 3500);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate({
      name,
      category,
      severity,
      lat,
      lng,
      radiusMeters,
      address: address || "TP. Hồ Chí Minh",
      description,
      durationHours,
    });
  };

  const getCategoryBadge = (cat: DangerGeofenceItem["category"]) => {
    switch (cat) {
      case "FLOODING":
        return { label: "Ngập lụt", icon: Waves, color: "text-sky-400 bg-sky-500/10 border-sky-500/30" };
      case "DARK_ROAD":
        return { label: "Đường tối", icon: Moon, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" };
      case "ROAD_HAZARD":
        return { label: "Chướng ngại", icon: Flame, color: "text-orange-400 bg-orange-500/10 border-orange-500/30" };
      case "CRIME_HOTSPOT":
        return { label: "An ninh / Cướp giật", icon: Eye, color: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
      case "CONSTRUCTION":
        return { label: "Công trình sạt lở", icon: AlertTriangle, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-rose-500/30 bg-card shadow-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-6 py-3.5 backdrop-blur shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
              <Radio className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wide text-foreground">
                  QUẢN TRỊ VÙNG NGUY HIỂM ĐỘNG · DYNAMIC GEOFENCING
                </span>
                <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-400">
                  {stats?.active ?? 0} VÙNG HOẠT ĐỘNG
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Thiết lập vành đai cảnh báo rủi ro & Phát thanh khẩn cấp cho người dùng theo tọa độ GPS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === "LIST" ? "CREATE" : "LIST")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "CREATE"
                  ? "bg-secondary text-foreground"
                  : "bg-rose-600 text-white hover:bg-rose-500 shadow"
              }`}
            >
              {activeTab === "CREATE" ? "Quay lại danh sách" : <><Plus className="h-3.5 w-3.5" /> Thêm Vùng Mới</>}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notice Toast */}
        {actionSuccessNotice && (
          <div className="bg-emerald-950/40 border-b border-emerald-500/30 px-6 py-2 text-xs font-bold text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-border/80 bg-background/80 p-3 text-center">
              <div className="text-[10px] text-muted-foreground font-medium">Tổng số vùng thiết lập</div>
              <div className="text-xl font-black text-foreground mt-0.5">{stats?.total || geofences.length}</div>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-center">
              <div className="text-[10px] text-rose-300 font-medium">Đang phát hiệu lực</div>
              <div className="text-xl font-black text-rose-400 mt-0.5">{stats?.active || 0}</div>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 text-center">
              <div className="text-[10px] text-sky-300 font-medium">Người dùng trong vùng</div>
              <div className="text-xl font-black text-sky-400 mt-0.5">{stats?.totalMonitoredUsers || 0}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-center">
              <div className="text-[10px] text-emerald-300 font-medium">Lượt cảnh báo đã phát</div>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{stats?.totalBroadcastsDispatched || 0}</div>
            </div>
          </div>

          {activeTab === "CREATE" ? (
            /* CREATE FORM */
            <form onSubmit={handleCreateSubmit} className="rounded-xl border border-border bg-background/60 p-5 space-y-4">
              <div className="border-b border-border/60 pb-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Plus className="h-4 w-4 text-rose-400" /> Thiết Lập Vành Đai Nguy Hiểm Động Mới
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vùng nguy hiểm sẽ hiển thị viền phát sáng trên bản đồ và kích hoạt cảnh báo đẩy khi có người dùng đi vào.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Tên vùng nguy hiểm *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Điểm ngập sâu ngã tư Nguyễn Hữu Cảnh"
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Loại hiểm họa</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium outline-none"
                  >
                    <option value="LANDSLIDE">Sạt lở đất đá / Đèo núi</option>
                    <option value="FLOODING">Ngập nước sâu / Triều cường</option>
                    <option value="DARK_ROAD">Đoạn đường tối thiếu ánh sáng</option>
                    <option value="ROAD_HAZARD">Chướng ngại / Bẫy đinh</option>
                    <option value="CRIME_HOTSPOT">Điểm đen cướp giật / Mất an ninh</option>
                    <option value="CONSTRUCTION">Công trình thi công</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Mức độ rủi ro</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium outline-none"
                  >
                    <option value="CRITICAL">🔴 CỰC KỲ NGUY HIỂM (Critical)</option>
                    <option value="WARNING">🟠 CẢNH BÁO CAO (Warning)</option>
                    <option value="ADVISORY">🟡 LƯU Ý / KHUYẾN NGHỊ (Advisory)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Bán kính bảo vệ (Mét): {radiusMeters}m</label>
                  <input
                    type="range"
                    min={100}
                    max={2000}
                    step={50}
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="w-full mt-2 accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>100m</span>
                    <span>500m</span>
                    <span>1000m</span>
                    <span>2000m</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Tọa độ tâm (Vĩ độ Lat, Kinh độ Lng)</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input
                      type="number"
                      step="any"
                      required
                      value={lat}
                      onChange={(e) => setLat(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-mono outline-none"
                      placeholder="Lat"
                    />
                    <input
                      type="number"
                      step="any"
                      required
                      value={lng}
                      onChange={(e) => setLng(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-mono outline-none"
                      placeholder="Lng"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Thời hạn hiệu lực tự động</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium outline-none"
                  >
                    <option value={4}>4 giờ (Ngập lụt sau mưa)</option>
                    <option value={12}>12 giờ (Qua đêm 18h - 06h)</option>
                    <option value={24}>24 giờ (Sự cố trong ngày)</option>
                    <option value={72}>3 ngày (Công trình dài ngày)</option>
                    <option value={720}>30 ngày (Vùng tối cố định)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">Địa chỉ / Vị trí cụ thể</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="VD: Đường Nguyễn Hữu Cảnh, Phường 25, Quận Bình Thạnh"
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">Ghi chú & Khuyến nghị thoát hiểm</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="VD: Nước ngập sâu trên 0.5m, đề xuất tài xế và người đi bộ rẽ sang hướng Điện Biên Phủ..."
                    className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("LIST")}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-lg disabled:opacity-50"
                >
                  {createMutation.isPending ? "Đang khởi tạo..." : "Kích Hoạt Vùng Cảnh Báo"}
                </button>
              </div>
            </form>
          ) : (
            /* LIST OF GEOFENCES */
            <div className="space-y-3">
              {geofences.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  Chưa có vùng nguy hiểm động nào được thiết lập. Hãy bấm nút "Thêm Vùng Mới" phía trên.
                </div>
              ) : (
                geofences.map((geo) => {
                  const badge = getCategoryBadge(geo.category);
                  const isActive = geo.status === "ACTIVE";

                  return (
                    <div
                      key={geo.id}
                      className={`rounded-xl border p-4 transition ${
                        isActive
                          ? "border-rose-500/30 bg-background/80 shadow-md"
                          : "border-border/60 bg-card/40 opacity-70"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.color}`}>
                              <badge.icon className="h-3 w-3" />
                              {badge.label}
                            </span>
                            <span className="text-xs font-extrabold text-foreground">{geo.name}</span>
                            <span className={`rounded-full px-2 py-0.2 text-[9px] font-bold ${
                              geo.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-400"
                                : geo.severity === "WARNING"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-sky-500/20 text-sky-400"
                            }`}>
                              {geo.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            📍 {geo.address} · Bán kính: <strong className="text-foreground">{geo.radiusMeters}m</strong> (Tọa độ: {geo.center.lat.toFixed(4)}, {geo.center.lng.toFixed(4)})
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleMutation.mutate(geo.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                              isActive
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {isActive ? "ĐANG BẬT" : "TẠM TẮT"}
                          </button>

                          <button
                            onClick={() => setBroadcastTarget(geo)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-400 hover:bg-sky-500/20 transition"
                          >
                            <Send className="h-3 w-3" /> Phát Loa Vùng ({geo.activePeopleCount})
                          </button>

                          <button
                            onClick={() => deleteMutation.mutate(geo.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/20 hover:text-rose-400 transition"
                            title="Xóa vùng"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <div className="italic text-foreground/80 max-w-xl">
                          "{geo.description}"
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span>Đã phát: <strong className="text-foreground">{geo.broadcastCount}</strong> lượt</span>
                          <span>Hết hạn: {new Date(geo.expiresAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Broadcast Quick Confirm */}
        {broadcastTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-sky-400">
                <BellRing className="h-5 w-5 animate-bounce" />
                <h4 className="text-base font-bold">Phát Thông Điệp Khẩn Cấp Theo Vùng</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Tin nhắn thông báo đẩy sẽ được gửi tức thì đến toàn bộ <strong>{broadcastTarget.activePeopleCount} người dùng</strong> đang có mặt trong bán kính {broadcastTarget.radiusMeters}m của:
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-bold text-foreground">
                {broadcastTarget.name}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Nội dung thông điệp phát thanh:</label>
                <textarea
                  rows={3}
                  value={customBroadcastMsg}
                  onChange={(e) => setCustomBroadcastMsg(e.target.value)}
                  placeholder={`[CẢNH BÁO AN TOÀN SAFESOLO] Bạn đang ở gần vùng rủi ro: ${broadcastTarget.name}. Vui lòng giảm tốc độ hoặc chọn lộ trình thay thế.`}
                  className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setBroadcastTarget(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() =>
                    broadcastMutation.mutate({
                      id: broadcastTarget.id,
                      message: customBroadcastMsg,
                    })
                  }
                  disabled={broadcastMutation.isPending}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-500 shadow-md disabled:opacity-50"
                >
                  {broadcastMutation.isPending ? "Đang phát sóng..." : "Gửi Cảnh Báo Ngay"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
