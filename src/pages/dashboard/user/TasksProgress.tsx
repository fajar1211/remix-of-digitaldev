import { useEffect, useRef, useState } from 'react';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle,
  PartyPopper,
  Plus,
  Upload,
  X,
  Calendar,
  User,
  ArrowLeft,
  Pencil,
  Image as ImageIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePackageMenuRules } from '@/hooks/usePackageMenuRules';

interface Task {
  id: string;
  task_number: number | null;
  title: string;
  description: string | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'ready_for_review' | 'completed' | 'cancelled';
  type: 'blog' | 'social_media' | 'email_marketing' | 'ads' | 'others' | null;
  platform: 'facebook' | 'instagram' | 'x' | 'threads' | 'linkedin' | null;
  file_url: string | null;
  notes: string | null;
  assigned_to: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

interface AssistAccount {
  id: string;
  name: string;
}

interface WorkLog {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
  status: string | null;
  time_spent: number | null; // minutes
  work_description: string | null;
  file_url: string | null;
  screenshot_url: string | null;
  shared_url: string | null;
}

interface WorkLogDeleteRequest {
  id: string;
  work_log_id: string;
  task_id: string;
  requester_id: string;
  owner_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<Task['status'], { label: string; icon: any; className: string }> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-muted text-muted-foreground',
  },
  assigned: {
    label: 'Assigned',
    icon: User,
    className: 'bg-secondary text-secondary-foreground',
  },
  in_progress: {
    label: 'In Progress',
    icon: AlertCircle,
    className: 'bg-primary/10 text-primary',
  },
  ready_for_review: {
    label: 'Ready for Review',
    icon: CheckCircle,
    className: 'bg-accent/10 text-accent',
  },
  completed: {
    label: 'Completed',
    icon: CheckSquare,
    className: 'bg-muted text-muted-foreground',
  },
  cancelled: {
    label: 'Cancelled',
    icon: X,
    className: 'bg-destructive/10 text-destructive',
  },
};

const typeLabels: Record<string, string> = {
  blog: 'Blog',
  social_media: 'Social Media',
  email_marketing: 'Email Marketing',
  ads: 'Ads',
  others: 'Others',
};

const platformLabels: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X (Twitter)',
  threads: 'Threads',
  linkedin: 'LinkedIn',
};

type ViewMode = 'list' | 'create' | 'view';

export default function TasksProgress() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isEnabled } = usePackageMenuRules(user?.id);
  const canCreateTasks = isEnabled('tasks_progress_create') && isEnabled('tasks_progress');
  const canEditTasks = isEnabled('tasks_progress_editing') && isEnabled('tasks_progress');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [uploading, setUploading] = useState(false);
  const [assists, setAssists] = useState<AssistAccount[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [workLogsLoading, setWorkLogsLoading] = useState(false);
  const [nextTaskNumber, setNextTaskNumber] = useState(101);
  const [businessName, setBusinessName] = useState('');
  const [statusFilters, setStatusFilters] = useState<Task['status'][]>([]);

  // Hide completed tasks from the user task list page.
  const baseVisibleTasks = tasks.filter((t) => t.status !== 'completed');

  const visibleTasks = statusFilters.length
    ? baseVisibleTasks.filter((t) => statusFilters.includes(t.status))
    : baseVisibleTasks;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    platform: '',
    assignee: 'none',
    deadline: '',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editUploadedFile, setEditUploadedFile] = useState<File | null>(null);

  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);

  // Work log delete requests (approve/reject by business owner)
  const [deleteRequests, setDeleteRequests] = useState<WorkLogDeleteRequest[]>([]);
  const [deleteRequestsLoading, setDeleteRequestsLoading] = useState(false);
  const [decidingRequestId, setDecidingRequestId] = useState<string | null>(null);

  // Approve delete request confirmation
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmApproveRequest, setConfirmApproveRequest] = useState<WorkLogDeleteRequest | null>(null);
  const [approveCanceledRequestIds, setApproveCanceledRequestIds] = useState<Set<string>>(() => new Set());

  // Mark completed confirmation
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  // Celebration overlay when a task is marked as completed
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimerRef = useRef<number | null>(null);

  const triggerCelebration = () => {
    setShowCelebration(true);
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => {
      setShowCelebration(false);
      celebrationTimerRef.current = null;
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    type: '',
    platform: '',
    deadline: '',
    status: 'pending' as Task['status'],
    assignee: 'none' as string, // assist user id or 'none'
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch business name for current user
      const { data: businessData } = await supabase
        .from('businesses')
        .select('business_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (businessData?.business_name) {
        setBusinessName(businessData.business_name);
      }

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (tasksData) {
        setTasks(tasksData as Task[]);
        // Calculate next task number for UI display (DB guarantees uniqueness)
        const maxNum = tasksData.reduce(
          (max, t) => Math.max(max, t.task_number || 0),
          100
        );
        setNextTaskNumber(Math.max(maxNum + 1, 101));
      }

      // Fetch ACTIVE assist accounts only (synced with profiles.account_status)
      const { data: assistAccounts, error: assistError } = await supabase.rpc('get_active_assist_accounts');

      if (!assistError && assistAccounts) {
        setAssists(
          [...assistAccounts].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Fetch work log history for selected task
  useEffect(() => {
    const fetchWorkLogs = async () => {
      if (!user || !selectedTask || viewMode !== 'view') return;
      setWorkLogsLoading(true);

      const { data, error } = await supabase
        .from('task_work_logs')
        .select('*')
        .eq('task_id', selectedTask.id)
        .order('created_at', { ascending: false });

      if (!error && data) setWorkLogs(data as WorkLog[]);
      setWorkLogsLoading(false);
    };

    fetchWorkLogs();
  }, [user, selectedTask?.id, viewMode]);

  // Fetch delete requests for selected task (business owner approval)
  useEffect(() => {
    const fetchDeleteRequests = async () => {
      if (!user || !selectedTask || viewMode !== 'view') return;
      setDeleteRequestsLoading(true);

        const { data, error } = await supabase
          .from('work_log_delete_requests')
          .select('*')
          .eq('task_id', selectedTask.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) setDeleteRequests(data as WorkLogDeleteRequest[]);
      setDeleteRequestsLoading(false);
    };

    fetchDeleteRequests();
  }, [user, selectedTask?.id, viewMode]);

  // Real-time subscription for tasks
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks(prev => [payload.new as Task, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as Task : t));
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: '',
      platform: '',
      assignee: 'none',
      deadline: '',
    });
    setUploadedFile(null);
    setEditUploadedFile(null);
    setScreenshotPreviewUrl(null);
    setSelectedTask(null);
    setViewMode('list');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const formatTaskId = (num: number) => `T${String(num).padStart(5, '0')}`;

  const formatMinutesAsHoursMinutes = (totalMinutes: number | null | undefined) => {
    const safe = typeof totalMinutes === 'number' && Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : 0;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}h ${m}m`;
  };

  const handleSubmit = async () => {
    if (!canCreateTasks) return;
    if (!formData.title || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in the required fields.',
      });
      return;
    }

    setUploading(true);
    let fileUrl: string | null = null;

    // Upload file if exists
    if (uploadedFile) {
      const filePath = `${user.id}/tasks/${Date.now()}-${uploadedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, uploadedFile);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }
    }

    const selectedAssignee = formData.assignee && formData.assignee !== 'none' ? formData.assignee : null;
    const nextStatus: Task['status'] = selectedAssignee ? 'assigned' : 'pending';

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: formData.title,
        description: formData.description || null,
        type: (formData.type as any) || null,
        platform: formData.type === 'social_media' ? (formData.platform as any) : null,
        assigned_to: selectedAssignee,
        deadline: formData.deadline || null,
        file_url: fileUrl,
        status: nextStatus as any,
      })
      .select()
      .single();

    setUploading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create task.',
      });
      return;
    }

    if (data) {
      const createdTask = data as Task;
      const createdNum = createdTask.task_number || nextTaskNumber;
      setNextTaskNumber(createdNum + 1);

      toast({
        title: 'Task Created',
        description: `Task "${formData.title}" (${formatTaskId(createdNum)}) has been created.`,
      });

      resetForm();
    }
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setEditUploadedFile(null);
    setScreenshotPreviewUrl(null);
    setEditData({
      title: task.title,
      description: task.description || '',
      type: task.type || '',
      platform: task.platform || '',
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      status: task.status,
      assignee: task.assigned_to || 'none',
    });
    setIsEditing(false);
    setViewMode('view');
  };

  const getAssistName = (id: string | null) => {
    if (!id) return '-';
    const assist = assists.find(a => a.id === id);
    return assist?.name || '-';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // View Task Progress (Task Info + Work Log History)
  if (viewMode === 'view' && selectedTask) {
    const createdDate = selectedTask.created_at ? selectedTask.created_at.slice(0, 10) : '';

    const deriveStatusFromAssignee = (assignee: string) =>
      assignee && assignee !== 'none' ? ('assigned' as Task['status']) : ('pending' as Task['status']);

    // Only allow editing of the fields when Edit mode is enabled AND permission allows.
    const canEditDetails = isEditing && canEditTasks;

    const derivedStatus = deriveStatusFromAssignee(editData.assignee);

    const handleSaveChanges = async () => {
      if (!canEditTasks) return;
      if (!user) return;

      const nextPlatform = editData.type === 'social_media' ? (editData.platform || null) : null;
      const nextAssignedTo = editData.assignee && editData.assignee !== 'none' ? editData.assignee : null;
      const nextStatus = deriveStatusFromAssignee(editData.assignee);

      let nextFileUrl: string | null = selectedTask.file_url;

      // Upload new file if user selected one in Edit mode
      if (editUploadedFile) {
        const filePath = `${user.id}/tasks/${Date.now()}-${editUploadedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, editUploadedFile);

        if (uploadError) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to upload file.',
          });
          return;
        }

        const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(filePath);
        nextFileUrl = urlData.publicUrl;
      }

      const { data: updated, error } = await supabase
        .from('tasks')
        .update({
          title: editData.title,
          description: editData.description || null,
          type: (editData.type as any) || null,
          platform: nextPlatform as any,
          deadline: editData.deadline || null,
          status: nextStatus as any,
          assigned_to: nextAssignedTo,
          file_url: nextFileUrl,
        })
        .eq('id', selectedTask.id)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save changes.',
        });
        return;
      }

      if (updated) {
        setSelectedTask(updated as Task);
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? (updated as Task) : t)));
      }

      toast({
        title: 'Saved',
        description: 'Task updated successfully.',
      });
      setEditUploadedFile(null);
      setIsEditing(false);
    };

    const handleDecideDeleteRequest = async (req: WorkLogDeleteRequest, decision: 'approved' | 'rejected') => {
      if (!user) return;

      setDecidingRequestId(req.id);
      try {
        const { error: updateError } = await supabase
          .from('work_log_delete_requests')
          .update({
            status: decision,
            decided_by: user.id,
            decided_at: new Date().toISOString(),
          })
          .eq('id', req.id)
          .eq('owner_id', user.id);

        if (updateError) throw updateError;

        if (decision === 'approved') {
          const { error: deleteError } = await supabase
            .from('task_work_logs')
            .delete()
            .eq('id', req.work_log_id);

          if (deleteError) throw deleteError;

          setWorkLogs((prev) => prev.filter((l) => l.id !== req.work_log_id));
        }

        // Hide the request after a decision (only pending requests are shown)
        setDeleteRequests((prev) => prev.filter((r) => r.id !== req.id));

        toast({
          title: decision === 'approved' ? 'Approved' : 'Rejected',
          description:
            decision === 'approved'
              ? 'Work log deleted from database.'
              : 'Work log remains in history (Rejected).',
        });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: err?.message || 'Failed to process request.',
        });
      } finally {
        setDecidingRequestId(null);
      }
    };

    const handleCancelApproveDeleteRequest = async (req: WorkLogDeleteRequest) => {
      if (!user || !selectedTask) return;

      // Disable the button (white/outline disabled) after choosing "No"
      setApproveCanceledRequestIds((prev) => {
        const next = new Set(prev);
        next.add(req.id);
        return next;
      });

      setConfirmApproveOpen(false);
      setConfirmApproveRequest(null);

      try {
        // As requested: when answering "No", set task status to "In Progress"
        const { data: updated, error } = await supabase
          .from('tasks')
          .update({ status: 'in_progress' as any })
          .eq('id', selectedTask.id)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (error) throw error;

        if (updated) {
          setSelectedTask(updated as Task);
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? (updated as Task) : t)));
        }
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: err?.message || 'Failed to update task status.',
        });
      }
    };

    const handleMarkCompleted = async () => {
      if (!user || !selectedTask) return;

      try {
        const { data: updated, error } = await supabase
          .from('tasks')
          .update({ status: 'completed' as any })
          .eq('id', selectedTask.id)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (error) throw error;

        if (updated) {
          setSelectedTask(updated as Task);
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? (updated as Task) : t)));
        }

        toast({
          title: 'Completed',
          description: 'Task marked as completed.',
        });

        triggerCelebration();
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: err?.message || 'Failed to mark task as completed.',
        });
      } finally {
        setConfirmCompleteOpen(false);
      }
    };

    return (
      <div className="relative">
        {showCelebration && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-start justify-center pt-20">
            <div className="animate-enter rounded-full border bg-background/90 px-5 py-3 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PartyPopper className="h-5 w-5 text-primary" />
                <span>Nice! Task completed.</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Task Progress</h1>
              <p className="text-muted-foreground">Update the core details of this task</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Task Info */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Task Info</CardTitle>
                <CardDescription>Update the core details of this task</CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className={(statusConfig[selectedTask.status] ?? statusConfig.pending).className}>
                  {(statusConfig[selectedTask.status] ?? statusConfig.pending).label}
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canEditTasks}
                  onClick={() => {
                    if (!canEditTasks) return;
                    setIsEditing((v) => {
                      const next = !v;
                      setEditUploadedFile(null);
                      if (next) {
                        setEditData({
                          title: selectedTask.title,
                          description: selectedTask.description || '',
                          type: selectedTask.type || '',
                          platform: selectedTask.platform || '',
                          deadline: selectedTask.deadline ? selectedTask.deadline.slice(0, 10) : '',
                          status: selectedTask.status,
                          assignee: selectedTask.assigned_to || 'none',
                        });
                      }
                      return next;
                    });
                  }}
                  aria-pressed={isEditing}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Task ID</Label>
                <Input value={formatTaskId(selectedTask.task_number || 0)} disabled className="bg-muted font-mono" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title">Task Title</Label>
                <Input
                  id="edit-title"
                  value={editData.title}
                  disabled={!canEditDetails}
                  onChange={(e) => setEditData((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input value={businessName || ''} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Created</Label>
                  <Input type="date" value={createdDate} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select
                    value={isEditing ? editData.assignee : selectedTask.assigned_to || 'none'}
                    onValueChange={(value) => setEditData((p) => ({ ...p, assignee: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {assists.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input value={(statusConfig[selectedTask.status] ?? statusConfig.pending).label} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Status updates automatically based on progress.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-deadline">Deadline</Label>
                  <Input
                    id="edit-deadline"
                    type="date"
                    value={editData.deadline}
                    disabled={!canEditDetails}
                    onChange={(e) => setEditData((p) => ({ ...p, deadline: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={editData.type}
                    onValueChange={(value) => setEditData((p) => ({ ...p, type: value, platform: '' }))}
                    disabled={!canEditDetails}
                  >
                    <SelectTrigger id="edit-type">
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

                <div className="space-y-2">
                  <Label htmlFor="edit-platform">Platform</Label>
                  <Select
                    value={editData.platform}
                    onValueChange={(value) => setEditData((p) => ({ ...p, platform: value }))}
                    disabled={!canEditDetails || editData.type !== 'social_media'}
                  >
                    <SelectTrigger id="edit-platform">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editData.description}
                  disabled={!canEditDetails}
                  onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Upload File</Label>
                <p className="text-xs text-muted-foreground">Only one file is allowed. Please zip or rar multiple files before upload.</p>

                {canEditDetails ? (
                  <div className="space-y-2">
                    <input
                      ref={editFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setEditUploadedFile(f);
                      }}
                    />

                    <div
                      className={cn(
                        'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50',
                        !canEditDetails && 'opacity-60 cursor-not-allowed'
                      )}
                      onClick={() => editFileInputRef.current?.click()}
                    >
                      {editUploadedFile ? (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm truncate">{editUploadedFile.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setEditUploadedFile(null);
                              if (editFileInputRef.current) editFileInputRef.current.value = '';
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to upload file</span>
                        </div>
                      )}
                    </div>

                    {selectedTask.file_url && !editUploadedFile && (
                      <a
                        href={selectedTask.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Upload className="h-4 w-4" />
                        View current file
                      </a>
                    )}
                  </div>
                ) : selectedTask.file_url ? (
                  <a
                    href={selectedTask.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Upload className="h-4 w-4" />
                    View File
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">-</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveChanges} disabled={!isEditing}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Work Log History */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Work Log History</CardTitle>
                <CardDescription>Track your progress on this task</CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={selectedTask.status === 'ready_for_review' ? 'default' : 'outline'}
                  disabled={selectedTask.status !== 'ready_for_review'}
                  onClick={() => setConfirmCompleteOpen(true)}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Mark as Completed
                </Button>

                <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Mark task as completed?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to mark this task as completed?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No</AlertDialogCancel>
                      <AlertDialogAction onClick={handleMarkCompleted}>Yes</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Total Time Spent (history)</div>
                  <div className="mt-1 font-medium text-foreground">
                    {formatMinutesAsHoursMinutes(
                      workLogs.reduce((sum, l) => sum + (typeof l.time_spent === 'number' ? l.time_spent : 0), 0)
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Delete Requests</div>
                  {deleteRequestsLoading ? (
                    <div className="mt-2 h-10 rounded bg-muted animate-pulse" />
                  ) : deleteRequests.length === 0 ? (
                    <div className="mt-1 text-sm text-muted-foreground">No delete requests.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {deleteRequests.map((req) => {
                        const relatedLog = workLogs.find((l) => l.id === req.work_log_id);

                        return (
                          <div key={req.id} className="flex flex-col gap-2 rounded-md border bg-background p-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">Work Log</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(relatedLog?.created_at || req.created_at).toLocaleString()}
                                </span>
                              </div>

                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div>
                                  <div className="text-xs text-muted-foreground">Time Spent (minutes)</div>
                                  <div className="text-sm text-foreground">
                                    {typeof relatedLog?.time_spent === 'number' ? relatedLog.time_spent : '-'}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs text-muted-foreground">Reason</div>
                                  <div className="text-sm text-muted-foreground break-words">{req.reason}</div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={decidingRequestId === req.id}
                                onClick={() => handleDecideDeleteRequest(req, 'rejected')}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant={approveCanceledRequestIds.has(req.id) ? 'outline' : 'default'}
                                disabled={decidingRequestId === req.id || approveCanceledRequestIds.has(req.id)}
                                onClick={() => {
                                  setConfirmApproveRequest(req);
                                  setConfirmApproveOpen(true);
                                }}
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <AlertDialog
                open={confirmApproveOpen}
                onOpenChange={(open) => {
                  setConfirmApproveOpen(open);
                  if (!open) setConfirmApproveRequest(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve delete request?</AlertDialogTitle>
                    <AlertDialogDescription>
                      If you approve, the selected work log will be deleted permanently.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => {
                        if (confirmApproveRequest) void handleCancelApproveDeleteRequest(confirmApproveRequest);
                      }}
                    >
                      No
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (confirmApproveRequest)
                          void handleDecideDeleteRequest(confirmApproveRequest, 'approved');
                        setConfirmApproveOpen(false);
                        setConfirmApproveRequest(null);
                      }}
                    >
                      Yes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {workLogsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : workLogs.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">Belum ada work log.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border bg-card p-4">
                      <div className="grid gap-3">
                        <div className="text-sm font-medium text-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Time Spent (minutes)</p>
                            <p className="text-sm text-foreground">{typeof log.time_spent === 'number' ? log.time_spent : '-'}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Shared URL</p>
                            {log.shared_url ? (
                              <a className="text-sm text-primary hover:underline" href={log.shared_url} target="_blank" rel="noreferrer">
                                {log.shared_url}
                              </a>
                            ) : (
                              <p className="text-sm text-foreground">-</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Work Description</p>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{log.work_description || '-'}</p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Upload File</p>
                            {log.file_url ? (
                              <a className="text-sm text-primary hover:underline" href={log.file_url} target="_blank" rel="noreferrer">
                                Open file
                              </a>
                            ) : (
                              <p className="text-sm text-foreground">-</p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Screenshot</p>
                            {log.screenshot_url ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-sm"
                                onClick={() => setScreenshotPreviewUrl(log.screenshot_url as string)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  View screenshot
                                </span>
                              </Button>
                            ) : (
                              <p className="text-sm text-foreground">-</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Dialog open={!!screenshotPreviewUrl} onOpenChange={(open) => !open && setScreenshotPreviewUrl(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Screenshot Preview</DialogTitle>
                  </DialogHeader>
                  {screenshotPreviewUrl ? (
                    <div className="mt-2 overflow-hidden rounded-lg border bg-muted/20">
                      <img
                        src={screenshotPreviewUrl}
                        alt="Work log screenshot preview"
                        className="h-auto w-full"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    );
  }

  // Full Page Create Task Form
  if (viewMode === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={resetForm}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create New Task</h1>
            <p className="text-muted-foreground">Add a new task to your workflow</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
            <CardDescription>Fill in the details for your new task</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Task ID</Label>
                <Input
                  value={formatTaskId(nextTaskNumber)}
                  disabled
                  className="bg-muted font-mono"
                />
                <p className="text-xs text-muted-foreground">Auto-generated ID</p>
              </div>

              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={businessName || ''}
                  placeholder="Your business name"
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value, platform: '' }))}
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

              {formData.type === 'social_media' && (
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select 
                    value={formData.platform} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Upload File</Label>
              <div className="border-2 border-dashed rounded-lg p-6">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="task-file-upload"
                />
                <label 
                  htmlFor="task-file-upload" 
                  className="flex flex-col items-center cursor-pointer"
                >
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload file</span>
                </label>
              </div>
              {uploadedFile && (
                <div className="flex items-center justify-between bg-muted/50 p-2 rounded mt-2">
                  <span className="text-sm truncate">{uploadedFile.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => setUploadedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Select
                  value={formData.assignee || 'none'}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, assignee: value }))}
                >
                  <SelectTrigger id="assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {assists.map((assist) => (
                      <SelectItem key={assist.id} value={assist.id}>
                        {assist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Input
                  value={formData.assignee && formData.assignee !== 'none' ? 'Assigned' : 'Pending'}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Status updates automatically after assignee selection.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={uploading || !canCreateTasks}>
                {uploading ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks & Progress</h1>
          <p className="text-muted-foreground">Track the progress of your marketing tasks</p>
        </div>
        <Button onClick={() => setViewMode('create')} disabled={!canCreateTasks}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Summary (click to filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['pending', 'assigned', 'in_progress', 'ready_for_review'] as const).map((status) => {
          const config = statusConfig[status];
          const count = tasks.filter((t) => t.status === status).length;
          const isActive = statusFilters.includes(status);
          const showReadyForReviewBadge = status === 'ready_for_review' && count > 0;

          return (
            <button
              key={status}
              type="button"
              onClick={() =>
                setStatusFilters((prev) =>
                  prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                )
              }
              className="text-left"
              aria-pressed={isActive}
              aria-label={`Filter tasks: ${config.label}`}
            >
              <Card
                className={cn(
                  "relative transition-colors",
                  isActive ? "border-primary bg-primary/10" : "hover:bg-muted/20",
                )}
              >
                {showReadyForReviewBadge && (
                  <Badge
                    variant="warning"
                    className="absolute right-2 top-2 min-w-5 justify-center tabular-nums"
                    aria-label={`Ready for Review: ${count}`}
                  >
                    {count > 99 ? '99+' : count}
                  </Badge>
                )}
                <CardContent className="py-4 text-center">
                  <config.icon
                    className={cn(
                      "h-6 w-6 mx-auto mb-2",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className={cn("text-xs", isActive ? "text-primary" : "text-muted-foreground")}>{config.label}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Task List */}
      {visibleTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">
              {tasks.length === 0 ? 'No tasks yet' : 'No tasks for this status'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {tasks.length === 0
                ? 'Create your first task to get started'
                : 'Try clearing the filter to see all tasks.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {tasks.length !== 0 && (
                <Button variant="outline" onClick={() => setStatusFilters([])}>
                  Show All Tasks
                </Button>
              )}
              <Button onClick={() => setViewMode('create')} disabled={!canCreateTasks}>
                <Plus className="h-4 w-4 mr-2" />
                {tasks.length === 0 ? 'Create Task' : 'New Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {statusFilters.length
                ? `${statusFilters.map((s) => (statusConfig[s] ?? { label: s.replace(/_/g, ' ') }).label).join(', ')} Tasks`
                : 'All Tasks'}
            </CardTitle>
            <CardDescription>Tasks created for your Marketing Assist</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleTasks.map((task) => {
              const config = statusConfig[task.status] ?? {
                label: task.status.replace(/_/g, ' '),
                icon: AlertCircle,
                className: 'bg-muted text-muted-foreground',
              };
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className={cn("p-2 rounded-lg", config.className)}>
                    <config.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-foreground">{task.title}</h4>
                          <Badge variant="outline" className="text-xs font-mono">
                            {formatTaskId(task.task_number || 0)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {task.type && (
                            <Badge variant="secondary" className="text-xs">
                              {typeLabels[task.type] || task.type}
                            </Badge>
                          )}
                          {task.platform && (
                            <Badge variant="outline" className="text-xs">
                              {platformLabels[task.platform] || task.platform}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => handleViewTask(task)}>
                          View Progress
                        </Button>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{task.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                      {task.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due: {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {task.assigned_to && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getAssistName(task.assigned_to)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
