import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type TaskStatus = "pending" | "assigned" | "in_progress" | "ready_for_review" | "completed";

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

export function ReportingTasksCard({ days }: { days: number }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskRow[]>([]);

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, task_number, title, status, type, platform, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("status", "completed" as any)
        // use updated_at as completion timestamp
        .gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false });

      if (!error && data) setTasks((data as unknown as TaskRow[]) ?? []);
      if (error) setTasks([]);
      setLoading(false);
    };

    run();
  }, [user, sinceIso]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reporting Tasks</CardTitle>
        <CardDescription>
          Completed tasks in the last {days} days (based on completion time)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{formatTaskId(t.task_number)}</TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{t.type ? typeLabels[t.type] ?? t.type : "-"}</TableCell>
                  <TableCell>
                    {t.platform ? platformLabels[t.platform] ?? t.platform : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Completed</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(t.updated_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
