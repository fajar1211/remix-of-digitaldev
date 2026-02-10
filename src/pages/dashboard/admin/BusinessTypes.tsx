import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { BusinessTypeRow } from "./business-types/types";
import { useBusinessTypesAdmin } from "./business-types/useBusinessTypesAdmin";
import { CategoryGroupCard } from "./business-types/CategoryGroupCard";
import { isOthers } from "./business-types/sort";

const createSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(80),
  type: z.string().trim().min(1, "Type is required").max(80),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
});

export default function AdminBusinessTypes() {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessTypeRow | null>(null);
  const { loading, grouped, categoryCount, createType, updateType, toggleActive, removeType, moveType, moveCategory } =
    useBusinessTypesAdmin();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { category: "", type: "", sort_order: 0, is_active: true },
  });

  const editForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { category: "", type: "", sort_order: 0, is_active: true },
  });

  const onCreate = async (values: z.infer<typeof createSchema>) => {
    await createType(values);
    form.reset({ category: "", type: "", sort_order: 0, is_active: true });
    setOpen(false);
  };

  const openEditDialog = (row: BusinessTypeRow) => {
    setEditing(row);
    editForm.reset({
      category: row.category,
      type: row.type,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    setEditOpen(true);
  };

  const onEdit = async (values: z.infer<typeof createSchema>) => {
    if (!editing) return;

    await updateType(editing.id, values);
    setEditOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Business Types</h1>
          <p className="text-sm text-muted-foreground">
            Manage the Business Type list used in onboarding dropdowns. ({categoryCount} categories)
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Business Type</DialogTitle>
                <DialogDescription>Create a new category + type.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Home Services" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Plumbing Service" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="sort_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Order</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <FormLabel className="m-0">Active</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Business Type</DialogTitle>
              <DialogDescription>Update category, type, ordering, and status.</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Home Services" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Plumbing Service" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={editForm.control}
                    name="sort_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Order</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <FormLabel className="m-0">Active</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditOpen(false);
                      setEditing(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading...</div>
          ) : grouped.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">
              No data yet. Add some Business Types to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((g) => {
                const movable = grouped.filter((x) => !isOthers(x.category));
                const idx = movable.findIndex((x) => x.category === g.category);
                const isFirstMovable = idx === 0;
                const isLastMovable = idx === movable.length - 1;

                return (
                  <CategoryGroupCard
                    key={g.category}
                    group={g}
                    isFirstMovable={isFirstMovable}
                    isLastMovable={isLastMovable}
                    onMoveCategory={(cat, dir) => void moveCategory(cat, dir)}
                    onMoveType={(cat, id, dir) => void moveType(cat, id, dir)}
                    onToggleActive={(id, next) => void toggleActive(id, next)}
                    onDelete={(id) => void removeType(id)}
                    onEdit={openEditDialog}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
