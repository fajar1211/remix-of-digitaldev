import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Upload, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Client = {
  id: string;
  label: string;
  status: "pending" | "approved" | "active" | "suspended" | "expired";
};

type AssistAccount = {
  id: string;
  name: string;
  status?: string;
};

type BusinessStatus = "pending" | "approved" | "active" | "suspended" | "expired";

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

type FormState = {
  title: string;
  description: string;
  type: string;
  platform: string;
  clientId: string;
  deadline: string;
  assignedTo: string;
  recurringMonthly: boolean;
};

export default function AdminTaskCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [assistAccounts, setAssistAccounts] = useState<AssistAccount[]>([]);
  const [nextTaskNumber, setNextTaskNumber] = useState(100);

  const [formData, setFormData] = useState<FormState>({
    title: "",
    description: "",
    type: "",
    platform: "",
    clientId: "",
    deadline: "",
    assignedTo: "",
    recurringMonthly: false,
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const taskIdLabel = useMemo(() => `T${String(nextTaskNumber).padStart(5, "0")}` , [nextTaskNumber]);

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      setLoading(true);

      const [userRolesRes, profilesRes, businessesRes, maxRes, assistRes] = await Promise.all([
        // Clients: start from user_roles so we can include non-active/pending users too
        (supabase as any).from("user_roles").select("user_id").eq("role", "user"),
        (supabase as any).from("profiles").select("id, name, email, account_status, payment_active"),
        (supabase as any).from("businesses").select("user_id, business_name").not("user_id", "is", null),
        (supabase as any)
          .from("tasks")
          .select("task_number")
          .order("task_number", { ascending: false })
          .limit(1),
        // Assignees: include status for context (no filtering)
        (supabase as any).rpc("get_assist_contacts"),
      ]);

      if (userRolesRes.error) throw userRolesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (businessesRes.error) throw businessesRes.error;
      if (maxRes.error) throw maxRes.error;
      if (assistRes.error) throw assistRes.error;

      const userIds: string[] = ((userRolesRes.data as any[]) ?? []).map((r) => String(r.user_id)).filter(Boolean);
      const profilesById = new Map<string, any>(((profilesRes.data as any[]) ?? []).map((p) => [String(p.id), p]));
      const businessNameByUserId = new Map<string, string>(
        ((businessesRes.data as any[]) ?? [])
          .filter((b) => b?.user_id)
          .map((b) => [String(b.user_id), String(b.business_name ?? "").trim()]),
      );

      const nextClients: Client[] = userIds
        .map((userId) => {
          const p = profilesById.get(userId);
          const paymentActive = Boolean(p?.payment_active ?? false);
          const status = mapDbAccountStatusToUi(p?.account_status, paymentActive);

          const businessName = (businessNameByUserId.get(userId) ?? "").trim();
          const name = String(p?.name ?? "").trim();
          const email = String(p?.email ?? "").trim();
          const baseLabel = businessName || name || email || userId;

          return {
            id: userId,
            label: `${baseLabel} — ${statusLabel[status]}`,
            status,
          };
        })
        // Match Business Users page: only show Active accounts in this dropdown
        .filter((c) => c.status === "active")
        .sort((a, b) => a.label.localeCompare(b.label));

      const nextAssists: AssistAccount[] = ((assistRes.data as any[]) ?? [])
        .filter((x) => x?.id && x?.name)
        .map((x) => ({ id: String(x.id), name: String(x.name), status: x?.status ? String(x.status) : undefined }))
        // Match Assistants page: only show Active assists in this dropdown
        .filter((a) => String(a.status ?? "").toLowerCase().trim() === "active");

      const maxNum = Number((maxRes.data as any[])?.[0]?.task_number ?? 99);
      const safeMax = Number.isFinite(maxNum) ? maxNum : 99;

      setClients(nextClients);
      setAssistAccounts(nextAssists);
      setNextTaskNumber(safeMax + 1);
    } catch (e) {
      console.error("Error preparing task create form:", e);
      toast({
        title: "Failed",
        description: "Could not load task create form data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "",
      platform: "",
      clientId: "",
      deadline: "",
      assignedTo: "",
      recurringMonthly: false,
    });
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    navigate("/dashboard/admin/tasks");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.clientId) {
      toast({
        title: "Missing required fields",
        description: "Client and Task Title are required.",
        variant: "destructive",
      });
      return;
    }

    if (formData.recurringMonthly && !formData.deadline) {
      toast({
        title: "Missing deadline",
        description: "Deadline is required for monthly recurring tasks.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Not signed in",
        description: "Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);

      let fileUrl: string | null = null;

      if (uploadedFile) {
        const filePath = `${formData.clientId}/tasks/${Date.now()}-${uploadedFile.name}`;
        const { error: uploadError } = await supabase.storage.from("user-files").upload(filePath, uploadedFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("user-files").getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      // Monthly recurring rule (auto-generate H-7 from chosen deadline day)
      if (formData.recurringMonthly) {
        const deadlineDay = Number.parseInt(formData.deadline.split("-")[2] || "", 10);
        if (!Number.isFinite(deadlineDay) || deadlineDay < 1 || deadlineDay > 31) {
          toast({
            title: "Invalid deadline",
            description: "Please choose a valid deadline date.",
            variant: "destructive",
          });
          return;
        }

        const { data: ruleData, error: ruleErr } = await (supabase as any)
          .from("task_recurring_rules")
          .insert({
            created_by: user.id,
            user_id: formData.clientId,
            assigned_to: formData.assignedTo || null,
            title: formData.title.trim(),
            description: formData.description?.trim() ? formData.description.trim() : null,
            type: (formData.type as any) || null,
            platform: formData.type === "social_media" ? ((formData.platform as any) || null) : null,
            file_url: fileUrl,
            deadline_day: deadlineDay,
            is_active: true,
          })
          .select("id")
          .limit(1);

        if (ruleErr) throw ruleErr;
        if (!Array.isArray(ruleData) || ruleData.length === 0) {
          throw new Error("Recurring rule was not saved.");
        }

        toast({
          title: "Recurring Task Enabled",
          description: "This task will auto-generate monthly (H-7 from the deadline).",
        });

        resetForm();
        return;
      }

      // One-time task (task_number auto-generated by DB trigger)
      const { data: taskData, error } = await (supabase as any)
        .from("tasks")
        .insert({
          user_id: formData.clientId,
          title: formData.title.trim(),
          description: formData.description?.trim() ? formData.description.trim() : null,
          type: (formData.type as any) || null,
          platform: formData.type === "social_media" ? ((formData.platform as any) || null) : null,
          assigned_to: formData.assignedTo || null,
          deadline: formData.deadline || null,
          file_url: fileUrl,
          notes: null,
          status: "pending",
        })
        .select("id, task_number")
        .limit(1);

      if (error) throw error;
      if (!Array.isArray(taskData) || taskData.length === 0) {
        throw new Error("Task was not saved.");
      }

      const createdTaskNumber = Number(taskData[0]?.task_number ?? nextTaskNumber);
      const createdTaskId = `T${String(createdTaskNumber).padStart(5, "0")}`;

      toast({
        title: "Task Created",
        description: `Task ${createdTaskId} has been created.`,
      });

      setNextTaskNumber(createdTaskNumber + 1);
      resetForm();
    } catch (e) {
      console.error("Error creating task:", e);
      toast({
        title: "Failed",
        description: "Failed to create task.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={resetForm}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create New Task</h1>
          <p className="text-muted-foreground">Add a new task for a client</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
          <CardDescription>Fill in the details for the new task</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Task ID</Label>
                  <Input value={taskIdLabel} disabled className="bg-muted font-mono" />
                  <p className="text-xs text-muted-foreground">Auto-generated task ID</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client * (Business Name)</Label>
                  <Select
                    value={formData.clientId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.label}
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
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value, platform: "" }))}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog">Blog</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="email_marketing">Email Marketing</SelectItem>
                      <SelectItem value="ads">Ads</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "social_media" && (
                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, platform: value }))}
                    >
                      <SelectTrigger id="platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
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
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadedFile ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate">{uploadedFile.name}</span>
                      <X
                        className="h-4 w-4 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to upload file</span>
                  )}
                </div>
                <input ref={fileInputRef} id="task-file-upload" type="file" onChange={handleFileUpload} className="hidden" />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="deadline">Deadline</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Monthly</Label>
                      <Switch
                        checked={formData.recurringMonthly}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({ ...prev, recurringMonthly: checked }))
                        }
                      />
                    </div>
                  </div>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee</Label>
                  <Select
                    value={formData.assignedTo || "__unassigned__"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        assignedTo: value === "__unassigned__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="Select assignee (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {assistAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.status ? `${a.name} — ${a.status}` : a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={creating}>
                  {creating ? (
                    "Creating..."
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Task
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
