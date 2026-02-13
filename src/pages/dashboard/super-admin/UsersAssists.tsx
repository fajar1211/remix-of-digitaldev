import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  if (s === "inactive") return "nonactive";
  if (s === "") return "pending";
  return s;
};

const getAccountStatus = (row: Pick<AccountRow, "role" | "paymentActive" | "accountStatus">) => {
  const role = normalizeRole(row.role);
  if (role !== "assistant" && row.paymentActive) return "active";
  const s = normalizeAccountStatus(row.accountStatus);
  if (role === "assistant") {
    if (s === "active" || s === "pending" || s === "nonactive") return s;
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

const canLoginAs = (role: string) => normalizeRole(role) !== "super_admin";

export default function SuperAdminUsersAssists() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [activeTab, setActiveTab] = useState("user");

  // Expired confirmation dialog state
  const [expireTarget, setExpireTarget] = useState<AccountRow | null>(null);

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

  const filteredByRole = useMemo(() => {
    return rows.filter((r) => {
      const role = normalizeRole(r.role);
      if (activeTab === "user") return role === "user";
      if (activeTab === "assistant") return role === "assistant";
      if (activeTab === "admin") return role === "admin";
      if (activeTab === "super_admin") return role === "super_admin";
      return true;
    });
  }, [rows, activeTab]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredByRole].sort((a, b) => {
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
  }, [filteredByRole, sortDir, sortKey]);

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

  const handleSetExpired = async () => {
    if (!expireTarget) return;
    try {
      const now = new Date().toISOString();
      // 1) Update profile status
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: "expired" as any, payment_active: false, updated_at: now })
        .eq("id", expireTarget.id);
      if (error) throw error;

      // 2) Update user_packages.expires_at to now for the user's latest package
      const { error: pkgError } = await supabase
        .from("user_packages")
        .update({ expires_at: now } as any)
        .eq("user_id", expireTarget.id)
        .in("status", ["active", "pending", "approved"]);
      if (pkgError) console.warn("Failed to update user_packages.expires_at:", pkgError);

      toast.success(`${expireTarget.name || expireTarget.email} marked as Expired`);
      setExpireTarget(null);
      fetchAccounts();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update status");
    }
  };

  const roleCounts = useMemo(() => {
    const counts = { user: 0, assistant: 0, admin: 0, super_admin: 0 };
    for (const r of rows) {
      const role = normalizeRole(r.role);
      if (role in counts) counts[role as keyof typeof counts]++;
    }
    return counts;
  }, [rows]);

  const renderSortableHead = (key: SortKey, label: string) => (
    <TableHead>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-2 hover:underline"
      >
        {label}
        {sortKey === key ? <span className="text-xs">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </TableHead>
  );

  const renderTable = (showExpireAction: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          {renderSortableHead("name", "Name")}
          {renderSortableHead("email", "Email")}
          {renderSortableHead("account_status", "Status")}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground">
              No accounts found.
            </TableCell>
          </TableRow>
        ) : (
          sorted.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.email}</TableCell>
              <TableCell>{renderStatusBadge(getAccountStatus(r), r.role)}</TableCell>
              <TableCell className="text-right space-x-2">
                {showExpireAction && getAccountStatus(r) !== "expired" && (
                  <Button size="sm" variant="destructive" onClick={() => setExpireTarget(r)}>
                    Set Expired
                  </Button>
                )}
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
  );

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
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading accounts...</p>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="user">User ({roleCounts.user})</TabsTrigger>
                <TabsTrigger value="assistant">Assistant ({roleCounts.assistant})</TabsTrigger>
                <TabsTrigger value="admin">Admin ({roleCounts.admin})</TabsTrigger>
                <TabsTrigger value="super_admin">Super Admin ({roleCounts.super_admin})</TabsTrigger>
              </TabsList>

              <TabsContent value="user">{renderTable(true)}</TabsContent>
              <TabsContent value="assistant">{renderTable(false)}</TabsContent>
              <TabsContent value="admin">{renderTable(false)}</TabsContent>
              <TabsContent value="super_admin">{renderTable(false)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Confirm Expired Dialog */}
      <AlertDialog open={!!expireTarget} onOpenChange={(open) => !open && setExpireTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set account as Expired?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark <strong>{expireTarget?.name || expireTarget?.email}</strong> as Expired?
              This will deactivate their payment status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetExpired}>Yes, Set Expired</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
