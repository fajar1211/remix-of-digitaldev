import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
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
import { AssistantActions } from "@/pages/dashboard/admin/assistants/AssistantActions";
import { formatAssistStatusLabel } from "@/lib/assistStatus";
import { QuickCreateAccountDialog } from "./components/QuickCreateAccountDialog";

type AssistantRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  status: string | null;
  assistId: string;
};

export default function AdminAssistants() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AssistantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAssistants();
  }, []);

  const formatAssistId = (userId: string) => {
    const idNum = (parseInt(userId.slice(-4), 16) % 900) + 100;
    return `A${String(idNum).padStart(5, "0")}`;
  };

  const fetchAssistants = async () => {
    try {
      setLoading(true);

      const { data: assistRoles, error: rolesError } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("role", "assist");

      if (rolesError) throw rolesError;

      const assistIds = (assistRoles as any[])?.map((r) => r.user_id) ?? [];

      if (assistIds.length === 0) {
        setRows([]);
        return;
      }

      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles")
        .select("id, name, email, phone, country, account_status")
        .in("id", assistIds)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const nextRows: AssistantRow[] = ((profiles as any[]) ?? []).map((p) => ({
        ...p,
        status: (p as any).account_status ?? null,
        assistId: formatAssistId(p.id),
      }));

      setRows(nextRows);
    } catch (error) {
      console.error("Error fetching assistants:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const formatStatusLabel = (status: string | null) => formatAssistStatusLabel(status);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Assistants</h1>
          <p className="text-sm text-muted-foreground">View and manage marketing assistant accounts.</p>
        </div>

        <QuickCreateAccountDialog
          title="Add New Assistant"
          description="Create an ASSIST account (email + password). The user will be auto-confirmed."
          functionName="admin-create-assistant"
          onCreated={() => void fetchAssistants()}
          triggerContent={
            <span className="inline-flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add New Assistant
            </span>
          }
        />
      </header>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Assistant Accounts</CardTitle>
          <p className="text-xs text-muted-foreground">
            This list shows users with the <span className="font-medium">assist</span> role.
          </p>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading assistants...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assistant ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No assistants found.
                      </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.assistId}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.email}</TableCell>
                      <TableCell className="text-muted-foreground">{row.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{row.country ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatStatusLabel(row.status)}</TableCell>
                      <TableCell className="text-center">
                        <AssistantActions
                          userId={row.id}
                          email={row.email}
                          status={row.status}
                          onDeleted={() => void fetchAssistants()}
                          onUpdated={() => void fetchAssistants()}
                          onView={() => navigate(`/dashboard/admin/assistants/${row.id}`)}
                        />
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
