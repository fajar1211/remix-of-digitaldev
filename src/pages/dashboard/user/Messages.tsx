import { useEffect, useMemo, useState, useRef } from 'react';
import { ArrowLeft, Send, Paperclip, MessageCircle, User, Search, Trash2, Download, X, Check, CheckCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeContactActivity } from '@/hooks/useRealtimeContactActivity';
import { usePackageMenuRules } from '@/hooks/usePackageMenuRules';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  file_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface AssistContact {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  status?: string;
}

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Treat tablet as a "narrow" layout too so chat can take full width when needed.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsNarrow(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const { loading: loadingMenuRules, isEnabled } = usePackageMenuRules(user?.id);
  const canSendMessages = useMemo(() => {
    // Default allow while loading to avoid briefly locking sending on slow rule loads.
    if (loadingMenuRules) return true;
    return isEnabled('messages');
  }, [isEnabled, loadingMenuRules]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [assists, setAssists] = useState<AssistContact[]>([]);
  const [selectedAssist, setSelectedAssist] = useState<AssistContact | null>(null);
  const [unreadByAssistId, setUnreadByAssistId] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Narrow UX (mobile + tablet): show either contact list OR chat (prevents content being squeezed)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Per-user clear chat marker (do NOT delete from DB)
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const clearedAtRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assistContactIds = useMemo(() => assists.map((a) => a.id), [assists]);

  const { lastActivityById, bumpActivity } = useRealtimeContactActivity({
    userId: user?.id,
    contactIds: assistContactIds,
  });

  // Fetch assists
  useEffect(() => {
    const fetchAssists = async () => {
      try {
        // Use RLS-safe RPC and filter contacts to Active only (hide Nonactive)
        const { data: contacts, error: rpcError } = await supabase.rpc('get_assist_contacts');
        if (rpcError) throw rpcError;

        const normalized = (contacts ?? []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          email: String(c.email ?? ''),
          avatar_url: (c.avatar_url ?? null) as string | null,
          status: String(c.status ?? 'active').toLowerCase().trim(),
        })) as AssistContact[];

        const activeOnly = normalized.filter((c) => c.status === 'active');
        setAssists(activeOnly);
        setSelectedAssist(activeOnly[0] ?? null);

        // On narrow screens start on list view (don't auto-open chat)
        if (isNarrow) setMobileView('list');
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Failed to load Assist contacts',
          description: error?.message ?? 'Something went wrong.',
        });
        setAssists([]);
        setSelectedAssist(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAssists();
  }, [toast, isNarrow]);

  // If user taps an assist on narrow screens, open chat view.
  useEffect(() => {
    if (!isNarrow) return;
    if (selectedAssist) setMobileView('chat');
  }, [isNarrow, selectedAssist]);

  // Unread notifications per contact (for contacts list badge)
  useEffect(() => {
    if (!user?.id) return;
    if (assists.length === 0) {
      setUnreadByAssistId({});
      return;
    }

    const assistIds = assists.map((a) => a.id);

    const refreshUnreadByAssist = async () => {
      const { data } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        // treat NULL as unread too
        .or("is_read.is.null,is_read.eq.false")
        .in("sender_id", assistIds);

      const next: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        const sid = row?.sender_id;
        if (!sid) return;
        next[sid] = (next[sid] || 0) + 1;
      });

      setUnreadByAssistId(next);
    };

    refreshUnreadByAssist();

    const channel = supabase
      .channel(`user-messages-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as any;
          if (row?.receiver_id !== user.id) return;
          if (row?.is_read) return;

          // If this chat is currently open, it will be marked read immediately by the thread handler.
          if (row?.sender_id === selectedAssist?.id) return;

          const sender = assists.find((a) => a.id === row.sender_id);
          toast({
            title: `New message from ${sender?.name ?? 'Assist'}`,
            description: (row?.content as string | undefined) ?? 'You have received a new message.',
          });

          setUnreadByAssistId((prev) => ({
            ...prev,
            [row.sender_id]: (prev[row.sender_id] || 0) + 1,
          }));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const nextRow = payload.new as any;
          const oldRow = payload.old as any;
          if (nextRow?.receiver_id !== user.id) return;
          // handle NULL -> true as well
          if (oldRow?.is_read !== true && nextRow?.is_read === true) {
            setUnreadByAssistId((prev) => {
              const senderId = nextRow.sender_id as string;
              const current = prev[senderId] || 0;
              const updated = Math.max(0, current - 1);
              return { ...prev, [senderId]: updated };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, assists, selectedAssist?.id]);

  // Fetch messages for selected assist (respect per-user clear marker)
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !selectedAssist) return;

      // Load per-user clear marker (if exists)
      const { data: clearRow, error: clearErr } = await (supabase as any)
        .from('chat_clears')
        .select('cleared_at')
        .eq('user_id', user.id)
        .eq('peer_id', selectedAssist.id)
        .maybeSingle();

      if (!clearErr) {
        const ts = (clearRow as any)?.cleared_at ?? null;
        setClearedAt(ts);
        clearedAtRef.current = ts;
      }

      const clearedAtLocal = (clearRow as any)?.cleared_at as string | undefined;

      let query = supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedAssist.id}),and(sender_id.eq.${selectedAssist.id},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (clearedAtLocal) query = (query as any).gt('created_at', clearedAtLocal);

      const { data } = await query;

      if (data) {
        const normalized = (data as any[]).map((m) => ({
          ...(m as any),
          is_read: Boolean((m as any).is_read),
        })) as Message[];

        setMessages(normalized);

        // Mark messages as read (incoming only)
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', user.id)
          .eq('sender_id', selectedAssist.id)
          .or('is_read.is.null,is_read.eq.false');

        // Tell sidebar badge to refresh immediately (no reload needed)
        window.dispatchEvent(new CustomEvent('messages:refresh-unread'));

        // Optimistic local update
        setMessages((prev) =>
          prev.map((m) =>
            m.receiver_id === user.id && m.sender_id === selectedAssist.id
              ? { ...m, is_read: true }
              : m
          )
        );

        // Remove unread badge for this contact
        setUnreadByAssistId((prev) => ({ ...prev, [selectedAssist.id]: 0 }));
      }
    };

    fetchMessages();

    // Set up real-time subscription
    if (!user || !selectedAssist) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          const belongsToThread =
            (newMsg.sender_id === user.id && newMsg.receiver_id === selectedAssist.id) ||
            (newMsg.sender_id === selectedAssist.id && newMsg.receiver_id === user.id);

          if (!belongsToThread) return;

          // Hide messages older than the local clear marker
          const clearedAtIso = clearedAtRef.current;
          if (clearedAtIso && new Date(newMsg.created_at).getTime() <= new Date(clearedAtIso).getTime()) return;

          const normalized: Message = {
            ...(newMsg as Message),
            is_read: Boolean(newMsg.is_read),
          };

          // If chat is open and we receive a message, mark it read immediately
          if (
            normalized.receiver_id === user.id &&
            normalized.sender_id === selectedAssist.id &&
            !normalized.is_read
          ) {
            setMessages((prev) =>
              prev.some((m) => m.id === normalized.id)
                ? prev
                : [...prev, { ...normalized, is_read: true }]
            );
            supabase.from('messages').update({ is_read: true }).eq('id', normalized.id);
            window.dispatchEvent(new CustomEvent('messages:refresh-unread'));
            return;
          }

          setMessages((prev) => (prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized]));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updated = payload.new as any;
          const belongsToThread =
            (updated.sender_id === user.id && updated.receiver_id === selectedAssist.id) ||
            (updated.sender_id === selectedAssist.id && updated.receiver_id === user.id);

          if (!belongsToThread) return;

          // Hide messages older than the local clear marker
          const clearedAtIso = clearedAtRef.current;
          if (clearedAtIso && new Date(updated.created_at).getTime() <= new Date(clearedAtIso).getTime()) return;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? ({ ...(updated as Message), is_read: Boolean(updated.is_read) } as Message)
                : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedAssist, toast]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleSend = async () => {
    if (!canSendMessages) {
      toast({
        variant: 'destructive',
        title: 'Sending disabled',
        description: 'Sending messages is not available for your package.',
      });
      return;
    }
    if (!user || !selectedAssist || (!newMessage.trim() && !uploadedFile)) return;

    const contentToSend = newMessage.trim() || (uploadedFile ? `📎 ${uploadedFile.name}` : '');
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: selectedAssist.id,
      content: contentToSend,
      file_url: null,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI: show message immediately
    setMessages((prev) => [...prev, optimistic]);
    // Ensure contacts list jumps to top immediately
    bumpActivity(selectedAssist.id, optimistic.created_at);

    setNewMessage('');
    setUploading(Boolean(uploadedFile));

    try {
      let fileUrl: string | null = null;

      // Upload file if exists
      if (uploadedFile) {
        const filePath = `messages/${user.id}/${Date.now()}-${uploadedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, uploadedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      const { data: inserted, error } = await (supabase as any)
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedAssist.id,
          content: contentToSend,
          file_url: fileUrl,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Replace optimistic message with real DB row (prevents perceived delay)
      if (inserted) {
        const normalized: Message = {
          ...(inserted as Message),
          is_read: Boolean((inserted as any).is_read),
        };

        setMessages((prev) => prev.map((m) => (m.id === tempId ? normalized : m)));
      }

      setUploadedFile(null);
    } catch (error: any) {
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast({
        variant: 'destructive',
        title: 'Error sending message',
        description: error.message,
      });
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleClearChat = async () => {
    if (!user || !selectedAssist) return;

    try {
      const nowIso = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('chat_clears')
        .upsert(
          {
            user_id: user.id,
            peer_id: selectedAssist.id,
            cleared_at: nowIso,
          },
          { onConflict: 'user_id,peer_id' }
        );

      if (error) throw error;

      clearedAtRef.current = nowIso;
      setClearedAt(nowIso);
      setMessages([]);

      toast({
        title: 'Chat cleared (local)',
        description: 'This chat is hidden for your account only.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const getFileName = (url: string) => {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace(/^\d+-/, '');
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const filteredAssists = assists.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedAssists = [...filteredAssists].sort((a, b) => {
    const unreadA = unreadByAssistId[a.id] || 0;
    const unreadB = unreadByAssistId[b.id] || 0;
    if (unreadA !== unreadB) return unreadB - unreadA;

    const tsA = lastActivityById[a.id] ? new Date(lastActivityById[a.id]).getTime() : 0;
    const tsB = lastActivityById[b.id] ? new Date(lastActivityById[b.id]).getTime() : 0;
    if (tsA !== tsB) return tsB - tsA;

    return a.name.localeCompare(b.name, 'en-US');
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-160px)]">
      <div className="shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground">Chat with your Marketing Assist</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Contacts List */}
        <Card
          className={cn(
            'lg:col-span-1 flex flex-col min-h-0 h-full',
            isNarrow && mobileView === 'chat' ? 'hidden lg:flex' : ''
          )}
        >
          <CardHeader className="border-b py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-[60vh] lg:h-[calc(100vh-240px)]">
              {filteredAssists.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No assists available</p>
                </div>
              ) : (
                sortedAssists.map((assist) => {
                  const unread = unreadByAssistId[assist.id] || 0;

                  return (
                    <div
                      key={assist.id}
                      onClick={() => {
                        setSelectedAssist(assist);
                        setUnreadByAssistId((prev) => ({ ...prev, [assist.id]: 0 }));
                        if (isNarrow) setMobileView('chat');
                      }}
                      className={cn(
                        "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                        selectedAssist?.id === assist.id && "bg-muted"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={assist.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {assist.name?.charAt(0)?.toUpperCase() || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{assist.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{assist.email}</p>
                      </div>

                      {unread > 0 && (
                        <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs tabular-nums">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card
          className={cn(
            'lg:col-span-2 flex flex-col min-h-0 h-full',
            isNarrow && mobileView === 'list' ? 'hidden lg:flex' : ''
          )}
        >
          {selectedAssist ? (
            <>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isNarrow ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileView('list')}
                        aria-label="Back to assists"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedAssist.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedAssist.name?.charAt(0)?.toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{selectedAssist.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Marketing Assist</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear Chat</AlertDialogTitle>
                        <AlertDialogDescription>
                          This only hides the chat for your account (it does not delete messages from the database or for the other person).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearChat} className="bg-destructive text-destructive-foreground">
                          Clear Chat
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>

              <CardContent className="flex-1 min-h-0 flex flex-col p-0">
                <div
                  ref={scrollRef}
                  className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"
                >
                  {messages.length === 0 ? (
                    <div className="h-full min-h-[50vh] lg:min-h-[calc(100vh-360px)] flex flex-col items-center justify-center text-muted-foreground text-center px-4">
                      <MessageCircle className="h-10 w-10 mb-2" />
                      <p className="text-sm max-w-sm">
                        {clearedAt
                          ? 'Chat cleared. New messages will appear here.'
                          : 'No messages yet. Start the conversation!'}
                      </p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isOwn = msg.sender_id === user?.id;

                      const prev = messages[idx - 1];
                      const showDateSeparator =
                        !prev ||
                        new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();

                      return (
                        <div key={msg.id} className="space-y-2">
                          {showDateSeparator && (
                            <div className="flex justify-center">
                              <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                          )}

                          <div className={cn("flex gap-2", isOwn ? 'justify-end' : 'justify-start')}>
                            {!isOwn && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={selectedAssist.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {selectedAssist.name?.charAt(0)?.toUpperCase() || 'A'}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                isOwn
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : 'bg-muted text-foreground rounded-bl-sm'
                              )}
                            >
                              {msg.content && (
                                <p className="whitespace-pre-wrap break-words mb-1">{msg.content}</p>
                              )}
                              {msg.file_url && (
                                <div
                                  className={cn(
                                    "mt-1 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                                    isOwn ? 'border-primary/40 bg-primary/10' : 'border-muted-foreground/10 bg-background/60'
                                  )}
                                >
                                  <Paperclip className="h-4 w-4" />
                                  <span className="truncate flex-1">{getFileName(msg.file_url)}</span>
                                  <a
                                    href={msg.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <Download className="h-3 w-3" />
                                    Download
                                  </a>
                                </div>
                              )}

                              <span
                                className={cn(
                                  "mt-1 block text-[10px] opacity-70",
                                  isOwn ? 'text-primary-foreground' : 'text-muted-foreground'
                                )}
                              >
                                <span className="inline-flex items-center justify-end gap-1 w-full">
                                  <span>{formatTime(msg.created_at)}</span>
                                  {isOwn &&
                                    (msg.is_read ? (
                                      <CheckCheck className="h-3 w-3" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    ))}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Input */}
                <div className="border-t p-3 space-y-2 bg-background/60 backdrop-blur">
                  {!canSendMessages && (
                    <div className="text-xs rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
                      Sending is disabled for your package. You can still read incoming messages.
                    </div>
                  )}
                  {uploadedFile && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/60 rounded-md px-3 py-1">
                      <span className="flex items-center gap-2">
                        <Paperclip className="h-3 w-3" />
                        {uploadedFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="inline-flex items-center justify-center rounded-full hover:bg-muted p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileUpload}
                    />

                    {/* Upload button pinned to the left edge */}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !canSendMessages}
                      className="h-10 w-10 shrink-0"
                      aria-label="Upload file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>

                    {/* Message input */}
                    <div className="flex-1 flex flex-col gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={!canSendMessages}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' || e.shiftKey) return;

                          // Enter to send, Shift+Enter for new line
                          e.preventDefault();

                          if (sending || uploading) return;
                          if (!newMessage.trim() && !uploadedFile) return;
                          if (!canSendMessages) return;

                          handleSend();
                        }}
                        rows={2}
                        className="resize-none"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Files are stored securely in your workspace.</span>
                      </div>
                    </div>

                    {/* Send button on the right */}
                    <Button
                      type="button"
                      onClick={handleSend}
                      disabled={
                        !canSendMessages ||
                        sending ||
                        uploading ||
                        (!newMessage.trim() && !uploadedFile)
                      }
                      className="h-10 shrink-0"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-2" />
              <p className="text-sm">Select an assist to start chatting.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
