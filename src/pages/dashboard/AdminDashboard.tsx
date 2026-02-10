import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Briefcase,
  CheckSquare,
  FileQuestion,
  FileText,
  Globe,
  Home as HomeIcon,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  MessageSquare,
  Newspaper,
  Phone,
  Package,
  PanelsTopLeft,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Tags,
  User,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar, type AdminNavItem } from "@/components/admin/AdminSidebar";

import AdminOverview from "./admin/Overview";
import AdminPlaceholder from "./admin/Placeholder";
import AdminWebsiteBlog from "./admin/WebsiteBlog";
import AdminWebsiteBlogCreate from "./admin/WebsiteBlogCreate";
import AdminWebsiteBlogEdit from "./admin/WebsiteBlogEdit";
import AdminWebsiteMedia from "./admin/WebsiteMedia";
import AdminWebsiteContact from "./admin/WebsiteContact";
import AdminWebsiteServices from "./admin/WebsiteServices";
import AdminWebsiteFaqs from "./admin/WebsiteFaqs";
import AdminWebsitePackages from "./admin/WebsitePackages";
import AdminWebsiteLayout from "./admin/WebsiteLayout";
import AdminWebsiteHomepage from "./admin/WebsiteHomepage";
import AdminWebsiteDomainTools from "./admin/WebsiteDomainTools";
import AdminWebsitePages from "./admin/WebsitePages";
import AdminBusinessUsers from "./admin/BusinessUsers";
import AdminBusinessTypes from "./admin/BusinessTypes";
import AdminBusinessUserDetails from "./admin/BusinessUserDetails";
import AdminCreateBusinessUser from "./admin/BusinessUserCreate";
import AdminAssistants from "./admin/Assistants";
import AdminAssistantDetails from "./admin/AssistantDetails";
import AdminAssistantCreate from "./admin/AssistantCreate";
import AdminTasks from "./admin/Tasks";
import AdminTaskCreate from "./admin/TaskCreate";
import AdminTaskDetails from "./admin/TaskDetails";
import AdminReports from "./admin/Reports";
import AdminReportsLayout from "./admin/reports/AdminReportsLayout";
import ReportingComingSoon from "./user/reporting/ReportingComingSoon";
import AdminSupport from "./admin/Support";
import AdminAccount from "./admin/Account";
import AdminDashboardBanners from "./admin/DashboardBanners";
import AdminMessageMonitor from "./admin/MessageMonitor";
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [supportNewCount, setSupportNewCount] = useState(0);
  const [businessPendingCount, setBusinessPendingCount] = useState(0);
  const [tasksPendingCount, setTasksPendingCount] = useState(0);

  const fetchSupportNewCount = async () => {
    try {
      const { count, error } = await (supabase as any)
        .from("website_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");

      if (error) throw error;
      setSupportNewCount(Number(count ?? 0));
    } catch {
      // If anything fails, don't block the dashboard.
      setSupportNewCount(0);
    }
  };

  const fetchBusinessPendingCount = async () => {
    try {
      const { count, error } = await (supabase as any)
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_status", "pending");

      if (error) throw error;
      setBusinessPendingCount(Number(count ?? 0));
    } catch {
      // If anything fails, don't block the dashboard.
      setBusinessPendingCount(0);
    }
  };

  const fetchTasksPendingCount = async () => {
    try {
      const { count, error } = await (supabase as any)
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (error) throw error;
      setTasksPendingCount(Number(count ?? 0));
    } catch {
      setTasksPendingCount(0);
    }
  };

  const navItems: AdminNavItem[] = useMemo(
    () => [
      { title: "Dashboard", url: "/dashboard/admin", icon: LayoutDashboard },
      {
        title: "Business",
        url: "/dashboard/admin/business-users",
        icon: Users,
        badgeCount: businessPendingCount > 0 ? businessPendingCount : undefined,
        children: [
          {
            title: "Accounts",
            url: "/dashboard/admin/business-users",
            icon: Users,
            badgeCount: businessPendingCount > 0 ? businessPendingCount : undefined,
          },
          { title: "Business Types", url: "/dashboard/admin/business-users/types", icon: Tags },
        ],
      },
      { title: "Assistant", url: "/dashboard/admin/assistants", icon: ShieldCheck },
      {
        title: "Tasks",
        url: "/dashboard/admin/tasks",
        icon: CheckSquare,
        badgeCount: tasksPendingCount > 0 ? tasksPendingCount : undefined,
      },
      { title: "Reports", url: "/dashboard/admin/reports", icon: BarChart3 },
      { title: "Message Monitor", url: "/dashboard/admin/message-monitor", icon: MessageSquare },
      {
        title: "Support Tickets",
        url: "/dashboard/admin/support-tickets",
        icon: MessageSquare,
        badgeCount: supportNewCount > 0 ? supportNewCount : undefined,
      },
      {
        title: "Website",
        url: "/dashboard/admin/website",
        icon: Globe,
        children: [
          { title: "Homepage", url: "/dashboard/admin/website/homepage", icon: HomeIcon },
          { title: "Pages", url: "/dashboard/admin/website/pages", icon: FileText },
          { title: "Blog", url: "/dashboard/admin/website/blog", icon: Newspaper },
          { title: "Media Library", url: "/dashboard/admin/website/media", icon: Image },
          { title: "Contact", url: "/dashboard/admin/website/contact", icon: Phone },
          { title: "Services", url: "/dashboard/admin/website/services", icon: Briefcase },
          { title: "FAQs", url: "/dashboard/admin/website/services/faqs", icon: FileQuestion },
          { title: "Packages", url: "/dashboard/admin/website/packages", icon: Package },
          { title: "Layout", url: "/dashboard/admin/website/layout", icon: LayoutTemplate },
           // Templates (Order)
           { title: "Templates", url: "/dashboard/admin/website/templates", icon: SlidersHorizontal },
        ],
      },
      {
        title: "Analytics",
        url: "/dashboard/admin/analytics",
        icon: TrendingUp,
        children: [
          { title: "Traffic", url: "/dashboard/admin/analytics/traffic", icon: TrendingUp },
          { title: "Pages", url: "/dashboard/admin/analytics/pages", icon: FileText },
          { title: "Blog Performance", url: "/dashboard/admin/analytics/blog-performance", icon: Newspaper },
          { title: "Campaign (UTM)", url: "/dashboard/admin/analytics/campaign", icon: MessageSquare },
          { title: "Conversion (read-only)", url: "/dashboard/admin/analytics/conversion", icon: BarChart3 },
        ],
      },
      { title: "Dashboard Banners", url: "/dashboard/admin/dashboard-banners", icon: PanelsTopLeft },
      { title: "Announcements (soon)", url: "/dashboard/admin/announcements", icon: Bell },
      { title: "Activity Logs (soon)", url: "/dashboard/admin/logs", icon: AlertCircle },
      { title: "My Account", url: "/dashboard/admin/account", icon: User },
    ],
    [businessPendingCount, supportNewCount, tasksPendingCount]
  );

  useEffect(() => {
    void fetchSupportNewCount();
    void fetchBusinessPendingCount();
    void fetchTasksPendingCount();

    const channel = supabase
      .channel("admin-support-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "website_inquiries" },
        () => void fetchSupportNewCount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void fetchBusinessPendingCount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => void fetchTasksPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      // Requirement: sebelum login, halaman /dashboard/admin harus tampil 404
      if (!session?.user) {
        navigate("/404", { replace: true });
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const isAdmin = roleData?.role === ("admin" as any);

      if (!isAdmin) {
        await supabase.auth.signOut();
        navigate("/404", { replace: true });
        return;
      }

      setCheckingAccess(false);
    })();
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  };

  if (checkingAccess) return <LoadingScreen />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar items={navItems} />

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-20 h-12 flex items-center gap-3 border-b border-border bg-background px-3">
            <SidebarTrigger />

            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">Operations Admin</div>
              <div className="text-xs text-muted-foreground truncate">Control Center</div>
            </div>

            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </header>

          <main className="p-6 bg-background overflow-auto">
            <Routes>
              <Route index element={<AdminOverview />} />
              <Route path="business-users" element={<AdminBusinessUsers />} />
               <Route path="business-users/types" element={<AdminBusinessTypes />} />
              <Route path="business-users/new" element={<AdminCreateBusinessUser />} />
              <Route path="business-users/:userId" element={<AdminBusinessUserDetails />} />
              <Route path="assistants" element={<AdminAssistants />} />
              <Route path="assistants/new" element={<AdminAssistantCreate />} />
              <Route path="assistants/:userId" element={<AdminAssistantDetails />} />
              <Route path="tasks" element={<AdminTasks />} />
              <Route path="tasks/new" element={<AdminTaskCreate />} />
              <Route path="tasks/:taskNumberLabel" element={<AdminTaskDetails />} />
              <Route path="reports" element={<AdminReportsLayout />}>
                <Route index element={<Navigate to="task-reports" replace />} />
                <Route path="task-reports" element={<AdminReports />} />
                <Route path="performance-summary" element={<ReportingComingSoon title="Performance Summary" />} />
                <Route path="local-insights" element={<ReportingComingSoon title="Local Insights" />} />
                <Route path="keyword-rankings" element={<ReportingComingSoon title="Keyword Rankings" />} />
                <Route path="traffic-insights" element={<ReportingComingSoon title="Traffic Insights" />} />
                <Route path="conversion-insights" element={<ReportingComingSoon title="Conversion Insights" />} />
                <Route path="downloadable-reports" element={<ReportingComingSoon title="Downloadable Reports" />} />
              </Route>
              <Route path="message-monitor" element={<AdminMessageMonitor />} />
              <Route path="support-tickets" element={<AdminSupport />} />
              <Route path="website/pages" element={<AdminWebsitePages />} />
              <Route path="website/homepage" element={<AdminWebsiteHomepage />} />
              <Route path="website/blog" element={<AdminWebsiteBlog />} />
              <Route path="website/blog/new" element={<AdminWebsiteBlogCreate />} />
              <Route path="website/blog/:id" element={<AdminWebsiteBlogEdit />} />
              <Route path="website/media" element={<AdminWebsiteMedia />} />
              <Route path="website/contact" element={<AdminWebsiteContact />} />
              <Route path="website/services" element={<AdminWebsiteServices />} />
              <Route path="website/services/faqs" element={<AdminWebsiteFaqs />} />
              <Route path="website/packages" element={<AdminWebsitePackages />} />
              <Route path="website/layout" element={<AdminWebsiteLayout />} />
              {/* Templates (Order) */}
              <Route path="website/templates" element={<AdminWebsiteDomainTools />} />

              {/* Analytics */}
              <Route path="analytics/traffic" element={<AdminPlaceholder title="Traffic" />} />
              <Route path="analytics/pages" element={<AdminPlaceholder title="Analytics Pages" />} />
              <Route path="analytics/blog-performance" element={<AdminPlaceholder title="Blog Performance" />} />
              <Route path="analytics/campaign" element={<AdminPlaceholder title="Campaign (UTM)" />} />
              <Route path="analytics/conversion" element={<AdminPlaceholder title="Conversion (read-only)" />} />

              <Route path="dashboard-banners" element={<AdminDashboardBanners />} />

              <Route path="announcements" element={<AdminPlaceholder title="Announcements" />} />
              <Route path="logs" element={<AdminPlaceholder title="Activity Logs" />} />
              <Route path="account" element={<AdminAccount />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
