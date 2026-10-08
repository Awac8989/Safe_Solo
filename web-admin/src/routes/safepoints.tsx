import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BatteryCharging,
  CheckCircle2,
  Clock,
  Compass,
  DoorClosed,
  DoorOpen,
  Heart,
  KeyRound,
  Lock,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Unlock,
  Wrench,
  Zap,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchSafePointsNearby,
  requestSafePointUnlock,
  confirmSafePointUnlock,
  type SafePointAssetItem,
} from "@/lib/api";

export const Route = createFileRoute("/safepoints")({
  head: () => ({ meta: [{ title: "Mạng lưới Cứu hộ SafePoint & OpenAED - SafeSolo Admin" }] }),
  component: SafePointsManagementPage,
});

function SafePointsManagementPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedStation, setSelectedStation] = useState<SafePointAssetItem | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [rescuerIdInput, setRescuerIdInput] = useState("DISPATCHER_DESK_01");
  const [purposeInput, setPurposeInput] = useState("Cấp cứu ngừng tuần hoàn ngoại viện (AHA CPR/AED)");
  const [unlockResult, setUnlockResult] = useState<{
    otp: string;
    validSeconds: number;
    expiresAt: string;
    instructions: string;
  } | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Default coordinate center (Ho Chi Minh City District 1)
  const defaultLat = 10.7769;
  const defaultLng = 106.7009;

  const { data: safePointsData, isLoading, refetch } = useQuery({
    queryKey: ["safepoints-nearby", typeFilter],
    queryFn: () =>
      fetchSafePointsNearby({
        latitude: defaultLat,
        longitude: defaultLng,
        radiusMeters: 50000,
        type: typeFilter === "ALL" ? undefined : typeFilter,
      }),
    refetchInterval: 15000,
  });

  const unlockMutation = useMutation({
    mutationFn: (stationId: string) =>
      requestSafePointUnlock(stationId, {
        rescuerId: rescuerIdInput,
        purpose: purposeInput,
      }),
    onSuccess: (res) => {
      setUnlockResult({
        otp: res.data.unlockOtp,
        validSeconds: res.data.validSeconds,
        expiresAt: res.data.expiresAt,
        instructions: res.data.instructions,
      });
      setFeedbackNotice(`Đã tạo mã OTP mở tủ thành công cho trạm: ${res.data.stationName}`);
      void queryClient.invalidateQueries({ queryKey: ["safepoints-nearby"] });
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi mở tủ: ${err.message}`);
    },
  });

  const confirmUnlockMutation = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) =>
      confirmSafePointUnlock(id, {
        unlockOtp: otp,
        rescuerId: rescuerIdInput,
      }),
    onSuccess: () => {
      setFeedbackNotice("Trạm đã xác nhận mở tủ thành công và chuyển trạng thái đang sử dụng!");
      void queryClient.invalidateQueries({ queryKey: ["safepoints-nearby"] });
    },
  });

  const stations = safePointsData?.data || [];

  const filteredStations = stations.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      st.location.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (st.location.buildingName && st.location.buildingName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || st.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const aedCount = stations.filter((s) => s.type === "AED").length;
  const activeCount = stations.filter((s) => s.status === "ACTIVE").length;
  const maintenanceCount = stations.filter((s) => s.status === "MAINTENANCE").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar title="Mạng Lưới SafePoint & Trạm Sốc Tim OpenAED Cộng Đồng" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tổng Điểm Cứu Hộ</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Compass className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stations.length}</span>
              <span className="text-xs text-muted-foreground">Trạm trong bán kính 50km</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trạm Máy Sốc Tim AED</span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <Heart className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{aedCount}</span>
              <span className="text-xs text-emerald-500 font-medium">Sẵn sàng sốc tim 24/7</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trực Chiến Hoạt Động</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-500">{activeCount}</span>
              <span className="text-xs text-muted-foreground">Trạng thái bình thường</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cần Bảo Trì / Thay Pad</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Wrench className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-500">{maintenanceCount}</span>
              <span className="text-xs text-muted-foreground">Cần kiểm tra kỹ thuật</span>
            </div>
          </div>
        </div>

        {feedbackNotice && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{feedbackNotice}</span>
            </div>
            <button
              onClick={() => setFeedbackNotice(null)}
              className="text-xs font-semibold hover:underline text-muted-foreground"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Filter and Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm mã trạm, địa chỉ, tòa nhà..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Mọi loại trạm</option>
              <option value="AED">Máy sốc tim AED</option>
              <option value="FIRST_AID_KIT">Tủ sơ cấp cứu</option>
              <option value="OXYGEN_TANK">Bình dưỡng khí Oxy</option>
              <option value="TRAUMA_KIT">Bộ cầm máu chấn thương</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động (Active)</option>
              <option value="MAINTENANCE">Đang bảo trì</option>
              <option value="IN_USE">Đang mở cứu hộ</option>
              <option value="OFFLINE">Mất tín hiệu</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Station Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStations.map((station) => {
            const isAED = station.type === "AED";
            const batteryLow = station.hardwareState.batteryLevelPercent < 30;
            const doorOpen = station.hardwareState.cabinetDoorSensor === "OPEN";

            return (
              <div
                key={station._id}
                className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:border-primary/50 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-lg ${
                          isAED ? "bg-rose-500/15 text-rose-500" : "bg-blue-500/15 text-blue-500"
                        }`}
                      >
                        {isAED ? <Heart className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base leading-snug">{station.name}</h3>
                        <span className="text-xs font-mono text-muted-foreground">{station.code}</span>
                      </div>
                    </div>
                    <Tag
                      variant={
                        station.status === "ACTIVE"
                          ? "emerald"
                          : station.status === "MAINTENANCE"
                          ? "amber"
                          : station.status === "IN_USE"
                          ? "rose"
                          : "zinc"
                      }
                    >
                      {station.status}
                    </Tag>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{station.location.address}</span>
                    </div>
                    {station.location.buildingName && (
                      <div className="text-[11px] text-muted-foreground/80 pl-5">
                        Tòa nhà: {station.location.buildingName} - {station.location.floor || "Tầng 1"}
                      </div>
                    )}
                    {station.location.accessNotes && (
                      <div className="text-[11px] text-muted-foreground/80 pl-5 italic">
                        Ghi chú: {station.location.accessNotes}
                      </div>
                    )}
                  </div>

                  {/* Hardware Telemetry Bar */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-center text-xs">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <BatteryCharging className={`h-3 w-3 ${batteryLow ? "text-rose-500" : "text-emerald-500"}`} />
                        <span>Pin</span>
                      </div>
                      <div className={`mt-0.5 font-bold ${batteryLow ? "text-rose-500" : "text-foreground"}`}>
                        {station.hardwareState.batteryLevelPercent}%
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        {doorOpen ? (
                          <DoorOpen className="h-3 w-3 text-amber-500" />
                        ) : (
                          <DoorClosed className="h-3 w-3 text-emerald-500" />
                        )}
                        <span>Cửa Tủ</span>
                      </div>
                      <div className={`mt-0.5 font-semibold ${doorOpen ? "text-amber-500" : "text-emerald-500"}`}>
                        {doorOpen ? "MỞ CỬA" : "ĐÓNG"}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Mở Cửa</span>
                      </div>
                      <div className="mt-0.5 font-semibold text-foreground">
                        {station.operationalHours.is24x7 ? "24/7" : "Giờ HC"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-muted-foreground">
                    Khóa: <span className="font-mono">{station.unlockMechanism.type}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedStation(station);
                        setUnlockResult(null);
                        setUnlockModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Mã Mở Tủ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredStations.length === 0 && !isLoading && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">Không tìm thấy trạm cứu hộ phù hợp</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Vui lòng thử điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm.
            </p>
          </div>
        )}
      </main>

      {/* Emergency Unlock Modal */}
      {unlockModalOpen && selectedStation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                  <Unlock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Mở Khóa Khẩn Cấp SafePoint</h3>
                  <p className="text-xs text-muted-foreground">
                    Trạm: <span className="font-semibold text-foreground">{selectedStation.name}</span> ({selectedStation.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUnlockModalOpen(false);
                  setUnlockResult(null);
                }}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div><span className="font-semibold">Vị trí:</span> {selectedStation.location.address}</div>
                {selectedStation.location.buildingName && (
                  <div><span className="font-semibold">Chi tiết:</span> {selectedStation.location.buildingName} - {selectedStation.location.floor}</div>
                )}
                <div><span className="font-semibold">Cơ chế mở:</span> {selectedStation.unlockMechanism.type}</div>
              </div>

              {!unlockResult ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Mã Điều phối viên / Hiệp sĩ yêu cầu</label>
                    <input
                      type="text"
                      value={rescuerIdInput}
                      onChange={(e) => setRescuerIdInput(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Mục đích mở tủ cấp cứu</label>
                    <textarea
                      rows={2}
                      value={purposeInput}
                      onChange={(e) => setPurposeInput(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setUnlockModalOpen(false)}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={() => unlockMutation.mutate(selectedStation._id)}
                      disabled={unlockMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shadow-sm"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {unlockMutation.isPending ? "Đang tạo mã..." : "Kích Hoạt Sinh Mã OTP"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                      Mã Mở Khóa Khẩn Cấp (TOTP)
                    </span>
                    <div className="mt-2 font-mono text-4xl font-extrabold tracking-widest text-rose-500">
                      {unlockResult.otp}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Hiệu lực trong <span className="font-semibold text-foreground">{unlockResult.validSeconds} giây</span> (Hết hạn lúc {new Date(unlockResult.expiresAt).toLocaleTimeString("vi-VN")})
                    </div>
                  </div>

                  <div className="text-left text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg">
                    <div className="font-semibold text-foreground mb-1">Hướng dẫn cho người tiếp cận tủ:</div>
                    <div>{unlockResult.instructions}</div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() =>
                        confirmUnlockMutation.mutate({
                          id: selectedStation._id,
                          otp: unlockResult.otp,
                        })
                      }
                      disabled={confirmUnlockMutation.isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Xác Nhận Đã Mở Tủ Thành Công
                    </button>
                    <button
                      onClick={() => {
                        setUnlockModalOpen(false);
                        setUnlockResult(null);
                      }}
                      className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
