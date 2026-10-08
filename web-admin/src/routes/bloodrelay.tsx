import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Droplets,
  Heart,
  Hospital,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import {
  fetchActiveBloodRelays,
  createBloodRelayRequest,
  acceptBloodRelayRequest,
  fulfillBloodRelayRequest,
  type BloodRelayItem,
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
      setFeedbackNotice(`Đã phát lệnh điều phối máu hiếm khẩn cấp: ${res.data.requestCode}`);
      void queryClient.invalidateQueries({ queryKey: ["blood-relays-active"] });
    },
    onError: (err: any) => {
      setFeedbackNotice(`Lỗi tạo yêu cầu: ${err.message}`);
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
      setFeedbackNotice("Đã ghi nhận hoàn tất ca tiếp nhận máu thành công!");
      void queryClient.invalidateQueries({ queryKey: ["blood-relays-active"] });
    },
  });

  const requests = bloodRelaysData?.data || [];

  const extremeCount = requests.filter((r) => r.urgencyLevel === "EXTREME_IMMEDIATE").length;
  const pendingCount = requests.filter((r) => r.status === "PENDING_DONORS").length;
  const fulfilledCount = requests.filter((r) => r.status === "DELIVERED_AND_FULFILLED").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <Topbar title="Trung Tâm Điều Phối Máu Hiếm SafeBlood Khẩn Cấp" />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Báo Động Cực Khẩn (Tức Thì)</span>
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chờ Người Hiến Ghép Cặp</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-500">{pendingCount}</span>
              <span className="text-xs text-muted-foreground">Đang quét hiệp sĩ nhóm máu hiếm</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đã Hoàn Tất Truyền Máu</span>
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
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
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
                        {item.targetBloodGroup.replace("_", " ")}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Nhận từ: {item.compatibleBloodGroups?.map((g) => g.replace("_", " ")).join(", ")}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <Tag
                        variant={
                          item.urgencyLevel === "EXTREME_IMMEDIATE"
                            ? "rose"
                            : item.urgencyLevel === "URGENT_1_HOUR"
                            ? "amber"
                            : "blue"
                        }
                      >
                        {item.urgencyLevel === "EXTREME_IMMEDIATE" ? "CỰC KHẨN (TỨC THÌ)" : item.urgencyLevel}
                      </Tag>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-foreground">{item.hospitalLocation.hospitalName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[200px]">{item.hospitalLocation.address}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{item.hospitalLocation.contactPhone}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-bold text-foreground">
                      {item.unitsRequired} đơn vị (250ml)
                    </td>

                    <td className="px-4 py-3.5">
                      {acceptedDonors.length > 0 ? (
                        <div className="space-y-1">
                          {acceptedDonors.map((d, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                              <UserCheck className="h-3 w-3 shrink-0" />
                              <span>{d.donorName || "Hiệp sĩ " + d.donorId.substring(0, 6)}</span>
                              {d.etaMinutes && <span className="text-[10px] text-muted-foreground">(ETA {d.etaMinutes}p)</span>}
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

                    <td className="px-4 py-3.5 text-right">
                      {item.status !== "DELIVERED_AND_FULFILLED" && (
                        <button
                          onClick={() => {
                            setSelectedRelay(item);
                            setFulfillModalOpen(true);
                          }}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                        >
                          Xác Nhận Đã Nhận Máu
                        </button>
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
                    Hệ thống sẽ lập tức kích hoạt thông báo PUSH tới toàn bộ Hiệp sĩ có nhóm máu phù hợp.
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
                  <option value="EXTREME_IMMEDIATE">EXTREME_IMMEDIATE (Sốc đe dọa sinh mạng - Tức thì)</option>
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
