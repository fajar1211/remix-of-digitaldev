import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type TaskStatus = "pending" | "assigned" | "in_progress" | "ready_for_review" | "completed" | "cancelled";

interface TaskRow {
  id: string;
  task_number: number | null;
  title: string;
  status: TaskStatus;
  type: "blog" | "social_media" | "email_marketing" | "ads" | "others" | null;
  platform: "facebook" | "instagram" | "x" | "threads" | "linkedin" | null;
  created_at: string;
  updated_at: string;
}

const typeLabels: Record<string, string> = {
  blog: "Blog",
  social_media: "Social Media",
  email_marketing: "Email Marketing",
  ads: "Ads",
  others: "Others",
};

const platformLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  threads: "Threads",
  linkedin: "LinkedIn",
};

function formatTaskId(num: number | null) {
  if (!num) return "-";
  return `T${String(num).padStart(5, "0")}`;
}

export function AdminReportingTasksCard({ days, userId }: { days: number; userId: string | null }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  useEffect(() => {
    const run = async () => {
      if (!userId) {
        setTasks([]);
        return;
      }

      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, task_number, title, status, type, platform, created_at, updated_at")
        .eq("user_id", userId)
        .in("status", ["completed", "cancelled"] as any)
        .gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false });

      if (!error && data) setTasks((data as unknown as TaskRow[]) ?? []);
      if (error) setTasks([]);
      setLoading(false);
    };

    void run();
  }, [sinceIso, userId]);

  const handleDelete = async () => {
    if (!deleteTaskId) return;

    setDeleting(true);
    const { error } = await (supabase as any)
      .from("tasks")
      .delete()
      .eq("id", deleteTaskId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete task.",
      });
    } else {
      toast({
        title: "Success",
        description: "Task deleted permanently.",
      });
      // Remove from local state
      setTasks((prev) => prev.filter((t) => t.id !== deleteTaskId));
    }

    setDeleting(false);
    setDeleteTaskId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Reporting Tasks</CardTitle>
          <CardDescription>
            Completed and cancelled tasks in the last {days} days (based on update time)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!userId ? (
            <div className="text-sm text-muted-foreground">Select a business to view completed tasks.</div>
          ) : loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : tasks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No completed tasks in this period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Completed At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{formatTaskId(t.task_number)}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{t.type ? typeLabels[t.type] ?? t.type : "-"}</TableCell>
                    <TableCell>{t.platform ? platformLabels[t.platform] ?? t.platform : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "cancelled" ? "destructive" : "outline"}>
                        {t.status === "completed" ? "Completed" : "Cancelled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTaskId(t.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTaskId !== null} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task and all associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>No, Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
