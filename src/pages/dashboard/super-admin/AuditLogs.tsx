import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCcw, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string;
  provider: string;
  action: string;
  metadata: Record<string, any>;
};

function formatTime(v: unknown) {
  const s = typeof v === "string" ? v : null;
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

export default function SuperAdminAuditLogs() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<AuditLogRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("super_admin_audit_logs")
        .select("id,created_at,actor_user_id,provider,action,metadata")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems((data as AuditLogRow[]) ?? []);
    } catch (e: any) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("super_admin_audit_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Catatan aktivitas order dan aksi penting lainnya.</p>
        </div>

        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Logs ({items.length})</CardTitle>
          {loading ? <span className="text-sm text-muted-foreground">Memuat…</span> : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(it.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{it.provider}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{it.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {it.actor_user_id}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSelectedItem(it)}
                        title="Read"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus log ini?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Log ini akan dihapus permanen dan tidak bisa dikembalikan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(it.id)}>Hapus</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Belum ada audit log.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Read Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Audit Log</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2">
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-24 shrink-0">Waktu</span>
                  <span>{formatTime(selectedItem.created_at)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-24 shrink-0">Provider</span>
                  <Badge variant="outline">{selectedItem.provider}</Badge>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-24 shrink-0">Action</span>
                  <span className="font-medium">{selectedItem.action}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground w-24 shrink-0">Actor ID</span>
                  <span className="break-all">{selectedItem.actor_user_id}</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-2">Metadata</p>
                <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedItem.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
