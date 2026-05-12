import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Shield, Phone, Clock3, MapPinned, Download, BadgeCheck } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Tag } from "@/components/Badge";
import { fetchAdminUsers, type AdminUser } from "@/lib/api";
import { exportWorkbook } from "@/lib/excel";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [{ title: "Người dùng ứng dụng - SafeSolo Admin" }],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
    refetchInterval: 15000,
  });

  const users = usersQuery.data?.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return users;
    }
    return users.filter((user) => {
      const haystack = `${user.fullName} ${user.phone} ${user.currentStatus} ${user.role}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, users]);

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
        subtitle="Dữ liệu người dùng SafeSolo đồng bộ trực tiếp từ backend"
      />
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Danh sách người dùng</h2>
              <p className="text-[11px] text-muted-foreground">
                {filtered.length} / {users.length} người dùng hiện có
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

          {usersQuery.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Đang tải danh sách người dùng...</div>
          ) : usersQuery.isError ? (
            <div className="p-4 text-sm text-sos">{usersQuery.error.message}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Người dùng</th>
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
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{user.fullName}</div>
                            <div className="text-[10px] text-muted-foreground">{user.phone || "Chưa có số điện thoại"}</div>
                          </div>
                          {user.role === "hero" && (
                            <Tag tone="success">
                              <BadgeCheck className="h-3 w-3" /> Hiệp sĩ
                            </Tag>
                          )}
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
                    <h2 className="text-sm font-semibold">{selected.fullName}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.id} · {formatRole(selected)}
                    </p>
                  </div>
                  <Tag tone={statusTone(selected.currentStatus)}>{formatStatus(selected.currentStatus)}</Tag>
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
