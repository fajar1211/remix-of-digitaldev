import { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Eye,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Mail,
  Megaphone,
  MessageSquareText,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePackageMenuRules } from "@/hooks/usePackageMenuRules";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ScheduledContentEditDialog, {
  type ScheduledContentEditValues,
} from "@/pages/dashboard/user/content-planner/ScheduledContentEditDialog";
type ContentFilter = "all" | "blog" | "email_marketing" | "social_media" | "gmb_posts";

type BusinessOption = {
  id: string;
  name: string;
};

type AssistAccount = {
  id: string;
  name: string;
};

type ScheduledContentItem = {
  id: string;
  title: string;
  scheduledAt: string; // ISO
  contentTypeName: string;
  platform: string | null;
  businessId: string;
  businessName: string | null;
  description: string | null;
};

type RecommendationIdea = {
  kind: "idea";
  id: string;
  type: Exclude<ContentFilter, "all">;
  title: string;
  notes: string;
};

type Recommendation =
  | {
      kind: "scheduled";
      id: string;
      businessId: string;
      type: Exclude<ContentFilter, "all">;
      title: string;
      scheduledAt: string;
      contentTypeName: string;
      platform: string | null;
      businessName: string | null;
      description: string | null;
    }
  | RecommendationIdea;

const FILTER_LABELS: Record<ContentFilter, string> = {
  all: "All Content",
  blog: "Blog Posts",
  email_marketing: "Email Marketing",
  social_media: "Social Media",
  gmb_posts: "Google Business Posts",
};

function normalizeTypeName(name: string) {
  return (name ?? "").trim().toLowerCase();
}

function getTypeIcon(typeName: string) {
  const key = normalizeTypeName(typeName);
  if (key.includes("blog")) return FileText;
  if (key.includes("email")) return Mail;
  if (key.includes("ads")) return Megaphone;
  if (key.includes("social")) return ImageIcon;
  if (key.includes("gmb")) return MessageSquareText;
  return CalendarDays;
}

function mapTypeToFilter(typeName: string): Exclude<ContentFilter, "all"> {
  const key = normalizeTypeName(typeName);
  if (key.includes("blog")) return "blog";
  if (key.includes("email")) return "email_marketing";
  if (key.includes("gmb")) return "gmb_posts";
  // default to social
  return "social_media";
}

function getMonthlyRecommendations(monthIndex: number): RecommendationIdea[] {
  const themes = [
    "New Year / Fresh Start",
    "Trust & Reviews",
    "Behind The Scenes",
    "Seasonal Offers",
    "Customer Stories",
    "How-to Education",
    "Local Community",
    "Summer / Peak Season",
    "Back-to-Business",
    "Preparation & Planning",
    "Holiday Readiness",
    "Year Wrap-up",
  ];

  const theme = themes[monthIndex] ?? "Monthly Theme";

  return [
    {
      kind: "idea",
      id: `blog-${monthIndex}`,
      type: "blog",
      title: `Blog: ${theme} – 5 Tips for Customers`,
      notes: "Write a practical list post that answers common customer questions.",
    },
    {
      kind: "idea",
      id: `email-${monthIndex}`,
      type: "email_marketing",
      title: `Email: ${theme} – Promo / Reminder`,
      notes: "Short email: value first, then a clear call to action (book, call, visit, order).",
    },
    {
      kind: "idea",
      id: `social-${monthIndex}`,
      type: "social_media",
      title: `Social: ${theme} – 3 Post Ideas`,
      notes: "1) Tip carousel, 2) Before/after, 3) Testimonial screenshot.",
    },
    {
      kind: "idea",
      id: `gmb-${monthIndex}`,
      type: "gmb_posts",
      title: `GMB Post: ${theme} – Weekly Update`,
      notes: "Post an update + photo + link. Keep it short and local.",
    },
  ];
}

export default function ContentPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const { isEnabled } = usePackageMenuRules(user?.id);
  const canUseContentPlanner = useMemo(() => isEnabled("content_planner"), [isEnabled]);
  const canSendToTasks = useMemo(
    () => canUseContentPlanner && isEnabled("content_planner_send_to_tasks"),
    [canUseContentPlanner, isEnabled]
  );
  const canEditScheduled = useMemo(
    () => canUseContentPlanner && isEnabled("content_planner_edit_scheduled"),
    [canUseContentPlanner, isEnabled]
  );

  const viewOnly = !canUseContentPlanner;

  const [month, setMonth] = useState<Date>(new Date());
  const [filter, setFilter] = useState<ContentFilter>("all");

  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  const [scheduledItems, setScheduledItems] = useState<ScheduledContentItem[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  const [viewItem, setViewItem] = useState<Recommendation | null>(null);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [contentTypes, setContentTypes] = useState<{ id: string; name: string }[]>([]);

  const [assists, setAssists] = useState<AssistAccount[]>([]);
  const [postOpen, setPostOpen] = useState(false);
  const [postTarget, setPostTarget] = useState<Recommendation | null>(null);
  const [postAssignee, setPostAssignee] = useState<string>("none");
  const [posting, setPosting] = useState(false);

  // Keep track of which scheduled content items have already been "posted" to Tasks
  // so we can show status "Post" and disable buttons.
  const [postedScheduledIds, setPostedScheduledIds] = useState<Set<string>>(() => new Set());

  const [editOpen, setEditOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editBusinessId, setEditBusinessId] = useState<string | null>(null);
  const [editInitialValues, setEditInitialValues] = useState<ScheduledContentEditValues | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const buildScheduledContentDetailUrl = (opts: { itemId: string; businessId: string }) => {
    const url = new URL(`${window.location.origin}/dashboard/user/content-planner`);
    url.searchParams.set("item", opts.itemId);
    url.searchParams.set("business", opts.businessId);
    return url.toString();
  };

  // Deep-link support: opening Scheduled Content detail directly from a URL.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get("item");
    const businessId = params.get("business");

    if (!itemId || !businessId) return;

    if (viewOnly) {
      toast({
        title: "Content Planner disabled",
        description: "Your package can view the calendar only. Editing is disabled.",
      });

      // Clean URL so refreshing doesn't keep trying to open it.
      params.delete("item");
      params.delete("business");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true }
      );
      return;
    }

    setEditItemId(itemId);
    setEditBusinessId(businessId);
    setEditOpen(true);

    // Clean URL so refreshing doesn't keep re-opening it.
    params.delete("item");
    params.delete("business");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate, toast, viewOnly]);

  useEffect(() => {
    let cancelled = false;

    const loadBusinesses = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("businesses")
          .select("id, business_name")
          .eq("user_id", user.id)
          .order("business_name", { ascending: true });

        if (cancelled) return;
        if (error) throw error;

        const mapped: BusinessOption[] = (data ?? []).map((b: any) => ({
          id: b.id as string,
          name: (b.business_name ?? "Unnamed Business") as string,
        }));

        setBusinesses(mapped);

        // Default to the first business so users never see an "All Businesses" view.
        if (!selectedBusinessId && mapped.length > 0) {
          setSelectedBusinessId(mapped[0].id);
        }
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load businesses",
          description: e?.message ?? "Unknown error",
        });
        setBusinesses([]);
      }
    };

    void loadBusinesses();

    return () => {
      cancelled = true;
    };
  }, [selectedBusinessId, toast, user]);


  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
      if (!user) return;
      try {
        const [{ data: catData, error: catErr }, { data: typeData, error: typeErr }] = await Promise.all([
          supabase.from("content_categories").select("id, name").order("name", { ascending: true }),
          supabase.from("content_types").select("id, name").order("name", { ascending: true }),
        ]);

        if (cancelled) return;
        if (catErr) throw catErr;
        if (typeErr) throw typeErr;

        setCategories((catData ?? []).map((c: any) => ({ id: c.id as string, name: c.name as string })));
        setContentTypes((typeData ?? []).map((t: any) => ({ id: t.id as string, name: t.name as string })));
      } catch {
        // not fatal for the page; only affects edit dialog
        setCategories([]);
        setContentTypes([]);
      }
    };

    const loadAssists = async () => {
      if (!user) return;
      // Only show ACTIVE assistants (synced with profiles.account_status)
      const { data: assistAccounts, error } = await supabase.rpc("get_active_assist_accounts");
      if (cancelled) return;
      if (!error && assistAccounts) {
        setAssists(
          [...assistAccounts].sort((a, b) => (a.name || "").localeCompare(b.name || "")) as AssistAccount[],
        );
      } else {
        setAssists([]);
      }
    };

    void loadMeta();
    void loadAssists();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadScheduled = async () => {
      if (!user) return;

      const businessIds = businesses.map((b) => b.id);
      if (businessIds.length === 0) {
        setScheduledItems([]);
        return;
      }

      setLoadingScheduled(true);
      try {
        const from = startOfMonth(month).toISOString();
        const to = endOfMonth(month).toISOString();

        let query = supabase
          .from("content_items")
          .select(
            "id, title, description, business_id, scheduled_at, platform, businesses!inner(business_name, user_id), content_types(name)",
          )
          // Hard guarantee: only show scheduled content for the logged-in user's businesses
          .eq("businesses.user_id", user.id)
          .not("scheduled_at", "is", null)
          .is("deleted_at", null)
          .gte("scheduled_at", from)
          .lte("scheduled_at", to)
          .order("scheduled_at", { ascending: true });

        if (selectedBusinessId) {
          query = query.eq("business_id", selectedBusinessId);
        } else {
          query = query.in("business_id", businessIds);
        }

        const { data, error } = await query;
        if (cancelled) return;
        if (error) throw error;

        const mapped: ScheduledContentItem[] = ((data ?? []) as any[])
          .filter((d) => Boolean(d.scheduled_at))
          .map((d) => ({
            id: d.id as string,
            title: (d.title ?? "Untitled") as string,
            scheduledAt: d.scheduled_at as string,
            contentTypeName: (d.content_types?.name ?? "") as string,
            platform: (d.platform ?? null) as string | null,
            businessId: d.business_id as string,
            businessName: (d.businesses?.business_name ?? null) as string | null,
            description: (d.description ?? null) as string | null,
          }));

        setScheduledItems(mapped);
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load schedule",
          description: e?.message ?? "Unknown error",
        });
        setScheduledItems([]);
      } finally {
        if (!cancelled) setLoadingScheduled(false);
      }
    };

    void loadScheduled();

    return () => {
      cancelled = true;
    };
  }, [businesses, month, selectedBusinessId, toast, user]);

  // Determine which scheduled items have already been sent to Tasks (persisted via task.description URL).
  useEffect(() => {
    if (!user) return;
    if (scheduledItems.length === 0) {
      setPostedScheduledIds(new Set());
      return;
    }

    let cancelled = false;

    const loadPostedFlags = async () => {
      try {
        // We store a deep-link to the content planner in task.description.
        // Fetch only tasks for this user, then parse `item=<id>` from the URL.
        const { data, error } = await supabase
          .from("tasks")
          .select("description")
          .eq("user_id", user.id)
          .not("description", "is", null)
          .ilike("description", "%/dashboard/user/content-planner%")
          .limit(1000);

        if (cancelled) return;
        if (error) throw error;

        const scheduledIdSet = new Set(scheduledItems.map((s) => s.id));
        const posted = new Set<string>();

        for (const row of (data ?? []) as any[]) {
          const desc = String(row?.description ?? "");
          const idx = desc.indexOf("http");
          const maybeUrl = idx >= 0 ? desc.slice(idx).trim() : "";

          // Fallback: sometimes description might be just the URL (no prefix)
          const candidate = maybeUrl || desc;
          try {
            const url = new URL(candidate);
            const itemId = url.searchParams.get("item");
            if (itemId && scheduledIdSet.has(itemId)) posted.add(itemId);
          } catch {
            // ignore non-url descriptions
          }
        }

        setPostedScheduledIds(posted);
      } catch {
        // non-fatal; just don't disable anything
        setPostedScheduledIds(new Set());
      }
    };

    void loadPostedFlags();

    return () => {
      cancelled = true;
    };
  }, [scheduledItems, user]);
  const dayToScheduled = useMemo(() => {
    const map = new Map<string, ScheduledContentItem[]>();
    for (const it of scheduledItems) {
      const dayKey = format(new Date(it.scheduledAt), "yyyy-MM-dd");
      const arr = map.get(dayKey) ?? [];
      arr.push(it);
      map.set(dayKey, arr);
    }
    return map;
  }, [scheduledItems]);

  const daysWithItems = useMemo(() => {
    return scheduledItems.map((it) => new Date(it.scheduledAt));
  }, [scheduledItems]);

  const recommendations = useMemo(() => {
    const scheduled: Recommendation[] = scheduledItems.map((it) => ({
      kind: "scheduled",
      id: it.id,
      businessId: it.businessId,
      type: mapTypeToFilter(it.contentTypeName),
      title: it.title,
      scheduledAt: it.scheduledAt,
      contentTypeName: it.contentTypeName,
      platform: it.platform,
      businessName: it.businessName,
      description: it.description,
    }));

    const filtered = filter === "all" ? scheduled : scheduled.filter((r) => r.type === filter);

    // Sort by the month currently shown on the calendar (already filtered in query), then by date/time.
    return [...filtered].sort((a, b) => {
      if (a.kind === "scheduled" && b.kind === "scheduled") {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      }
      return a.title.localeCompare(b.title);
    });
  }, [filter, scheduledItems]);

  function mapRecommendationToTaskType(rec: Recommendation): "blog" | "social_media" | "email_marketing" | "ads" | "others" {
    const source = rec.kind === "scheduled" ? rec.contentTypeName : rec.type;
    const key = normalizeTypeName(source);
    if (key.includes("blog")) return "blog";
    if (key.includes("email")) return "email_marketing";
    if (key.includes("ads")) return "ads";
    if (key.includes("social")) return "social_media";
    // gmb_posts or unknown
    return "others";
  }

  function mapPlatformToEnum(raw: string | null | undefined): "facebook" | "instagram" | "x" | "threads" | "linkedin" | null {
    const key = normalizeTypeName(raw ?? "");
    if (!key) return null;
    if (key.includes("facebook")) return "facebook";
    if (key.includes("instagram")) return "instagram";
    if (key === "x" || key.includes("twitter")) return "x";
    if (key.includes("threads")) return "threads";
    if (key.includes("linkedin")) return "linkedin";
    return null;
  }

  const handlePost = (rec: Recommendation) => {
    if (!canSendToTasks) return;
    setPostTarget(rec);
    setPostAssignee("none");
    setPostOpen(true);
  };

  const handleSubmitPost = async () => {
    if (!canSendToTasks) return;
    if (!user || !postTarget) return;

    const selectedAssignee = postAssignee && postAssignee !== "none" ? postAssignee : null;
    const nextStatus = selectedAssignee ? "assigned" : "pending";

    setPosting(true);
    try {
      const getNextTaskNumber = async () => {
        // Task IDs should start at T00100 (numeric 100) and always increment.
        // IMPORTANT: This is GLOBAL across the whole tasks table (not per-user).
        // Ignore rows that have NULL task_number (legacy/manual tasks).
        const { data: latestTask, error: latestErr } = await supabase
          .from("tasks")
          .select("task_number")
          .not("task_number", "is", null)
          .order("task_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestErr) throw latestErr;

        const latestNum = (latestTask as any)?.task_number as number | null | undefined;
        const next = typeof latestNum === "number" && Number.isFinite(latestNum) ? latestNum + 1 : 100;
        return Math.max(next, 100);
      };

      let nextTaskNumber = await getNextTaskNumber();

      const taskType = mapRecommendationToTaskType(postTarget);
      const platformEnum =
        taskType === "social_media" && postTarget.kind === "scheduled"
          ? mapPlatformToEnum(postTarget.platform)
          : null;

      const deadline = postTarget.kind === "scheduled" ? postTarget.scheduledAt : null;

      const description =
        postTarget.kind === "scheduled"
          ? [
              postTarget.description || "",
              `View Content (Read-only): ${new URL(`${window.location.origin}/dashboard/assist/calendar/view/${postTarget.id}`).toString()}`,
              // Keep the existing deep-link to Content Planner so we can detect "already posted" items reliably.
              `View Detail Content: ${buildScheduledContentDetailUrl({ itemId: postTarget.id, businessId: postTarget.businessId })}`,
            ].filter(Boolean).join("\n\n")
          : postTarget.notes;

      const taskTitle = `Content Post - ${postTarget.title}`;

      // Retry a few times to avoid duplicates if multiple tasks are created quickly.
      // (Best practice: add a DB unique constraint on task_number to fully prevent race-condition duplicates.)
      let inserted = false;
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        const { data: taskData, error } = await supabase.from("tasks").insert({
          user_id: user.id,
          title: taskTitle,
          deadline,
          description,
          type: taskType as any,
          platform: platformEnum as any,
          assigned_to: selectedAssignee,
          status: nextStatus as any,
          notes: null,
        }).select("id, task_number").maybeSingle();

        if (!error && taskData) {
          const createdTaskNumber = Number(taskData.task_number ?? nextTaskNumber);
          nextTaskNumber = createdTaskNumber + 1;
          inserted = true;
          break;
        }

        const msg = String((error as any)?.message ?? "");
        const isDuplicate = msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique");
        if (!isDuplicate) throw error;

        // fetch a fresh number and try again
        nextTaskNumber = await getNextTaskNumber();
      }

      if (!inserted) throw new Error("Failed to generate a unique task number. Please try again.");

      toast({
        title: "Sent to Tasks",
        description: "Item has been added to your task list.",
      });

      // Mark as posted so UI shows "Post" and disables Post/View.
      if (postTarget.kind === "scheduled") {
        setPostedScheduledIds((prev) => {
          const next = new Set(prev);
          next.add(postTarget.id);
          return next;
        });
      }

      setPostOpen(false);
      setPostTarget(null);
      setPostAssignee("none");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to create task",
        description: e?.message ?? "Unknown error",
      });
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    if (!editOpen || !editItemId) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("content_items")
          .select(
            "id, title, description, platform, business_id, category_id, content_type_id, image_primary_url, image_second_url, image_third_url, content_categories(name), content_types(name)",
          )
          .eq("id", editItemId)
          .single();

        if (cancelled) return;
        if (error) throw error;

        setEditBusinessId((data as any).business_id as string);
        setEditInitialValues({
          title: ((data as any).title ?? "") as string,
          description: ((data as any).description ?? "") as string,
          categoryName: ((data as any).content_categories?.name ?? "") as string,
          contentTypeName: ((data as any).content_types?.name ?? "") as string,
          platform: (((data as any).platform ?? "") as string) || "",
          primaryImageUrl: (((data as any).image_primary_url ?? "") as string) || "",
          secondaryImageUrl: (((data as any).image_second_url ?? "") as string) || "",
          thirdImageUrl: (((data as any).image_third_url ?? "") as string) || "",
        });
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load content",
          description: e?.message ?? "Unknown error",
        });
        setEditOpen(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editItemId, editOpen, toast]);

  const handleSaveEdit = async (values: ScheduledContentEditValues) => {
    if (!canEditScheduled) return;
    if (!editItemId) return;

    const categoryId = categories.find((c) => c.name === values.categoryName)?.id;
    const contentTypeId = contentTypes.find((t) => t.name === values.contentTypeName)?.id;

    if (!categoryId || !contentTypeId) {
      toast({
        variant: "destructive",
        title: "Missing selection",
        description: "Please select Category and Type Content.",
      });
      return;
    }

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("content_items")
        .update({
          title: values.title,
          description: values.description,
          platform: values.platform || null,
          category_id: categoryId,
          content_type_id: contentTypeId,
          image_primary_url: values.primaryImageUrl || null,
          image_second_url: values.secondaryImageUrl || null,
          image_third_url: values.thirdImageUrl || null,
        })
        .eq("id", editItemId);

      if (error) throw error;

      // Update local scheduled list so UI reflects instantly
      setScheduledItems((prev) =>
        prev.map((it) =>
          it.id === editItemId
            ? {
                ...it,
                title: values.title,
                platform: values.platform || null,
                contentTypeName: values.contentTypeName,
              }
            : it,
        ),
      );

      toast({ title: "Saved", description: "Scheduled content updated." });
      setEditOpen(false);
      setEditItemId(null);
      setEditBusinessId(null);
      setEditInitialValues(null);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: e?.message ?? "Unknown error",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-8 w-8 text-primary" />
          Content Planner
        </h1>
        <p className="text-muted-foreground">
          Plan your content month by month, review scheduled items, and follow recommendations.
        </p>

        {viewOnly ? (
          <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
            Content Planner is disabled for your package. You can view the calendar and scheduled items, but actions and
            editing are disabled.
          </div>
        ) : null}
      </header>

      <section className="grid gap-4 lg:grid-cols-3 min-w-0">
        <Card className="lg:col-span-2 min-w-0">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Monthly Calendar</span>
                <span className="text-sm font-medium text-muted-foreground">{format(month, "MMMM yyyy")}</span>
              </CardTitle>

              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="w-full sm:w-[280px]" disabled={viewOnly || businesses.length <= 1}>
                  <SelectValue placeholder="Business" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CardDescription>
              Scheduled content is marked on the calendar. {loadingScheduled ? "Loading…" : ""}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="w-full min-w-0">
              <Calendar
                mode="single"
                selected={month}
                onSelect={(d) => {
                  if (viewOnly) return;
                  if (d) setMonth(d);
                }}
                month={month}
                onMonthChange={(d) => {
                  if (viewOnly) return;
                  setMonth(d);
                }}
                modifiers={{ hasContent: daysWithItems }}
                modifiersClassNames={{
                  hasContent: "ring-1 ring-primary/30 rounded-md",
                }}
                className="w-full p-2 sm:p-3 pointer-events-auto"
                classNames={{
                  months: "w-full min-w-0",
                  month: "w-full min-w-0 space-y-6",
                  // Prevent long month labels (e.g. January 2026) from causing horizontal overflow on small screens.
                  caption: "flex justify-center pt-1 relative items-center w-full min-w-0 px-8",
                  caption_label: "text-sm sm:text-base font-semibold truncate max-w-full",
                  table: "w-full border-collapse table-fixed",
                  // Grid keeps 7 columns visible on mobile without horizontal scrolling.
                  head_row: "grid grid-cols-7 w-full",
                  head_cell: "text-muted-foreground rounded-md font-medium text-[11px] sm:text-sm text-center",
                  row: "grid grid-cols-7 w-full mt-3",
                  cell: "h-12 sm:h-14 md:h-16 w-full text-center text-sm sm:text-base p-0 relative focus-within:relative focus-within:z-20",
                  day: "h-12 sm:h-14 md:h-16 w-full p-0 font-normal aria-selected:opacity-100",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const key = format(date, "yyyy-MM-dd");
                    const dayItems = dayToScheduled.get(key) ?? [];
                    const uniqueTypes = Array.from(new Set(dayItems.map((d) => d.contentTypeName))).slice(0, 3);

                    return (
                      <div className="h-full w-full flex flex-col items-center justify-between py-1">
                        <div className="text-xs sm:text-sm">{date.getDate()}</div>
                        <div className="flex items-center gap-0.5 sm:gap-1 pb-1">
                          {uniqueTypes.map((t) => {
                            const Icon = getTypeIcon(t);
                            return <Icon key={t} className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />;
                          })}
                        </div>
                      </div>
                    );
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Content Recommendations
            </CardTitle>
            <CardDescription>
              Shows only content scheduled on the calendar for {format(month, "MMMM yyyy")}.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Filter</div>
              <Select value={filter} onValueChange={(v) => setFilter(v as ContentFilter)}>
                <SelectTrigger disabled={viewOnly}>
                  <SelectValue placeholder="Select a content type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FILTER_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recommendations for this month.</p>
              ) : (
                recommendations.map((rec) => {
                  const iconLabel = rec.kind === "scheduled" ? rec.contentTypeName : rec.type;
                  const Icon = getTypeIcon(iconLabel);

                    return (
                     <div key={`${rec.kind}-${rec.id}`} className="rounded-lg border border-border p-3 min-w-0">
                       <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-2 min-w-0">
                          <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{rec.title}</div>

                            {rec.kind === "scheduled" ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {format(new Date(rec.scheduledAt), "dd MMM • HH:mm")}
                                {rec.platform ? ` • ${rec.platform}` : ""}
                                {rec.businessName ? ` • ${rec.businessName}` : ""}
                              </div>
                            ) : (
                              <div className="mt-1 text-sm text-muted-foreground">{rec.notes}</div>
                            )}

                            {rec.kind === "scheduled" && postedScheduledIds.has(rec.id) ? (
                              <div className="mt-2 text-xs font-medium text-primary">Post</div>
                            ) : null}
                          </div>
                        </div>

                          <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={rec.kind === "scheduled" && postedScheduledIds.has(rec.id)}
                            onClick={() => {
                              if (viewOnly) return;
                              if (rec.kind === "scheduled") {
                                setEditItemId(rec.id);
                                setEditBusinessId(rec.businessId);
                                setEditOpen(true);
                                return;
                              }
                              setViewItem(rec);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={
                              viewOnly ||
                              !canSendToTasks ||
                              (rec.kind === "scheduled" && postedScheduledIds.has(rec.id))
                            }
                            onClick={() => handlePost(rec)}
                          >
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Post</span>
                          </Button>
                        </div>
                       </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>


      <Dialog
        open={postOpen}
        onOpenChange={(open) => {
          if (viewOnly) return;
          setPostOpen(open);
          if (!open) {
            setPostTarget(null);
            setPostAssignee("none");
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Send to Tasks</DialogTitle>
            <DialogDescription>
              Choose an assignee (optional) then submit to create a task.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm">
              <span className="font-medium">Item:</span> {postTarget?.title ?? ""}
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-assignee">Assignee</Label>
              <Select value={postAssignee} onValueChange={setPostAssignee}>
                <SelectTrigger id="post-assignee" disabled={!canSendToTasks}>
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPostOpen(false)}
              disabled={posting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitPost}
              disabled={!canSendToTasks || posting || !postTarget}
            >
              {posting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editInitialValues && user ? (

        <ScheduledContentEditDialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditItemId(null);
              setEditBusinessId(null);
              setEditInitialValues(null);
            }
          }}
          categories={categories.map((c) => c.name)}
          contentTypes={contentTypes.map((t) => t.name)}
          initialValues={editInitialValues}
          saving={savingEdit}
          onSave={handleSaveEdit}
          mediaPicker={editBusinessId ? { userId: user.id, businessId: editBusinessId } : null}
          readOnly={!canEditScheduled}
        />
      ) : null}

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>View Content</DialogTitle>
            <DialogDescription>Details for the selected item.</DialogDescription>
          </DialogHeader>

          {viewItem && viewItem.kind === "idea" ? (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Title:</span> {viewItem.title}
              </div>
              <div className="text-sm">
                <span className="font-medium">Notes:</span> {viewItem.notes}
              </div>

              <div className="pt-2">
                <Button type="button" className="w-full" onClick={() => handlePost(viewItem)} disabled={viewOnly || !canSendToTasks}>
                  Post
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
