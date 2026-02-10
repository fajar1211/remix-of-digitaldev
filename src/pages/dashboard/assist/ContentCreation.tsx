import * as React from "react";

import { ArrowLeft, Lock, Unlock, Pencil, Trash2 } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseRealtimeReload } from "@/hooks/useSupabaseRealtimeReload";
import type { ContentItemEditValues } from "@/pages/dashboard/assist/content-creation/ContentItemEditDialog";
import ContentItemInlineEditor from "@/pages/dashboard/assist/content-creation/ContentItemInlineEditor";
import ContentItemForm from "@/pages/dashboard/assist/content-creation/ContentItemForm";
import { fetchActiveBusinesses } from "@/lib/activeBusinesses";

type SortDirection = "asc" | "desc";

type BusinessOption = {
  id: string;
  name: string;
  publicId?: string;
  userId?: string;
};

type ContentRow = {
  id: string;
  businessId: string;
  businessName: string;
  category: string;
  counts: Record<string, number>;
};


function safeName(name: string | null | undefined) {
  return (name ?? "(No name)").trim() || "(No name)";
}

function lockKey(name: string) {
  return (name ?? "").trim().toLowerCase();
}

const PERMANENT_CONTENT_TYPES = new Set([
  "ads marketing",
  "blog posts",
  "email marketing",
  "gmb posts",
  "social media posts",
]);

function formatBusinessId(businessNumber: number | null | undefined) {
  if (!businessNumber) return "";
  return `B${businessNumber.toString().padStart(5, "0")}`;
}

function uniqueNonEmpty(values: string[]) {
  const set = new Set<string>();
  for (const v of values) {
    const cleaned = (v ?? "").trim();
    if (!cleaned) continue;
    set.add(cleaned);
  }
  return Array.from(set);
}

function toDatetimeLocalInput(isoString: string) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

type ImageSlotKey = "primary" | "second" | "third";

type ImageSlotState = {
  url: string;
  originalUrl: string;
};

export default function ContentCreation() {
  const { toast } = useToast();

  const [lastImportType, setLastImportType] = React.useState<string | null>(null);
  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<string>("all");

  const [contentRows, setContentRows] = React.useState<ContentRow[]>([]);
  const contentRowsRef = React.useRef<ContentRow[]>([]);
  const [rowsLoading, setRowsLoading] = React.useState(false);
  const fetchRowsInFlight = React.useRef(false);

  // Create (full page, not overlay)
  const [createOpen, setCreateOpen] = React.useState(false);

  // View Details (full page, not overlay)
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [activeRow, setActiveRow] = React.useState<ContentRow | null>(null);
  const [detailsItemId, setDetailsItemId] = React.useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsSaving, setDetailsSaving] = React.useState(false);

  type DetailsListItem = {
    id: string;
    title: string;
    description: string;
    category: string;
    contentType: string;
    platform: string;
    scheduledAt: string | null;
    images: Record<ImageSlotKey, string>;
  };

  const [detailsItems, setDetailsItems] = React.useState<DetailsListItem[]>([]);

  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [editItem, setEditItem] = React.useState<DetailsListItem | null>(null);
  const [deleteItemId, setDeleteItemId] = React.useState<string | null>(null);

  const [detailsForm, setDetailsForm] = React.useState({
    title: "",
    description: "",
    category: "",
    contentType: "",
    platform: "",
    scheduledAt: "", // datetime-local string
  });

  const [detailsSortCategory, setDetailsSortCategory] = React.useState<string>("");
  const [detailsSortTypeContent, setDetailsSortTypeContent] = React.useState<string>("");

  const [images, setImages] = React.useState<Record<ImageSlotKey, ImageSlotState>>({
    primary: { url: "/placeholder.svg", originalUrl: "/placeholder.svg" },
    second: { url: "/placeholder.svg", originalUrl: "/placeholder.svg" },
    third: { url: "/placeholder.svg", originalUrl: "/placeholder.svg" },
  });

  // Category + Content column management
  const [contentTypes, setContentTypes] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);

  const [lockedCategories, setLockedCategories] = React.useState<Set<string>>(() => new Set());
  const [lockedContentTypes, setLockedContentTypes] = React.useState<Set<string>>(() => new Set());

  // Prevent table flicker: only fetch table rows after we know the content_types columns
  const [typesReady, setTypesReady] = React.useState(false);

  const [manageDialogOpen, setManageDialogOpen] = React.useState(false);
  const [manageTab, setManageTab] = React.useState<"category" | "content">("category");

  const [newCategory, setNewCategory] = React.useState("");
  const [editingCategory, setEditingCategory] = React.useState<string | null>(null);
  const [editingCategoryDraft, setEditingCategoryDraft] = React.useState("");

  const [newContentType, setNewContentType] = React.useState("");
  const [editingContentType, setEditingContentType] = React.useState<string | null>(null);
  const [editingContentTypeDraft, setEditingContentTypeDraft] = React.useState("");

  type ConfirmActionState =
    | { kind: "delete_category"; name: string }
    | { kind: "save_edit_category" }
    | { kind: "delete_type"; name: string }
    | { kind: "save_edit_type" };

  const [confirmAction, setConfirmAction] = React.useState<ConfirmActionState | null>(null);

  React.useEffect(() => {
    contentRowsRef.current = contentRows;
  }, [contentRows]);

  const fetchContentRows = React.useCallback(async () => {
    if (fetchRowsInFlight.current) return;
    fetchRowsInFlight.current = true;

    // Only show loading state when table is empty to prevent flicker
    const shouldShowLoading = contentRowsRef.current.length === 0;
    if (shouldShowLoading) setRowsLoading(true);

    try {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, business_id, businesses(business_name), content_categories(name), content_types(name)")
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const emptyCounts = Object.fromEntries(contentTypes.map((t) => [t, 0] as const));
      const map = new Map<string, ContentRow>();

      for (const item of (data ?? []) as any[]) {
        const businessId = item.business_id as string;
        const businessName = safeName(item.businesses?.business_name as string | null | undefined);
        const categoryName = (item.content_categories?.name as string | undefined) ?? "";
        const typeName = (item.content_types?.name as string | undefined) ?? "";

        if (!businessId || !categoryName || !typeName) continue;

        const key = `${businessId}::${categoryName}`;
        const existing = map.get(key);

        if (!existing) {
          map.set(key, {
            id: key,
            businessId,
            businessName,
            category: categoryName,
            counts: { ...emptyCounts, [typeName]: 1 },
          });
          continue;
        }

        existing.counts[typeName] = (existing.counts[typeName] ?? 0) + 1;
      }

      setContentRows(Array.from(map.values()));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load table", description: e?.message ?? "Unknown error" });
      // Keep previous rows to avoid flicker.
    } finally {
      fetchRowsInFlight.current = false;
      if (shouldShowLoading) setRowsLoading(false);
    }
  }, [contentTypes, toast]);

  // Keep Content Management table always in sync with DB + current columns
  React.useEffect(() => {
    if (!typesReady) return;
    void fetchContentRows();
  }, [fetchContentRows, typesReady]);

  React.useEffect(() => {
    let cancelled = false;

    const loadBusinesses = async () => {
      const [bizData, { data: catData }, { data: typeData, error: typeError }] = await Promise.all([
        fetchActiveBusinesses({ select: "id, business_name, business_number, user_id", orderByBusinessName: true }),
        supabase.from("content_categories").select("name, is_locked").order("name", { ascending: true }),
        // Column order follows database order (created_at). UI can reverse it.
        supabase.from("content_types").select("name, is_locked").order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      const list: BusinessOption[] = (bizData ?? []).map((b: any) => ({
        id: b.id as string,
        name: safeName(b.business_name as string | null | undefined),
        publicId: formatBusinessId((b as any).business_number as number | null),
        userId: (b.user_id ?? undefined) as string | undefined,
      }));
      setBusinesses(list);

      const catRows = (catData ?? []) as Array<{ name: string; is_locked?: boolean }>;
      const typeRows = (typeData ?? []) as Array<{ name: string; is_locked?: boolean }>;

      const catNames = catRows.map((c) => (c as any).name as string);
      const typeNames = typeRows.map((t) => (t as any).name as string);

      setCategories(uniqueNonEmpty(catNames));
      setContentTypes(uniqueNonEmpty(typeNames));

      // Hydrate lock state from DB so it survives refresh
      setLockedCategories(new Set(catRows.filter((c) => Boolean(c.is_locked)).map((c) => lockKey(c.name))));

      const lockedTypes = new Set(typeRows.filter((t) => Boolean(t.is_locked)).map((t) => lockKey(t.name)));
      for (const k of PERMANENT_CONTENT_TYPES) lockedTypes.add(k);
      setLockedContentTypes(lockedTypes);

      // even if content_types query fails, we stop blocking the table forever
      if (typeError) setContentTypes([]);
      setTypesReady(true);
    };

    void loadBusinesses();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows: ContentRow[] = React.useMemo(() => contentRows, [contentRows]);

  const displayedRows = React.useMemo(() => {
    const filtered = selectedBusinessId === "all" ? rows : rows.filter((r) => r.businessId === selectedBusinessId);

    // Stable order for readability
    return [...filtered].sort((a, b) => {
      const byBusiness = a.businessName.localeCompare(b.businessName, "en", { sensitivity: "base" });
      if (byBusiness !== 0) return byBusiness;
      return a.category.localeCompare(b.category, "en", { sensitivity: "base" });
    });
  }, [rows, selectedBusinessId]);

  // Column order follows database order (created_at)
  const displayedContentTypes = React.useMemo(() => contentTypes, [contentTypes]);

  const onImport = (type: string) => {
    setLastImportType(type);
    toast({
      title: "In Progress",
      description: `Import \"${type}\" is in progress.`,
    });
  };

  const openDetails = (row: ContentRow) => {
    setActiveRow(row);
    setDetailsItemId(null);
    setDetailsItems([]);
    setDetailsLoading(true);

    // Reset optimistic UI first
    setDetailsForm({
      title: "",
      description: "",
      category: "",
      contentType: "",
      platform: "",
      scheduledAt: "",
    });
    setDetailsSortCategory("");
    setDetailsSortTypeContent("");
    setImages({
      primary: { url: "", originalUrl: "" },
      second: { url: "", originalUrl: "" },
      third: { url: "", originalUrl: "" },
    });
    setDetailsOpen(true);

    // Load ALL content items for this business (sorted)
    void (async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select(
          "id, title, description, platform, scheduled_at, image_primary_url, image_second_url, image_third_url, content_categories(name), content_types(name)",
        )
        .eq("business_id", row.businessId)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (error) {
        setDetailsLoading(false);
        toast({ variant: "destructive", title: "Failed to load", description: error.message });
        return;
      }

      const items: DetailsListItem[] = ((data ?? []) as any[]).map((d) => {
        const catName = (d as any).content_categories?.name as string | undefined;
        const typeName = (d as any).content_types?.name as string | undefined;
        return {
          id: d.id as string,
          title: (d.title ?? "") as string,
          description: (d.description ?? "") as string,
          category: (catName ?? "") as string,
          contentType: (typeName ?? "") as string,
          platform: (d.platform ?? "") as string,
          scheduledAt: (d.scheduled_at ?? null) as string | null,
          images: {
            primary: (d.image_primary_url ?? "") as string,
            second: (d.image_second_url ?? "") as string,
            third: (d.image_third_url ?? "") as string,
          },
        };
      });

      setDetailsItems(items);
      setDetailsLoading(false);
    })();
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setActiveRow(null);
    setDetailsItemId(null);
    setDetailsItems([]);
    setDetailsLoading(false);
    setDetailsSaving(false);
  };

  const resolveCategoryId = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) throw new Error("Category is required.");

    const { data: existing, error: selectError } = await supabase
      .from("content_categories")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (selectError) throw selectError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: insertError } = await supabase
      .from("content_categories")
      .insert({ name: cleaned })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return created.id as string;
  };

  const resolveContentTypeId = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) throw new Error("Type Content is required.");

    const { data: existing, error: selectError } = await supabase
      .from("content_types")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (selectError) throw selectError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: insertError } = await supabase
      .from("content_types")
      .insert({ name: cleaned })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return created.id as string;
  };

  const lookupCategoryId = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return null;

    const { data, error } = await supabase
      .from("content_categories")
      .select("id")
      .eq("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  };

  const lookupContentTypeId = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return null;

    const { data, error } = await supabase
      .from("content_types")
      .select("id")
      .eq("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  };

  const fetchDetailsItem = async (categoryName: string, typeName: string) => {
    if (!activeRow) return;

    setDetailsLoading(true);
    try {
      const [categoryId, contentTypeId] = await Promise.all([
        categoryName ? lookupCategoryId(categoryName) : Promise.resolve(null),
        typeName ? lookupContentTypeId(typeName) : Promise.resolve(null),
      ]);

      let q = supabase
        .from("content_items")
        .select(
          "id, title, description, platform, scheduled_at, image_primary_url, image_second_url, image_third_url, content_categories(name), content_types(name)",
        )
        .eq("business_id", activeRow.businessId)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (categoryId) q = q.eq("category_id", categoryId);
      if (contentTypeId) q = q.eq("content_type_id", contentTypeId);

      const { data, error } = await q;
      if (error) throw error;

      const items: DetailsListItem[] = ((data ?? []) as any[]).map((d) => {
        const cat = (d as any).content_categories?.name as string | undefined;
        const type = (d as any).content_types?.name as string | undefined;

        return {
          id: d.id as string,
          title: (d.title ?? "") as string,
          description: (d.description ?? "") as string,
          category: (cat ?? "") as string,
          contentType: (type ?? "") as string,
          platform: (d.platform ?? "") as string,
          scheduledAt: (d.scheduled_at ?? null) as string | null,
          images: {
            primary: (d.image_primary_url ?? "") as string,
            second: (d.image_second_url ?? "") as string,
            third: (d.image_third_url ?? "") as string,
          },
        };
      });

      setDetailsItems(items);
      setDetailsItemId(items[0]?.id ?? null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load", description: e?.message ?? "Unknown error" });
      setDetailsItems([]);
      setDetailsItemId(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  useSupabaseRealtimeReload({
    channelName: "assist-content-creation-sync",
    targets: [
      { table: "content_items" },
      { table: "content_categories" },
      { table: "content_types" },
      { table: "businesses" },
    ],
    debounceMs: 300,
    onChange: () => {
      // Keep the table counts + details view in sync without manual refresh.
      if (typesReady) void fetchContentRows();
      // Meta lists might be changed by other admins/assists.
      void refreshCategories();
      void refreshContentTypes();

      if (detailsOpen && activeRow && !detailsSaving) {
        void fetchDetailsItem(detailsSortCategory, detailsSortTypeContent);
      }
    },
  });

  const saveDetails = async () => {
    if (!activeRow) return;

    const title = detailsForm.title.trim();
    const description = detailsForm.description.trim();

    if (!title) {
      toast({ variant: "destructive", title: "Missing title", description: "Title is required." });
      return;
    }
    if (!description) {
      toast({ variant: "destructive", title: "Missing description", description: "Description is required." });
      return;
    }
    if (!detailsForm.category.trim()) {
      toast({ variant: "destructive", title: "Missing category", description: "Category is required." });
      return;
    }
    if (!detailsForm.contentType.trim()) {
      toast({ variant: "destructive", title: "Missing type", description: "Type Content is required." });
      return;
    }

    setDetailsSaving(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const [categoryId, contentTypeId] = await Promise.all([
        resolveCategoryId(detailsForm.category),
        resolveContentTypeId(detailsForm.contentType),
      ]);

      const scheduledAtIso = detailsForm.scheduledAt ? new Date(detailsForm.scheduledAt).toISOString() : null;

      const payload = {
        business_id: activeRow.businessId,
        category_id: categoryId,
        content_type_id: contentTypeId,
        title,
        description,
        platform: detailsForm.platform.trim() || null,
        scheduled_at: scheduledAtIso,
        image_primary_url: images.primary.url || null,
        image_second_url: images.second.url || null,
        image_third_url: images.third.url || null,
      };

      if (detailsItemId) {
        const { error } = await supabase.from("content_items").update(payload).eq("id", detailsItemId);
        if (error) throw error;
      } else {
        const { data: created, error } = await supabase
          .from("content_items")
          .insert({ ...payload, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        setDetailsItemId(created.id);
      }

      toast({ title: "Saved", description: "Content item saved successfully." });

      // Keep dropdown lists in sync with DB
      await refreshCategories();
      await refreshContentTypes();
      await fetchContentRows();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
    } finally {
      setDetailsSaving(false);
    }
  };

  const openEditItem = (item: DetailsListItem) => {
    setEditItem(item);
    setEditingItemId(item.id);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditItem(null);
  };

  const saveEditItem = async (values: ContentItemEditValues) => {
    if (!activeRow || !editItem) return;

    setDetailsSaving(true);
    try {
      const [categoryId, contentTypeId] = await Promise.all([
        resolveCategoryId(values.category),
        resolveContentTypeId(values.contentType),
      ]);

      const scheduledAtIso = values.scheduledAt ? new Date(values.scheduledAt).toISOString() : null;

      const payload = {
        business_id: activeRow.businessId,
        category_id: categoryId,
        content_type_id: contentTypeId,
        title: values.title.trim() || "Untitled",
        description: values.description,
        platform: values.platform.trim() || null,
        scheduled_at: scheduledAtIso,
        image_primary_url: values.primaryImageUrl || null,
        image_second_url: values.secondaryImageUrl || null,
        image_third_url: values.thirdImageUrl || null,
      };

      const { error } = await supabase.from("content_items").update(payload).eq("id", editItem.id);
      if (error) throw error;

      toast({ title: "Updated", description: "Content item updated." });
      cancelEditItem();

      await fetchDetailsItem(detailsSortCategory, detailsSortTypeContent);
      await fetchContentRows();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e?.message ?? "Unknown error" });
    } finally {
      setDetailsSaving(false);
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemId) return;

    setDetailsSaving(true);
    try {
      const { error } = await supabase.from("content_items").delete().eq("id", deleteItemId);
      if (error) throw error;

      toast({ title: "Deleted", description: "Content item deleted permanently." });
      setDeleteItemId(null);

      if (editingItemId === deleteItemId) cancelEditItem();

      await fetchDetailsItem(detailsSortCategory, detailsSortTypeContent);
      await fetchContentRows();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e?.message ?? "Unknown error" });
    } finally {
      setDetailsSaving(false);
    }
  };

  const openManage = (tab: "category" | "content") => {
    setManageTab(tab);
    setManageDialogOpen(true);
    // ensure lists reflect DB-only values
    void refreshCategories();
    void refreshContentTypes();
  };

  const refreshCategories = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("content_categories")
      .select("name, is_locked")
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<{ name: string; is_locked?: boolean }>;
    const names = rows.map((c) => (c as any).name as string);

    // Only show categories coming from DB
    setCategories(uniqueNonEmpty(names));
    setLockedCategories(new Set(rows.filter((c) => Boolean(c.is_locked)).map((c) => lockKey(c.name))));
  }, []);

  const refreshContentTypes = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("content_types")
      .select("name, is_locked")
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<{ name: string; is_locked?: boolean }>;
    const names = rows.map((t) => (t as any).name as string);

    // Only show content types coming from DB
    setContentTypes(uniqueNonEmpty(names));
    setLockedContentTypes(new Set(rows.filter((t) => Boolean(t.is_locked)).map((t) => lockKey(t.name))));
  }, []);

  const lookupCategoryIdInsensitive = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return null;

    const { data, error } = await supabase
      .from("content_categories")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  };

  const lookupContentTypeIdInsensitive = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return null;

    const { data, error } = await supabase
      .from("content_types")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Category already exists", description: `Category \"${name}\" is already registered.` });
      return;
    }

    try {
      await resolveCategoryId(name);
      await refreshCategories();
      setNewCategory("");
      toast({ title: "Saved", description: "Category saved to database." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
    }
  };

  const startEditCategory = (name: string) => {
    setEditingCategory(name);
    setEditingCategoryDraft(name);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditingCategoryDraft("");
  };

  const saveEditCategory = async () => {
    const from = (editingCategory ?? "").trim();
    const to = editingCategoryDraft.trim();
    if (!from || !to) return;

    if (categories.some((c) => c !== from && c.toLowerCase() === to.toLowerCase())) {
      toast({ title: "Category name conflict", description: `Category \"${to}\" already exists.` });
      return;
    }

    try {
      const id = await lookupCategoryIdInsensitive(from);
      if (!id) throw new Error("Category not found in database.");

      const { error } = await supabase.from("content_categories").update({ name: to }).eq("id", id);
      if (error) throw error;

      // keep local fields synced (so the user sees the new name immediately)
      setDetailsForm((p) => (p.category === from ? { ...p, category: to } : p));
      setDetailsSortCategory((p) => (p === from ? to : p));

      await refreshCategories();
      cancelEditCategory();
      toast({ title: "Saved", description: "Category updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
    }
  };

  const deleteCategory = async (name: string) => {
    try {
      const id = await lookupCategoryIdInsensitive(name);
      if (!id) throw new Error("Category not found in database.");

      const { error } = await supabase.from("content_categories").delete().eq("id", id);
      if (error) throw error;

      setLockedCategories((prev) => {
        const next = new Set(prev);
        next.delete(lockKey(name));
        return next;
      });
      setDetailsForm((p) => (p.category === name ? { ...p, category: "" } : p));
      setDetailsSortCategory((p) => (p === name ? "" : p));
      if (editingCategory === name) cancelEditCategory();

      await refreshCategories();
      toast({ title: "Deleted", description: "Category deleted." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e?.message ?? "Category may be in use by existing content items.",
      });
    }
  };
  const toggleCategoryLock = async (name: string) => {
    try {
      const cleaned = name.trim();
      const { data, error } = await supabase
        .from("content_categories")
        .select("id, is_locked")
        .ilike("name", cleaned)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Category not found in database.");

      const nextLocked = !Boolean((data as any).is_locked);
      const { error: updateError } = await supabase
        .from("content_categories")
        .update({ is_locked: nextLocked })
        .eq("id", (data as any).id);
      if (updateError) throw updateError;

      await refreshCategories();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e?.message ?? "Failed to toggle lock." });
    }
  };

  const addContentType = async () => {
    const name = newContentType.trim();
    if (!name) return;
    if (contentTypes.some((c) => c.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Column already exists", description: `Content \"${name}\" is already registered.` });
      return;
    }

    try {
      await resolveContentTypeId(name);
      await refreshContentTypes();
      setNewContentType("");
      toast({ title: "Saved", description: "Type Content saved to database." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
    }
  };

  const startEditContentType = (name: string) => {
    setEditingContentType(name);
    setEditingContentTypeDraft(name);
  };

  const cancelEditContentType = () => {
    setEditingContentType(null);
    setEditingContentTypeDraft("");
  };

  const saveEditContentType = async () => {
    const from = (editingContentType ?? "").trim();
    const to = editingContentTypeDraft.trim();
    if (!from || !to) return;

    if (contentTypes.some((c) => c !== from && c.toLowerCase() === to.toLowerCase())) {
      toast({ title: "Column name conflict", description: `Content \"${to}\" already exists.` });
      return;
    }

    try {
      const id = await lookupContentTypeIdInsensitive(from);
      if (!id) throw new Error("Type Content not found in database.");

      const { error } = await supabase.from("content_types").update({ name: to }).eq("id", id);
      if (error) throw error;

      setDetailsForm((p) => (p.contentType === from ? { ...p, contentType: to } : p));
      setDetailsSortTypeContent((p) => (p === from ? to : p));

      await refreshContentTypes();
      cancelEditContentType();
      toast({ title: "Saved", description: "Type Content updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
    }
  };

  const deleteContentType = async (name: string) => {
    try {
      const id = await lookupContentTypeIdInsensitive(name);
      if (!id) throw new Error("Type Content not found in database.");

      const { error } = await supabase.from("content_types").delete().eq("id", id);
      if (error) throw error;

      setLockedContentTypes((prev) => {
        const next = new Set(prev);
        next.delete(lockKey(name));
        return next;
      });
      setDetailsForm((p) => (p.contentType === name ? { ...p, contentType: "", platform: "" } : p));
      setDetailsSortTypeContent((p) => (p === name ? "" : p));
      if (editingContentType === name) cancelEditContentType();

      await refreshContentTypes();
      toast({ title: "Deleted", description: "Type Content deleted." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e?.message ?? "Type Content may be in use by existing content items.",
      });
    }
  };

  const toggleContentTypeLock = async (name: string) => {
    try {
      const cleaned = name.trim();
      const { data, error } = await supabase
        .from("content_types")
        .select("id, is_locked")
        .ilike("name", cleaned)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Type Content not found in database.");

      const nextLocked = !Boolean((data as any).is_locked);
      const { error: updateError } = await supabase
        .from("content_types")
        .update({ is_locked: nextLocked })
        .eq("id", (data as any).id);
      if (updateError) throw updateError;

      await refreshContentTypes();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e?.message ?? "Failed to toggle lock." });
    }
  };

  const getConfirmCopy = React.useCallback(() => {
    if (!confirmAction) return null;

    switch (confirmAction.kind) {
      case "delete_category":
        return {
          title: "Delete category?",
          description: `Are you sure you want to delete \"${confirmAction.name}\"? This action cannot be undone.`,
          confirmLabel: "Yes, delete",
        };
      case "save_edit_category":
        return {
          title: "Save changes?",
          description: `Save changes to category \"${editingCategory ?? ""}\"?`,
          confirmLabel: "Yes, save",
        };
      case "delete_type":
        return {
          title: "Delete type content?",
          description: `Are you sure you want to delete \"${confirmAction.name}\"? This action cannot be undone.`,
          confirmLabel: "Yes, delete",
        };
      case "save_edit_type":
        return {
          title: "Save changes?",
          description: `Save changes to type content \"${editingContentType ?? ""}\"?`,
          confirmLabel: "Yes, save",
        };
    }
  }, [confirmAction, editingCategory, editingContentType]);

  const confirmCopy = getConfirmCopy();

  const handleConfirm = async () => {
    if (!confirmAction) return;

    try {
      switch (confirmAction.kind) {
        case "delete_category":
          await deleteCategory(confirmAction.name);
          break;
        case "save_edit_category":
          await saveEditCategory();
          break;
        case "delete_type":
          await deleteContentType(confirmAction.name);
          break;
        case "save_edit_type":
          await saveEditContentType();
          break;
      }
    } finally {
      setConfirmAction(null);
    }
  };

  if (createOpen) {
    return (
      <ContentItemForm
        businesses={businesses.length ? businesses : [{ id: "demo", name: "Demo Business", publicId: "B00000", userId: undefined }]}
        categories={categories}
        contentTypes={contentTypes}
        onCancel={() => setCreateOpen(false)}
        onSave={(payload) => {
          void (async () => {
            try {
              const { data: userRes, error: userErr } = await supabase.auth.getUser();
              if (userErr) throw userErr;
              const userId = userRes.user?.id;
              if (!userId) throw new Error("Not authenticated");

              const [categoryId, contentTypeId] = await Promise.all([
                resolveCategoryId(payload.category),
                resolveContentTypeId(payload.contentType),
              ]);

              const scheduledAtIso = payload.scheduledAt ? new Date(payload.scheduledAt).toISOString() : null;
              const title = payload.title.trim() || "Untitled";

              const insertPayload = {
                business_id: payload.businessId,
                category_id: categoryId,
                content_type_id: contentTypeId,
                title,
                description: payload.description,
                platform: payload.platform.trim() || null,
                scheduled_at: scheduledAtIso,
                image_primary_url: payload.primaryImageUrl || null,
                image_second_url: payload.secondaryImageUrl || null,
                image_third_url: payload.thirdImageUrl || null,
                created_by: userId,
              };

              const { error } = await supabase.from("content_items").insert(insertPayload);
              if (error) throw error;

              toast({ title: "Saved", description: "Content item saved to database." });
              await refreshCategories();
              await refreshContentTypes();
              await fetchContentRows();
              setCreateOpen(false);
            } catch (e: any) {
              toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
            }
          })();
        }}
      />
    );
  }

  if (detailsOpen && activeRow) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5"
              onClick={closeDetails}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-foreground">View Details</h1>
              <p className="text-muted-foreground">{activeRow.businessName}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={detailsSortCategory || "all"}
              onValueChange={(v) => {
                const next = v === "all" ? "" : v;
                setDetailsSortCategory(next);
                void fetchDetailsItem(next, detailsSortTypeContent);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Sort by Category" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={detailsSortTypeContent || "all"}
              onValueChange={(v) => {
                const next = v === "all" ? "" : v;
                setDetailsSortTypeContent(next);
                void fetchDetailsItem(detailsSortCategory, next);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Sort by Type Content" />
              </SelectTrigger>
              <SelectContent className="z-50">
                <SelectItem value="all">All Types</SelectItem>
                {contentTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <Card>
          <CardContent className="p-6">
            {detailsLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Loading content...</div>
            ) : detailsItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-foreground">No results found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try changing the filters.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {detailsItems.map((item) => {
                  const scheduledLabel = item.scheduledAt ? new Date(item.scheduledAt).toLocaleString("en-US") : "-";
                  const primary = item.images.primary || "/placeholder.svg";
                  const second = item.images.second || "/placeholder.svg";
                  const third = item.images.third || "/placeholder.svg";

                  const isEditing = editingItemId === item.id;

                  return (
                    <section key={item.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                        <div className="space-y-1">
                          <h2 className="text-lg font-semibold text-foreground">{item.title || "Untitled"}</h2>
                          <p className="text-sm text-muted-foreground">Scheduled: {scheduledLabel}</p>
                        </div>

                        {!isEditing ? (
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => openEditItem(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeleteItemId(item.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {isEditing ? (
                      <div className="mt-4">
                        <ContentItemInlineEditor
                          categories={categories}
                          contentTypes={contentTypes}
                          saving={detailsSaving}
                          initialValues={{
                            title: item.title ?? "",
                            description: item.description ?? "",
                            category: item.category ?? "",
                            contentType: item.contentType ?? "",
                            platform: item.platform ?? "",
                            scheduledAt: item.scheduledAt ? toDatetimeLocalInput(item.scheduledAt) : "",
                            primaryImageUrl: item.images.primary || "/placeholder.svg",
                            secondaryImageUrl: item.images.second || "/placeholder.svg",
                            thirdImageUrl: item.images.third || "/placeholder.svg",
                          }}
                          readOnly={editingItemId !== item.id}
                          mediaPicker={(() => {
                            const biz = businesses.find((b) => b.id === activeRow?.businessId);
                            return biz?.userId && activeRow?.businessId ? { userId: biz.userId, businessId: activeRow.businessId } : null;
                          })()}
                          onCancel={cancelEditItem}
                          onDelete={undefined}
                          onSave={(values) => void saveEditItem(values)}
                        />
                      </div>
                      ) : (
                        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_4fr]">
                          {/* Content Details */}
                          <div className="order-1 space-y-3 lg:order-2">
                            <p className="text-sm font-medium text-foreground">Content Details</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Category</p>
                                <p className="text-sm text-foreground">{item.category || "-"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Type Content</p>
                                <p className="text-sm text-foreground">{item.contentType || "-"}</p>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="text-xs text-muted-foreground">Platform</p>
                                <p className="text-sm text-foreground">{item.platform || "-"}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground">Description</p>
                              <div className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: item.description || "" }} />
                            </div>
                          </div>

                          {/* Images */}
                          <div className="order-2 space-y-3 lg:order-1">
                            <p className="text-sm font-medium text-foreground">Images</p>
                            <div className="grid gap-3">
                              <img
                                src={primary}
                                alt="Primary image"
                                loading="lazy"
                                className="h-36 w-full rounded-md object-cover"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <img
                                  src={second}
                                  alt="Secondary image"
                                  loading="lazy"
                                  className="h-24 w-full rounded-md object-cover"
                                />
                                <img
                                  src={third}
                                  alt="Third image"
                                  loading="lazy"
                                  className="h-24 w-full rounded-md object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={Boolean(deleteItemId)}
          onOpenChange={(open) => {
            if (!open) setDeleteItemId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This content will be permanently deleted from the database. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmDeleteItem()}>Yes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Manage dialog (Category / Content) */}
        <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage</DialogTitle>
              <DialogDescription className="sr-only">Manage categories and content columns.</DialogDescription>
            </DialogHeader>

            <Tabs value={manageTab} onValueChange={(v) => setManageTab(v as "category" | "content")}>
              <TabsList>
                <TabsTrigger value="category">Category</TabsTrigger>
                <TabsTrigger value="content">Type Content</TabsTrigger>
              </TabsList>

              <TabsContent value="category" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category name..." />
                  <Button type="button" onClick={addCategory}>
                    Add
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((c) => {
                      const isEditing = editingCategory === c;
                      const isLocked = lockedCategories.has(lockKey(c));

                      return (
                        <TableRow key={c}>
                          <TableCell>
                            {isEditing ? (
                              <Input value={editingCategoryDraft} onChange={(e) => setEditingCategoryDraft(e.target.value)} />
                            ) : (
                              <span className="font-medium">{c}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isEditing}
                                onClick={() => toggleCategoryLock(c)}
                                aria-label={isLocked ? "Unlock" : "Lock"}
                                title={isLocked ? "Unlock" : "Lock"}
                              >
                                {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                              </Button>

                              {isEditing ? (
                                <>
                                  <Button type="button" size="sm" onClick={() => setConfirmAction({ kind: "save_edit_category" })}>
                                    Save
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={cancelEditCategory}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={isLocked}
                                  onClick={() => startEditCategory(c)}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isLocked}
                                onClick={() => setConfirmAction({ kind: "delete_category", name: c })}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {categories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                          No categories yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={newContentType}
                    onChange={(e) => setNewContentType(e.target.value)}
                    placeholder="Content column name..."
                  />
                  <Button type="button" onClick={addContentType}>
                    Add
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content Column</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contentTypes.map((t) => {
                      const isEditing = editingContentType === t;
                      const isLocked = lockedContentTypes.has(lockKey(t));

                      return (
                        <TableRow key={t}>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={editingContentTypeDraft}
                                onChange={(e) => setEditingContentTypeDraft(e.target.value)}
                              />
                            ) : (
                              <span className="font-medium">{t}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isEditing}
                                onClick={() => toggleContentTypeLock(t)}
                                aria-label={isLocked ? "Unlock" : "Lock"}
                                title={isLocked ? "Unlock" : "Lock"}
                              >
                                {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                              </Button>

                              {isEditing ? (
                                <>
                                  <Button type="button" size="sm" onClick={() => setConfirmAction({ kind: "save_edit_type" })}>
                                    Save
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" onClick={cancelEditContentType}>
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={isLocked}
                                  onClick={() => startEditContentType(t)}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isLocked}
                                onClick={() => setConfirmAction({ kind: "delete_type", name: t })}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {contentTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                          No content columns yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>

            <AlertDialog open={!!confirmAction} onOpenChange={(open) => (!open ? setConfirmAction(null) : undefined)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
                  <AlertDialogDescription>{confirmCopy?.description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm}>{confirmCopy?.confirmLabel ?? "Yes"}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setManageDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Content Creation</h1>
          <p className="text-muted-foreground">Manage content ideas, categories, and deliverables for clients.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Add
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary">
                Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-50 w-64">
              {displayedContentTypes.map((t) => (
                <DropdownMenuItem key={t} onClick={() => onImport(t)}>
                  {t}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => openManage("content")}>
                Manage…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Content Management</CardTitle>
            {lastImportType ? (
              <p className="text-sm text-muted-foreground">Last selected: {lastImportType}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="w-full sm:w-[260px]">
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

            <Button type="button" variant="secondary" onClick={() => openManage("category")}>
              Manage
            </Button>
          </div>
        </CardHeader>

        <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Category</TableHead>
                  {displayedContentTypes.map((t) => (
                    <TableHead key={t} className="text-right">
                      {t}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {displayedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.businessName}</TableCell>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    {displayedContentTypes.map((t) => (
                      <TableCell key={t} className="text-right">
                        {row.counts?.[t] ?? 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openDetails(row)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {rowsLoading && displayedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayedContentTypes.length + 3} className="py-10 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : null}

                {!rowsLoading && displayedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayedContentTypes.length + 3} className="py-10 text-center text-muted-foreground">
                      No data for the selected business.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      {/* Manage dialog (Category / Content) */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage</DialogTitle>
            <DialogDescription className="sr-only">Manage categories and content columns.</DialogDescription>
          </DialogHeader>

          <Tabs value={manageTab} onValueChange={(v) => setManageTab(v as "category" | "content")}>
            <TabsList>
              <TabsTrigger value="category">Category</TabsTrigger>
              <TabsTrigger value="content">Type Content</TabsTrigger>
            </TabsList>

            <TabsContent value="category" className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Category name..." />
                <Button type="button" onClick={addCategory}>
                  Add
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => {
                    const isEditing = editingCategory === c;
                    const isLocked = lockedCategories.has(lockKey(c));

                    return (
                      <TableRow key={c}>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editingCategoryDraft} onChange={(e) => setEditingCategoryDraft(e.target.value)} />
                          ) : (
                            <span className="font-medium">{c}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isEditing}
                              onClick={() => toggleCategoryLock(c)}
                              aria-label={isLocked ? "Unlock" : "Lock"}
                              title={isLocked ? "Unlock" : "Lock"}
                            >
                              {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </Button>

                            {isEditing ? (
                              <>
                                <Button type="button" size="sm" onClick={() => setConfirmAction({ kind: "save_edit_category" })}>
                                  Save
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={cancelEditCategory}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isLocked}
                                onClick={() => startEditCategory(c)}
                              >
                                Edit
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isLocked}
                              onClick={() => setConfirmAction({ kind: "delete_category", name: c })}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                        No categories yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={newContentType}
                  onChange={(e) => setNewContentType(e.target.value)}
                  placeholder="Content column name..."
                />
                <Button type="button" onClick={addContentType}>
                  Add
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content Column</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contentTypes.map((t) => {
                    const key = lockKey(t);
                    const isPermanent = PERMANENT_CONTENT_TYPES.has(key);
                    const isEditing = editingContentType === t;
                    const isLocked = isPermanent || lockedContentTypes.has(key);

                    return (
                      <TableRow key={t}>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editingContentTypeDraft}
                              onChange={(e) => setEditingContentTypeDraft(e.target.value)}
                            />
                          ) : (
                            <span className="font-medium">{t}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isEditing || isPermanent}
                              onClick={() => toggleContentTypeLock(t)}
                              aria-label={isLocked ? "Unlock" : "Lock"}
                              title={isPermanent ? "Permanent" : isLocked ? "Unlock" : "Lock"}
                            >
                              {isPermanent ? (
                                <Lock className="h-4 w-4" />
                              ) : isLocked ? (
                                <Unlock className="h-4 w-4" />
                              ) : (
                                <Lock className="h-4 w-4" />
                              )}
                            </Button>

                            {isEditing ? (
                              <>
                                <Button type="button" size="sm" onClick={() => setConfirmAction({ kind: "save_edit_type" })}>
                                  Save
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={cancelEditContentType}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isLocked}
                                onClick={() => startEditContentType(t)}
                              >
                                Edit
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isLocked}
                              onClick={() => setConfirmAction({ kind: "delete_type", name: t })}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {contentTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                        No content columns yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>

          <AlertDialog open={!!confirmAction} onOpenChange={(open) => (!open ? setConfirmAction(null) : undefined)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmCopy?.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirm}>{confirmCopy?.confirmLabel ?? "Yes"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
