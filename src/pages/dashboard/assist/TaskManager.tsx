import { useEffect, useState, useRef } from 'react';
import { CheckSquare, Clock, AlertCircle, CheckCircle, Plus, Upload, Download, X, ArrowLeft, Eye, FileText, Link as LinkIcon, Image, Camera, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { fetchActiveBusinesses } from '@/lib/activeBusinesses';

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
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface WorkLog {
  id: string;
  task_id: string;
  user_id: string;
  time_spent: number | null;
  work_description: string | null;
  shared_url: string | null;
  file_url: string | null;
  screenshot_url: string | null;
  status: string;
  created_at: string;
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

interface Client {
  id: string;
  name: string;
  email: string;
  business_name: string | null;
}

interface AssistUser {
  id: string;
  name: string;
  email: string;
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

const workLogStatusOptions = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready_for_review', label: 'Ready for Review' },
];

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

export default function TaskManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workLogFileRef = useRef<HTMLInputElement>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assistUsers, setAssistUsers] = useState<AssistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [uploading, setUploading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [sortByAssist, setSortByAssist] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Task['status']>('all');
  const [nextTaskNumber, setNextTaskNumber] = useState(100);
  const [assistName, setAssistName] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    platform: '',
    clientId: '',
    deadline: '',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Work log form state
  type WorkLogStatus = 'in_progress' | 'ready_for_review';

  const [workLogForm, setWorkLogForm] = useState<{
    hours: string;
    minutes: string;
    workDescription: string;
    sharedUrl: string;
    status: WorkLogStatus;
  }>({
    hours: '',
    minutes: '',
    workDescription: '',
    sharedUrl: '',
    status: 'in_progress',
  });
  const [workLogFile, setWorkLogFile] = useState<File | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [savingWorkLog, setSavingWorkLog] = useState(false);
  const [workLogLocked, setWorkLogLocked] = useState(false);

  // Work log delete requests (assist -> business owner approval)
  const [deleteRequests, setDeleteRequests] = useState<WorkLogDeleteRequest[]>([]);

  const [activeDeleteRequestLogId, setActiveDeleteRequestLogId] = useState<string | null>(null);
  const [deleteRequestReason, setDeleteRequestReason] = useState('');
  const [sendingDeleteRequest, setSendingDeleteRequest] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchClients();
    fetchAssistUsers();
  }, []);

  // Lock the assignee filter to the currently logged-in assist (disabled in UI)
  useEffect(() => {
    if (user?.id) setSortByAssist(user.id);
  }, [user?.id]);

 const fetchTasks = async () => {
    const { data } = await (supabase as any)
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setTasks((data as unknown as Task[]) ?? []);
      // Calculate next task number starting from 100
      const maxNum = (data as any[]).reduce((max, t) => Math.max(max, t.task_number || 0), 99);
      setNextTaskNumber(maxNum + 1);
    }
    setLoading(false);
  };

 const fetchClients = async () => {
    // Only fetch users with 'user' role (not assist)
    const { data: userRoles } = await (supabase as any)
      .from('user_roles')
      .select('user_id')
      .eq('role', 'user');

    const userIds = (userRoles as any[])?.map((r) => r.user_id) || [];

    // Keep only Active clients (synced from user_packages -> profiles)
    const activeBusinesses = await fetchActiveBusinesses({ select: 'user_id, business_name', orderByBusinessName: true });
    const businesses = (activeBusinesses ?? []).filter((b) => userIds.includes((b as any).user_id));

    const filteredClients: Client[] = ((businesses as any[]) || [])
      .filter((b) => b.business_name)
      .map((business) => ({
        id: business.user_id,
        name: business.business_name || '',
        email: '',
        business_name: business.business_name,
      }))
      // Sort by business_name
      .sort((a, b) => (a.business_name || '').localeCompare(b.business_name || ''));

    setClients(filteredClients);
  };

 const fetchAssistUsers = async () => {
    const { data: userRoles } = await (supabase as any)
      .from('user_roles')
      .select('user_id')
      .eq('role', 'assist');

    const assistIds = (userRoles as any[])?.map((r) => r.user_id) || [];

    const { data: profiles } = await (supabase as any)
      .from('profiles')
      .select('id, name, email')
      .in('id', assistIds)
      .order('name', { ascending: true });

    // Sort by full name
    const sorted = ((profiles as any[]) || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')) as AssistUser[];
    setAssistUsers(sorted);

    // Set current assist full name for disabled Assignee field
    if (user) {
      const currentAssist = (sorted || []).find((p) => p.id === user.id);
      if (currentAssist?.name) {
        setAssistName(currentAssist.name);
      }
    }
  };

  const fetchDeleteRequests = async (taskId: string) => {
    const { data } = await (supabase as any)
      .from('work_log_delete_requests')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    setDeleteRequests(((data as any[]) || []) as WorkLogDeleteRequest[]);
  };

  const fetchWorkLogs = async (taskId: string) => {
    const { data } = await (supabase as any)
      .from('task_work_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    setWorkLogs(((data as any[]) || []) as WorkLog[]);
  };

  // Real-time subscription for tasks
  useEffect(() => {
    const channel = (supabase as any)
      .channel('assist-tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) => prev.map((t) => (t.id === payload.new.id ? (payload.new as Task) : t)));
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Real-time subscription for delete requests (so assist can see rejected/pending updates)
  useEffect(() => {
    if (!selectedTask || viewMode !== 'view') return;

    const channel = supabase
      .channel(`work-log-delete-requests-${selectedTask.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_log_delete_requests',
          filter: `task_id=eq.${selectedTask.id}`,
        },
        () => {
          fetchDeleteRequests(selectedTask.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTask?.id, viewMode]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: '',
      platform: '',
      clientId: '',
      deadline: '',
    });
    setUploadedFile(null);
    setViewMode('list');
  };

  const resetWorkLogForm = (opts?: { keepStatus?: WorkLogStatus }) => {
    setWorkLogForm((prev) => ({
      hours: '',
      minutes: '',
      workDescription: '',
      sharedUrl: '',
      status: opts?.keepStatus ?? prev.status,
    }));
    setWorkLogFile(null);
    setScreenshotFile(null);
    setWorkLogLocked(false);
  };

  const initWorkLogForTask = (task: Task) => {
    // Requirement: when a task is Assigned, auto-fill the work log (30 minutes + review text)
    // and lock the inputs until the assist clicks "Start Now".
    if (task.status === 'assigned') {
      setWorkLogLocked(true);
      setWorkLogForm({
        hours: '',
        minutes: '30',
        workDescription: 'review Tasks',
        sharedUrl: '',
        status: 'in_progress',
      });
      return;
    }

    setWorkLogLocked(false);
    setWorkLogForm({
      hours: '',
      minutes: '',
      workDescription: '',
      sharedUrl: '',
      status: getDefaultWorkLogStatusForTask(task),
    });
  };

  const getDefaultWorkLogStatusForTask = (task: Task): WorkLogStatus => {
    return task.status === 'ready_for_review' ? 'ready_for_review' : 'in_progress';
  };

  const getTotalMinutes = (hours: string, minutes: string) => {
    const h = Number.parseInt(hours || '0', 10);
    const m = Number.parseInt(minutes || '0', 10);
    const safeH = Number.isFinite(h) && h >= 0 ? h : 0;
    const safeM = Number.isFinite(m) && m >= 0 ? m : 0;
    return safeH * 60 + safeM;
  };

  const formatMinutesAsHoursMinutes = (totalMinutes: number | null | undefined) => {
    const safe = typeof totalMinutes === 'number' && Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : 0;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    if (h === 0 && m === 0) return '0h 0m';
    if (h === 0) return `0h ${m}m`;
    return `${h}h ${m}m`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.clientId || !user) {
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
      const filePath = `${formData.clientId}/tasks/${Date.now()}-${uploadedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, uploadedFile);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }
    }

    const { data, error } = await (supabase as any)
      .from('tasks')
      .insert({
        user_id: formData.clientId,
        title: formData.title,
        description: formData.description || null,
        type: (formData.type as any) || null,
        platform: formData.type === 'social_media' ? (formData.platform as any) : null,
        assigned_to: user.id,
        deadline: formData.deadline || null,
        file_url: fileUrl,
        notes: null,
        status: 'pending',
      })
      .select('id, task_number')
      .maybeSingle();

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
      const createdTaskNumber = Number(data?.task_number ?? nextTaskNumber);

      setNextTaskNumber(createdTaskNumber + 1);
      toast({
        title: 'Task Created',
        description: `Task "${formData.title}" has been created with ID T${String(createdTaskNumber).padStart(5, '0')}.`,
      });
      resetForm();
    }
  };

  const handleSaveWorkLog = async () => {
    if (!selectedTask || !user) return;

    setSavingWorkLog(true);
    let fileUrl: string | null = null;
    let screenshotUrl: string | null = null;

    try {
      // Upload file if exists
      if (workLogFile) {
        const filePath = `${selectedTask.user_id}/work-logs/${Date.now()}-${workLogFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, workLogFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('user-files')
            .getPublicUrl(filePath);
          fileUrl = urlData.publicUrl;
        }
      }

      // Upload screenshot if exists
      if (screenshotFile) {
        const filePath = `${selectedTask.user_id}/work-logs/screenshots/${Date.now()}-${screenshotFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, screenshotFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('user-files')
            .getPublicUrl(filePath);
          screenshotUrl = urlData.publicUrl;
        }
      }

      const totalMinutes = getTotalMinutes(workLogForm.hours, workLogForm.minutes);

      const { error } = await (supabase as any)
        .from('task_work_logs')
        .insert({
          task_id: selectedTask.id,
          user_id: user.id,
          time_spent: totalMinutes > 0 ? totalMinutes : null,
          work_description: workLogForm.workDescription || null,
          shared_url: workLogForm.sharedUrl || null,
          file_url: fileUrl,
          screenshot_url: screenshotUrl,
          status: workLogForm.status,
        });

      if (error) throw error;

      // Sync task status with Work Log status (only for allowed transitions)
      if (workLogForm.status === 'in_progress' || workLogForm.status === 'ready_for_review') {
        const { error: taskUpdateError } = await (supabase as any)
          .from('tasks')
          .update({ status: workLogForm.status as any })
          .eq('id', selectedTask.id);

        if (taskUpdateError) throw taskUpdateError;

        // Update UI immediately
        setSelectedTask((prev) => (prev ? { ...prev, status: workLogForm.status as any } : prev));
        setTasks((prev) => prev.map((t) => (t.id === selectedTask.id ? { ...t, status: workLogForm.status as any } : t)));
      }

      toast({
        title: 'Work Log Added',
        description: 'Your work log has been saved.',
      });

      // Keep the selected status active after saving
      resetWorkLogForm({ keepStatus: workLogForm.status });
      fetchWorkLogs(selectedTask.id);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save work log.',
      });
    } finally {
      setSavingWorkLog(false);
    }
  };

  const handleStartNow = async () => {
    // Requirement: when clicking "Start Now" (pending), immediately insert the auto-filled work log to DB.
    if (!selectedTask || !user) return;
    await handleSaveWorkLog();
    setWorkLogLocked(false);
  };

  const handleSendDeleteRequest = async (workLogId: string) => {
    if (!selectedTask || !user) return;

    const reason = deleteRequestReason.trim();
    if (!reason) {
      toast({
        variant: 'destructive',
        title: 'Reason required',
        description: 'Please provide a reason for deleting this work log.',
      });
      return;
    }

    setSendingDeleteRequest(true);
    try {
      const { error } = await (supabase as any).from('work_log_delete_requests').insert({
        work_log_id: workLogId,
        task_id: selectedTask.id,
        requester_id: user.id,
        owner_id: selectedTask.user_id,
        reason,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Request sent',
        description: 'Delete request has been sent to the business owner for approval.',
      });

      await fetchDeleteRequests(selectedTask.id);

      setActiveDeleteRequestLogId(null);
      setDeleteRequestReason('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err?.message || 'Failed to send delete request.',
      });
    } finally {
      setSendingDeleteRequest(false);
    }
  };

  const getClientName = (userId: string) => {
    const client = clients.find(c => c.id === userId);
    return client?.business_name || client?.name || 'Unknown';
  };

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return '-';
    const assist = assistUsers.find(a => a.id === assigneeId);
    return assist?.name || 'Unknown';
  };

  const getTaskId = (task: Task) => {
    return task.task_number ? `T${String(task.task_number).padStart(5, '0')}` : '-';
  };

  // Sort and filter tasks
  const filteredTasks = tasks
    // Force filter by current assist account (as requested)
    .filter((task) => (!sortByAssist ? true : task.assigned_to === sortByAssist))
    .filter((task) => (filterStatus === 'all' ? true : task.status === filterStatus))
    .sort((a, b) => {
      if (sortByAssist) {
        return getAssigneeName(a.assigned_to).localeCompare(getAssigneeName(b.assigned_to));
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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

  // Task View Mode with Work Log
  if (viewMode === 'view' && selectedTask) {
    const config = statusConfig[selectedTask.status] ?? statusConfig.pending;
    const isTaskFinalized = selectedTask.status === 'completed' || selectedTask.status === 'cancelled' || selectedTask.status === 'ready_for_review';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode('list'); setSelectedTask(null); setWorkLogs([]); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Task Details</h1>
            <p className="text-muted-foreground">{getTaskId(selectedTask)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Task Info</CardTitle>
                  <CardDescription>Update the core details of this task</CardDescription>
                </div>
                <Badge variant="outline" className={config.className}>
                  {config.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Task ID</Label>
                <Input value={getTaskId(selectedTask)} disabled className="bg-muted font-mono" />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Task Title</Label>
                <Input value={selectedTask.title} disabled className="bg-muted" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Business Name</Label>
                  <p className="font-medium">{getClientName(selectedTask.user_id)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assignee</Label>
                  <p className="font-medium">{getAssigneeName(selectedTask.assigned_to)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <Input
                    value={new Date(selectedTask.created_at).toLocaleString()}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Deadline</Label>
                  <Input
                    type="date"
                    value={selectedTask.deadline ? selectedTask.deadline.split('T')[0] : ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <Select value={selectedTask.type || ''} disabled>
                    <SelectTrigger className="bg-muted">
                      <SelectValue placeholder="-" />
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
                {selectedTask.type === 'social_media' && (
                  <div>
                    <Label className="text-muted-foreground">Platform</Label>
                    <Select value={selectedTask.platform || ''} disabled>
                      <SelectTrigger className="bg-muted">
                        <SelectValue placeholder="-" />
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
                <Label className="text-muted-foreground">Description</Label>
                <Textarea value={selectedTask.description || ''} disabled className="bg-muted" rows={4} />
              </div>

              {selectedTask.file_url && (
                <div>
                  <Label className="text-muted-foreground">File</Label>
                  <a
                    href={selectedTask.file_url}
                    download
                    className="mt-1 inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Download File
                  </a>
                </div>
              )}

              <div className="flex justify-end">
                <Button disabled variant="secondary">
                  {isTaskFinalized ? (selectedTask.status === 'completed' ? 'Completed' : 'Cancelled') : 'Read-only'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Work Log */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Work Log
                </CardTitle>
                <CardDescription>Track your progress on this task</CardDescription>
              </div>
              {workLogs.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      View History
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Work Log History</DialogTitle>
                    </DialogHeader>

                     <div className="mt-2 max-h-[26rem] overflow-y-auto pr-1">
                      <div className="space-y-3">
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                          <div className="text-xs text-muted-foreground">Total Time Spent (history)</div>
                          <div className="mt-1 font-medium text-foreground">
                            {formatMinutesAsHoursMinutes(
                              workLogs.reduce((sum, l) => sum + (typeof l.time_spent === 'number' ? l.time_spent : 0), 0)
                            )}
                          </div>
                        </div>

                        {workLogs.map((log) => {
                          const statusKey = log.status as Task['status'];
                          const badgeCfg = statusConfig[statusKey] ?? {
                            label: log.status.replace(/_/g, ' '),
                            icon: FileText,
                            className: 'bg-muted text-muted-foreground',
                          };
                          const StatusIcon = badgeCfg.icon;
                          const isDeleteActive = activeDeleteRequestLogId === log.id;

                          const latestReqForLog = deleteRequests.find((r) => r.work_log_id === log.id);
                          const deleteDisabled = latestReqForLog?.status === 'pending';
                          const showRejectedLabel = latestReqForLog?.status === 'rejected';

                          return (
                            <div key={log.id} className="rounded-lg border bg-background p-4 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn('gap-1', badgeCfg.className)}>
                                      <StatusIcon className="h-3.5 w-3.5" />
                                      {badgeCfg.label}
                                    </Badge>

                                    {showRejectedLabel && (
                                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                                        REJECTED DELETE
                                      </Badge>
                                    )}

                                    <span className="text-xs text-muted-foreground">
                                      {new Date(log.created_at).toLocaleString()}
                                    </span>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-3 text-muted-foreground">
                                    <span className="inline-flex items-center gap-2">
                                      <Clock className="h-4 w-4" />
                                      <span>
                                        Time Spent: {formatMinutesAsHoursMinutes(log.time_spent)}
                                      </span>
                                    </span>
                                  </div>

                                  {log.work_description && (
                                    <p className="mt-2 whitespace-pre-wrap leading-relaxed">{log.work_description}</p>
                                  )}
                                </div>

                                <div className="shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={deleteDisabled || isTaskFinalized}
                                    onClick={() => {
                                      if (isTaskFinalized) return;
                                      setActiveDeleteRequestLogId(log.id);
                                      setDeleteRequestReason('');
                                    }}
                                  >
                                    {deleteDisabled ? 'Requested' : 'Delete'}
                                  </Button>
                                </div>
                              </div>

                              {(log.shared_url || log.file_url || log.screenshot_url) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {log.shared_url && (
                                    <a
                                      href={log.shared_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                                    >
                                      <LinkIcon className="h-4 w-4" />
                                      Shared URL
                                    </a>
                                  )}
                                  {log.file_url && (
                                    <a
                                      href={log.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                                    >
                                      <Upload className="h-4 w-4" />
                                      File
                                    </a>
                                  )}
                                  {log.screenshot_url && (
                                    <a
                                      href={log.screenshot_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                                    >
                                      <Image className="h-4 w-4" />
                                      Screenshot
                                    </a>
                                  )}
                                </div>
                              )}

                              {isDeleteActive && (
                                <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-3">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Reason for delete request</Label>
                                    <Textarea
                                      value={deleteRequestReason}
                                      onChange={(e) => setDeleteRequestReason(e.target.value)}
                                      placeholder="Examples: wrong file uploaded, incorrect time spent, etc."
                                      rows={3}
                                      disabled={sendingDeleteRequest || isTaskFinalized}
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => {
                                        setActiveDeleteRequestLogId(null);
                                        setDeleteRequestReason('');
                                      }}
                                      disabled={sendingDeleteRequest}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => handleSendDeleteRequest(log.id)}
                                      disabled={sendingDeleteRequest || isTaskFinalized}
                                    >
                                      {sendingDeleteRequest ? 'Sending...' : 'Send Request'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={cn(isTaskFinalized && "pointer-events-none opacity-60")}>
                <div className="space-y-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="1"
                        value={workLogForm.hours}
                        onChange={(e) => setWorkLogForm((prev) => ({ ...prev, hours: e.target.value }))}
                        disabled={isTaskFinalized || workLogLocked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Minutes</Label>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="30"
                        value={workLogForm.minutes}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setWorkLogForm((prev) => ({ ...prev, minutes: '' }));
                            return;
                          }
                          const n = Number.parseInt(raw, 10);
                          const safe = Number.isFinite(n) ? Math.min(59, Math.max(0, n)) : 0;
                          setWorkLogForm((prev) => ({ ...prev, minutes: String(safe) }));
                        }}
                        disabled={isTaskFinalized || workLogLocked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={workLogForm.status}
                        onValueChange={(value) =>
                          setWorkLogForm((prev) => ({ ...prev, status: value as WorkLogStatus }))
                        }
                        disabled={isTaskFinalized || workLogLocked}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {workLogStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Work Description</Label>
                  <Textarea
                    placeholder="Describe what you worked on..."
                    value={workLogForm.workDescription}
                    onChange={(e) => setWorkLogForm((prev) => ({ ...prev, workDescription: e.target.value }))}
                    rows={3}
                    disabled={isTaskFinalized || workLogLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Shared URL
                  </Label>
                  <Input
                    placeholder="https://..."
                    value={workLogForm.sharedUrl}
                    onChange={(e) => setWorkLogForm((prev) => ({ ...prev, sharedUrl: e.target.value }))}
                    disabled={isTaskFinalized || workLogLocked}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload File
                    </Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => (isTaskFinalized || workLogLocked ? undefined : workLogFileRef.current?.click())}
                    >
                      {workLogFile ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate">{workLogFile.name}</span>
                          <X
                            className="h-4 w-4 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWorkLogFile(null);
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Click to upload</span>
                      )}
                    </div>
                    <input
                      ref={workLogFileRef}
                      type="file"
                      onChange={(e) => e.target.files?.[0] && setWorkLogFile(e.target.files[0])}
                      className="hidden"
                      disabled={isTaskFinalized || workLogLocked}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Screenshot
                    </Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => (isTaskFinalized || workLogLocked ? undefined : screenshotRef.current?.click())}
                    >
                      {screenshotFile ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm truncate">{screenshotFile.name}</span>
                          <X
                            className="h-4 w-4 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setScreenshotFile(null);
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Click to upload</span>
                      )}
                    </div>
                    <input
                      ref={screenshotRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && setScreenshotFile(e.target.files[0])}
                      className="hidden"
                      disabled={isTaskFinalized || workLogLocked}
                    />
                  </div>
                </div>

                {workLogLocked && !isTaskFinalized ? (
                  <Button
                    type="button"
                    onClick={handleStartNow}
                    className="w-full"
                  >
                    Start Now
                  </Button>
                ) : (
                  <Button onClick={handleSaveWorkLog} disabled={savingWorkLog || isTaskFinalized} className="w-full">
                    {isTaskFinalized ? (selectedTask.status === 'completed' ? 'Completed' : 'Cancelled') : savingWorkLog ? 'Saving...' : 'Add Work Log'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
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
            <p className="text-muted-foreground">Add a new task for a client</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
            <CardDescription>Fill in the details for the new task</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Task ID</Label>
                <Input value={`T${String(nextTaskNumber).padStart(5, '0')}`} disabled className="bg-muted font-mono" />
                <p className="text-xs text-muted-foreground">Auto-generated task ID</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client * (Business Name)</Label>
                <Select 
                  value={formData.clientId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
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
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Click to upload file</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="task-file-upload"
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                <Input
                  id="assignee"
                  value={assistName || (user?.email ?? '')}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Automatically assigned to you</p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={uploading}>
                {uploading ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Task List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Task Manager</h1>
          <p className="text-muted-foreground">Manage client tasks and assignments.</p>
        </div>
        <Button onClick={() => setViewMode('create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-3">
          <Label>Assignee:</Label>
          <Input
            value={assistName || (user?.email ?? '')}
            disabled
            className="w-[240px] bg-muted"
          />
        </div>

        <div className="flex items-center gap-3">
          <Label>Status:</Label>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="ready_for_review">Ready for Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center">
              <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tasks yet</h3>
              <p className="text-muted-foreground mb-4">Create your first task to get started</p>
              <Button onClick={() => setViewMode('create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Task
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Task Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const config = statusConfig[task.status] ?? {
                    label: task.status.replace(/_/g, ' '),
                    icon: AlertCircle,
                    className: 'bg-muted text-muted-foreground',
                  };
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono">{getTaskId(task)}</TableCell>
                      <TableCell className="font-medium">{getClientName(task.user_id)}</TableCell>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.className}>
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{getAssigneeName(task.assigned_to)}</TableCell>
                      <TableCell>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setViewMode('view');
                            setWorkLogs([]);
                            setDeleteRequests([]);
                            setWorkLogFile(null);
                            setScreenshotFile(null);
                            initWorkLogForTask(task);
                            fetchWorkLogs(task.id);
                            fetchDeleteRequests(task.id);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
