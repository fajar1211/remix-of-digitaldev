import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, CheckCircle2, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

type InquiryStatus = "new" | "resolved" | "all" | (string & {});

type InquiryRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  source: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
};

function formatDateTime(input: string) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = String(status ?? "").toLowerCase();
  if (s === "resolved" || s === "done" || s === "closed") return "secondary";
  if (s === "new" || s === "open" || s === "unread") return "default";
  return "outline";
}

type InquiryTableProps = {
  rows: InquiryRow[];
  emptyLabel: string;
  onOpen: (row: InquiryRow) => void;
  selected: InquiryRow | null;
  onMarkResolved: (id: string) => void;
  onDelete: (id: string) => void;
};

function InquiryTable({ rows, emptyLabel, onOpen, selected, onMarkResolved, onDelete }: InquiryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Received</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-muted-foreground">{r.email}</TableCell>
              <TableCell className="text-muted-foreground">{r.subject}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => onOpen(r)}>
                      <Eye className="h-4 w-4" />
                      Read
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Inquiry Details</DialogTitle>
                      <DialogDescription>
                        {r.email} • {formatDateTime(r.created_at)} • source: {r.source}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium text-foreground">Subject</div>
                        <div className="text-sm text-muted-foreground">{r.subject}</div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium text-foreground">Message</div>
                        <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
                          {r.message}
                        </div>
                      </div>

                      {r.attachment_url ? (
                        <div className="flex flex-col gap-2">
                          <div className="text-sm font-medium text-foreground">Attachment</div>

                          {String(r.attachment_mime ?? "").startsWith("image/") ? (
                            <img
                              src={r.attachment_url}
                              alt={r.attachment_name || "Support attachment"}
                              className="max-h-80 w-full rounded-md border border-border object-contain bg-muted/20"
                              loading="lazy"
                            />
                          ) : null}

                          {String(r.attachment_mime ?? "") === "application/pdf" ? (
                            <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                              <iframe
                                title={r.attachment_name || "PDF attachment"}
                                src={r.attachment_url}
                                className="h-80 w-full"
                              />
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={r.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary underline underline-offset-4"
                            >
                              {r.attachment_name || "Download attachment"}
                            </a>
                            {r.attachment_size ? (
                              <span className="text-xs text-muted-foreground">{(r.attachment_size / 1024 / 1024).toFixed(2)} MB</span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-foreground">Status:</div>
                        <Badge variant={statusBadgeVariant(selected?.status ?? r.status)}>
                          {selected?.id === r.id ? selected.status : r.status}
                        </Badge>
                      </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      {(() => {
                        const currentStatus = String((selected?.id === r.id ? selected.status : r.status) ?? "")
                          .toLowerCase()
                          .trim();
                        const isResolved = currentStatus === "resolved";

                        return isResolved ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="destructive">
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the ticket from the database. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault();
                                    onDelete(r.id);
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null;
                      })()}

                      <Button
                        type="button"
                        variant="default"
                        onClick={() => onMarkResolved(r.id)}
                        disabled={
                          String((selected?.id === r.id ? selected.status : r.status)).toLowerCase() === "resolved"
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Resolved
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function AdminSupport() {
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus>("all");
  const [selected, setSelected] = useState<InquiryRow | null>(null);
  const [tab, setTab] = useState<"public" | "business" | "assistant">("public");

  const fetchInquiries = async () => {
    try {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from("website_inquiries")
        .select(
          "id, created_at, name, email, subject, message, status, source, attachment_url, attachment_name, attachment_mime, attachment_size"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const list = ((data as any[]) ?? []).map((x) => ({
        id: String(x.id),
        created_at: String(x.created_at),
        name: String(x.name ?? ""),
        email: String(x.email ?? ""),
        subject: String(x.subject ?? ""),
        message: String(x.message ?? ""),
        status: String(x.status ?? "new"),
        source: String(x.source ?? "contact"),
        attachment_url: x.attachment_url ? String(x.attachment_url) : null,
        attachment_name: x.attachment_name ? String(x.attachment_name) : null,
        attachment_mime: x.attachment_mime ? String(x.attachment_mime) : null,
        attachment_size:
          typeof x.attachment_size === "number" ? x.attachment_size : x.attachment_size ? Number(x.attachment_size) : null,
      })) as InquiryRow[];

      setRows(list);
    } catch (e) {
      console.error("Error fetching inquiries:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInquiries();

    // Keep ticket lists up to date (so Tickets Business reflects /dashboard/user/support immediately)
    const channel = supabase
      .channel("admin-support-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "website_inquiries" },
        () => void fetchInquiries()
      )
      .subscribe();

    // Fallback: if Realtime isn't enabled for this table in Supabase, still refresh periodically
    // so admins see new tickets without manually refreshing.
    const interval = window.setInterval(() => {
      void fetchInquiries();
    }, 15000);

    // Also refetch when the user returns to the tab/window
    const onFocus = () => void fetchInquiries();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    const needle = String(statusFilter).toLowerCase();
    return rows.filter((r) => String(r.status).toLowerCase() === needle);
  }, [rows, statusFilter]);

  const ticketsPublic = useMemo(() => {
    const blocked = new Set(["business_support", "assistant_support"]);
    return filtered.filter((r) => !blocked.has(String(r.source).toLowerCase()));
  }, [filtered]);

  const ticketsBusiness = useMemo(() => {
    return filtered.filter((r) => String(r.source).toLowerCase() === "business_support");
  }, [filtered]);

  const ticketsAssistant = useMemo(() => {
    return filtered.filter((r) => String(r.source).toLowerCase() === "assistant_support");
  }, [filtered]);

  const newCounts = useMemo(() => {
    const isNew = (r: InquiryRow) => String(r.status ?? "").toLowerCase() === "new";
    const isBusiness = (r: InquiryRow) => String(r.source ?? "").toLowerCase() === "business_support";
    const isAssistant = (r: InquiryRow) => String(r.source ?? "").toLowerCase() === "assistant_support";
    const isPublic = (r: InquiryRow) => !isBusiness(r) && !isAssistant(r);

    const publicCount = rows.filter((r) => isNew(r) && isPublic(r)).length;
    const businessCount = rows.filter((r) => isNew(r) && isBusiness(r)).length;
    const assistantCount = rows.filter((r) => isNew(r) && isAssistant(r)).length;

    return {
      public: publicCount,
      business: businessCount,
      assistant: assistantCount,
    };
  }, [rows]);

  const markResolved = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("website_inquiries").update({ status: "resolved" }).eq("id", id);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "resolved" } : r)));
      setSelected((prev) => (prev?.id === id ? { ...prev, status: "resolved" } : prev));

      toast({ title: "Updated", description: "Marked as resolved." });
    } catch (e) {
      console.error("Error updating inquiry status:", e);
      toast({
        title: "Failed",
        description: "Could not update status.",
        variant: "destructive",
      });
    }
  };

  const deleteInquiry = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("website_inquiries").delete().eq("id", id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelected((prev) => (prev?.id === id ? null : prev));

      toast({ title: "Deleted", description: "Ticket deleted." });
    } catch (e) {
      console.error("Error deleting inquiry:", e);
      toast({
        title: "Failed",
        description: "Could not delete ticket.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Inbox for public + business + assistant support requests.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="w-full sm:w-[220px]">
            <Select value={String(statusFilter)} onValueChange={(v) => setStatusFilter(v as InquiryStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={fetchInquiries}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Tickets</CardTitle>
          <CardDescription>Filter by ticket type and status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading inquiries...</div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              {/* Mobile/tablet: show all tabs without horizontal scrolling by wrapping into multiple rows */}
              <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1">
                <TabsTrigger value="public" className="gap-2 text-xs sm:text-sm">
                  <span>Tickets Public</span>
                  {newCounts.public > 0 ? <Badge variant="default">{newCounts.public}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="business" className="gap-2 text-xs sm:text-sm">
                  <span>Tickets Business</span>
                  {newCounts.business > 0 ? <Badge variant="default">{newCounts.business}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="assistant" className="gap-2 text-xs sm:text-sm">
                  <span>Tickets Assistant</span>
                  {newCounts.assistant > 0 ? <Badge variant="default">{newCounts.assistant}</Badge> : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="public" className="mt-4">
                <InquiryTable
                  rows={ticketsPublic}
                  emptyLabel="No public tickets."
                  onOpen={setSelected}
                  selected={selected}
                  onMarkResolved={markResolved}
                  onDelete={deleteInquiry}
                />
              </TabsContent>

              <TabsContent value="business" className="mt-4">
                <InquiryTable
                  rows={ticketsBusiness}
                  emptyLabel="No business tickets."
                  onOpen={setSelected}
                  selected={selected}
                  onMarkResolved={markResolved}
                  onDelete={deleteInquiry}
                />
              </TabsContent>

              <TabsContent value="assistant" className="mt-4">
                <InquiryTable
                  rows={ticketsAssistant}
                  emptyLabel="No assistant tickets."
                  onOpen={setSelected}
                  selected={selected}
                  onMarkResolved={markResolved}
                  onDelete={deleteInquiry}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
