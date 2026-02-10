import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import {
  Home,
  Users,
  CheckSquare,
  Sparkles,
  MessageCircle,
  BarChart3,
  Activity,
  Settings,
  User,
  PenLine,
  Images,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { supabase } from '@/integrations/supabase/client';
import { AssistSidebar, type AssistNavItem } from '@/components/assist/AssistSidebar';
import { DashboardEventBanner } from '@/components/dashboard/DashboardEventBanner';

import AssistOverview from './assist/overview/AssistOverview';

// Import components
import ClientList from './assist/ClientList';
import TaskManager from './assist/TaskManager';
import ContentCreation from './assist/ContentCreation';
import AssistMediaLibrary from './assist/MediaLibrary';
import AssistCalendar from './assist/Calendar';
import AssistScheduledContentView from './assist/calendar/ViewScheduledContent';
import AIGenerator from './assist/AIGenerator';
import AssistMessages from './assist/Messages';
import Reports from './assist/Reports';
import LogActivity from './assist/LogActivity';
import AssistSettings from './assist/Settings';
import AssistProfile from './assist/Profile';
import AssistSupportLocked from './assist/SupportLocked';

const mainMenuItemsBase: AssistNavItem[] = [
  { title: 'Overview', url: '/dashboard/assist', icon: Home },
  { title: 'Profile', url: '/dashboard/assist/profile', icon: User },
  { title: 'Client List', url: '/dashboard/assist/clients', icon: Users },
  { title: 'Task Manager', url: '/dashboard/assist/tasks', icon: CheckSquare },
  { title: 'Content Creation', url: '/dashboard/assist/content-creation', icon: PenLine },
  { title: 'Media Library', url: '/dashboard/assist/media-library', icon: Images },
  { title: 'Calendar', url: '/dashboard/assist/calendar', icon: CalendarDays },
  { title: 'AI Agents', url: '/dashboard/assist/ai-agents', icon: Sparkles },
  { title: 'Messages', url: '/dashboard/assist/messages', icon: MessageCircle },
  { title: 'Reports', url: '/dashboard/assist/reports', icon: BarChart3 },
  { title: 'Log Activity', url: '/dashboard/assist/log-activity', icon: Activity },
  { title: 'Settings', url: '/dashboard/assist/settings', icon: Settings },
];

export default function AssistDashboard() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [accountChecked, setAccountChecked] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string>('active');
  const [profileName, setProfileName] = useState<string>('');
  const [profileEmail, setProfileEmail] = useState<string>('');
  const [assignedTasksCount, setAssignedTasksCount] = useState(0);
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [taskStats, setTaskStats] = useState({
    pending: 0,
    assigned: 0,
    inProgress: 0,
    readyForReview: 0,
    completed: 0,
  });

  // Prevent the document body from becoming the scroll container on mobile.
  // Keep scrolling inside the dashboard <main> (and hide its scrollbar indicator).
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  const fetchAssignedTasksCount = async () => {
    if (!user?.id) return;

    // Assist Task Manager is locked to the current assist account (assigned_to = assist)
    const { count, error } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", user.id)
      .eq("status", "assigned");

    if (error) return;
    setAssignedTasksCount(Number(count ?? 0));
  };

  const fetchTaskStats = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select('status')
        .eq('assigned_to', user.id);

      if (error) throw error;

      const next = {
        pending: 0,
        assigned: 0,
        inProgress: 0,
        readyForReview: 0,
        completed: 0,
      };

      (data ?? []).forEach((row: any) => {
        const s = String(row?.status ?? '').toLowerCase();
        if (s === 'pending') next.pending += 1;
        else if (s === 'assigned') next.assigned += 1;
        else if (s === 'in_progress') next.inProgress += 1;
        else if (s === 'ready_for_review') next.readyForReview += 1;
        else if (s === 'completed') next.completed += 1;
      });

      setTaskStats(next);
      // Keep sidebar badge consistent
      setAssignedTasksCount(next.assigned);
    } catch (e) {
      console.error('Error fetching task stats:', e);
    }
  };

  const fetchActiveClientsCount = async () => {
    try {
      const { data: userRoles, error: rolesErr } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'user');
      if (rolesErr) throw rolesErr;

      const userIds = (userRoles as any[])?.map((r) => r.user_id).filter(Boolean) ?? [];
      if (userIds.length === 0) {
        setActiveClientsCount(0);
        return;
      }

      // Align with Client List definition: active == payment_active
      const { count, error } = await (supabase as any)
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('payment_active', true)
        .in('id', userIds);

      if (error) throw error;
      setActiveClientsCount(Number(count ?? 0));
    } catch (e) {
      console.error('Error fetching active clients count:', e);
    }
  };

  const fetchUnreadMessagesCount = async () => {
    if (!user?.id) return;
    try {
      const { count, error } = await (supabase as any)
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .or('is_read.is.null,is_read.eq.false');

      if (error) throw error;
      setUnreadMessagesCount(Number(count ?? 0));
    } catch (e) {
      console.error('Error fetching unread messages count:', e);
    }
  };

  useEffect(() => {
    if (!user?.id || role !== 'assist') return;

    void fetchTaskStats();
    void fetchActiveClientsCount();
    void fetchUnreadMessagesCount();

    const channel = supabase
      .channel(`assist-tasks-badge-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => void fetchTaskStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => void fetchActiveClientsCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => void fetchActiveClientsCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const row = (payload as any)?.new ?? (payload as any)?.old;
          // Only refresh if this message impacts this assist's inbox
          if (row?.receiver_id !== user.id) return;
          void fetchUnreadMessagesCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  const mainMenuItems: AssistNavItem[] = useMemo(() => {
    return mainMenuItemsBase.map((item) => {
      if (item.url === '/dashboard/assist/tasks') {
        return {
          ...item,
          badgeCount: assignedTasksCount > 0 ? assignedTasksCount : undefined,
        };
      }
      return item;
    });
  }, [assignedTasksCount]);

  const welcomeName = useMemo(() => {
    if (!user) return '';
    const meta: any = (user as any)?.user_metadata ?? {};
    const fromMeta = (meta?.name as string | undefined)?.trim();
    const first = (meta?.first_name as string | undefined)?.trim();
    const last = (meta?.last_name as string | undefined)?.trim();
    const combined = [first, last].filter(Boolean).join(' ').trim();
    return (fromMeta || combined || user.email?.split('@')[0] || '');
  }, [user]);

  useEffect(() => {
    if (!loading && (!user || role !== 'assist')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  useEffect(() => {
    if (!loading && user && role === 'assist') {
      (async () => {
        try {
          const { data, error } = await (supabase as any)
            .from('profiles')
            .select('account_status, name, email')
            .eq('id', user.id)
            .maybeSingle();

          if (error) throw error;

          setProfileStatus(String((data as any)?.account_status ?? 'active'));
          setProfileName(String((data as any)?.name ?? ''));
          setProfileEmail(String((data as any)?.email ?? user.email ?? ''));
        } catch (err) {
          console.error('Error checking profile status:', err);
          setProfileStatus('active');
          setProfileName('');
          setProfileEmail(String(user.email ?? ''));
        } finally {
          setAccountChecked(true);
        }
      })();
    } else if (!loading) {
      setAccountChecked(true);
    }
  }, [loading, user, role]);

  useEffect(() => {
    if (!loading && user && role === 'assist') {
      (async () => {
        try {
          const isActive = String(profileStatus ?? 'active').toLowerCase() === 'active';
          if (!isActive) {
            setOnboardingChecked(true);
            return;
          }

          // If opened via Super Admin magic-link, allow bypass orientation check (verified server-side).
          const imp = new URLSearchParams(window.location.search).get('imp');
          if (imp) {
            try {
              const { data, error } = await supabase.functions.invoke('super-admin-impersonation-verify', {
                body: { token: imp },
              });
              if (!error && (data as any)?.allow === true) {
                setOnboardingChecked(true);
                return;
              }
            } catch {
              // ignore and fall back
            }
          }

          const { data, error } = await (supabase as any)
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', user.id)
            .maybeSingle();

          if (error) throw error;

          const completed = (data as any)?.onboarding_completed ?? false;

          if (!completed) {
            navigate('/orientation/welcome');
          } else {
            setOnboardingChecked(true);
          }
        } catch (err) {
          console.error('Error checking onboarding status:', err);
          setOnboardingChecked(true);
        }
      })();
    }
  }, [loading, user, role, navigate, profileStatus]);

  if (loading || !accountChecked || (role === 'assist' && !onboardingChecked)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) return null;

  const isActive = String(profileStatus ?? 'active').toLowerCase() === 'active';
  if (!isActive) {
    return (
      <AssistSupportLocked
        name={profileName || (welcomeName || 'Assistant')}
        email={profileEmail || ''}
        status={profileStatus}
        onLogout={signOut}
      />
    );
  }


  return (
    <SidebarProvider>
      <div className="h-[100dvh] flex w-full overflow-hidden">
          <AssistSidebar items={mainMenuItems} onLogout={signOut} />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <header className="sticky top-0 z-20 h-12 flex items-center gap-3 border-b border-border bg-background px-3">
            <SidebarTrigger />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">Welcome {welcomeName}</div>
              <div className="text-xs text-muted-foreground truncate">Workspace</div>
            </div>
          </header>

          <main className="flex-1 min-h-0 p-3 sm:p-4 lg:p-6 bg-background overflow-y-auto overflow-x-hidden overscroll-y-contain no-scrollbar">
            <Routes>
              <Route
                index
                element={
                  <div className="space-y-4">
                    <DashboardEventBanner audience="assist" />
                    <AssistOverview
                      accountStatus={profileStatus}
                      activeClients={activeClientsCount}
                      assignedTasks={assignedTasksCount}
                      unreadMessages={unreadMessagesCount}
                      taskStats={taskStats}
                    />
                  </div>
                }
              />
              <Route path="profile" element={<AssistProfile />} />
              <Route path="clients" element={<ClientList />} />
              <Route path="tasks" element={<TaskManager />} />
              <Route path="content-creation" element={<ContentCreation />} />
              <Route path="media-library" element={<AssistMediaLibrary />} />
              <Route path="calendar" element={<AssistCalendar />} />
              <Route path="calendar/view/:id" element={<AssistScheduledContentView />} />
              {/* Backward-compatible route */}
              <Route path="ai-generator" element={<Navigate to="/dashboard/assist/ai-agents" replace />} />
              <Route path="ai-agents" element={<AIGenerator />} />
              <Route path="messages" element={<AssistMessages />} />
              <Route path="reports" element={<Reports />} />
              <Route path="log-activity" element={<LogActivity />} />
              <Route path="settings" element={<AssistSettings />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
