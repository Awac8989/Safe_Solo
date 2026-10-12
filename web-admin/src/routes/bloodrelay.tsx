import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Droplets,
  ExternalLink,
  Heart,
  Hospital,
  MapPin,
  Phone,
  Plus,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchActiveBloodRelays,
  fetchMatchingBloodDonors,
  createBloodRelayRequest,
  acceptBloodRelayRequest,
  fulfillBloodRelayRequest,
  type BloodRelayItem,
  type MatchingDonor,
} from "@/lib/api";

export const Route = createFileRoute("/bloodrelay")({
  head: () => ({ meta: [{ title: "Điều Phối Máu Hiếm SafeBlood Relay - SafeSolo Admin" }] }),
  component: BloodRelayManagementPage,
});

function BloodRelayManagementPage() {
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedRelay, setSelectedRelay] = useState<BloodRelayItem | null>(null);
  const [fulfillModalOpen, setFulfillModalOpen] = useState(false);
  const [radarModalOpen, setRadarModalOpen] = useState(false);
  const [qrPassModalOpen, setQrPassModalOpen] = useState(false);
  const [activeDonorPass, setActiveDonorPass] = useState<{
    donorName: string;
    bloodGroup: string;
    hospitalName: string;
    address: string;
    requestCode: string;
    fastTrackCode: string;
    etaMinutes?: number;
  } | null>(null);

  const [staffNoteInput, setStaffNoteInput] = useState("Đã hoàn tất tiếp nhận 2 đơn vị máu qua ngân hàng máu bệnh viện");
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Form state for creating emergency blood request
  const [targetBloodGroup, setTargetBloodGroup] = useState<string>("O_MINUS");
  const [unitsRequired, setUnitsRequired] = useState<number>(2);
  const [urgencyLevel, setUrgencyLevel] = useState<string>("EXTREME_IMMEDIATE");
  const [hospitalName, setHospitalName] = useState("Bệnh viện Chợ Rẫy - Trung tâm Cấp cứu 115");
  const [hospitalAddress, setHospitalAddress] = useState("201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM");
  const [contactPhone, setContactPhone] = useState("02838554137");
  const [clinicalJustification, setClinicalJustification] = useState("Bệnh nhân sốc mất máu cấp do đa chấn thương giao thông, đứt động mạch đùi.");

  const { data: bloodRelaysData, isLoading, refetch } = useQuery({
    queryKey: ["blood-relays-active"],
    queryFn: () => fetchActiveBloodRelays(),
    refetchInterval: 10000,
  });

  // Query matching donors for selected relay
  const { data: radarDonorsData, isLoading: isRadarLoading } = useQuery({
    queryKey: ["blood-relay-donors", selectedRelay?._id],
    queryFn: () => (selectedRelay ? fetchMatchingBloodDonors(selectedRelay._id) : null),
    enabled: Boolean(selectedRelay && radarModalOpen),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBloodRelayRequest({
        targetBloodGroup,
        unitsRequired,
        urgencyLevel,
        hospitalLocation: {
          hospitalName,
          address: hospitalAddress,
          contactPhone,
          coordinates: [106.6598, 10.7578], // Chợ Rẫy
        },
        clinicalJustification,
      }),
    onSuccess: (res) => {
      setCreateModalOpen(false);
      setFeedbackNotice(`Đã phát lệnh điều phối máu hiếm STAT: ${res.data.requestCode} đồng thời tới Bot Telegram @SFESOLOBot & Gmail Live!`);
      void queryClient.invalidateQueries({ queryKey: ["blood-relays-active"] });
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi tạo yêu cầu: ${err.message}`);
    },
  });

  const acceptDonorMutation = useMutation({
    mutationFn: ({ requestId, donorId, etaMinutes }: { requestId: string; donorId: string; etaMinutes: number }) =>
      acceptBloodRelayRequest(requestId, { donorId, etaMinutes }),
    onSuccess: (res, vars) => {
      setRadarModalOpen(false);
      const donor = res.data.matchedDonors.find((d) => String(d.donorId) === String(vars.donorId));
      setActiveDonorPass({
        donorName: donor?.donorName || "Hiệp sĩ SafeBlood",
        bloodGroup: donor?.bloodGroup || selectedRelay?.targetBloodGroup || "O-",
        hospitalName: res.data.hospitalLocation.hospitalName,
        address: res.data.hospitalLocation.address,
        requestCode: res.data.requestCode,
        fastTrackCode: donor?.fastTrackCode || `FAST-BLOOD-${Date.now().toString().slice(-4)}`,
        etaMinutes: vars.etaMinutes,
      });
      setQrPassModalOpen(true);
      setFeedbackNotice(`Đã cấp thẻ Fast-Track QR và bắn thông báo ưu tiên tới Telegram & Email Hiệp sĩ!`);
      void queryClient.invalidateQueries({ queryKey: ["blood-relays-active"] });
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi gán hiệp sĩ: ${err.message}`);
    },
  });

  const fulfillMutation = useMutation({
    mutationFn: ({ requestId, donorId }: { requestId: string; donorId: string }) =>
      fulfillBloodRelayRequest(requestId, {
        donorId,
        hospitalStaffNote: staffNoteInput,
      }),
    onSuccess: () => {
      setFulfillModalOpen(false);
      setFeedbackNotice("Đã ghi nhận hoàn tất ca tiếp nhận máu thành công! Bệnh nhân đã qua cơn nguy kịch.");
      void queryClient.invalidateQueries({ queryKey: ["blood-relays-active"] });
    },
  });

  const requests = bloodRelaysData?.data || [];
  const extremeCount = requests.filter((r) => r.urgencyLevel === "EXTREME_IMMEDIATE" || r.urgencyLevel?.includes("IMMEDIATE")).length;
  const pendingCount = requests.filter((r) => r.status === "PENDING_DONORS" || r.status === "SEARCHING").length;
  const fulfilledCount = requests.filter((r) => r.status === "DELIVERED_AND_FULFILLED").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar title="Trung Tâm Điều Phối Máu Hiếm SafeBlood Khẩn Cấp (STAT ISBT-128)" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Live Channel Broadcast Banner */}
        <div className="rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-950/40 via-card to-card p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-500 shrink-0 animate-pulse">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Phát Thanh Điều Phối Máu Khẩn Cấp Đa Kênh Tự Động</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync 115
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mọi lệnh điều phối máu STAT đều được đẩy tức thì qua <b>Telegram Bot (@SFESOLOBot)</b> và gửi email khẩn cấp tới Viện Huyết học, Ngân hàng Máu Chợ Rẫy & các Hiệp Sĩ nhóm máu tương thích.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-muted/60 text-muted-foreground border border-border">
              SMTP: safesolocompanyvn@gmail.com
            </span>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu Cầu Đang Mở</span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <Droplets className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{requests.length}</span>
              <span className="text-xs text-muted-foreground">Lệnh điều phối hiện hữu</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Báo Động Cực Khẩn (STAT)</span>
              <div className="p-2 rounded-lg bg-rose-600/15 text-rose-500">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-500">{extremeCount}</span>
              <span className="text-xs text-rose-400 font-medium">Nguy kịch tính mạng</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đang Quét Radar Người Hiến</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-500">{pendingCount}</span>
              <span className="text-xs text-muted-foreground">Đang ghép nối hiệp sĩ tương thích</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đã Tiếp Máu An Toàn</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-500">{fulfilledCount}</span>
              <span className="text-xs text-muted-foreground">Bệnh nhân an toàn</span>
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

        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Danh Sách Lệnh Khẩn SafeBlood Relay</h2>
              <p className="text-xs text-muted-foreground">
                Tự động lọc tương thích sinh học theo chuẩn ISBT 128 và kích hoạt mạng lưới Hiệp sĩ hiến máu lân cận.
              </p>
            </div>
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
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              Phát Lệnh Điều Phối Máu Khẩn Cấp
            </button>
          </div>
        </div>

        {/* Blood Requests Table */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Mã Lệnh</th>
                <th className="px-4 py-3">Nhóm Máu Cần</th>
                <th className="px-4 py-3">Cấp Độ Khẩn</th>
                <th className="px-4 py-3">Bệnh Viện Tiếp Nhận</th>
                <th className="px-4 py-3">Số Đơn Vị</th>
                <th className="px-4 py-3">Hiệp Sĩ Đã Nhận</th>
                <th className="px-4 py-3">Trạng Thái</th>
                <th className="px-4 py-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {requests.map((item) => {
                const acceptedDonors = item.matchedDonors?.filter((d) => d.status === "ACCEPTED" || d.status === "ARRIVED" || d.status === "DONATED") || [];

                return (
                  <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">
                      {item.requestCode}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 text-rose-500 px-2 py-1 text-xs font-extrabold font-mono">
                        <Droplets className="h-3 w-3" />
                        {(item.targetBloodGroup || item.requestedBloodType || "O_MINUS").replace("_", " ")}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Tương thích: {item.compatibleBloodGroups && item.compatibleBloodGroups.length > 0
                          ? item.compatibleBloodGroups.map((g) => (g || "").replace("_", " ")).filter(Boolean).join(", ")
                          : "O-, O+"}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <Tag
                        variant={
                          item.urgencyLevel === "EXTREME_IMMEDIATE" || item.urgencyLevel?.includes("IMMEDIATE")
                            ? "rose"
                            : item.urgencyLevel === "URGENT_1_HOUR"
                            ? "amber"
                            : "blue"
                        }
                      >
                        {item.urgencyLevel === "EXTREME_IMMEDIATE" || item.urgencyLevel?.includes("IMMEDIATE")
                          ? "CỰC KHẨN (STAT 30M)"
                          : item.urgencyLevel}
                      </Tag>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-foreground">
                        {item.hospitalLocation?.hospitalName || item.hospitalName || "Bệnh viện Chợ Rẫy TP.HCM"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {item.hospitalLocation?.address || "201B Nguyễn Chí Thanh, Quận 5, TP.HCM"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{item.hospitalLocation?.contactPhone || "02838554137"}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-bold text-foreground">
                      {item.unitsRequired} đơn vị (250ml)
                    </td>

                    <td className="px-4 py-3.5">
                      {acceptedDonors.length > 0 ? (
                        <div className="space-y-1">
                          {acceptedDonors.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-1 text-xs">
                              <div className="flex items-center gap-1 text-emerald-500 font-medium">
                                <UserCheck className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[130px]">{d.donorName || "Hiệp sĩ " + d.donorId.substring(0, 6)}</span>
                                {d.etaMinutes && <span className="text-[10px] text-muted-foreground">(ETA {d.etaMinutes}p)</span>}
                              </div>
                              {d.fastTrackCode && (
                                <button
                                  onClick={() => {
                                    setActiveDonorPass({
                                      donorName: d.donorName || "Hiệp sĩ SafeBlood",
                                      bloodGroup: d.bloodGroup || item.targetBloodGroup,
                                      hospitalName: item.hospitalLocation.hospitalName,
                                      address: item.hospitalLocation.address,
                                      requestCode: item.requestCode,
                                      fastTrackCode: d.fastTrackCode,
                                      etaMinutes: d.etaMinutes,
                                    });
                                    setQrPassModalOpen(true);
                                  }}
                                  className="text-[10px] font-mono font-bold text-primary hover:underline flex items-center gap-0.5"
                                  title="Xem thẻ Fast-Track QR"
                                >
                                  <QrCode className="h-3 w-3" />
                                  QR
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Chưa có người nhận</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <Tag
                        variant={
                          item.status === "DELIVERED_AND_FULFILLED"
                            ? "emerald"
                            : item.status === "IN_TRANSIT"
                            ? "blue"
                            : item.status === "DONORS_COMMITTED"
                            ? "indigo"
                            : "amber"
                        }
                      >
                        {item.status}
                      </Tag>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {item.status !== "DELIVERED_AND_FULFILLED" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedRelay(item);
                              setRadarModalOpen(true);
                            }}
                            className="rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          >
                            <Radio className="h-3.5 w-3.5" />
                            Quét Radar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRelay(item);
                              setFulfillModalOpen(true);
                            }}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Xác Nhận Đã Nhận
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {requests.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <Droplets className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">Hiện không có lệnh điều phối máu nào</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Tất cả nhu cầu máu hiếm đã được đáp ứng hoặc chưa có bệnh viện phát lệnh.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modal Quét Radar Người Hiến Tương Thích */}
      {radarModalOpen && selectedRelay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Radio className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Radar Ghép Cặp Hiệp Sĩ Hiến Máu Tương Thích (ISBT-128)</h3>
                  <p className="text-xs text-muted-foreground">
                    Lệnh: <span className="font-mono font-bold text-foreground">{selectedRelay.requestCode}</span> | Bệnh nhân cần nhóm: <span className="font-bold text-rose-500">{selectedRelay.targetBloodGroup}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRadarModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Điểm đến tiếp nhận:</span>{" "}
                  <b>{selectedRelay.hospitalLocation.hospitalName}</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Bán kính quét:</span> <b>15 km</b>
                </div>
              </div>

              {isRadarLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <span className="mt-2 block">Đang quét vị trí và đối soát nhóm máu của các hiệp sĩ trực chiến...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {(radarDonorsData?.data || []).map((donor) => (
                    <div
                      key={donor.donorUserId}
                      className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center font-bold text-sm">
                          {donor.donorBloodType}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                            {donor.donorName}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono">
                              Trust: {donor.trustScore}%
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              Cách {donor.distanceKm} km
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              ETA ~{donor.etaMinutes} phút
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {donor.contactPhone}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          acceptDonorMutation.mutate({
                            requestId: selectedRelay._id,
                            donorId: donor.donorUserId,
                            etaMinutes: donor.etaMinutes,
                          })
                        }
                        disabled={acceptDonorMutation.isPending}
                        className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Cấp Thẻ Fast-Track
                      </button>
                    </div>
                  ))}

                  {(radarDonorsData?.data || []).length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Không tìm thấy người hiến tương thích trong bán kính trực chiến. Hãy mở rộng bán kính tìm kiếm.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Thẻ Cấp Cứu Ưu Tiên Fast-Track QR */}
      {qrPassModalOpen && activeDonorPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" />
                <span>SAFESOLO EMERGENCY BLOOD RELAY</span>
              </div>
              <button
                onClick={() => setQrPassModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 p-4 rounded-xl border border-rose-500/30 bg-gradient-to-b from-rose-950/30 to-background space-y-3">
              <span className="text-[11px] font-bold tracking-widest uppercase text-rose-400">
                THẺ ƯU TIÊN TIẾP NHẬN MÁU STAT (GREEN LANE)
              </span>

              <div className="font-mono text-2xl font-black tracking-wider text-rose-500 py-2 border-y border-rose-500/20">
                {activeDonorPass.fastTrackCode}
              </div>

              {/* QR Mockup Canvas */}
              <div className="mx-auto w-36 h-36 bg-white p-2 rounded-xl shadow-inner flex flex-col items-center justify-center">
                <QrCode className="w-28 h-28 text-black" />
                <span className="text-[8px] font-mono text-black font-bold -mt-1">SCAN AT ER GATE</span>
              </div>

              <div className="text-left text-xs space-y-1.5 text-muted-foreground pt-2">
                <div><span className="text-foreground font-semibold">Hiệp Sĩ:</span> {activeDonorPass.donorName}</div>
                <div><span className="text-foreground font-semibold">Nhóm máu hiến:</span> <span className="font-bold text-rose-500 font-mono">{activeDonorPass.bloodGroup}</span></div>
                <div><span className="text-foreground font-semibold">Điểm tiếp nhận:</span> {activeDonorPass.hospitalName}</div>
                <div><span className="text-foreground font-semibold">Địa chỉ:</span> {activeDonorPass.address}</div>
                <div><span className="text-foreground font-semibold">Lệnh cấp cứu:</span> {activeDonorPass.requestCode}</div>
              </div>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              ⚡ <i>Hiệp sĩ xuất trình thẻ này tại Cổng Cấp Cứu để được hướng dẫn đi luồng ưu tiên vào thẳng phòng lấy máu không cần lấy số chờ.</i>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold hover:bg-muted inline-flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                In Thẻ Cấp Cứu
              </button>
              <button
                onClick={() => setQrPassModalOpen(false)}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 text-xs font-semibold shadow-sm"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Phát Lệnh Máu Khẩn Cấp */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Phát Lệnh Điều Phối Máu Khẩn Cấp SafeBlood</h3>
                  <p className="text-xs text-muted-foreground">
                    Hệ thống sẽ lập tức kích hoạt thông báo đa kênh tới Telegram Bot (@SFESOLOBot) & Gmail Live.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nhóm máu bệnh nhân cần (*)</label>
                  <select
                    value={targetBloodGroup}
                    onChange={(e) => setTargetBloodGroup(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-bold text-rose-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="O_MINUS">O- (O Âm tính - Hiến toàn năng)</option>
                    <option value="O_PLUS">O+ (O Dương tính)</option>
                    <option value="A_MINUS">A- (A Âm tính - Hiếm)</option>
                    <option value="A_PLUS">A+ (A Dương tính)</option>
                    <option value="B_MINUS">B- (B Âm tính - Hiếm)</option>
                    <option value="B_PLUS">B+ (B Dương tính)</option>
                    <option value="AB_MINUS">AB- (AB Âm tính - Cực hiếm)</option>
                    <option value="AB_PLUS">AB+ (AB Dương tính)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Số đơn vị máu cần (Units)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={unitsRequired}
                    onChange={(e) => setUnitsRequired(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Mức độ khẩn cấp y tế</label>
                <select
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="EXTREME_IMMEDIATE">EXTREME_IMMEDIATE (Sốc đe dọa sinh mạng - STAT 30p)</option>
                  <option value="URGENT_1_HOUR">URGENT_1_HOUR (Cần trong 1 giờ)</option>
                  <option value="HIGH_PRIORITY_4_HOURS">HIGH_PRIORITY_4_HOURS (Ưu tiên cao - 4 giờ)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tên Bệnh Viện / Trung Tâm Cấp Cứu</label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Địa chỉ bệnh viện</label>
                    <input
                      type="text"
                      value={hospitalAddress}
                      onChange={(e) => setHospitalAddress(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Số điện thoại liên hệ trực cấp cứu</label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Lý do lâm sàng / Bệnh cảnh</label>
                <textarea
                  rows={2}
                  value={clinicalJustification}
                  onChange={(e) => setClinicalJustification(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shadow-sm"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {createMutation.isPending ? "Đang gửi lệnh..." : "Phát Lệnh Toàn Mạng Lưới"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Hoàn Tất Tiếp Máu */}
      {fulfillModalOpen && selectedRelay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Xác Nhận Đã Nhận Máu</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedRelay.requestCode}</p>
                </div>
              </div>
              <button
                onClick={() => setFulfillModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Ghi chú của Điều phối viên / Bác sĩ</label>
                <textarea
                  rows={3}
                  value={staffNoteInput}
                  onChange={(e) => setStaffNoteInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setFulfillModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    const firstDonor = selectedRelay.matchedDonors?.[0]?.donorId || "SYSTEM_DONOR";
                    fulfillMutation.mutate({
                      requestId: selectedRelay._id,
                      donorId: firstDonor,
                    });
                  }}
                  disabled={fulfillMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {fulfillMutation.isPending ? "Đang xử lý..." : "Xác Nhận Thành Công"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
