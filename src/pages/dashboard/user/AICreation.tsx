import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  FileText,
  User,
  Users,
  PenTool,
  Image,
  MessageSquare,
  Lightbulb,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { buildToolPreviewSrcDoc, type ToolLanguage } from '@/lib/aiToolPreview';
import { usePackageAiToolRules } from '@/hooks/usePackageAiToolRules';
import { usePackageMenuRules } from '@/hooks/usePackageMenuRules';
import { useBusinessInfo } from '@/hooks/useBusinessInfo';
import BusinessInfoPanel from '@/components/business/BusinessInfoPanel';

interface AITool {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  codeLanguage: ToolLanguage;
  codeContent: string;
  shareFields?: string[];
}

type ViewMode = 'tools' | 'tool-detail';

const iconMap: Record<string, any> = {
  Sparkles,
  FileText,
  User,
  Users,
  PenTool,
  Image,
  MessageSquare,
  Lightbulb,
};

export default function AICreation() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { loading: loadingToolRules, enabledByToolId, isToolEnabled } = usePackageAiToolRules(user?.id);
  const { isEnabled } = usePackageMenuRules(user?.id);

  const { data: business } = useBusinessInfo(user?.id);

  const [viewMode, setViewMode] = useState<ViewMode>('tools');
  const [tools, setTools] = useState<AITool[]>([]);
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [loadingTools, setLoadingTools] = useState(false);

  const formatBusinessId = (businessNumber: number | null | undefined, fallback: string) => {
    if (typeof businessNumber === 'number' && Number.isFinite(businessNumber)) {
      return `B${String(businessNumber).padStart(5, '0')}`;
    }
    return fallback;
  };

  const businessFieldValueByLabel = useMemo(() => {
    return {
      'Business ID': formatBusinessId(business?.business_number ?? null, business?.id ?? ''),
      'First Name': business?.first_name ?? '',
      'Last Name': business?.last_name ?? '',
      'Business Name': business?.business_name ?? '',
      'Business Type': business?.business_type ?? '',
      Email: business?.email ?? '',
      'Website URL': business?.website_url ?? '',
      'Google Business Profile': business?.gmb_link ?? '',
      'My BKB': business?.bkb_content ?? '',
      'Brand Expert': business?.brand_expert_content ?? '',
      'My Persona 1': business?.persona1_content ?? '',
      'My Persona 2': business?.persona2_content ?? '',
      'My Persona 3': business?.persona3_content ?? '',
    } as Record<string, string>;
  }, [business?.bkb_content, business?.brand_expert_content, business?.business_name, business?.business_number, business?.business_type, business?.email, business?.first_name, business?.gmb_link, business?.id, business?.last_name, business?.persona1_content, business?.persona2_content, business?.persona3_content, business?.website_url]);

  const defaultBusinessFieldOrder = useMemo(
    () => [
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
    ],
    []
  );

  const businessInfoFieldsForSelectedTool = useMemo(() => {
    const shareOrder = (selectedTool?.shareFields ?? []).filter(Boolean);
    const order = shareOrder.length ? shareOrder : defaultBusinessFieldOrder;

    // Only show selected fields when shareFields is present.
    const visibleLabels = shareOrder.length ? shareOrder : defaultBusinessFieldOrder;
    const visible = new Set(visibleLabels);

    return order
      .filter((label) => visible.has(label))
      .map((label) => ({ label, value: businessFieldValueByLabel[label] ?? '' }));
  }, [businessFieldValueByLabel, defaultBusinessFieldOrder, selectedTool?.shareFields]);

  const canUsePage = useMemo(() => Boolean(user?.id), [user?.id]);

  const aiAgentsEnabled = useMemo(() => isEnabled('ai_agents'), [isEnabled]);

  const isToolAllowed = useMemo(() => {
    return (toolId: string) => {
      // Normal mode: ai_agents ON => use per-tool rule defaulting to enabled.
      if (aiAgentsEnabled) return isToolEnabled(toolId);

      // Whitelist mode: ai_agents OFF => only tools explicitly enabled in package_ai_tool_rules are usable.
      return enabledByToolId?.[toolId] === true;
    };
  }, [aiAgentsEnabled, enabledByToolId, isToolEnabled]);

  const loadTools = async () => {
    setLoadingTools(true);
    try {
      const { data, error } = await (supabase as any)
        .from('assist_ai_tools')
        .select('id,title,description,icon,color,code_language,code_content,json_config')
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
        shareFields: Array.isArray(row?.json_config?.share_fields) ? row.json_config.share_fields : [],
      }));

      setTools(mapped);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Unable to load tools',
        description: e?.message ?? 'An unexpected error occurred.',
      });
    } finally {
      setLoadingTools(false);
    }
  };

  const sortedTools = useMemo(() => {
    // Keep current order while rules are still loading to avoid flicker.
    if (loadingToolRules) return tools;

    // Stable sort: enabled tools first, then disabled tools; keep original order within groups.
    return tools
      .map((t, idx) => ({ t, idx }))
      .sort((a, b) => {
        const aAllowed = isToolAllowed(a.t.id);
        const bAllowed = isToolAllowed(b.t.id);
        if (aAllowed === bAllowed) return a.idx - b.idx;
        return aAllowed ? -1 : 1;
      })
      .map((x) => x.t);
  }, [tools, loadingToolRules, isToolAllowed]);

  useEffect(() => {
    if (!user?.id) return;
    void loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Tool detail view (match /dashboard/assist/ai-generator)
  if (viewMode === 'tool-detail' && selectedTool) {
    const ToolIcon = iconMap[selectedTool.icon] ?? Sparkles;
    const toolAllowed = isToolAllowed(selectedTool.id);

    // Safety: if someone navigates here with a non-allowed tool, block usage.
    if (!toolAllowed) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>This tool is unavailable</CardTitle>
            <CardDescription>This tool is not available for your current package.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => {
                setViewMode('tools');
                setSelectedTool(null);
              }}
            >
              Back to All Tools
            </Button>
          </CardContent>
        </Card>
      );
    }

    const toolReadonly = false;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setViewMode('tools');
              setSelectedTool(null);
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${selectedTool.color} shrink-0`}>
              <ToolIcon className="h-6 w-6" />
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
                <div className="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                  {selectedTool.description || '-'}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Code Language</Label>
                <div className="text-sm text-foreground font-medium break-words">
                  {selectedTool.codeLanguage.toUpperCase()}
                </div>
              </div>

              <div className="pt-2" />

              <BusinessInfoPanel
                fields={businessInfoFieldsForSelectedTool}
                mode="copy-only"
              />
            </CardContent>
          </Card>

          {/* Right: Preview from Code Snippet */}
          <Card className="min-w-0 flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {'Rendered from the saved Code Snippet'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border">
                <iframe
                  key={`${selectedTool.id}-${selectedTool.codeLanguage}`}
                  title={`${selectedTool.title} preview`}
                  srcDoc={buildToolPreviewSrcDoc({
                    codeLanguage: selectedTool.codeLanguage,
                    codeContent: selectedTool.codeContent,
                    readonly: toolReadonly,
                  })}
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

  // Tools management view (match /dashboard/assist/ai-generator)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Creation</h1>
          <p className="text-muted-foreground">All Tools</p>
        </div>
      </div>

      {!canUsePage ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-muted-foreground">Please sign in to view tools.</p>
          </CardContent>
        </Card>
      ) : loadingTools ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-muted-foreground">Loading tools...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Tools</CardTitle>
            <CardDescription>Click on a tool to use it</CardDescription>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <div className="py-10 text-muted-foreground">
                No tools have been published yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedTools.map((tool) => {
                  const ToolIcon = iconMap[tool.icon] ?? Sparkles;
                  // While rules are loading, prevent clicks to avoid briefly allowing a disabled tool.
                  const toolAllowed = !loadingToolRules && isToolAllowed(tool.id);
                  return (
                    <Card
                      key={tool.id}
                      className={
                        toolAllowed
                          ? 'min-w-0 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-primary/50'
                          : 'min-w-0 overflow-hidden cursor-not-allowed opacity-60 border-2 pointer-events-none'
                      }
                      aria-disabled={!toolAllowed}
                      onClick={() => {
                        if (!toolAllowed) return;
                        setSelectedTool(tool);
                        setViewMode('tool-detail');
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tool.color} shrink-0`}>
                              <ToolIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-base break-words">{tool.title}</CardTitle>
                              {/* NOTE: match assist page: do NOT show description in the card list */}
                            </div>
                          </div>

                          {!toolAllowed ? <Badge variant="secondary">Upgrade Plan</Badge> : null}
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
