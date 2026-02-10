import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export type BlogAuthorRow = {
  id: string;
  name: string;
  email: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  value: string | null;
  onChange: (nextId: string | null, nextLabel: string) => void;
  label?: string;
  placeholder?: string;
};

export function AuthorPicker({
  value,
  onChange,
  label = "Author",
  placeholder = "Select an author...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authors, setAuthors] = useState<BlogAuthorRow[]>([]);
  const [query, setQuery] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const selected = useMemo(() => authors.find((a) => a.id === value) ?? null, [authors, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return authors;
    return authors.filter((a) => {
      const hay = `${a.name} ${a.email ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [authors, query]);

  const loadAuthors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blog_authors")
        .select("id,name,email,is_locked,created_at,updated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      setAuthors((data as BlogAuthorRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadAuthors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Preload authors when an existing value is set (so the trigger shows the saved author
  // even before the popover is opened).
  useEffect(() => {
    if (!value) return;
    if (authors.length) return;
    void loadAuthors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = (a: BlogAuthorRow) => {
    onChange(a.id, a.email ? `${a.name} (${a.email})` : a.name);
    setOpen(false);
  };

  const beginEdit = (a: BlogAuthorRow) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditEmail(a.email ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmail("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name) return;

    await supabase
      .from("blog_authors")
      .update({ name, email: email || null })
      .eq("id", editingId);

    await loadAuthors();
    if (value === editingId) {
      onChange(editingId, email ? `${name} (${email})` : name);
    }
    cancelEdit();
  };

  const createAuthor = async () => {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name) return;

    const { data, error } = await supabase
      .from("blog_authors")
      .insert({ name, email: email || null })
      .select("id,name,email,is_locked,created_at,updated_at")
      .single();

    if (error) throw error;

    setNewName("");
    setNewEmail("");
    setCreating(false);

    await loadAuthors();
    if (data?.id) {
      const label = data.email ? `${data.name} (${data.email})` : data.name;
      onChange(data.id, label);
      setOpen(false);
    }
  };

  const deleteAuthor = async (a: BlogAuthorRow) => {
    if (a.is_locked) return;
    if (!confirm(`Delete author "${a.name}"?`)) return;

    const { error } = await supabase.from("blog_authors").delete().eq("id", a.id);
    if (error) throw error;

    if (value === a.id) onChange(null, "");
    await loadAuthors();
  };

  const triggerText = selected ? (selected.email ? `${selected.name} (${selected.email})` : selected.name) : "";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-between", !triggerText && "text-muted-foreground")}
          >
            <span className="truncate">{triggerText || placeholder}</span>
            <span className="ml-2 flex items-center gap-1">
              {value ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(null, "");
                  }}
                  aria-label="Clear author"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[360px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search authors..." value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{loading ? "Loading..." : "No authors found"}</CommandEmpty>

              <CommandGroup heading="Select author">
                {filtered.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.name} ${a.email ?? ""}`}
                    onSelect={() => pick(a)}
                    className="flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate">{a.name}</div>
                      {a.email ? <div className="truncate text-xs text-muted-foreground">{a.email}</div> : null}
                    </div>
                    <div className="ml-2 flex items-center gap-1">
                      {value === a.id ? <Check className="h-4 w-4 text-primary" /> : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          beginEdit(a);
                        }}
                        aria-label="Edit author"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={a.is_locked}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void deleteAuthor(a);
                        }}
                        aria-label="Delete author"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Manage">
                {editingId ? (
                  <div className="p-3 space-y-2">
                    <div className="text-sm font-medium">Edit author</div>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email (optional)" />
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => void saveEdit()} className="flex-1">
                        Save
                      </Button>
                      <Button type="button" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : creating ? (
                  <div className="p-3 space-y-2">
                    <div className="text-sm font-medium">Add new author</div>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
                    <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email (optional)" />
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => void createAuthor()} className="flex-1">
                        Add
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <Button type="button" variant="outline" className="w-full" onClick={() => setCreating(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add author
                    </Button>
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-xs text-muted-foreground">Select an author, or add/edit/delete authors.</p>
    </div>
  );
}
