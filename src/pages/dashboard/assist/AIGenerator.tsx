import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Pencil, Sparkles, ArrowLeft, Copy } from 'lucide-react';
import { usePackageAiToolRules } from '@/hooks/usePackageAiToolRules';
import { usePackageMenuRules } from '@/hooks/usePackageMenuRules';
import { Checkbox } from '@/components/ui/checkbox';
import { useBusinessInfo } from '@/hooks/useBusinessInfo';
import BusinessInfoPanel from '@/components/business/BusinessInfoPanel';

type ToolLanguage = 'html' | 'react' | 'nextjs';

interface AITool {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  codeLanguage: ToolLanguage;
  codeContent: string;
  createdBy?: string;
  shareFields?: string[];
}

type ViewMode = 'tools' | 'tool-detail' | 'tool-create';

export default function AIGenerator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isToolEnabled } = usePackageAiToolRules(user?.id);
  const { isEnabled } = usePackageMenuRules(user?.id);

  const { data: business } = useBusinessInfo(user?.id);

  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);

  // Tools management (default screen)
  const [viewMode, setViewMode] = useState<ViewMode>('tools');
  const [tools, setTools] = useState<AITool[]>([]);
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [editingTool, setEditingTool] = useState<AITool | null>(null);
  const [loadingTools, setLoadingTools] = useState(false);
  const [savingTool, setSavingTool] = useState(false);

  // Tool form
  const [toolForm, setToolForm] = useState({
    title: '',
    description: '',
    icon: 'Sparkles',
    color: 'bg-primary/10 text-primary',
    codeLanguage: 'html' as ToolLanguage,
    codeContent: '',
    shareFields: [] as string[],
  });

  const canUsePage = useMemo(() => Boolean(user?.id), [user?.id]);

  const canUseTools = useMemo(() => isEnabled('ai_agents'), [isEnabled]);

  const loadTools = async () => {
    if (!user?.id) return;
    setLoadingTools(true);
    try {
      const { data, error } = await (supabase as any)
        .from('assist_ai_tools')
        // Show ALL active tools across all assist accounts
        .select('id,title,description,icon,color,code_language,code_content,created_by,json_config')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: AITool[] = (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title ?? '',
        description: row.description ?? '',
        icon: row.icon ?? 'Sparkles',
        color: row.color ?? 'bg-primary/10 text-primary',
        codeLanguage: (row.code_language ?? 'html') as ToolLanguage,
        codeContent: row.code_content ?? '',
        createdBy: row.created_by ?? undefined,
        shareFields: Array.isArray(row?.json_config?.share_fields) ? row.json_config.share_fields : [],
      }));

      setTools(mapped);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Failed to load tools',
        description: e?.message ?? 'Something went wrong.',
      });
    } finally {
      setLoadingTools(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    void loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleToolGenerate = () => {
    if (!selectedTool) return;
    setGenerating(true);
    setTimeout(() => {
      setResult(
        `Generated ${selectedTool.title} content:\n\n"${prompt}"\n\nThis is a placeholder. Connect to AI Gateway for real generation.`
      );
      setGenerating(false);
    }, 2000);
  };

  const handleAddTool = () => {
    setEditingTool(null);
    setToolForm({
      title: '',
      description: '',
      icon: 'Sparkles',
      color: 'bg-primary/10 text-primary',
      codeLanguage: 'html',
      codeContent: '',
      shareFields: [],
    });
    setViewMode('tool-create');
  };

  const handleEditTool = (tool: AITool) => {
    setEditingTool(tool);
    setToolForm({
      title: tool.title,
      description: tool.description,
      icon: tool.icon,
      color: tool.color,
      codeLanguage: tool.codeLanguage,
      codeContent: tool.codeContent,
      shareFields: tool.shareFields ?? [],
    });
    setViewMode('tool-create');
  };

  const handleSaveTool = async () => {
    if (!user?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
      return;
    }

    if (!toolForm.title.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Tool name is required.' });
      return;
    }

    setSavingTool(true);
    try {
      if (editingTool) {
        const { error } = await (supabase as any)
          .from('assist_ai_tools')
          .update({
            title: toolForm.title,
            description: toolForm.description ?? '',
            icon: toolForm.icon,
            color: toolForm.color,
            json_config: { share_fields: toolForm.shareFields ?? [] },
            code_language: toolForm.codeLanguage,
            code_content: toolForm.codeContent,
          })
          .eq('id', editingTool.id)
          // Assist can edit any tool (not only the creator)
          ;

        if (error) throw error;
        toast({ title: 'Tool updated', description: 'Your changes have been saved.' });
      } else {
        const { error } = await (supabase as any)
          .from('assist_ai_tools')
          .insert({
            created_by: user.id,
            title: toolForm.title,
            description: toolForm.description ?? '',
            icon: toolForm.icon,
            color: toolForm.color,
            json_config: { share_fields: toolForm.shareFields ?? [] },
            code_language: toolForm.codeLanguage,
            code_content: toolForm.codeContent,
            is_active: true,
          });

        if (error) throw error;
        toast({ title: 'Tool created', description: 'Your tool has been saved.' });
      }

      setViewMode('tools');
      setEditingTool(null);
      await loadTools();
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Failed to save tool',
        description: e?.message ?? 'Something went wrong.',
      });
    } finally {
      setSavingTool(false);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await (supabase as any)
        .from('assist_ai_tools')
        .delete()
        // Assist can delete any tool (not only the creator)
        .eq('id', toolId);

      if (error) throw error;
      toast({ title: 'Tool deleted', description: 'The tool has been removed.' });
      await loadTools();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Failed to delete', description: e?.message ?? 'Something went wrong.' });
    }
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(result);
    toast({ title: 'Copied!', description: 'Content copied to clipboard.' });
  };

  // Create/edit tool view (full page)
  if (viewMode === 'tool-create') {
    const shareOptions = [
      'Business ID',
      'First Name',
      'Last Name',
      'Business Name',
      'Business Type',
      'Email',
      'Website URL',
      'Google Business Profile',
      'My BKB',
      'Brand Expert',
      'My Persona 1',
      'My Persona 2',
      'My Persona 3',
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setViewMode('tools');
              setEditingTool(null);
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{editingTool ? 'Edit Tool' : 'Create New Tool'}</h1>
            <p className="text-muted-foreground">Save tools to the database</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tool Details</CardTitle>
            <CardDescription>Enter tool info and a code snippet (HTML/React/Next.js)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tool Name *</Label>
              <Input
                placeholder="Enter tool name..."
                value={toolForm.title}
                onChange={(e) => setToolForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter tool description..."
                value={toolForm.description}
                onChange={(e) => setToolForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={toolForm.icon} onValueChange={(value) => setToolForm((prev) => ({ ...prev, icon: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sparkles">Sparkles</SelectItem>
                    <SelectItem value="FileText">FileText</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Users">Users</SelectItem>
                    <SelectItem value="PenTool">PenTool</SelectItem>
                    <SelectItem value="Image">Image</SelectItem>
                    <SelectItem value="MessageSquare">MessageSquare</SelectItem>
                    <SelectItem value="Lightbulb">Lightbulb</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select value={toolForm.color} onValueChange={(value) => setToolForm((prev) => ({ ...prev, color: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bg-primary/10 text-primary">Primary</SelectItem>
                    <SelectItem value="bg-blue-500/10 text-blue-500">Blue</SelectItem>
                    <SelectItem value="bg-purple-500/10 text-purple-500">Purple</SelectItem>
                    <SelectItem value="bg-green-500/10 text-green-500">Green</SelectItem>
                    <SelectItem value="bg-orange-500/10 text-orange-500">Orange</SelectItem>
                    <SelectItem value="bg-pink-500/10 text-pink-500">Pink</SelectItem>
                    <SelectItem value="bg-cyan-500/10 text-cyan-500">Cyan</SelectItem>
                    <SelectItem value="bg-yellow-500/10 text-yellow-500">Yellow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Code Language</Label>
                <Select
                  value={toolForm.codeLanguage}
                  onValueChange={(value) => setToolForm((prev) => ({ ...prev, codeLanguage: value as ToolLanguage }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                    <SelectItem value="nextjs">Next.js</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Code Snippet</Label>
              <Textarea
                placeholder="Paste your HTML / React / Next.js code here..."
                value={toolForm.codeContent}
                onChange={(e) => setToolForm((prev) => ({ ...prev, codeContent: e.target.value }))}
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Share</Label>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {shareOptions.map((label) => {
                    const checked = toolForm.shareFields.includes(label);
                    return (
                      <label key={label} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const nextChecked = v === true;
                            setToolForm((prev) => {
                              const current = new Set(prev.shareFields);
                              if (nextChecked) current.add(label);
                              else current.delete(label);
                              return { ...prev, shareFields: Array.from(current) };
                            });
                          }}
                        />
                        <span className="leading-snug">{label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Checklist ini hanya untuk kebutuhan share di UI (tidak disimpan).
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setViewMode('tools');
                  setEditingTool(null);
                }}
                disabled={savingTool}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTool} disabled={savingTool}>
                {savingTool ? 'Saving...' : editingTool ? 'Update Tool' : 'Create Tool'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tool detail view
  if (viewMode === 'tool-detail' && selectedTool) {
    const buildPreviewSrcDoc = () => {
      const escaped = (selectedTool.codeContent ?? '').toString();

      if (!escaped.trim()) {
        return `<!doctype html><html><head><meta charset="utf-8" /></head><body style="font-family: system-ui; padding: 16px;">
          <h3>No code snippet</h3>
          <p>This tool has no saved snippet.</p>
        </body></html>`;
      }

      if (selectedTool.codeLanguage === 'html') {
        // Run HTML directly (scripts allowed, sandboxed on iframe).
        return escaped;
      }

      if (selectedTool.codeLanguage === 'react') {
        // React live preview using in-iframe Babel transform.
        // Expected snippet examples:
        // 1) function App(){ return <div>Hello</div> }
        // 2) const App = () => (<div/>);
        // Optionally: render(<App />)
        return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; font-family: system-ui; }
      #root { padding: 16px; }
      .error { padding: 16px; color: #b91c1c; background: #fee2e2; }
    </style>
  </head>
  <body>
    <div id="root"></div>

    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <script type="text/babel">
      try {
        ${escaped}

        // Auto-mount if user defines App and doesn't mount manually.
        if (typeof App !== 'undefined' && document.getElementById('root')?.childNodes?.length === 0) {
          ReactDOM.createRoot(document.getElementById('root')).render(<App />);
        }
      } catch (e) {
        const el = document.getElementById('root');
        if (el) el.innerHTML = '<div class="error"><strong>Preview error:</strong><br/>' + (e?.message ?? e) + '</div>';
        console.error(e);
      }
    </script>
  </body>
</html>`;
      }

      // nextjs
      return `<!doctype html><html><head><meta charset="utf-8" /></head><body style="font-family: system-ui; padding: 16px;">
        <h3>Next.js preview is not supported</h3>
        <p>This app runs on Vite + React. Next.js snippets are stored as text only.</p>
      </body></html>`;
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setViewMode('tools');
              setSelectedTool(null);
              setPrompt('');
              setResult('');
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${selectedTool.color} shrink-0`}>
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-foreground break-words">{selectedTool.title}</h1>
            </div>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_7fr] min-w-0 items-stretch">
          {/* Left: Detail Automations */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Detail Automations</CardTitle>
              <CardDescription>Tool Name and Description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Tool Name</Label>
                <div className="text-sm text-foreground font-medium break-words">{selectedTool.title}</div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <div className="text-sm text-muted-foreground break-words">{selectedTool.description || '-'}</div>
              </div>
              <div className="space-y-1">
                <Label>Code Language</Label>
                <div className="text-sm text-foreground font-medium break-words">{selectedTool.codeLanguage.toUpperCase()}</div>
              </div>

              <div className="pt-2" />

              <BusinessInfoPanel
                fields={[
                  { label: 'Business ID', value: business?.id ?? '' },
                  { label: 'First Name', value: business?.first_name ?? '' },
                  { label: 'Last Name', value: business?.last_name ?? '' },
                  { label: 'Business Name', value: business?.business_name ?? '' },
                  { label: 'Business Type', value: business?.business_type ?? '' },
                  { label: 'Email', value: business?.email ?? '' },
                  { label: 'Website URL', value: business?.website_url ?? '' },
                  { label: 'Google Business Profile', value: business?.gmb_link ?? '' },
                  { label: 'My BKB', value: business?.bkb_content ?? '' },
                  { label: 'Brand Expert', value: business?.brand_expert_content ?? '' },
                  { label: 'My Persona 1', value: business?.persona1_content ?? '' },
                  { label: 'My Persona 2', value: business?.persona2_content ?? '' },
                  { label: 'My Persona 3', value: business?.persona3_content ?? '' },
                ]}
              />

              {/* Generator UI removed per request */}

              {result ? (
                <div className="space-y-3">
                  <Label>Result</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm">{result}</pre>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleCopyResult}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Result
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Right: Preview from Code Snippet */}
          <Card className="min-w-0 flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle>Preview</CardTitle>
              <CardDescription>Rendered from the saved Code Snippet</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border">
                <iframe
                  key={`${selectedTool.id}-${selectedTool.codeLanguage}`}
                  title={`${selectedTool.title} preview`}
                  srcDoc={buildPreviewSrcDoc()}
                  sandbox="allow-scripts allow-forms allow-modals"
                  className="block w-full h-full min-h-[60vh] lg:min-h-[70vh] bg-background"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Tools management view
  if (viewMode === 'tools') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI Generator</h1>
            <p className="text-muted-foreground">All Tools</p>
          </div>
          <Button onClick={handleAddTool}>
            <Plus className="h-4 w-4 mr-2" />
            New Tool
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Tools</CardTitle>
            <CardDescription>Click on a tool to use it, or edit/delete from actions</CardDescription>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <div className="py-10 text-muted-foreground">No tools yet.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => {
                  const toolClickable = canUseTools && isToolEnabled(tool.id);
                  return (
                  <Card 
                    key={tool.id}
                    className={
                      toolClickable
                        ? 'min-w-0 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-primary/50'
                        : 'min-w-0 overflow-hidden cursor-not-allowed opacity-60 border-2'
                    }
                    aria-disabled={!toolClickable}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0"
                          onClick={() => {
                            if (!toolClickable) {
                              toast({
                                variant: 'destructive',
                              title: 'Tool unavailable',
                              description: 'This tool is disabled for your package.',
                              });
                              return;
                            }
                            setSelectedTool(tool);
                            setViewMode('tool-detail');
                          }}
                        >
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tool.color} shrink-0`}>
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base break-words">{tool.title}</CardTitle>
                          </div>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTool(tool);
                            }}
                            aria-label={`Edit ${tool.title}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Delete ${tool.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this tool?</AlertDialogTitle>
                                <AlertDialogDescription className="break-words">
                                  "{tool.title}" will be permanently deleted and cannot be restored.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>No</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDeleteTool(tool.id);
                                  }}
                                >
                                  Yes
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    );
  }

  // No other view modes.
  return null;
}
