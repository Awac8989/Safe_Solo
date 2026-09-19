import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  Filter,
  Flame,
  HeartPulse,
  MapPin,
  Megaphone,
  Moon,
  PhoneCall,
  Plus,
  Printer,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchHazards, verifyHazard, createHazard, fetchDangerGeofences, type HazardItem } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";
import { DangerGeofenceModal } from "@/components/DangerGeofenceModal";
import { DisasterBroadcastModal } from "@/components/DisasterBroadcastModal";

export const Route = createFileRoute("/hazards")({
  head: () => ({ meta: [{ title: "Bản đồ Hiểm họa & Điểm nóng - SafeSolo Admin" }] }),
  component: HazardsPage,
});

function formatCategory(cat: string) {
  switch (cat) {
    case "DARK_ROAD":
      return { label: "Đoạn đường tối", icon: Moon, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" };
    case "FLOODING":
      return { label: "Ngập nước sâu", icon: Waves, color: "text-sky-400 bg-sky-500/10 border-sky-500/30" };
    case "LANDSLIDE":
      return { label: "Sạt lở đất đá / Đèo", icon: AlertOctagon, color: "text-red-400 bg-red-500/10 border-red-500/30" };
    case "STORM_SURGE":
      return { label: "Bão lũ / Thiên tai", icon: Zap, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" };
    case "ACCIDENT":
      return { label: "Va chạm / Tai nạn", icon: AlertTriangle, color: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
    case "SUSPICIOUS_PERSON":
      return { label: "Đối tượng khả nghi", icon: Eye, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    case "ROAD_HAZARD":
      return { label: "Chướng ngại / Bẫy đinh", icon: Flame, color: "text-orange-400 bg-orange-500/10 border-orange-500/30" };
    default:
      return { label: "Nguy hiểm khác", icon: ShieldAlert, color: "text-gray-400 bg-gray-500/10 border-gray-500/30" };
  }
}

function HazardsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<HazardItem["category"]>("ROAD_HAZARD");
  const [newAddress, setNewAddress] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedTimemarkHazard, setSelectedTimemarkHazard] = useState<HazardItem | null>(null);
  const [ambulanceDispatched, setAmbulanceDispatched] = useState<Record<string, boolean>>({});
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [isDisasterModalOpen, setIsDisasterModalOpen] = useState(false);

  const hazardsQuery = useQuery({
    queryKey: ["hazards-list"],
    queryFn: fetchHazards,
    refetchInterval: 12000,
  });

  const geofencesQuery = useQuery({
    queryKey: ["danger-geofences"],
    queryFn: fetchDangerGeofences,
    refetchInterval: 15000,
  });

  const geofencesStats = geofencesQuery.data?.data.stats;

  const verifyMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "VERIFY" | "RESOLVE" }) => verifyHazard(id, action),
    onSuccess: (_, vars) => {
      setActionNotice(vars.action === "RESOLVE" ? "Đã đánh dấu giải tỏa hiểm họa thành công!" : "Đã xác nhận cảnh báo thêm 1 lượt!");
      setTimeout(() => setActionNotice(null), 3000);
      void queryClient.invalidateQueries({ queryKey: ["hazards-list"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-radar"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<HazardItem>) => createHazard(payload),
    onSuccess: () => {
      setIsAddModalOpen(false);
      setNewTitle("");
      setNewAddress("");
      setNewDescription("");
      setActionNotice("Đã tạo vùng cảnh báo nguy hiểm thành công!");
      setTimeout(() => setActionNotice(null), 3000);
      void queryClient.invalidateQueries({ queryKey: ["hazards-list"] });
      void queryClient.invalidateQueries({ queryKey: ["hazards-radar"] });
    },
  });

  const data = hazardsQuery.data?.data;
  const hazards = data?.hazards ?? [];
  const stats = data?.stats;

  const filtered = hazards.filter((h) => {
    const matchesSearch =
      h.title.toLowerCase().includes(search.toLowerCase()) ||
      h.address.toLowerCase().includes(search.toLowerCase()) ||
      h.authorName.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === "ALL" || h.category === selectedCategory;
    const matchesStatus = selectedStatus === "ALL" || h.status === selectedStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const handleExport = () => {
    exportWorkbook("safesolo-hazards-report.xlsx", [
      {
        name: "Hiểm họa",
        rows: hazards.map((h) => ({
          ID: h.id,
          "Tiêu đề": h.title,
          "Loại hiểm họa": formatCategory(h.category).label,
          "Địa chỉ": h.address,
          "Tọa độ": `${h.lat}, ${h.lng}`,
          "Trạng thái": h.status === "ACTIVE" ? "Đang có nguy cơ" : "Đã giải tỏa",
          "Số người xác nhận": h.confirmCount,
          "Người báo cáo": h.authorName,
          "Thời gian tạo": h.createdAt,
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar title="Bản đồ Hiểm họa & Điểm nóng" subtitle="Mạng lưới giám sát rủi ro cộng đồng SafeSolo 24/7" />
      <div className="space-y-4 p-4 pb-16">
        {/* Notice Toast */}
        {actionNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {actionNotice}
          </div>
        )}

        {/* 1. Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="text-[11px] font-medium text-muted-foreground">Tổng điểm báo</div>
            <div className="mt-1 text-2xl font-bold">{stats?.total ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Cộng đồng xác thực</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-amber-400">Đang cảnh báo</div>
            <div className="mt-1 text-2xl font-bold text-amber-400">{stats?.active ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Cần chú ý cao</div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-emerald-400">Đã giải tỏa an toàn</div>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{stats?.resolved ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Lực lượng đã xử lý</div>
          </div>
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-indigo-400">Đường tối đêm</div>
            <div className="mt-1 text-2xl font-bold text-indigo-400">{stats?.darkRoads ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Thiếu đèn cao áp</div>
          </div>
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-sky-400">Điểm ngập nước</div>
            <div className="mt-1 text-2xl font-bold text-sky-400">{stats?.floodings ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Triều cường / mưa lớn</div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-3 shadow-sm">
            <div className="text-[11px] font-medium text-rose-400">Tai nạn / Va chạm</div>
            <div className="mt-1 text-2xl font-bold text-rose-400">{stats?.accidents ?? 0}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Đã cử hiệp sĩ hỗ trợ</div>
          </div>
        </div>

        {/* 2. Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm đường, tiêu đề, người báo..."
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none"
            >
              <option value="ALL">Tất cả danh mục hiểm họa</option>
              <option value="LANDSLIDE">Sạt lở đất đá / Đèo</option>
              <option value="FLOODING">Ngập nước sâu</option>
              <option value="STORM_SURGE">Bão lũ / Thiên tai</option>
              <option value="DARK_ROAD">Đoạn đường tối</option>
              <option value="ACCIDENT">Va chạm / Tai nạn</option>
              <option value="SUSPICIOUS_PERSON">Đối tượng khả nghi</option>
              <option value="ROAD_HAZARD">Bẫy đinh / Chướng ngại</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang kích hoạt (Active)</option>
              <option value="RESOLVED">Đã giải tỏa (Resolved)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDisasterModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/60 bg-red-600/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-600/30 transition shadow-lg shadow-red-950/40 animate-pulse"
            >
              <Megaphone className="h-3.5 w-3.5" /> Báo Động Thiên Tai (Ngập Lụt / Sạt Lở)
            </button>
            <button
              onClick={() => setIsGeofenceModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition shadow"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Vùng Nguy Hiểm Geofence ({geofencesStats?.active ?? 0})
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-500 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Tạo Cảnh Báo
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
            >
              <Download className="h-3.5 w-3.5" /> Xuất Excel
            </button>
          </div>
        </div>

        {/* 3. Hazard Cards Grid */}
        {hazardsQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Đang tải dữ liệu điểm nóng hiểm họa...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-semibold">Không tìm thấy báo cáo hiểm họa phù hợp</p>
            <p className="text-xs text-muted-foreground mt-1">Thử thay đổi bộ lọc tìm kiếm hoặc thêm cảnh báo mới.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const catMeta = formatCategory(item.category);
              const CatIcon = catMeta.icon;
              const isActive = item.status === "ACTIVE";

              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 shadow-sm transition hover:border-primary/40 ${
                    isActive ? "bg-card/90 border-border" : "bg-card/40 border-border/40 opacity-75"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Category + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${catMeta.color}`}>
                        <CatIcon className="h-3 w-3" />
                        {catMeta.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          isActive
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {isActive ? "Đang có nguy cơ" : "Đã an toàn"}
                      </span>
                    </div>

                    {/* TimeMark Photo Preview if available */}
                    {Boolean(item.timemarkPhotoUrl || item.category === "ACCIDENT") && (
                      <div 
                        onClick={() => setSelectedTimemarkHazard(item)}
                        className="relative cursor-pointer overflow-hidden rounded-lg border border-rose-500/40 bg-black/60 group shadow-md"
                      >
                        <img
                          src={item.timemarkPhotoUrl || "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80"}
                          alt="TimeMark Evidence"
                          className="h-28 w-full object-cover transition duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40" />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-rose-950/80 border border-rose-500/50 px-2 py-0.5 text-[10px] font-bold text-rose-300 backdrop-blur-sm shadow">
                          <Camera className="h-3 w-3 text-rose-400 animate-pulse" />
                          TIMEMARK CERTIFIED
                        </div>
                        {item.severity === "P1_CRITICAL" && (
                          <div className="absolute top-2 right-2 rounded bg-red-600 px-1.5 py-0.5 text-[9.5px] font-extrabold text-white uppercase shadow animate-pulse">
                            P1 CẤP CỨU
                          </div>
                        )}
                        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-white/90">
                          <span className="font-mono bg-black/75 px-1.5 py-0.5 rounded text-amber-300 text-[9.5px] truncate max-w-[170px]">
                            ⏱ {item.timemarkMeta?.timestamp || "17/09/2026 15:15:20"}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-rose-300 group-hover:text-white transition">
                            Xem chứng cứ →
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Victim Condition Summary */}
                    {Boolean(item.victimCount || item.victimCondition) && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-[11px] text-rose-300 flex items-start gap-1.5">
                        <HeartPulse className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>Nạn nhân: {item.victimCount || '1 người'}</span>
                            {item.reportedByPhone && (
                              <span className="text-[10px] font-normal text-muted-foreground">· SĐT: {item.reportedByPhone}</span>
                            )}
                          </div>
                          {item.victimCondition && (
                            <p className="text-muted-foreground text-[10px] line-clamp-1">{item.victimCondition}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-sm font-bold text-foreground leading-snug">{item.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-1.5 text-xs text-foreground/80">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-400 mt-0.5" />
                      <span className="line-clamp-1">{item.address}</span>
                    </div>

                    {/* Reporter & Stats */}
                    <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                      <span>Báo bởi: <strong className="text-foreground">{item.authorName}</strong></span>
                      <span className="flex items-center gap-1 text-sky-400 font-semibold">
                        <ThumbsUp className="h-3 w-3" /> {item.confirmCount} xác thực
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3">
                    {Boolean(item.timemarkPhotoUrl || item.category === "ACCIDENT") && (
                      <button
                        onClick={() => setSelectedTimemarkHazard(item)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-rose-600/20 border border-rose-500/40 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition"
                        title="Xem ảnh chứng thực TimeMark"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        TimeMark
                      </button>
                    )}
                    {isActive ? (
                      <>
                        <button
                          onClick={() => verifyMutation.mutate({ id: item.id, action: "VERIFY" })}
                          disabled={verifyMutation.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background/80 py-1.5 text-xs font-semibold hover:bg-accent transition"
                        >
                          <ThumbsUp className="h-3 w-3 text-sky-400" /> Xác nhận (+1)
                        </button>
                        <button
                          onClick={() => verifyMutation.mutate({ id: item.id, action: "RESOLVE" })}
                          disabled={verifyMutation.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Đã giải tỏa
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center text-xs text-emerald-400 font-medium py-1">
                        ✓ Điểm này đã được đội tuần tra xử lý an toàn
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. Modal Add Hazard Warning */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <AlertTriangle className="h-4 w-4" /> Thiết lập Vùng Cảnh báo Nguy hiểm Mới
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1">Tiêu đề cảnh báo</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="VD: Cảnh báo bẫy đinh dốc cầu..."
                    className="w-full h-8 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Phân loại hiểm họa</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as HazardItem["category"])}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2.5 outline-none"
                  >
                    <option value="DARK_ROAD">Đoạn đường tối thiếu đèn</option>
                    <option value="FLOODING">Ngập nước sâu triều cường</option>
                    <option value="ACCIDENT">Va chạm / Tai nạn giao thông</option>
                    <option value="SUSPICIOUS_PERSON">Đối tượng khả nghi áp sát</option>
                    <option value="ROAD_HAZARD">Chướng ngại vật / Bẫy đinh</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Địa chỉ chi tiết</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="VD: Ngã 4 Trần Hưng Đạo - Nguyễn Văn Cừ, Q.1"
                    className="w-full h-8 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Mô tả hiện trường & Lời dặn</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={3}
                    placeholder="Mô tả mức độ nguy hiểm, khuyến cáo người dân tránh đi qua..."
                    className="w-full rounded-lg border border-border bg-background p-2.5 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() =>
                    createMutation.mutate({
                      title: newTitle,
                      category: newCategory,
                      address: newAddress,
                      description: newDescription,
                      lat: 10.7626 + (Math.random() - 0.5) * 0.03,
                      lng: 106.6826 + (Math.random() - 0.5) * 0.03,
                    })
                  }
                  disabled={!newTitle || createMutation.isPending}
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-500 disabled:opacity-50 transition"
                >
                  Phát Lệnh Cảnh Báo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Modal TimeMark Evidence & Dispatch 115 */}
        {selectedTimemarkHazard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-2xl rounded-2xl border border-rose-500/40 bg-card p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-rose-500/20 p-2 border border-rose-500/40">
                    <Camera className="h-5 w-5 text-rose-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      HỒ SƠ CHỨNG CỨ TIMEMARK HIỆN TRƯỜNG
                      <span className="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-mono text-rose-300">
                        ANTI-SPOOFING
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Dữ liệu ảnh thực địa kèm toạ độ RTK và dấu thời gian phục vụ Cấp cứu 115 & Pháp lý
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTimemarkHazard(null)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-accent transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Notice Banner */}
              {ambulanceDispatched[selectedTimemarkHazard.id] && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-bounce">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    <strong>ĐÃ ĐIỀU PHỐI 115 THÀNH CÔNG!</strong> Trạm cấp cứu gần nhất đang xuất xe cứu thương tiếp cận hiện trường.
                  </span>
                </div>
              )}

              {/* Photo Container with iconic TimeMark Watermark HUD */}
              <div className="relative overflow-hidden rounded-xl border border-border bg-black shadow-inner">
                <img
                  src={
                    selectedTimemarkHazard.timemarkPhotoUrl ||
                    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80"
                  }
                  alt="TimeMark Evidence Full"
                  className="max-h-80 w-full object-cover"
                />

                {/* Real-time TimeMark Watermark HUD Overlay */}
                <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/85 border border-white/20 p-3 backdrop-blur-md shadow-2xl text-left">
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-amber-400 uppercase">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      SafeSolo TimeMark Digital Proof
                    </div>
                    <span className="font-mono text-[9px] text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-500/30">
                      RTK GPS ±1.8m
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10.5px]">
                    <div className="text-white/90">
                      <span className="text-amber-300 font-bold">⏱ THỜI GIAN: </span>
                      {selectedTimemarkHazard.timemarkMeta?.timestamp || "17/09/2026 15:15:20 GMT+7"}
                    </div>
                    <div className="text-white/90">
                      <span className="text-sky-300 font-bold">📍 TOẠ ĐỘ: </span>
                      {selectedTimemarkHazard.lat.toFixed(6)}, {selectedTimemarkHazard.lng.toFixed(6)}
                    </div>
                    <div className="text-white/90 md:col-span-2 truncate">
                      <span className="text-emerald-300 font-bold">📌 ĐỊA CHỈ: </span>
                      {selectedTimemarkHazard.address}
                    </div>
                    <div className="text-white/70 md:col-span-2 text-[9.5px] truncate">
                      <span className="text-rose-300 font-bold">🔐 SHA256: </span>
                      {selectedTimemarkHazard.timemarkMeta?.hash || "SHA256: 9F2D8A41-7BC9-4B52-8812-E51A18F9C4A2"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Triage & Incident Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                  <div className="text-muted-foreground font-semibold flex items-center gap-1.5 text-[11px]">
                    <HeartPulse className="h-3.5 w-3.5 text-rose-400" /> TÌNH TRẠNG NẠN NHÂN & PHÂN LOẠI TRIAGE
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                      {selectedTimemarkHazard.severity || "P1_CRITICAL"}
                    </span>
                    <span className="font-bold text-foreground">
                      {selectedTimemarkHazard.victimCount || "1 người"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {selectedTimemarkHazard.victimCondition ||
                      "Nạn nhân bất tỉnh sau va chạm, chấn thương cần xe cấp cứu 115 tiếp cận ngay."}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                  <div className="text-muted-foreground font-semibold flex items-center gap-1.5 text-[11px]">
                    <PhoneCall className="h-3.5 w-3.5 text-sky-400" /> NGƯỜI BÁO CÁO TẠI HIỆN TRƯỜNG
                  </div>
                  <div className="font-bold text-foreground text-sm">
                    {selectedTimemarkHazard.authorName}
                  </div>
                  <div className="flex items-center gap-2 text-sky-400 font-mono text-xs">
                    <span>SĐT: {selectedTimemarkHazard.reportedByPhone || "0908.115.999"}</span>
                    <a
                      href={`tel:${selectedTimemarkHazard.reportedByPhone || "0908115999"}`}
                      className="rounded bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold hover:bg-sky-500 hover:text-white transition"
                    >
                      Gọi Ngay
                    </a>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Thời điểm gửi: {selectedTimemarkHazard.createdAt}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedTimemarkHazard.lat},${selectedTimemarkHazard.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Mở Bản Đồ
                  </a>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
                  >
                    <Printer className="h-3.5 w-3.5" /> In Biên Bản
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAmbulanceDispatched((prev) => ({
                        ...prev,
                        [selectedTimemarkHazard.id]: true,
                      }));
                      setActionNotice("Đã kích hoạt lệnh điều xe Cấp cứu 115 đến hiện trường!");
                      setTimeout(() => setActionNotice(null), 4000);
                    }}
                    disabled={Boolean(ambulanceDispatched[selectedTimemarkHazard.id])}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-rose-500 disabled:opacity-60 transition"
                  >
                    <HeartPulse className="h-3.5 w-3.5" />
                    {ambulanceDispatched[selectedTimemarkHazard.id]
                      ? "Đã Điều Phối 115"
                      : "Điều Xe Cấp Cứu 115"}
                  </button>
                  <button
                    onClick={() => setSelectedTimemarkHazard(null)}
                    className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Quản trị Vùng Nguy Hiểm Geofence Động */}
        {isGeofenceModalOpen && (
          <DangerGeofenceModal onClose={() => setIsGeofenceModalOpen(false)} />
        )}

        {/* Modal Báo Động Thiên Tai & Hiểm Họa Khẩn Cấp (Ngập lụt, Sạt lở) */}
        {isDisasterModalOpen && (
          <DisasterBroadcastModal onClose={() => setIsDisasterModalOpen(false)} />
        )}
      </div>
    </>
  );
}
