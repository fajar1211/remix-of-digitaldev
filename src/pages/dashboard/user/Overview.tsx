import { useCallback, useEffect, useState } from 'react';
import { Activity, Package, CheckCircle, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseRealtimeReload } from '@/hooks/useSupabaseRealtimeReload';
import { DashboardEventBanner } from '@/components/dashboard/DashboardEventBanner';

interface DashboardData {
  activePackage: string | null;
  activePackageActivatedAt: string | null;
  activePackageExpiresAt: string | null;
  taskStats: {
    pending: number;
    assigned: number;
    inProgress: number;
    readyForReview: number;
    completed: number;
  };
  unreadMessages: number;
}

function formatDMY(dateIso: string | null | undefined): string {
  if (!dateIso) return '';
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>({
    activePackage: null,
    activePackageActivatedAt: null,
    activePackageExpiresAt: null,
    taskStats: { pending: 0, assigned: 0, inProgress: 0, readyForReview: 0, completed: 0 },
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch active package
      const nowIso = new Date().toISOString();
      const { data: userPackage } = await supabase
        .from('user_packages')
        .select('activated_at,started_at,expires_at,packages(name)')
        .eq('user_id', user.id)
        // Package "current" is determined by timestamps, not user_packages.status.
        .not('activated_at', 'is', null)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('activated_at', { ascending: false })
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch task stats
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', user.id);

      const taskStats = {
        pending: tasks?.filter((t) => t.status === 'pending').length || 0,
        assigned: tasks?.filter((t) => t.status === 'assigned').length || 0,
        inProgress: tasks?.filter((t) => t.status === 'in_progress').length || 0,
        readyForReview: tasks?.filter((t) => t.status === 'ready_for_review').length || 0,
        completed: tasks?.filter((t) => t.status === 'completed').length || 0,
      };

      // Fetch unread messages
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      const pkgObj = Array.isArray((userPackage as any)?.packages)
        ? (userPackage as any).packages[0]
        : (userPackage as any)?.packages;

      const activatedAtIso =
        (userPackage as any)?.activated_at ??
        (userPackage as any)?.started_at ??
        null;

      setData({
        activePackage: (pkgObj as any)?.name || null,
        activePackageActivatedAt: activatedAtIso,
        activePackageExpiresAt: (userPackage as any)?.expires_at ?? null,
        taskStats,
        unreadMessages: count || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Keep overview in sync with database changes.
  useSupabaseRealtimeReload({
    channelName: user ? `dashboard-user-overview:${user.id}` : 'dashboard-user-overview:anonymous',
    targets: user
      ? [
          { table: 'user_packages', filter: `user_id=eq.${user.id}` },
          { table: 'tasks', filter: `user_id=eq.${user.id}` },
          { table: 'messages', filter: `receiver_id=eq.${user.id}` },
        ]
      : [],
    debounceMs: 350,
    onChange: fetchDashboardData,
  });

  const totalTasks =
    data.taskStats.pending +
    data.taskStats.assigned +
    data.taskStats.inProgress +
    data.taskStats.readyForReview +
    data.taskStats.completed;
  const progressPercent = totalTasks > 0 ? (data.taskStats.completed / totalTasks) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground">We're working on your marketing.</p>
      </div>

      <DashboardEventBanner audience="user" />

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Marketing Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
              {data.activePackage ? 'Active' : 'In Progress'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              {data.activePackage ? `${data.activePackage}` : 'Setting up your marketing'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Package</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.activePackage || 'None'}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Your current marketing package</p>
              {data.activePackage ? (
                <>
                  <p>
                    Active since{' '}
                    {formatDMY(data.activePackageActivatedAt) || '-'}
                  </p>
                  <p>
                    Expires on{' '}
                    {formatDMY(data.activePackageExpiresAt) || '-'}
                  </p>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.taskStats.completed}/{totalTasks}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.taskStats.inProgress} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.unreadMessages}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Unread messages
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
          <CardDescription>Your marketing setup progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall completion</span>
              <span className="font-medium text-foreground">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{data.taskStats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary">
              <p className="text-2xl font-bold text-secondary-foreground">{data.taskStats.assigned}</p>
              <p className="text-xs text-secondary-foreground/80">Assigned</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{data.taskStats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-accent/10">
              <p className="text-2xl font-bold text-accent">{data.taskStats.readyForReview}</p>
              <p className="text-xs text-muted-foreground">Ready for Review</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
