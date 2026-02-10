import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Save, Upload, X, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type TaskStatus = "pending" | "assigned" | "in_progress" | "ready_for_review" | "completed" | "cancelled";

type TaskType = "blog" | "social_media" | "email_marketing" | "ads" | "others" | "";
type TaskPlatform = "facebook" | "instagram" | "x" | "threads" | "linkedin" | "";

type Client = {
  id: string;
  business_name: string;
};

type AssistAccount = {
  id: string;
  name: string;
};

const statusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  ready_for_review: "Ready for Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

const toTaskStatus = (status: unknown): TaskStatus => {
  const s = String(status ?? "pending") as TaskStatus;
  if (s === "pending") return "pending";
  if (s === "assigned") return "assigned";
  if (s === "in_progress") return "in_progress";
  if (s === "ready_for_review") return "ready_for_review";
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  return "pending";
};

function parseTaskNumberFromLabel(label: string | undefined | null): number | null {
  if (!label) return null;
  const raw = label.trim().toUpperCase();
  // Accept: T-0001 or T0001
  const m = raw.match(/^T-?(\d{1,})$/);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export default function AdminTaskDetails() {
  const navigate = useNavigate();
  const { taskNumberLabel } = useParams();
  const taskNumber = useMemo(() => parseTaskNumberFromLabel(taskNumberLabel), [taskNumberLabel]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<any | null>(null);
  const [businessName, setBusinessName] = useState<string>("—");
  const [assigneeName, setAssigneeName] = useState<string>("—");

  const [clients, setClients] = useState<Client[]>([]);
  const [assistAccounts, setAssistAccounts] = useState<AssistAccount[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [editData, setEditData] = useState({
    clientId: "",
    title: "",
    type: "" as TaskType,
    platform: "" as TaskPlatform,
    description: "",
    deadline: "",
    assignedTo: "__unassigned__",
    status: "pending" as TaskStatus,
    notes: "",
  });

  const [workLogsLoading, setWorkLogsLoading] = useState(false);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!taskNumber) {
        setError("Invalid Task ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Reset state to ensure fresh data
        setTask(null);
        setBusinessName("—");
        setAssigneeName("—");

        const { data: t, error: tErr } = await (supabase as any)
          .from("tasks")
          .select(
            "id, task_number, user_id, assigned_to, title, description, deadline, status, created_at, type, platform, file_url, notes",
          )
          .eq("task_number", taskNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tErr) throw tErr;
        if (!t) {
          setError("Task not found");
          return;
        }

        setTask(t);

        const userId = t.user_id as string | undefined;
        const assigneeId = t.assigned_to as string | undefined;

        const [businessesRes, assigneesRes, clientsRes, assistRes] = await Promise.all([
          userId
            ? (supabase as any)
                .from("businesses")
                .select("user_id, business_name")
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          assigneeId
            ? (supabase as any).from("profiles").select("id, name").eq("id", assigneeId).maybeSingle()
            : Promise.resolve({ data: null }),
          (supabase as any)
            .from("businesses")
            .select("user_id, business_name")
            .not("business_name", "is", null)
            .order("business_name", { ascending: true }),
          (supabase as any).rpc("get_assist_accounts"),
        ]);

        const businesses = businessesRes.data;
        const assignees = assigneesRes.data;

        setBusinessName(String((businesses as any)?.business_name ?? "—"));
        setAssigneeName(String((assignees as any)?.name ?? (assigneeId ? "—" : "Unassigned")));

        const nextClients: Client[] = ((clientsRes.data as any[]) ?? [])
          .filter((x) => x?.user_id && x?.business_name)
          .map((x) => ({ id: String(x.user_id), business_name: String(x.business_name) }));
        setClients(nextClients);

        const nextAssists: AssistAccount[] = ((assistRes.data as any[]) ?? [])
          .filter((x) => x?.id && x?.name)
          .map((x) => ({ id: String(x.id), name: String(x.name) }));
        setAssistAccounts(nextAssists);

        // Seed edit form
        setEditData({
          clientId: String(t.user_id ?? ""),
          title: String(t.title ?? ""),
          type: (String(t.type ?? "") as TaskType) || "",
          platform: (String(t.platform ?? "") as TaskPlatform) || "",
          description: String(t.description ?? ""),
          deadline: t.deadline ? String(t.deadline).slice(0, 10) : "",
          assignedTo: t.assigned_to ? String(t.assigned_to) : "__unassigned__",
          status: toTaskStatus(t.status),
          notes: String(t.notes ?? ""),
        });
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        setWorkLogsLoading(true);
        const { data: wl, error: wlErr } = await (supabase as any)
          .from("task_work_logs")
          .select("id, created_at, time_spent, work_description, status, shared_url, file_url, screenshot_url")
          .eq("task_id", t.id)
          .order("created_at", { ascending: false });
        if (wlErr) throw wlErr;
        setWorkLogs((wl as any[]) ?? []);
      } catch (e: any) {
        console.error("Error loading task details:", e);
        setError(e?.message ?? "Failed to load task");
      } finally {
        setWorkLogsLoading(false);
        setLoading(false);
      }
    };

    void run();

    // Set up realtime subscription for task updates
    const subscription = supabase
      .channel(`task-${taskNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `task_number=eq.${taskNumber}`
        },
        async (payload) => {
          console.log('Task updated in realtime:', payload);
          const updatedTask = payload.new;
          
          // Update task state
          setTask(updatedTask);
          
          // Update editData to sync with database
          setEditData({
            clientId: String(updatedTask.user_id ?? ""),
            title: String(updatedTask.title ?? ""),
            type: (String(updatedTask.type ?? "") as TaskType) || "",
            platform: (String(updatedTask.platform ?? "") as TaskPlatform) || "",
            description: String(updatedTask.description ?? ""),
            deadline: updatedTask.deadline ? String(updatedTask.deadline).slice(0, 10) : "",
            assignedTo: updatedTask.assigned_to ? String(updatedTask.assigned_to) : "__unassigned__",
            status: toTaskStatus(updatedTask.status),
            notes: String(updatedTask.notes ?? ""),
          });
          
          // Fetch updated business and assignee names
          const userId = updatedTask.user_id as string | undefined;
          const assigneeId = updatedTask.assigned_to as string | undefined;
          
          const [{ data: businesses }, { data: assignees }] = await Promise.all([
            userId
              ? (supabase as any).from("businesses").select("user_id, business_name").eq("user_id", userId).maybeSingle()
              : Promise.resolve({ data: null }),
            assigneeId
              ? (supabase as any).from("profiles").select("id, name").eq("id", assigneeId).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          
          setBusinessName(String((businesses as any)?.business_name ?? "—"));
          setAssigneeName(String((assignees as any)?.name ?? (assigneeId ? "—" : "Unassigned")));
          
          toast({ 
            title: "Task Updated", 
            description: "Task data has been synchronized with latest changes." 
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount or when taskNumber changes
    return () => {
      subscription.unsubscribe();
    };
  }, [taskNumber]);

  const label = taskNumber ? `T-${String(taskNumber).padStart(4, "0")}` : String(taskNumberLabel ?? "");
  const status = toTaskStatus(task?.status);

  const handleSave = async () => {
    if (!task) return;
    if (!editData.clientId || !editData.title.trim()) {
      toast({
        title: "Missing required fields",
        description: "Client and Task Title are required.",
        variant: "destructive",
      });
      return;
    }

    if (editData.type === "social_media" && !editData.platform) {
      toast({
        title: "Missing platform",
        description: "Platform is required for Social Media tasks.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      let nextFileUrl: string | null = task.file_url ?? null;
      if (uploadedFile) {
        const filePath = `${editData.clientId}/tasks/${Date.now()}-${uploadedFile.name}`;
        const { error: uploadError } = await supabase.storage.from("user-files").upload(filePath, uploadedFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(filePath);
        nextFileUrl = urlData.publicUrl;
      }

      const nextAssignedTo = editData.assignedTo === "__unassigned__" ? null : editData.assignedTo;

      // Update by the specific task id (fetched in the useEffect)
      const { data: updated, error: updErr } = await (supabase as any)
        .from("tasks")
        .update({
          user_id: editData.clientId,
          title: editData.title.trim(),
          description: editData.description.trim() ? editData.description.trim() : null,
          type: (editData.type as any) || null,
          platform: editData.type === "social_media" ? ((editData.platform as any) || null) : null,
          deadline: editData.deadline || null,
          assigned_to: nextAssignedTo,
          status: editData.status as any,
          notes: editData.notes.trim() ? editData.notes.trim() : null,
          file_url: nextFileUrl,
        })
        .eq("id", task.id)
        .select(
          "id, task_number, user_id, assigned_to, title, description, deadline, status, created_at, type, platform, file_url, notes",
        )
        .single();

      if (updErr) throw updErr;
      if (!updated) {
        throw new Error("Failed to update task - no matching record found");
      }

      setTask(updated);
      setIsEditing(false);
      setUploadedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // update labels shown on page
      const userId = updated?.user_id as string | undefined;
      const assigneeId = updated?.assigned_to as string | undefined;
      const [{ data: businesses }, { data: assignees }] = await Promise.all([
        userId
          ? (supabase as any).from("businesses").select("user_id, business_name").eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        assigneeId
          ? (supabase as any).from("profiles").select("id, name").eq("id", assigneeId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setBusinessName(String((businesses as any)?.business_name ?? "—"));
      setAssigneeName(String((assignees as any)?.name ?? (assigneeId ? "—" : "Unassigned")));

      toast({ title: "Saved", description: "Task updated successfully." });
    } catch (e: any) {
      console.error("Error updating task:", e);
      toast({
        title: "Failed",
        description: e?.message ?? "Failed to update task.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!task) return;

    try {
      setCancelling(true);

      // Update by the specific task id
      const { data: updated, error: updErr } = await (supabase as any)
        .from("tasks")
        .update({ status: "cancelled" as any })
        .eq("id", task.id)
        .select(
          "id, task_number, user_id, assigned_to, title, description, deadline, status, created_at, type, platform, file_url, notes",
        )
        .single();

      if (updErr) throw updErr;
      if (!updated) {
        throw new Error("Failed to cancel task - no matching record found");
      }

      setTask(updated);
      // Update edit form state if in edit mode
      setEditData((prev) => ({ ...prev, status: "cancelled" }));
      // Exit edit mode after cancelling
      setIsEditing(false);
      setShowCancelDialog(false);

      toast({ title: "Task Cancelled", description: "Task status has been updated to cancelled." });
    } catch (e: any) {
      console.error("Error cancelling task:", e);
      toast({
        title: "Failed",
        description: e?.message ?? "Failed to cancel task.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatMinutes = (minutes: number | null | undefined) => {
    const m = typeof minutes === "number" && Number.isFinite(minutes) ? minutes : 0;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard/admin/tasks")}
          aria-label="Back to tasks"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Task Details</h1>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Overview</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{statusLabel[status]}</Badge>
            {!loading && !error && task && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing((v) => !v)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
                {status !== "cancelled" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Task
                  </Button>
                )}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="py-8 text-sm text-muted-foreground">{error}</div>
          ) : isEditing ? (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Task ID</Label>
                  <Input value={label.replace("-", "")} disabled className="bg-muted font-mono" />
                  <p className="text-xs text-muted-foreground">Task number is fixed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client * (Business Name)</Label>
                  <Select
                    value={editData.clientId}
                    onValueChange={(value) => setEditData((p) => ({ ...p, clientId: value }))}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.business_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter task title..."
                  value={editData.title}
                  onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={editData.type}
                    onValueChange={(value) =>
                      setEditData((p) => ({ ...p, type: value as TaskType, platform: "" }))
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="blog">Blog</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="email_marketing">Email Marketing</SelectItem>
                      <SelectItem value="ads">Ads</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editData.type === "social_media" && (
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <Select
                      value={editData.platform}
                      onValueChange={(value) => setEditData((p) => ({ ...p, platform: value as TaskPlatform }))}
                    >
                      <SelectTrigger id="platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="x">X (Twitter)</SelectItem>
                        <SelectItem value="threads">Threads</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter task description..."
                  value={editData.description}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  File
                </Label>
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">Current</div>
                      {task?.file_url ? (
                        <a
                          href={String(task.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all"
                        >
                          View current file
                        </a>
                      ) : (
                        <div className="text-sm text-muted-foreground">No file attached</div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {uploadedFile ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground truncate max-w-[220px]">{uploadedFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUploadedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            aria-label="Remove selected file"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload new
                        </Button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setUploadedFile(f);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={editData.deadline}
                    onChange={(e) => setEditData((p) => ({ ...p, deadline: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee</Label>
                  <Select
                    value={editData.assignedTo}
                    onValueChange={(value) => setEditData((p) => ({ ...p, assignedTo: value }))}
                  >
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="Select assignee (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {assistAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editData.status}
                    onValueChange={(value) => setEditData((p) => ({ ...p, status: value as TaskStatus }))}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Internal notes..."
                    value={editData.notes}
                    onChange={(e) => setEditData((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Business Name</dt>
                <dd className="mt-1 font-medium text-foreground">{businessName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Assignee</dt>
                <dd className="mt-1 font-medium text-foreground">{assigneeName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Title</dt>
                <dd className="mt-1 font-medium text-foreground">{task?.title ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deadline</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {task?.deadline ? String(task.deadline).slice(0, 10) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Type</dt>
                <dd className="mt-1 font-medium text-foreground">{task?.type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Platform</dt>
                <dd className="mt-1 font-medium text-foreground">{task?.platform ?? "—"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{task?.description ?? "—"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs text-muted-foreground">File</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {task?.file_url ? (
                    <a
                      href={String(task.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      View file
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{task?.notes ?? "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this task? This will change the task status to "Cancelled".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work Log</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="py-8 text-sm text-muted-foreground">—</div>
          ) : workLogsLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading work logs...</div>
          ) : workLogs.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">No work logs yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-left font-medium">Time</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {workLogs.map((w) => (
                    <tr key={w.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 align-top text-muted-foreground">
                        {w.created_at ? new Date(w.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 pr-4 align-top text-foreground">
                        {formatMinutes(w.time_spent)}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <Badge variant="outline">{String(w.status ?? "—")}</Badge>
                      </td>
                      <td className="py-3 align-top whitespace-pre-wrap text-foreground">
                        {w.work_description ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
