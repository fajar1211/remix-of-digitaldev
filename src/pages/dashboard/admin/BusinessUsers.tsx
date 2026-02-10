import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { BusinessUserActions } from "./business-users/BusinessUserActions";
import { invokeWithAuth } from "@/lib/invokeWithAuth";
import { QuickCreateAccountDialog } from "./components/QuickCreateAccountDialog";

 type BusinessStatus = "pending" | "approved" | "active" | "suspended" | "expired";

type BusinessPackage =
  | "starter"
  | "growth"
  | "pro"
  | "optimize"
  | "scale"
  | "dominate"
  | "custom";

type BusinessAccountRow = {
  userId: string;
  businessId: string;
  businessName: string;
  email: string;
  phone: string;
    status: BusinessStatus;
  package: BusinessPackage;
  paymentActive: boolean;
  expiresAt: string | null;
};

const statusLabel: Record<BusinessStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  active: "Active",
  suspended: "Suspended",
  expired: "Expired",
};

const mapDbAccountStatusToUi = (status: unknown, paymentActive: boolean): BusinessStatus => {
  // payment_active=true always means Active access, regardless of intermediate states.
  if (paymentActive) return "active";
  const s = String(status ?? "pending").toLowerCase().trim();
  if (s === "pending") return "pending";
  if (s === "approved") return "approved";
  if (s === "expired") return "expired";
  // Back-compat for old enum values
  if (s === "nonactive" || s === "blacklisted" || s === "suspended") return "suspended";
  if (s === "active") return "active";
  return "pending";
};

const mapDbPackageToUi = (pkgType: unknown): BusinessPackage => {
  const p = String(pkgType ?? "").toLowerCase();
  if (p === "starter") return "starter";
  if (p === "growth") return "growth";
  if (p === "pro") return "pro";
  // DB also has: website, monthly
  return "custom";
};

const formatDateSafe = (value: unknown): string | null => {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "dd MMM yyyy");
};

export default function AdminBusinessUsers() {
  const navigate = useNavigate();
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [rows, setRows] = useState<BusinessAccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchBusinessUsers();
  }, []);

  const fetchBusinessUsers = async () => {
    try {
      setLoading(true);

      // Ensure account statuses are kept in sync with package expiry.
      // This updates the database (profiles) when an Active account has passed expires_at.
      // Non-blocking: if it fails, we still load the table.
      try {
        await invokeWithAuth("admin-expire-accounts", {});
      } catch (e) {
        console.warn("admin-expire-accounts failed:", e);
      }

      // 1) get all user ids
      const { data: userRoles, error: rolesError } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("role", "user");

      if (rolesError) throw rolesError;

      const userIds: string[] = ((userRoles as any[]) ?? []).map((r) => r.user_id).filter(Boolean);
      if (userIds.length === 0) {
        setRows([]);
        return;
      }

      // 2) fetch profiles for email/name/phone/status
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles")
        .select("id, name, email, phone, account_status, payment_active")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // 3) fetch businesses for business_name + business_number
      const { data: businesses, error: businessesError } = await (supabase as any)
        .from("businesses")
        .select("id, user_id, business_name, business_number")
        .in("user_id", userIds);

      if (businessesError) throw businessesError;

      // 4) fetch active package per user (if any)
      const { data: userPackages, error: packagesError } = await (supabase as any)
        .from("user_packages")
        .select("user_id, status, expires_at, created_at, package:packages(type)")
        .in("user_id", userIds);

      if (packagesError) throw packagesError;

      const businessByUserId = new Map<string, any>();
      (businesses as any[] | null)?.forEach((b) => {
        if (b?.user_id) businessByUserId.set(b.user_id, b);
      });

      const packageByUserId = new Map<string, BusinessPackage>();
      const expiresAtByUserId = new Map<string, string | null>();
      const latestPkgCreatedAtByUserId = new Map<string, number>();

      (userPackages as any[] | null)?.forEach((up) => {
        if (!up?.user_id) return;

        // Choose the latest package row per user (by created_at when available).
        const userId = String(up.user_id);
        const nextCreatedAt = up?.created_at ? new Date(String(up.created_at)).getTime() : 0;
        const prevCreatedAt = latestPkgCreatedAtByUserId.get(userId) ?? 0;
        const shouldReplace = nextCreatedAt >= prevCreatedAt;

        if (shouldReplace) {
          const pkgType = up?.package?.type;
          packageByUserId.set(userId, mapDbPackageToUi(pkgType));
          expiresAtByUserId.set(userId, formatDateSafe(up?.expires_at));
          latestPkgCreatedAtByUserId.set(userId, nextCreatedAt);
        }
      });

      const nextRows: BusinessAccountRow[] = ((profiles as any[]) ?? []).map((p) => {
        const b = businessByUserId.get(p.id);
        const businessNumber = b?.business_number as number | null | undefined;
        const businessId = businessNumber ? `B${String(businessNumber).padStart(5, "0")}` : "—";

        // IMPORTANT: payment_active must default to false for new/uninitialized rows,
        // otherwise newly created accounts look Active and show full Actions.
        const paymentActive = Boolean(p?.payment_active ?? false);

        return {
          userId: p.id,
          businessId,
          businessName: b?.business_name || "—",
          email: p?.email || "—",
          phone: p?.phone || "—",
          status: mapDbAccountStatusToUi(p?.account_status, paymentActive),
          package: packageByUserId.get(p.id) ?? "custom",
          paymentActive,
          expiresAt: expiresAtByUserId.get(p.id) ?? null,
        };
      });

      setRows(nextRows);
    } catch (error) {
      console.error("Error fetching business users:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesPackage = packageFilter === "all" || row.package.toLowerCase() === packageFilter.toLowerCase();
      const matchesStatus = statusFilter === "all" || row.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesPackage && matchesStatus;
    });
  }, [packageFilter, rows, statusFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Business Accounts</h1>
          <p className="text-sm text-muted-foreground">Read-only view of business accounts.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <QuickCreateAccountDialog
            title="Add New Business"
            description="Create a USER account (email + password). The user will be auto-confirmed."
            functionName="admin-create-user"
            onCreated={() => void fetchBusinessUsers()}
            triggerContent={
              <span className="inline-flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Add New Business
              </span>
            }
          />
        </div>
      </header>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Business Accounts</CardTitle>
              <p className="text-xs text-muted-foreground">
                Filters on this page are based on <span className="font-medium">packages</span> and{" "}
                <span className="font-medium">status</span>.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="optimize">Optimize</SelectItem>
                  <SelectItem value="scale">Scale</SelectItem>
                  <SelectItem value="dominate">Dominate</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading business accounts...</div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto lg:overflow-visible">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px] lg:min-w-0">Business ID</TableHead>
                      <TableHead className="min-w-[150px] lg:min-w-0">Business Name</TableHead>
                      <TableHead className="min-w-[180px] lg:min-w-0">Email</TableHead>
                      <TableHead className="min-w-[100px] lg:min-w-0">Status</TableHead>
                      <TableHead className="min-w-[140px] lg:min-w-0">Expired</TableHead>
                      <TableHead className="text-center min-w-[220px] lg:min-w-0">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No businesses found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((row) => (
                        <TableRow key={`${row.businessId}-${row.email}`}>
                          <TableCell className="font-medium">{row.businessId}</TableCell>
                          <TableCell className="font-medium">{row.businessName}</TableCell>
                          <TableCell className="text-muted-foreground">{row.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{statusLabel[row.status]}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.expiresAt ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <BusinessUserActions
                              userId={row.userId}
                              email={row.email}
                              paymentActive={row.paymentActive}
                              accountStatus={row.status}
                              onUpdated={fetchBusinessUsers}
                              onDeleted={fetchBusinessUsers}
                              onView={() => navigate(`/dashboard/admin/business-users/${row.userId}`)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Pending:</span> New registration
                </div>
                <div>
                  <span className="font-medium">Approved:</span> Payment completed (requires activation)
                </div>
                <div>
                  <span className="font-medium">Active:</span> Account active based on selected package
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
