import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Shield,
  Phone,
  Clock3,
  MapPinned,
  Download,
  BadgeCheck,
  ShieldCheck,
  Award,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Send,
} from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchAdminUsers, pingUserCheckin, escalateUserGuardian, type AdminUser } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [{ title: "Người dùng ứng dụng - SafeSolo Admin" }],
  }),
  component: UsersPage,
});

function UsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "HERO" | "USER">("ALL");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
    refetchInterval: 15000,
  });

  const pingCheckinMutation = useMutation({
    mutationFn: (userId: string) => pingUserCheckin(userId),
    onSuccess: (res) => {
      setActionNotice(res.data.message || "Đã gửi lời nhắc check-in 1-tap qua Telegram Bot!");
      setTimeout(() => setActionNotice(null), 3500);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const escalateGuardianMutation = useMutation({
    mutationFn: (userId: string) => escalateUserGuardian(userId),
    onSuccess: (res) => {
      setActionNotice(res.data.message || "Đã kích hoạt báo động khẩn cấp tới danh sách Guardian!");
      setTimeout(() => setActionNotice(null), 3500);
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = usersQuery.data?.data ?? [];
  const heroesCount = useMemo(() => users.filter((u) => u.role === "hero").length, [users]);
  const regularCount = useMemo(() => users.filter((u) => u.role !== "hero").length, [users]);

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter === "HERO") {
      result = result.filter((u) => u.role === "hero");
    } else if (roleFilter === "USER") {
      result = result.filter((u) => u.role !== "hero");
    }

    const q = query.trim().toLowerCase();
    if (!q) {
      return result;
    }
    return result.filter((user) => {
      const haystack = `${user.fullName} ${user.phone} ${user.currentStatus} ${user.role}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, users, roleFilter]);

  const selected = filtered.find((item) => item.id === selectedUserId) ?? filtered[0] ?? null;

  const handleExport = () => {
    exportWorkbook("safesolo-admin-users.xlsx", [
      {
        name: "Người dùng",
        rows: filtered.map((user) => ({
          ID: user.id,
          "Họ tên": user.fullName,
          Email: user.email,
          "Số điện thoại": user.phone,
          Nguồn: formatSource(user.source),
          "Vai trò": formatRole(user),
          "Trạng thái": formatStatus(user.currentStatus),
          "Chu kỳ check-in (phút)": user.timerIntervalMinutes,
          "Quiet hours bắt đầu": user.quietHoursStart,
          "Quiet hours kết thúc": user.quietHoursEnd,
          "False alert grace (phút)": user.falseAlertGraceMinutes,
          "Check-in cuối": user.lastCheckInAt,
          "Deadline tiếp theo": user.nextCheckinDeadline,
          "Cập nhật cuối": user.updatedAt,
          "Tạo lúc": user.createdAt,
          "Guardian / liên hệ khẩn cấp": user.emergencyContacts
            .map((contact) => `${contact.name} - ${contact.relation} - ${contact.phone}`)
            .join(" | "),
        })),
      },
    ]);
  };

  return (
    <>
      <Topbar
        title="Người dùng ứng dụng"
        subtitle="Dữ liệu người dùng & hiệp sĩ SafeSolo đồng bộ trực tiếp từ MongoDB"
      />
      <div className="p-3 pb-0">
        {actionNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/40 p-3 text-xs font-semibold text-sky-300 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
            {actionNotice}
          </div>
        )}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Danh sách người dùng & Hiệp sĩ</h2>
              <p className="text-[11px] text-muted-foreground">
                Hiển thị {filtered.length} / {users.length} hồ sơ thực tế
              </p>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, số điện thoại, trạng thái"
                className="w-72 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Xuất Excel
            </button>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background/30 px-4 py-2 text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter("ALL")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                roleFilter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Tất cả ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("HERO")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                roleFilter === "HERO"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              Hiệp sĩ đã xác minh ({heroesCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("USER")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                roleFilter === "USER"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              Người dùng cần bảo vệ ({regularCount})
            </button>
          </div>

          {usersQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Đang tải danh sách người dùng...</div>
          ) : usersQuery.isError ? (
            <div className="p-4 text-sm text-sos">{usersQuery.error.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Họ tên & Vai trò</th>
                    <th className="px-4 py-2 text-left font-medium">Nguồn</th>
                    <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
                    <th className="px-4 py-2 text-left font-medium">Chu kỳ</th>
                    <th className="px-4 py-2 text-left font-medium">Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`cursor-pointer border-t border-border transition ${
                        selected?.id === user.id ? "bg-info/5" : "hover:bg-accent/30"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {user.fullName}
                            {user.role === "hero" && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                <BadgeCheck className="h-3 w-3 text-emerald-400" /> Hiệp sĩ
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{user.phone || "Chưa có số điện thoại"}</span>
                            {user.role === "hero" && (
                              <span className="text-amber-400 font-medium">
                                ⭐ {user.trustScore ?? 4.9} ({user.rescuesCount ?? 0} cứu hộ)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Tag tone="info">{formatSource(user.source)}</Tag>
                      </td>
                      <td className="px-4 py-3">
                        <Tag tone={statusTone(user.currentStatus)}>{formatStatus(user.currentStatus)}</Tag>
                      </td>
                      <td className="px-4 py-3">{Math.round(user.timerIntervalMinutes / 60)} giờ</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(user.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {selected ? (
            <>
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      {selected.fullName}
                      {selected.role === "hero" && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          HIỆP SĨ SAFESOLO
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.id} · {formatRole(selected)}
                    </p>
                  </div>
                  <Tag tone={statusTone(selected.currentStatus)}>{formatStatus(selected.currentStatus)}</Tag>
                </div>
              </div>

              {/* Hero Specific Credentials Panel */}
              {selected.role === "hero" && (
                <div className="mx-4 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Hồ sơ Hiệp sĩ phản ứng nhanh (Cộng đồng)
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      ĐÃ XÁC THỰC
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-background/60 p-2 border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Điểm tín nhiệm</div>
                      <div className="font-bold text-amber-400 mt-0.5">⭐ {selected.trustScore ?? 4.9} / 5.0</div>
                    </div>
                    <div className="rounded-lg bg-background/60 p-2 border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Cứu hộ thành công</div>
                      <div className="font-bold text-emerald-400 mt-0.5">🏆 {selected.rescuesCount ?? 0} lượt</div>
                    </div>
                    <div className="rounded-lg bg-background/60 p-2 border border-border/60">
                      <div className="text-[10px] text-muted-foreground">Xác thực CCCD</div>
                      <div className="font-bold text-sky-400 mt-0.5">
                        {selected.isKycVerified ? "Đã duyệt KYC" : "Xác minh số ĐT"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DeadMan Switch & Check-in Protection Panel */}
              <div className="mx-4 mt-4 rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                    <Hourglass className="h-4 w-4 text-sky-400 animate-pulse" />
                    Bảo Vệ DeadMan Switch & Điểm Danh Định Kỳ
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      selected.currentStatus === "SOS"
                        ? "bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse"
                        : selected.currentStatus === "WARNING"
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {selected.currentStatus === "SOS"
                      ? "BÁO ĐỘNG SOS"
                      : selected.currentStatus === "WARNING"
                      ? "QUÁ HẠN CHECK-IN"
                      : "ĐANG AN TOÀN"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-background/60 p-2.5 border border-border/60">
                    <div className="text-[10px] text-muted-foreground">Check-in cuối</div>
                    <div className="font-semibold text-foreground mt-0.5">
                      {formatDateTime(selected.lastCheckInAt)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background/60 p-2.5 border border-border/60">
                    <div className="text-[10px] text-muted-foreground">Deadline tiếp theo</div>
                    <div className="font-semibold text-sky-400 mt-0.5">
                      {formatDateTime(selected.nextCheckinDeadline)}
                    </div>
                  </div>
                </div>

                {/* DeadMan Actions for Dispatcher */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => pingCheckinMutation.mutate(selected.id)}
                    disabled={pingCheckinMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 py-2 px-2.5 text-xs font-bold text-sky-300 transition shadow disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {pingCheckinMutation.isPending ? "Đang gửi..." : "Gửi Nhắc Nhở 1-Tap (Bot)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => escalateGuardianMutation.mutate(selected.id)}
                    disabled={escalateGuardianMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 py-2 px-2.5 text-xs font-bold text-rose-300 transition shadow disabled:opacity-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    {escalateGuardianMutation.isPending ? "Đang báo động..." : "Báo Động Guardian"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-2">
                <InfoBox icon={Phone} label="Số điện thoại" value={selected.phone || "Chưa có"} />
                <InfoBox icon={Clock3} label="Chu kỳ check-in" value={`${Math.round(selected.timerIntervalMinutes / 60)} giờ`} />
                <InfoBox
                  icon={Shield}
                  label="Quiet hours"
                  value={`${selected.quietHoursStart} - ${selected.quietHoursEnd}`}
                />
                <InfoBox
                  icon={MapPinned}
                  label="False alert grace"
                  value={`${selected.falseAlertGraceMinutes} phút`}
                />
              </div>

              <div className="border-t border-border px-4 py-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Guardian / liên hệ khẩn cấp
                </div>
                <div className="space-y-2">
                  {selected.emergencyContacts.length > 0 ? (
                    selected.emergencyContacts.map((contact) => (
                      <div
                        key={`${contact.phone}-${contact.name}`}
                        className="rounded-lg border border-border bg-background/40 px-3 py-3"
                      >
                        <div className="font-medium">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {contact.relation} · {contact.phone}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                      Chưa có guardian nào trên hồ sơ này.
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
                  <div>Check-in cuối: {formatDateTime(selected.lastCheckInAt)}</div>
                  <div>Deadline tiếp theo: {formatDateTime(selected.nextCheckinDeadline)}</div>
                  <div>Tạo lúc: {formatDateTime(selected.createdAt)}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">Chưa có người dùng để hiển thị.</div>
          )}
        </section>
      </div>
    </>
  );
}

function statusTone(status: string) {
  if (status === "SOS") return "sos";
  if (status === "WARNING" || status === "REMINDER") return "warning";
  return "info";
}

function formatSource(source: AdminUser["source"]) {
  if (source === "mongo") return "MongoDB";
  if (source === "sqlite") return "SQLite";
  return "Legacy Store";
}

function formatRole(user: AdminUser) {
  if (user.role === "hero") return "Hiệp sĩ";
  if (user.role === "admin") return "Quản trị viên";
  return "Người dùng";
}

function formatStatus(status: string) {
  if (status === "SAFE") return "An toàn";
  if (status === "REMINDER") return "Nhắc nhở";
  if (status === "WARNING") return "Cảnh báo";
  if (status === "SOS") return "SOS";
  return status;
}

function InfoBox({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Không có";
  return new Date(value).toLocaleString("vi-VN");
}
