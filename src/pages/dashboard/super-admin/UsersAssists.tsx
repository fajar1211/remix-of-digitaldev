import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";
import { assistStatusBadgeVariant, formatAssistStatusLabel } from "@/lib/assistStatus";

type RoleRow = {
  user_id: string;
  role: string;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  payment_active?: boolean | null;
  account_status?: string | null;
};

type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  paymentActive: boolean;
  accountStatus: string;
};

type SortKey = "name" | "email" | "role" | "account_status";
type SortDir = "asc" | "desc";

type RoleFilter = "all" | "user" | "assistant" | "super_admin";
type StatusFilter = "all" | string;

export default function SuperAdminUsersAssists() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccountRow[]>([]);

  const [sortKey, setSortKey] = useState<SortKey>("role");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const normalizeRole = (role: string) => {
    const r = String(role ?? "").toLowerCase().trim();
    if (r === "assist") return "assistant";
    if (r === "super admin") return "super_admin";
    return r;
  };

  const formatStatusLabel = (status: string) => {
    const s = String(status ?? "").toLowerCase().trim();
    if (s === "active") return "Active";
    if (s === "approved") return "Approved";
    if (s === "pending") return "Pending";
    if (s === "suspended" || s === "inactive" || s === "nonactive" || s === "blacklisted") return "Suspended";
    if (s === "expired") return "Expired";
    if (s === "pending") return "Pending";
    return "—";
  };

  const userStatusBadgeVariant = (
    status: string,
  ): "success" | "secondary" | "warning" | "destructive" | "muted" | "outline" => {
    const s = String(status ?? "").toLowerCase().trim();
    if (s === "active") return "success";
    if (s === "approved") return "secondary";
    if (s === "pending") return "warning";
    if (s === "expired") return "muted";
    if (s === "suspended" || s === "inactive" || s === "nonactive" || s === "blacklisted") return "destructive";
    return "outline";
  };

  const normalizeAccountStatus = (status: string) => {
    const s = String(status ?? "").toLowerCase().trim();
    // Back-compat with previous values
    if (s === "inactive") return "nonactive";
    if (s === "") return "pending";
    return s;
  };

  const getAccountStatus = (row: Pick<AccountRow, "role" | "paymentActive" | "accountStatus">) => {
    const role = normalizeRole(row.role);
    // NOTE:
    // - For assistants, status should strictly follow profiles.account_status
    //   so the admin "set nonactive" action works reliably.
    // - For users, payment_active=true still implies Active access.
    if (role !== "assistant" && row.paymentActive) return "active";

    const s = normalizeAccountStatus(row.accountStatus);

    // For assistants we only care about active/nonactive/pending.
    if (role === "assistant") {
      if (s === "active" || s === "pending" || s === "nonactive") return s;
      // Treat suspended/blacklisted/expired/etc as nonactive for assistant UI.
      return "nonactive";
    }

    return s;
  };

  const renderStatusBadge = (status: string, role: string) => {
    if (normalizeRole(role) === "assistant") {
      const label = formatAssistStatusLabel(status);
      if (label === "—") return <span className="text-muted-foreground">—</span>;
      return <Badge variant={assistStatusBadgeVariant(status)}>{label}</Badge>;
    }

    const label = formatStatusLabel(status);
    if (label === "—") return <span className="text-muted-foreground">—</span>;
    return <Badge variant={userStatusBadgeVariant(status)}>{label}</Badge>;
  };

  const canLoginAs = (role: string) => {
    // Super Admin accounts should not be impersonated from this list.
    return normalizeRole(role) !== "super_admin";
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,email,payment_active,account_status")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);

      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;

      const roleByUserId = new Map<string, string>();
      (roles as RoleRow[] | null)?.forEach((r) => roleByUserId.set(String(r.user_id), String(r.role)));

      const mapped: AccountRow[] = ((profiles as ProfileRow[] | null) ?? []).map((p) => {
        const role = roleByUserId.get(String(p.id)) ?? "unknown";
        return {
          id: String(p.id),
          name: String(p.name ?? ""),
          email: String(p.email ?? ""),
          role,
          accountStatus: String((p as any).account_status ?? "pending"),
          // IMPORTANT: default must be false so new users don't appear Active.
          paymentActive: Boolean((p as any).payment_active ?? false),
        };
      });

      setRows(mapped);
    } catch (err) {
      console.error("Error fetching users/assists:", err);
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (roleFilter !== "all" && normalizeRole(r.role) !== roleFilter) return false;
      if (statusFilter !== "all") {
        const s = String(getAccountStatus(r) ?? "").toLowerCase().trim();
        if (s !== String(statusFilter).toLowerCase().trim()) return false;
      }
      return true;
    });
  }, [roleFilter, rows, statusFilter]);

  const statusOptions = useMemo(() => {
    // Build options from the current role-filtered dataset (before status filtering)
    const base = rows.filter((r) => (roleFilter === "all" ? true : normalizeRole(r.role) === roleFilter));
    const map = new Map<string, string>();

    base.forEach((r) => {
      const raw = String(getAccountStatus(r) ?? "").toLowerCase().trim();
      if (!raw) return;
      const label =
        normalizeRole(r.role) === "assistant" ? formatAssistStatusLabel(raw) : formatStatusLabel(raw);
      if (label === "—") return;
      // Keep first label found for a raw status
      if (!map.has(raw)) map.set(raw, label);
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [roleFilter, rows]);

  useEffect(() => {
    if (statusFilter === "all") return;
    const current = String(statusFilter).toLowerCase().trim();
    const exists = statusOptions.some((o) => o.value === current);
    if (!exists) setStatusFilter("all");
  }, [statusFilter, statusOptions]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const getSortValue = (row: AccountRow) => {
          if (sortKey === "account_status") {
            const status = getAccountStatus(row);
            const label =
              normalizeRole(row.role) === "assistant" ? formatAssistStatusLabel(status) : formatStatusLabel(status);
            return label.toLowerCase();
          }
        return String((row as any)[sortKey] ?? "").toLowerCase();
      };

      const av = getSortValue(a);
      const bv = getSortValue(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  };

  const openLoginAs = async (targetUserId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("super-admin-login-link", {
        body: { target_user_id: targetUserId },
      });
      if (error) throw error;

      const actionLink = (data as any)?.action_link as string | undefined;
      const redirectTo = (data as any)?.redirect_to as string | undefined;
      if (!actionLink) throw new Error("Missing action_link");
      if (!redirectTo) throw new Error("Missing redirect_to");

      // NOTE: Supabase magic-link sometimes falls back to SITE_URL (e.g. localhost) on the verify URL.
      // To ensure we land on the correct dashboard, we verify the magiclink token ourselves on a local route,
      // then redirect to the provided redirect_to.
      const token = new URL(actionLink).searchParams.get("token");
      if (!token) throw new Error("Missing token in action_link");

      const local = new URL(`${window.location.origin}/super-admin/impersonate`);
      local.searchParams.set("token", token);
      local.searchParams.set("redirect_to", redirectTo);

      window.open(local.toString(), "_blank", "noopener,noreferrer");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to generate login link");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users & Assistants</h1>
          <p className="text-muted-foreground">View all user and assistant accounts.</p>
        </div>

        <Button variant="outline" onClick={fetchAccounts} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Accounts</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:w-56">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-56">
              <Select value={String(statusFilter)} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="all">All statuses</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading accounts...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("role")}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      Role
                      {sortKey === "role" ? <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      onClick={() => toggleSort("account_status")}
                      className="inline-flex items-center gap-2 hover:underline"
                    >
                      Status
                      {sortKey === "account_status" ? (
                        <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
                      ) : null}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No accounts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell className="capitalize">{r.role.replace("_", " ")}</TableCell>
                      <TableCell>{renderStatusBadge(getAccountStatus(r), r.role)}</TableCell>
                      <TableCell className="text-right">
                        {canLoginAs(r.role) ? (
                          <Button size="sm" variant="outline" onClick={() => openLoginAs(r.id)}>
                            Login as
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
