import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Mail,
  Megaphone,
  MessageSquareText,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageFieldCard from "@/components/dashboard/ImageFieldCard";
import PlatformDropdown from "@/pages/dashboard/assist/content-creation/PlatformDropdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseRealtimeReload } from "@/hooks/useSupabaseRealtimeReload";
import { fetchActiveBusinesses } from "@/lib/activeBusinesses";

type BusinessOption = {
  id: string;
  name: string;
};

type ScheduledContentItem = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string; // ISO
  contentTypeId: string;
  contentTypeName: string;
  categoryId: string;
  categoryName: string;
  platform: string | null;
  businessName: string | null;
  businessId: string;
  businessUserId: string; // owner of business (client)
  imagePrimaryUrl: string;
  imageSecondUrl: string;
  imageThirdUrl: string;
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

function toDateTimeLocalValue(iso: string) {
  // Convert ISO to yyyy-MM-ddTHH:mm for <input type="datetime-local" />
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDateTimeLocalValue(v: string) {
  // Treat as local time and convert to ISO
  return new Date(v).toISOString();
}

export default function AssistCalendar() {
  const { toast } = useToast();

  const [month, setMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");

  const [items, setItems] = useState<ScheduledContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewItem, setViewItem] = useState<ScheduledContentItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [contentTypes, setContentTypes] = useState<Array<{ id: string; name: string }>>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editPlatform, setEditPlatform] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editContentTypeId, setEditContentTypeId] = useState<string>("");

  const [editImagePrimary, setEditImagePrimary] = useState<string>("");
  const [editImageSecond, setEditImageSecond] = useState<string>("");
  const [editImageThird, setEditImageThird] = useState<string>("");

  const editContentTypeName = useMemo(() => {
    return contentTypes.find((t) => t.id === editContentTypeId)?.name ?? "";
  }, [contentTypes, editContentTypeId]);

  useEffect(() => {
    const needsPlatform = editContentTypeName === "Social Media Posts" || editContentTypeName === "Ads Marketing";
    if (!needsPlatform && editPlatform) {
      setEditPlatform("");
    }
  }, [editContentTypeName, editPlatform]);

  useEffect(() => {
    let cancelled = false;

    const loadBusinesses = async () => {
      try {
        if (cancelled) return;
        const data = await fetchActiveBusinesses({ select: "id, business_name", orderByBusinessName: true });

        const mapped: BusinessOption[] = (data ?? []).map((b: any) => ({
          id: b.id as string,
          name: (b.business_name ?? "Unnamed Business") as string,
        }));

        setBusinesses(mapped);
      } catch (e: any) {
        // Keep the calendar usable even if the filter list fails
        console.error("Failed to load businesses", e);
        setBusinesses([]);
      }
    };

    void loadBusinesses();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;

    const loadMeta = async () => {
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
      } catch (e) {
        // Meta is optional; editing will still work with raw IDs
        if (!cancelled) {
          setCategories([]);
          setContentTypes([]);
        }
      }
    };

    void loadMeta();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const from = startOfMonth(month).toISOString();
        const to = endOfMonth(month).toISOString();

        let query = supabase
          .from("content_items")
          .select(
            "id, title, description, business_id, category_id, content_type_id, image_primary_url, image_second_url, image_third_url, scheduled_at, platform, businesses(business_name, user_id), content_types(name), content_categories(name)",
          )
          .not("scheduled_at", "is", null)
          .is("deleted_at", null)
          .gte("scheduled_at", from)
          .lte("scheduled_at", to)
          .order("scheduled_at", { ascending: true });

        if (selectedBusinessId !== "all") {
          query = query.eq("business_id", selectedBusinessId);
        }

        const { data, error } = await query;

        if (cancelled) return;
        if (error) throw error;

        const mapped: ScheduledContentItem[] = ((data ?? []) as any[])
          .filter((d) => Boolean(d.scheduled_at))
          .map((d) => ({
            id: d.id as string,
            title: (d.title ?? "Untitled") as string,
            description: (d.description ?? null) as string | null,
            scheduledAt: d.scheduled_at as string,
            contentTypeId: d.content_type_id as string,
            contentTypeName: (d.content_types?.name ?? "") as string,
            categoryId: d.category_id as string,
            categoryName: (d.content_categories?.name ?? "") as string,
            platform: (d.platform ?? null) as string | null,
            businessName: (d.businesses?.business_name ?? null) as string | null,
            businessId: d.business_id as string,
            businessUserId: d.businesses?.user_id as string,
            imagePrimaryUrl: (d.image_primary_url ?? "") as string,
            imageSecondUrl: (d.image_second_url ?? "") as string,
            imageThirdUrl: (d.image_third_url ?? "") as string,
          }));

        setItems(mapped);
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Failed to load calendar",
          description: e?.message ?? "Unknown error",
        });
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [month, selectedBusinessId, toast, reloadKey]);

  useSupabaseRealtimeReload({
    channelName: "assist-calendar-sync",
    targets: [
      { table: "content_items" },
      { table: "content_categories" },
      { table: "content_types" },
      { table: "businesses" },
    ],
    debounceMs: 350,
    onChange: () => setReloadKey((v) => v + 1),
  });

  const dayToItems = useMemo(() => {
    const map = new Map<string, ScheduledContentItem[]>();
    for (const it of items) {
      const dayKey = format(new Date(it.scheduledAt), "yyyy-MM-dd");
      const arr = map.get(dayKey) ?? [];
      arr.push(it);
      map.set(dayKey, arr);
    }
    return map;
  }, [items]);

  const daysWithItems = useMemo(() => {
    const days: Date[] = [];
    for (const it of items) {
      days.push(new Date(it.scheduledAt));
    }
    return days;
  }, [items]);


  const monthItemsSorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const tA = new Date(a.scheduledAt).getTime();
      const tB = new Date(b.scheduledAt).getTime();
      if (tA !== tB) return tA - tB;

      const nameA = (a.businessName ?? "").toLowerCase();
      const nameB = (b.businessName ?? "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [items]);

  const monthGroups = useMemo(() => {
    const groups = new Map<string, { date: Date; items: ScheduledContentItem[] }>();
    for (const it of monthItemsSorted) {
      const d = new Date(it.scheduledAt);
      const key = format(d, "yyyy-MM-dd");
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(it);
      } else {
        groups.set(key, { date: d, items: [it] });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [monthItemsSorted]);

  useEffect(() => {
    if (!viewItem) return;
    setIsEditing(false);

    setEditTitle(viewItem.title ?? "");
    setEditDescription(viewItem.description ?? "");
    setEditScheduledAt(toDateTimeLocalValue(viewItem.scheduledAt));
    setEditPlatform(viewItem.platform ?? "");
    setEditCategoryId(viewItem.categoryId ?? "");
    setEditContentTypeId(viewItem.contentTypeId ?? "");

    setEditImagePrimary(viewItem.imagePrimaryUrl ?? "");
    setEditImageSecond(viewItem.imageSecondUrl ?? "");
    setEditImageThird(viewItem.imageThirdUrl ?? "");
  }, [viewItem]);

  const handleSave = async () => {
    if (!viewItem) return;

    setSaving(true);
    try {
      const nextScheduledAt = editScheduledAt
        ? fromDateTimeLocalValue(editScheduledAt)
        : viewItem.scheduledAt;

      const next = {
        title: editTitle,
        description: editDescription.trim() ? editDescription.trim() : null,
        scheduled_at: nextScheduledAt,
        platform: editPlatform.trim() ? editPlatform.trim() : null,
        category_id: editCategoryId,
        content_type_id: editContentTypeId,
        image_primary_url: editImagePrimary.trim() ? editImagePrimary.trim() : null,
        image_second_url: editImageSecond.trim() ? editImageSecond.trim() : null,
        image_third_url: editImageThird.trim() ? editImageThird.trim() : null,
      } as const;

      const { error } = await supabase.from("content_items").update(next).eq("id", viewItem.id);
      if (error) throw error;

      const nextCategoryName = categories.find((c) => c.id === editCategoryId)?.name ?? viewItem.categoryName;
      const nextContentTypeName = contentTypes.find((t) => t.id === editContentTypeId)?.name ?? viewItem.contentTypeName;

      // Update local state so the UI refreshes immediately
      setItems((prev) =>
        prev.map((it) =>
          it.id === viewItem.id
            ? {
                ...it,
                title: editTitle,
                description: editDescription.trim() ? editDescription.trim() : null,
                scheduledAt: nextScheduledAt,
                platform: editPlatform.trim() ? editPlatform.trim() : null,
                categoryId: editCategoryId,
                categoryName: nextCategoryName,
                contentTypeId: editContentTypeId,
                contentTypeName: nextContentTypeName,
                imagePrimaryUrl: editImagePrimary.trim(),
                imageSecondUrl: editImageSecond.trim(),
                imageThirdUrl: editImageThird.trim(),
              }
            : it,
        ),
      );

      setViewItem((prev) =>
        prev
          ? {
              ...prev,
              title: editTitle,
              description: editDescription.trim() ? editDescription.trim() : null,
              scheduledAt: nextScheduledAt,
              platform: editPlatform.trim() ? editPlatform.trim() : null,
              categoryId: editCategoryId,
              categoryName: nextCategoryName,
              contentTypeId: editContentTypeId,
              contentTypeName: nextContentTypeName,
              imagePrimaryUrl: editImagePrimary.trim(),
              imageSecondUrl: editImageSecond.trim(),
              imageThirdUrl: editImageThird.trim(),
            }
          : prev,
      );

      toast({ title: "Saved", description: "Scheduled content updated." });
      setIsEditing(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Failed to save",
        description: e?.message ?? "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-8 w-8 text-primary" />
          Calendar
        </h1>
        <p className="text-muted-foreground">
          Shows scheduled content from <span className="font-medium">Content Creation</span>.
        </p>
      </header>

      <section className="grid gap-4 min-w-0 lg:grid-cols-3">
        <Card className="w-full min-w-0 lg:col-span-2">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Monthly Calendar</span>
                <span className="text-sm font-medium text-muted-foreground">{format(month, "MMMM yyyy")}</span>
              </CardTitle>

              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Filter by business name" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all">All Businesses</SelectItem>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CardDescription>
              Select a date to view scheduled content. {loading ? "Loading…" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full min-w-0">
              <Calendar
                fixedWeeks
                mode="single"
                selected={selectedDay}
                onSelect={(d) => d && setSelectedDay(d)}
                month={month}
                onMonthChange={setMonth}
                modifiers={{ hasContent: daysWithItems }}
                modifiersClassNames={{
                  hasContent: "ring-1 ring-primary/30 rounded-md",
                }}
                className="w-full min-w-0 p-3 pointer-events-auto"
                classNames={{
                  months: "w-full min-w-0",
                  month: "w-full min-w-0 space-y-6",
                  // Keep month labels from pushing the layout on small screens.
                  caption: "flex justify-center pt-1 relative items-center w-full min-w-0 px-8",
                  caption_label: "text-sm sm:text-base font-semibold truncate max-w-full",
                  table: "w-full border-collapse table-fixed",
                  // Grid ensures 7 columns always fit on mobile/tablet without horizontal scroll.
                  head_row: "grid grid-cols-7 w-full",
                  head_cell: "text-muted-foreground rounded-md font-medium text-[11px] sm:text-sm text-center",
                  row: "grid grid-cols-7 w-full mt-3",
                  cell: "h-12 sm:h-14 md:h-16 w-full text-center text-sm sm:text-base p-0 relative focus-within:relative focus-within:z-20",
                  day: "h-12 sm:h-14 md:h-16 w-full p-0 font-normal aria-selected:opacity-100",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const key = format(date, "yyyy-MM-dd");
                    const dayItems = dayToItems.get(key) ?? [];
                    const uniqueTypes = Array.from(new Set(dayItems.map((d) => d.contentTypeName))).slice(0, 3);

                    return (
                      <div className="h-full w-full flex flex-col items-center justify-between py-1">
                        <div className="text-[11px] sm:text-sm">{date.getDate()}</div>
                        <div className="flex items-center gap-1 pb-1">
                          {uniqueTypes.map((t) => {
                            const Icon = getTypeIcon(t);
                            return <Icon key={t} className="h-3.5 w-3.5 text-primary" />;
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

        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Monthly Schedule</CardTitle>
            <CardDescription>
              {format(month, "MMMM yyyy")} • Sorted by date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {monthGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled content this month.</p>
            ) : (
              monthGroups.map((group) => (
                <div key={format(group.date, "yyyy-MM-dd")} className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">
                    {format(group.date, "EEEE, dd MMM")}
                  </div>

                  <div className="space-y-2">
                    {group.items.map((it) => {
                      const Icon = getTypeIcon(it.contentTypeName);
                      const time = format(new Date(it.scheduledAt), "HH:mm");

                      return (
                        <div key={it.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">
                                  {it.title}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {time} • {it.contentTypeName || "(No type)"}
                                  {it.platform ? ` • ${it.platform}` : ""}
                                </div>
                                {it.businessName ? (
                                  <div className="mt-1 text-xs text-muted-foreground truncate">
                                    Business: {it.businessName}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <Button type="button" variant="outline" size="sm" onClick={() => setViewItem(it)}>
                              View
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!viewItem}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditing(false);
              setViewItem(null);
            }
          }}
        >
          <DialogContent className="w-[95vw] max-w-6xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Scheduled Content</DialogTitle>
              <DialogDescription>
                {viewItem ? format(new Date(viewItem.scheduledAt), "EEEE, dd MMM yyyy • HH:mm") : ""}
              </DialogDescription>
            </DialogHeader>

            {viewItem ? (
              <div className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="sc-title">Title</Label>
                    <Input
                      id="sc-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      disabled={!isEditing || saving}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="sc-description">Description</Label>
                    <Textarea
                      id="sc-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={!isEditing || saving}
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="sc-category">Category</Label>
                      <Select
                        value={editCategoryId}
                        onValueChange={setEditCategoryId}
                        disabled={!isEditing || saving}
                      >
                        <SelectTrigger id="sc-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="sc-type">Type Content</Label>
                      <Select
                        value={editContentTypeId}
                        onValueChange={(next) => {
                          setEditContentTypeId(next);
                          setEditPlatform("");
                        }}
                        disabled={!isEditing || saving}
                      >
                        <SelectTrigger id="sc-type">
                          <SelectValue placeholder="Select a content type" />
                        </SelectTrigger>
                        <SelectContent className="z-50">
                          {contentTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="sc-scheduled">Scheduled At</Label>
                      <Input
                        id="sc-scheduled"
                        type="datetime-local"
                        value={editScheduledAt}
                        onChange={(e) => setEditScheduledAt(e.target.value)}
                        disabled={!isEditing || saving}
                      />
                    </div>

                    <div className="space-y-1">
                      <PlatformDropdown
                        contentType={editContentTypeName}
                        value={editPlatform}
                        onChange={setEditPlatform}
                        disabled={!isEditing || saving}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border p-3">
                      <div className="text-xs text-muted-foreground">Business</div>
                      <div className="text-sm font-medium text-foreground truncate">
                        {viewItem.businessName ?? "-"}
                      </div>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <div className="text-xs text-muted-foreground">Current Type</div>
                      <div className="text-sm font-medium text-foreground truncate">
                        {viewItem.contentTypeName || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Images</div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <ImageFieldCard
                        label="Primary"
                        value={editImagePrimary}
                        originalValue={viewItem.imagePrimaryUrl}
                        onChange={({ url }) => setEditImagePrimary(url)}
                        variant="compact"
                        disabled={!isEditing || saving}
                        mediaPicker={{ userId: viewItem.businessUserId, businessId: viewItem.businessId }}
                      />
                      <ImageFieldCard
                        label="Second"
                        value={editImageSecond}
                        originalValue={viewItem.imageSecondUrl}
                        onChange={({ url }) => setEditImageSecond(url)}
                        variant="compact"
                        disabled={!isEditing || saving}
                        mediaPicker={{ userId: viewItem.businessUserId, businessId: viewItem.businessId }}
                      />
                      <ImageFieldCard
                        label="Third"
                        value={editImageThird}
                        originalValue={viewItem.imageThirdUrl}
                        onChange={({ url }) => setEditImageThird(url)}
                        variant="compact"
                        disabled={!isEditing || saving}
                        mediaPicker={{ userId: viewItem.businessUserId, businessId: viewItem.businessId }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const origin = window.location.origin;
                      const url = `${origin}/dashboard/assist/calendar/view/${viewItem.id}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast({ title: "Copied", description: "View Content URL copied." });
                      } catch {
                        toast({ variant: "destructive", title: "Copy failed", description: "Please copy manually." });
                      }
                    }}
                  >
                    Copy URL
                  </Button>

                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            setEditTitle(viewItem.title ?? "");
                            setEditDescription(viewItem.description ?? "");
                            setEditScheduledAt(toDateTimeLocalValue(viewItem.scheduledAt));
                            setEditPlatform(viewItem.platform ?? "");
                            setEditCategoryId(viewItem.categoryId ?? "");
                            setEditContentTypeId(viewItem.contentTypeId ?? "");
                            setEditImagePrimary(viewItem.imagePrimaryUrl ?? "");
                            setEditImageSecond(viewItem.imageSecondUrl ?? "");
                            setEditImageThird(viewItem.imageThirdUrl ?? "");
                          }}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button type="button" onClick={handleSave} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
