import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchActiveBusinesses } from "@/lib/activeBusinesses";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { Trash2 } from "lucide-react";

type BusinessOption = {
  id: string;
  business_name: string | null;
  user_id: string;
};

type ReportKind = "local_insights" | "keyword_rankings" | "traffic_insights" | "conversion_insights";

const reportFields: Array<{ kind: ReportKind; label: string; placeholder: string }> = [
  {
    kind: "local_insights",
    label: "Local Insights URL",
    placeholder: "https://...",
  },
  {
    kind: "keyword_rankings",
    label: "Keyword Rankings URL",
    placeholder: "https://...",
  },
  {
    kind: "traffic_insights",
    label: "Traffic Insights URL",
    placeholder: "https://...",
  },
  {
    kind: "conversion_insights",
    label: "Conversion Insights URL",
    placeholder: "https://...",
  },
];

type DownloadableRow = {
  id: string;
  created_at: string;
  description: string | null;
  file_name: string;
  file_url: string;
};

export default function Reports() {
  const { user } = useAuth();
  const sb: any = supabase;

  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId]
  );

  const [loadingReports, setLoadingReports] = useState(false);
  const [urlsByKind, setUrlsByKind] = useState<Record<ReportKind, string>>({
    local_insights: "",
    keyword_rankings: "",
    traffic_insights: "",
    conversion_insights: "",
  });

  const [savingUrls, setSavingUrls] = useState(false);
  const [editingUrls, setEditingUrls] = useState(false);
  const [draftUrlsByKind, setDraftUrlsByKind] = useState<Record<ReportKind, string>>({
    local_insights: "",
    keyword_rankings: "",
    traffic_insights: "",
    conversion_insights: "",
  });

  const [downloadable, setDownloadable] = useState<DownloadableRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState<string>("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingBusinesses(true);
      try {
        const data = await fetchActiveBusinesses({ select: "id,business_name,user_id", orderByBusinessName: true });
        const list = (data as any as BusinessOption[]) ?? [];
        if (!cancelled) {
          setBusinesses(list);
          // Do not auto-select a client; keep placeholder until user selects.
        }
      } catch (e) {
        console.error("Failed to load businesses", e);
        if (!cancelled) setBusinesses([]);
      } finally {
        if (!cancelled) setLoadingBusinesses(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBusinessId) return;
    let cancelled = false;

    const run = async () => {
      setLoadingReports(true);
      try {
        const { data: links, error: linksError } = await supabase
          // use any-typed client because this table was added after generated TS types
          .from("business_report_links")
          .select("kind,url")
          .eq("business_id", selectedBusinessId);
        if (linksError) throw linksError;

        const { data: files, error: filesError } = await sb
          .from("downloadable_reports")
          .select("id,created_at,description,file_name,file_url")
          .eq("business_id", selectedBusinessId)
          .order("created_at", { ascending: false });
        if (filesError) throw filesError;

        const next: Record<ReportKind, string> = {
          local_insights: "",
          keyword_rankings: "",
          traffic_insights: "",
          conversion_insights: "",
        };

        (links as any[] | null)?.forEach((row) => {
          const k = row.kind as ReportKind;
          if (k in next) next[k] = String(row.url ?? "");
        });

        if (!cancelled) {
          setUrlsByKind(next);
          setDraftUrlsByKind(next);
          setEditingUrls(false);
          setDownloadable((files as any as DownloadableRow[]) ?? []);
        }
      } catch (e) {
        console.error("Failed to load reports", e);
        if (!cancelled) {
          setUrlsByKind({
            local_insights: "",
            keyword_rankings: "",
            traffic_insights: "",
            conversion_insights: "",
          });
          setDraftUrlsByKind({
            local_insights: "",
            keyword_rankings: "",
            traffic_insights: "",
            conversion_insights: "",
          });
          setEditingUrls(false);
          setDownloadable([]);
        }
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedBusinessId]);

  const saveUrls = async () => {
    if (!user?.id || !selectedBusinessId) return;
    setSavingUrls(true);
    try {
      // Upsert non-empty URLs; delete rows when field cleared.
      const upserts = reportFields
        .map((f) => {
          const url = (draftUrlsByKind[f.kind] ?? "").trim();
          return url
            ? {
                business_id: selectedBusinessId,
                kind: f.kind,
                url,
                created_by: user.id,
              }
            : null;
        })
        .filter(Boolean);

      const deletes = reportFields
        .map((f) => f.kind)
        .filter((k) => !(draftUrlsByKind[k] ?? "").trim());

      if (deletes.length > 0) {
        const { error } = await sb
          .from("business_report_links")
          .delete()
          .eq("business_id", selectedBusinessId)
          .in("kind", deletes as any);
        if (error) throw error;
      }

      if (upserts.length > 0) {
        const { error } = await sb
          .from("business_report_links")
          .upsert(upserts, { onConflict: "business_id,kind" });
        if (error) throw error;
      }

      // Commit draft -> saved view
      setUrlsByKind(draftUrlsByKind);
      setEditingUrls(false);
    } catch (e) {
      console.error("Failed to save report URLs", e);
    } finally {
      setSavingUrls(false);
    }
  };

  const startEditUrls = () => {
    setDraftUrlsByKind(urlsByKind);
    setEditingUrls(true);
  };

  const cancelEditUrls = () => {
    setDraftUrlsByKind(urlsByKind);
    setEditingUrls(false);
  };

  const uploadDownloadable = async () => {
    if (!user?.id || !selectedBusinessId || !selectedBusiness || !uploadFile) return;
    setUploading(true);
    try {
      const ownerUserId = selectedBusiness.user_id;
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${ownerUserId}/${selectedBusinessId}/downloadable-reports/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("user-files").upload(filePath, uploadFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      const description = uploadDescription.trim() || null;

      const { error: repErr } = await sb.from("downloadable_reports").insert({
        business_id: selectedBusinessId,
        file_name: uploadFile.name,
        file_url: fileUrl,
        description,
        created_by: user.id,
      });
      if (repErr) throw repErr;

      // Make file visible in /dashboard/user/gallery
      const { error: galErr } = await supabase.from("user_gallery").insert({
        user_id: ownerUserId,
        name: uploadFile.name,
        type: uploadFile.type || "application/octet-stream",
        url: fileUrl,
        size: uploadFile.size,
      });
      if (galErr) throw galErr;

      // refresh downloadable list
      const { data: files, error: filesError } = await supabase
        // use any-typed client because this table was added after generated TS types
        .from("downloadable_reports")
        .select("id,created_at,description,file_name,file_url")
        .eq("business_id", selectedBusinessId)
        .order("created_at", { ascending: false });

      if (filesError) throw filesError;

      setDownloadable((files as any as DownloadableRow[]) ?? []);
      setUploadFile(null);
      setUploadDescription("");
    } catch (e) {
      console.error("Failed to upload downloadable report", e);
    } finally {
      setUploading(false);
    }
  };

  const deleteDownloadable = async (id: string) => {
    if (!selectedBusinessId) return;
    setDeletingId(id);
    try {
      const { error } = await sb
        .from("downloadable_reports")
        .delete()
        .eq("id", id)
        .eq("business_id", selectedBusinessId);
      if (error) throw error;

      setDownloadable((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error("Failed to delete downloadable report", e);
    } finally {
      setDeletingId((cur) => (cur === id ? null : cur));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Save report URLs and downloadable files for each client business.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label>Business</Label>
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId} disabled={loadingBusinesses}>
              <SelectTrigger>
                <SelectValue placeholder={loadingBusinesses ? "Loading businesses..." : "Select client"} />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.business_name || "(Unnamed business)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedBusinessId ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Report URLs</CardTitle>
                  {!editingUrls ? (
                    <Button type="button" variant="outline" size="sm" onClick={startEditUrls} disabled={loadingReports}>
                      Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={cancelEditUrls} disabled={savingUrls}>
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={saveUrls} disabled={loadingReports || savingUrls}>
                        {savingUrls ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {reportFields.map((f) => (
                  <div key={f.kind} className="grid gap-2">
                    <Label htmlFor={`report-${f.kind}`}>{f.label}</Label>
                    <Input
                      id={`report-${f.kind}`}
                      placeholder={f.placeholder}
                      value={editingUrls ? draftUrlsByKind[f.kind] : urlsByKind[f.kind]}
                      onChange={(e) =>
                        setDraftUrlsByKind((prev) => ({
                          ...prev,
                          [f.kind]: e.target.value,
                        }))
                      }
                      disabled={!editingUrls || loadingReports || savingUrls}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Downloadable Reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="downloadable-file">Upload File</Label>
                  <Input
                    id="downloadable-file"
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    disabled={uploading || loadingReports}
                  />
                  <p className="text-xs text-muted-foreground">This file will also appear in the client’s My Gallery.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="downloadable-desc">Description</Label>
                  <Textarea
                    id="downloadable-desc"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Optional description..."
                    disabled={uploading || loadingReports}
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button onClick={uploadDownloadable} disabled={uploading || !uploadFile || loadingReports}>
                    {uploading ? "Uploading..." : "Save"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Downloadable Reports List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[140px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloadable.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                          No downloadable reports yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      downloadable.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="min-w-0">
                            <div className="text-sm text-foreground truncate">{row.file_name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{row.description || "-"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button asChild variant="outline" size="sm">
                                <a href={row.file_url} target="_blank" rel="noreferrer">
                                  Open
                                </a>
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive"
                                    disabled={Boolean(deletingId) || loadingReports}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                                    <AlertDialogDescription className="break-words">
                                      The file "{row.file_name}" will be removed from the downloadable reports list.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>No</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => void deleteDownloadable(row.id)}
                                    >
                                      Yes
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
