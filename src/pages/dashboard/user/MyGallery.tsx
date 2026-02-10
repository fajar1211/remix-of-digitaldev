import { useState, useRef, useEffect } from 'react';
import {
  ImageIcon,
  Video,
  FileIcon,
  Upload,
  Trash2,
  MoreVertical,
  Download,
  Eye,
  Grid,
  List,
  Copy,
  Link,
  FileText,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MediaItem {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number | null;
  created_at: string;
}

export default function MyGallery() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTab, setSelectedTab] = useState('all');
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [textPreview, setTextPreview] = useState<string>('');
  const [loadingTextPreview, setLoadingTextPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<MediaItem | null>(null);

  // Fetch gallery from database
  useEffect(() => {
    const fetchGallery = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('user_gallery')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setMedia(data);
      }
      setLoading(false);
    };

    fetchGallery();
  }, [user]);

  // Load text preview when opening modal (txt/md/csv/json/log)
  useEffect(() => {
    const kind = getPreviewKind(previewItem);
    if (!previewItem || kind !== 'text') {
      setTextPreview('');
      setLoadingTextPreview(false);
      return;
    }

    const controller = new AbortController();
    setLoadingTextPreview(true);

    fetch(previewItem.url, { signal: controller.signal })
      .then((r) => r.text())
      .then((t) => setTextPreview(t))
      .catch(() => setTextPreview(''))
      .finally(() => setLoadingTextPreview(false));

    return () => controller.abort();
  }, [previewItem]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !user) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const type = file.type.startsWith('image/') 
        ? 'image' 
        : file.type.startsWith('video/') 
        ? 'video' 
        : 'file';

      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: `Failed to upload ${file.name}`,
        });
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-files')
        .getPublicUrl(filePath);

      // Save to database
      const { data: dbData } = await supabase
        .from('user_gallery')
        .insert({
          user_id: user.id,
          name: file.name,
          type,
          url: urlData.publicUrl,
          size: file.size,
        })
        .select()
        .single();

      if (dbData) {
        setMedia(prev => [dbData, ...prev]);
      }
    }

    setUploading(false);
    toast({
      title: 'Uploaded!',
      description: `${files.length} file(s) uploaded successfully.`,
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (item: MediaItem) => {
    // Delete from storage
    const filePath = item.url.split('/user-files/')[1];
    if (filePath) {
      await supabase.storage.from('user-files').remove([filePath]);
    }

    // Delete from database
    const { error } = await supabase
      .from('user_gallery')
      .delete()
      .eq('id', item.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete file.',
      });
      return;
    }

    setMedia(prev => prev.filter(m => m.id !== item.id));
    toast({
      title: 'Deleted',
      description: 'File has been removed.',
    });
  };

  const requestDelete = (item: MediaItem) => {
    setPendingDeleteItem(item);
    setConfirmDeleteOpen(true);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'URL copied to clipboard.',
    });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getExtension = (nameOrUrl: string) => {
    const clean = nameOrUrl.split('?')[0].split('#')[0];
    const parts = clean.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  const getPreviewKind = (item: MediaItem | null) => {
    if (!item) return 'unknown' as const;
    if (item.type === 'image') return 'image' as const;
    if (item.type === 'video') return 'video' as const;

    const ext = getExtension(item.name || item.url);

    if (ext === 'pdf') return 'pdf' as const;
    if (['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'text' as const;
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return 'office' as const;

    return 'download' as const;
  };

  const filteredMedia = media.filter((item) => {
    if (selectedTab === 'all') return true;
    return item.type === selectedTab;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-5 w-5" />;
      case 'video':
        return <Video className="h-5 w-5" />;
      default:
        return <FileIcon className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3 w-full md:flex-1">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Gallery</h1>
            <p className="text-muted-foreground">Manage your images, videos, and files</p>
          </div>

          <div className="rounded-lg border bg-card p-4 text-sm w-full">
            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">Please upload the following files (for reference):</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">•</span>
                  <span>Logo (example)</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">•</span>
                  <span>Brand Guidelines (PDF)</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">•</span>
                  <span>Product Images</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">•</span>
                  <span>Service Images</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">•</span>
                  <span>Office / Location Photos</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true">•</span>
                  <span>Video Assets (if available)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:pt-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="file">Files</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {filteredMedia.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No files yet</h3>
                <p className="text-muted-foreground mb-4">Upload your first file to get started</p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredMedia.map((item) => (
                <Card key={item.id} className="overflow-hidden group">
                  <div className="relative aspect-square bg-muted">
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getIcon(item.type)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => setPreviewItem(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={() => handleCopyUrl(item.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => requestDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(item.size)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredMedia.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {getIcon(item.type)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatSize(item.size)} • {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPreviewItem(item)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyUrl(item.url)}>
                            <Link className="h-4 w-4 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={item.url} download={item.name} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => requestDelete(item)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="w-[95vw] max-w-6xl h-[90vh] p-0 overflow-hidden [&>button:last-child]:hidden">
          <div className="px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">{previewItem?.name}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {previewItem ? formatSize(previewItem.size) : ''}
                </p>
              </div>

              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => previewItem && handleCopyUrl(previewItem.url)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy URL
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={previewItem?.url || '#'} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>

          <div className="h-[calc(90vh-73px)] bg-background">
            {(() => {
              const kind = getPreviewKind(previewItem);
              if (!previewItem) return null;

              if (kind === 'image') {
                return (
                  <div className="h-full w-full p-6 overflow-auto">
                    <img
                      src={previewItem.url}
                      alt={previewItem.name}
                      loading="lazy"
                      className="max-h-full mx-auto rounded-lg"
                    />
                  </div>
                );
              }

              if (kind === 'video') {
                return (
                  <div className="h-full w-full p-6">
                    <video
                      src={previewItem.url}
                      controls
                      className="w-full h-full rounded-lg"
                    />
                  </div>
                );
              }

              if (kind === 'pdf') {
                return (
                  <iframe
                    title={previewItem.name}
                    src={previewItem.url}
                    className="w-full h-full"
                  />
                );
              }

              if (kind === 'office') {
                const viewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(previewItem.url)}`;
                return <iframe title={previewItem.name} src={viewerUrl} className="w-full h-full" />;
              }

              if (kind === 'text') {
                return (
                  <div className="h-full p-6 overflow-auto">
                    {loadingTextPreview ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Loading preview...
                      </div>
                    ) : textPreview ? (
                      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono">
                        {textPreview}
                      </pre>
                    ) : (
                      <div className="text-center py-12 bg-muted rounded-lg">
                        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Tidak bisa memuat preview teks.</p>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center py-12 bg-muted rounded-lg w-full">
                    <FileIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Preview tidak tersedia untuk tipe file ini.</p>
                    <div className="mt-4">
                      <Button asChild>
                        <a href={previewItem.url} target="_blank" rel="noopener noreferrer">
                          Buka / Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file from your gallery and storage. This action can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingDeleteItem(null);
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const item = pendingDeleteItem;
                setConfirmDeleteOpen(false);
                setPendingDeleteItem(null);
                if (item) await handleDelete(item);
              }}
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
