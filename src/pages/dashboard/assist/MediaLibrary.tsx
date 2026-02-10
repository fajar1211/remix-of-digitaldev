import * as React from "react";

import { Lock, Unlock } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MediaItemForm from "@/pages/dashboard/assist/media-library/MediaItemForm";
import MediaDetailsView from "@/pages/dashboard/assist/media-library/MediaDetailsView";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseRealtimeReload } from "@/hooks/useSupabaseRealtimeReload";
import { fetchActiveBusinesses } from "@/lib/activeBusinesses";

type ImportType = "Gambar" | "Video";

type BusinessOption = {
  id: string;
  name: string;
  userId: string;
  publicId: string;
};

type MediaTypeOption = {
  id: string;
  name: string;
  key: string; // normalized key for lookups (lowercase/trim)
};

type MediaRow = {
  id: string;
  businessId: string;
  businessName: string;
  category: string;
  typeCounts: Record<string, number>; // by MediaTypeOption.key
};

const IMPORT_TYPES: ImportType[] = ["Gambar", "Video"];

const FALLBACK_ROWS: MediaRow[] = [
  {
    id: "demo-1",
    businessId: "demo",
    businessName: "Demo Business",
    category: "",
    typeCounts: {},
  },
  {
    id: "demo-2",
    businessId: "demo",
    businessName: "Demo Business",
    category: "",
    typeCounts: {},
  },
];

function safeName(name: string | null | undefined) {
  return (name ?? "(No name)").trim() || "(No name)";
}

function formatBusinessId(businessNumber: number | null | undefined) {
  if (!businessNumber) return "";
  return `B${businessNumber.toString().padStart(5, "0")}`;
}

function lockKey(name: string) {
  return (name ?? "").trim().toLowerCase();
}

const PERMANENT_CONTENT_TYPES = new Set(["manage files", "images gallery", "logo", "video content"]);

function uniqueNonEmpty(values: string[]) {
  const set = new Set<string>();
  for (const v of values) {
    const cleaned = (v ?? "").trim();
    if (!cleaned) continue;
    set.add(cleaned);
  }
  return Array.from(set);
}


export default function AssistMediaLibrary() {
  const { toast } = useToast();

  const [lastImportType, setLastImportType] = React.useState<ImportType | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  // View Details (full page, not overlay)
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsRow, setDetailsRow] = React.useState<{
    businessId: string;
    businessName: string;
    userId: string;
    category: string;
  } | null>(null);

  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<string>("all");

  // Category + Media Type management (media_categories + media_types)
  const [categories, setCategories] = React.useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = React.useState<Array<{ id: string; name: string; key: string }>>([]);
  const [mediaTypes, setMediaTypes] = React.useState<MediaTypeOption[]>([]);
  const visibleMediaTypeNames = React.useMemo(() => uniqueNonEmpty(mediaTypes.map((t) => t.name)), [mediaTypes]);
  const [lockedCategories, setLockedCategories] = React.useState<Set<string>>(() => new Set());
  const [lockedContentTypes, setLockedContentTypes] = React.useState<Set<string>>(() => new Set());

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

  const resolveCategoryId = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) throw new Error("Category is required.");

    const { data: existing, error: selectError } = await supabase
      .from("media_categories")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (selectError) throw selectError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: insertError } = await supabase
      .from("media_categories")
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
      .from("media_types")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (selectError) throw selectError;
    if (existing?.id) return existing.id as string;

    const { data: created, error: insertError } = await supabase
      .from("media_types")
      .insert({ name: cleaned })
      .select("id")
      .single();

    if (insertError) throw insertError;
    return created.id as string;
  };

  const lookupCategoryIdInsensitive = async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return null;

    const { data, error } = await supabase
      .from("media_categories")
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
      .from("media_types")
      .select("id")
      .ilike("name", cleaned)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data?.id as string | undefined) ?? null;
  };

  const refreshCategories = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("media_categories")
      .select("id, name, is_locked")
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<{ id: string; name: string; is_locked?: boolean }>;
    setCategories(uniqueNonEmpty(rows.map((r) => r.name)));
    setCategoryOptions(rows.map((r) => ({ id: r.id, name: r.name, key: lockKey(r.name) })));
    setLockedCategories(new Set(rows.filter((r) => Boolean(r.is_locked)).map((r) => lockKey(r.name))));
  }, []);

  const refreshContentTypes = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("media_types")
      .select("id, name, is_locked")
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<{ id: string; name: string; is_locked?: boolean }>;

    // Only show types that exist in the database.
    const byKey = new Map<string, MediaTypeOption>();
    for (const r of rows) {
      const key = lockKey(r.name);
      byKey.set(key, { id: r.id, name: r.name, key });
    }
    setMediaTypes(Array.from(byKey.values()));

    const locked = new Set(rows.filter((r) => Boolean(r.is_locked)).map((r) => lockKey(r.name)));
    for (const k of PERMANENT_CONTENT_TYPES) locked.add(k);
    setLockedContentTypes(locked);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [bizResult, { data: catData }, { data: typeData }] = await Promise.all([
        fetchActiveBusinesses({ select: "id, business_name, user_id, business_number", orderByBusinessName: true }),
        supabase.from("media_categories").select("id, name, is_locked").order("name", { ascending: true }),
        supabase.from("media_types").select("id, name, is_locked").order("name", { ascending: true }),
      ]);

      if (cancelled) return;

      setBusinesses(
        (bizResult ?? []).map((b: any) => ({
          id: b.id,
          name: safeName(b.business_name),
          userId: b.user_id,
          publicId: formatBusinessId((b as any).business_number as number | null) || b.id,
        }))
      );

      const catRows = (catData ?? []) as Array<{ id: string; name: string; is_locked?: boolean }>;
      setCategories(uniqueNonEmpty(catRows.map((c) => c.name)));
      setCategoryOptions(catRows.map((c) => ({ id: c.id, name: c.name, key: lockKey(c.name) })));
      setLockedCategories(new Set(catRows.filter((c) => Boolean(c.is_locked)).map((c) => lockKey(c.name))));

      const typeRows = (typeData ?? []) as Array<{ id: string; name: string; is_locked?: boolean }>;

      const byKey = new Map<string, MediaTypeOption>();
      for (const r of typeRows) {
        const key = lockKey(r.name);
        byKey.set(key, { id: r.id, name: r.name, key });
      }
      setMediaTypes(Array.from(byKey.values()));

      const locked = new Set(typeRows.filter((t) => Boolean(t.is_locked)).map((t) => lockKey(t.name)));
      for (const k of PERMANENT_CONTENT_TYPES) locked.add(k);
      setLockedContentTypes(locked);

    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const openManage = (tab: "category" | "content") => {
    setManageTab(tab);
    setManageDialogOpen(true);
    void refreshCategories();
    void refreshContentTypes();
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

      const { error } = await supabase.from("media_categories").update({ name: to }).eq("id", id);
      if (error) throw error;

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

      const { error } = await supabase.from("media_categories").delete().eq("id", id);
      if (error) throw error;

      await refreshCategories();
      toast({ title: "Deleted", description: "Category deleted." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e?.message ?? "Category may be in use by existing items.",
      });
    }
  };

  const toggleCategoryLock = async (name: string) => {
    try {
      const cleaned = name.trim();
      const { data, error } = await supabase
        .from("media_categories")
        .select("id, is_locked")
        .ilike("name", cleaned)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Category not found in database.");

      const nextLocked = !Boolean((data as any).is_locked);
      const { error: updateError } = await supabase.from("media_categories").update({ is_locked: nextLocked }).eq("id", (data as any).id);
      if (updateError) throw updateError;

      await refreshCategories();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed", description: e?.message ?? "Failed to toggle lock." });
    }
  };

  const addContentType = async () => {
    const name = newContentType.trim();
    if (!name) return;

    const key = lockKey(name);
    if (mediaTypes.some((t) => t.key === key)) {
      toast({ title: "Type already exists", description: `Type Content \"${name}\" is already registered.` });
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

    const fromKey = lockKey(from);
    const toKey = lockKey(to);
    if (mediaTypes.some((t) => t.key !== fromKey && t.key === toKey)) {
      toast({ title: "Type name conflict", description: `Type Content \"${to}\" already exists.` });
      return;
    }

    try {
      const id = await lookupContentTypeIdInsensitive(from);
      if (!id) throw new Error("Type Content not found in database.");

      const { error } = await supabase.from("media_types").update({ name: to }).eq("id", id);
      if (error) throw error;

      await refreshContentTypes();
      cancelEditContentType();
      toast({ title: "Saved", description: "Type Content updated." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message ?? "Unknown error" });
    }
  };

  const deleteContentType = async (name: string) => {
    try {
      const key = lockKey(name);
      if (PERMANENT_CONTENT_TYPES.has(key)) {
        toast({ variant: "destructive", title: "Not allowed", description: "This Type Content is permanent." });
        return;
      }

      const id = await lookupContentTypeIdInsensitive(name);
      if (!id) throw new Error("Type Content not found in database.");

      const { error } = await supabase.from("media_types").delete().eq("id", id);
      if (error) throw error;

      await refreshContentTypes();
      toast({ title: "Deleted", description: "Type Content deleted." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: e?.message ?? "Type Content may be in use by existing items.",
      });
    }
  };

  const toggleContentTypeLock = async (name: string) => {
    const key = lockKey(name);
    if (PERMANENT_CONTENT_TYPES.has(key)) return;

    try {
      const cleaned = name.trim();
      const { data, error } = await supabase
        .from("media_types")
        .select("id, is_locked")
        .ilike("name", cleaned)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("Type Content not found in database.");

      const nextLocked = !Boolean((data as any).is_locked);
      const { error: updateError } = await supabase.from("media_types").update({ is_locked: nextLocked }).eq("id", (data as any).id);
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

  const [mediaRows, setMediaRows] = React.useState<MediaRow[]>([]);
  const [mediaRowsLoading, setMediaRowsLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  useSupabaseRealtimeReload({
    channelName: "assist-media-library-sync",
    targets: [
      { table: "user_gallery" },
      { table: "media_categories" },
      { table: "media_types" },
      { table: "businesses" },
    ],
    debounceMs: 300,
    onChange: () => {
      // Refresh meta + recount (counts are derived from user_gallery)
      void refreshCategories();
      void refreshContentTypes();
      setRefreshKey((v) => v + 1);

      // Business list may change (new client onboarding)
      void (async () => {
        const { data: bizData, error: bizError } = await supabase
          .from("businesses")
          .select("id, business_name, user_id, business_number")
          .order("business_name", { ascending: true, nullsFirst: false });

        if (bizError) return;

        setBusinesses(
          (bizData ?? []).map((b: any) => ({
            id: b.id,
            name: safeName(b.business_name),
            userId: b.user_id,
            publicId: formatBusinessId((b as any).business_number as number | null) || b.id,
          })),
        );
      })();
    },
  });

  React.useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      if (businesses.length === 0) {
        setMediaRows([]);
        return;
      }

      setMediaRowsLoading(true);
      try {
        const userIds = Array.from(new Set(businesses.map((b) => b.userId).filter(Boolean)));
        if (userIds.length === 0) {
          setMediaRows([]);
          return;
        }

        // Build helpers from current mediaTypes
        const knownTypeKeys = mediaTypes.map((t) => t.key);
        const typeIdToKey = new Map<string, string>();
        for (const t of mediaTypes) {
          if (!t.id.startsWith("__default_")) typeIdToKey.set(t.id, t.key);
        }

        // Categories: create rows only for categories that exist in the database.
        const categoryIdToName = new Map<string, string>();
        for (const c of categoryOptions) categoryIdToName.set(c.id, c.name);
        const categoriesForRows = categoryOptions.map((c) => c.name);

        const imagesKey = mediaTypes.find((t) => t.key === lockKey("Images Gallery"))?.key;
        const videoKey = mediaTypes.find((t) => t.key === lockKey("Video Content"))?.key;

        const { data: galleryData, error } = await supabase
          .from("user_gallery")
          .select("user_id, type, media_type_id, media_category_id")
          .in("user_id", userIds);

        if (error) throw error;

        const ensureTypeInit = () => Object.fromEntries(knownTypeKeys.map((k) => [k, 0] as const)) as Record<string, number>;

        // user -> categoryName -> typeKey -> count
        const countsByUserCategory: Record<string, Record<string, Record<string, number>>> = {};
        const ensureUserCategoryInit = (userId: string, categoryName: string) => {
          if (!countsByUserCategory[userId]) countsByUserCategory[userId] = {};
          if (!countsByUserCategory[userId][categoryName]) countsByUserCategory[userId][categoryName] = ensureTypeInit();
          return countsByUserCategory[userId][categoryName];
        };

        for (const item of (galleryData ?? []) as Array<{
          user_id: string;
          type: string;
          media_type_id: string | null;
          media_category_id: string | null;
        }>) {
          const userId = item.user_id;
          const categoryName = item.media_category_id ? categoryIdToName.get(item.media_category_id) ?? "" : "";
          if (!categoryName) continue;

          const catCounts = ensureUserCategoryInit(userId, categoryName);

          const applyIncrement = (key: string) => {
            catCounts[key] = (catCounts[key] ?? 0) + 1;
          };

          const mappedKey = item.media_type_id ? typeIdToKey.get(item.media_type_id) : undefined;
          if (mappedKey) {
            applyIncrement(mappedKey);
            continue;
          }

          // Fallback mapping by MIME type for legacy rows that don't have media_type_id.
          const mime = (item.type ?? "").toLowerCase();
          if (mime.startsWith("image/") && imagesKey) applyIncrement(imagesKey);
          else if (mime.startsWith("video/") && videoKey) applyIncrement(videoKey);
        }

        const nextRows: MediaRow[] = businesses.flatMap((b) => {
          return categoriesForRows.map((catName) => {
            const typeCounts = countsByUserCategory[b.userId]?.[catName] ?? ensureTypeInit();
            return {
              id: `${b.id}-${lockKey(catName)}`,
              businessId: b.id,
              businessName: b.name,
              category: catName,
              typeCounts,
            };
          });
        });

        if (!cancelled) setMediaRows(nextRows);
      } catch {
        if (!cancelled) setMediaRows([]);
      } finally {
        if (!cancelled) setMediaRowsLoading(false);
      }
    };

    void loadCounts();

    return () => {
      cancelled = true;
    };
  }, [businesses, mediaTypes, categoryOptions, refreshKey]);

  const rows: MediaRow[] = React.useMemo(() => {
    if (mediaRows.length > 0) return mediaRows;

    const typeKeys = mediaTypes.map((t) => t.key);
    const emptyTypeCounts = Object.fromEntries(typeKeys.map((k) => [k, 0] as const));

    if (businesses.length > 0 && mediaRowsLoading) {
      return businesses.flatMap((b) =>
        categories.map((cat) => ({
          id: `${b.id}-${lockKey(cat)}`,
          businessId: b.id,
          businessName: b.name,
          category: cat,
          typeCounts: emptyTypeCounts,
        }))
      );
    }

    return FALLBACK_ROWS;
  }, [mediaRows, businesses, mediaRowsLoading, mediaTypes]);

  const displayedRows = React.useMemo(() => {
    const filtered = selectedBusinessId === "all" ? rows : rows.filter((r) => r.businessId === selectedBusinessId);

    // Show all directories (categories) even when they have 0 items.
    return [...filtered].sort((a, b) => {
      const byBusiness = a.businessName.localeCompare(b.businessName, "en", { sensitivity: "base" });
      if (byBusiness !== 0) return byBusiness;
      return a.category.localeCompare(b.category, "en", { sensitivity: "base" });
    });
  }, [rows, selectedBusinessId]);

  const onImport = (type: ImportType) => {
    setLastImportType(type);
    toast({
      title: "In Progress",
      description: `Import \"${type}\" is in progress.`,
    });
  };

  const openDetails = (row: MediaRow) => {
    const biz = businesses.find((b) => b.id === row.businessId);
    if (!biz?.userId) {
      toast({ variant: "destructive", title: "Cannot open details", description: "Business user not found." });
      return;
    }

    setDetailsRow({
      businessId: row.businessId,
      businessName: row.businessName,
      userId: biz.userId,
      category: row.category,
    });
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsRow(null);
  };

  if (detailsOpen && detailsRow) {
    return (
      <MediaDetailsView
        businessName={detailsRow.businessName}
        userId={detailsRow.userId}
        categories={categories}
        categoryOptions={categoryOptions.map((c) => ({ id: c.id, name: c.name }))}
        mediaTypes={mediaTypes}
        initialCategory={detailsRow.category}
        onBack={closeDetails}
      />
    );
  }

  if (createOpen) {
    return (
      <MediaItemForm
        businesses={
          businesses.length
            ? businesses.map((b) => ({ id: b.id, name: b.name, publicId: b.publicId }))
            : [{ id: "demo", name: "Demo Business", publicId: "B00000" }]
        }
        categories={categories}
        mediaTypes={visibleMediaTypeNames.length ? visibleMediaTypeNames : ["Gambar", "Video"]}
        onCancel={() => setCreateOpen(false)}
        onSave={async (payload) => {
          try {
            const biz = businesses.find((b) => b.id === payload.businessId);
            if (!biz?.userId) throw new Error("Business user not found.");

            const categoryId = await resolveCategoryId(payload.category);
            const mediaTypeId = await resolveContentTypeId(payload.mediaType);

            const safeBase = (value: string) =>
              value
                .trim()
                .replace(/\s+/g, "-")
                .replace(/[^a-zA-Z0-9_-]/g, "")
                .slice(0, 80);

            const uploads = await Promise.all(
              payload.files.map(async (file, idx) => {
                const baseName = payload.generatedNames[idx] || payload.imageName;
                const cleaned = safeBase(baseName) || `media-${idx + 1}`;

                const dot = file.name.lastIndexOf(".");
                const ext = dot >= 0 ? file.name.slice(dot) : "";

                const path = `${biz.userId}/${payload.businessId}/${categoryId}/${mediaTypeId}/${cleaned}${ext}`;

                const { error: uploadError } = await supabase.storage.from("user-files").upload(path, file, {
                  upsert: true,
                  contentType: file.type,
                });
                if (uploadError) throw uploadError;

                const { data: publicData } = supabase.storage.from("user-files").getPublicUrl(path);

                return {
                  user_id: biz.userId,
                  media_category_id: categoryId,
                  media_type_id: mediaTypeId,
                  name: `${cleaned}${ext}`,
                  size: file.size,
                  type: file.type,
                  url: publicData.publicUrl,
                };
              })
            );

            const { error: insertError } = await supabase.from("user_gallery").insert(uploads);
            if (insertError) throw insertError;

            toast({ title: "Saved", description: `Uploaded ${uploads.length} file(s).` });
            setCreateOpen(false);
            setRefreshKey((k) => k + 1);
          } catch (e: any) {
            toast({
              variant: "destructive",
              title: "Save failed",
              description: e?.message ?? "Unknown error",
            });
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Media Library</h1>
          <p className="text-muted-foreground">Manage media assets (images & video) for clients.</p>
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
              {IMPORT_TYPES.map((t) => (
                <DropdownMenuItem key={t} onClick={() => onImport(t)}>
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Media Management</CardTitle>
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
                {mediaTypes.map((t) => (
                  <TableHead key={t.key} className="text-right">
                    {t.name}
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
                  {mediaTypes.map((t) => (
                    <TableCell key={`${row.id}-${t.key}`} className="text-right">
                      {row.typeCounts?.[t.key] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDetails(row)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {displayedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + mediaTypes.length} className="py-10 text-center text-muted-foreground">
                    No data for the selected business.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manage dialog (Category / Type Content) */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage</DialogTitle>
            <DialogDescription className="sr-only">Manage categories and content types.</DialogDescription>
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
                  placeholder="Type Content name..."
                />
                <Button type="button" onClick={addContentType}>
                  Add
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type Content</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMediaTypeNames.map((t) => {
                    const key = lockKey(t);
                    const isPermanent = PERMANENT_CONTENT_TYPES.has(key);
                    const isEditing = editingContentType === t;
                    const isLocked = isPermanent || lockedContentTypes.has(key);

                    return (
                      <TableRow key={t}>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editingContentTypeDraft} onChange={(e) => setEditingContentTypeDraft(e.target.value)} />
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

                  {visibleMediaTypeNames.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                        No types yet.
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
