import { useEffect, useMemo, useState, useRef } from 'react';
import { ArrowLeft, Send, MessageCircle, User, Search, Trash2, Download, Paperclip, X, Check, CheckCheck } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  file_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface UserContact {
  id: string;
  name: string;
  email: string;
  business_name: string | null;
}

export default function AssistMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserContact[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserContact | null>(null);
  const [unreadByUserId, setUnreadByUserId] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Mobile UX: show either contact list OR chat (prevents chat being pushed below the fold)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Per-user clear chat marker (do NOT delete from DB)
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const clearedAtRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userContactIds = useMemo(() => users.map((u) => u.id), [users]);

  const { lastActivityById, bumpActivity } = useRealtimeContactActivity({
    userId: user?.id,
    contactIds: userContactIds,
  });

  // Fetch users (clients)
  useEffect(() => {
    const fetchUsers = async () => {
      const { data: roles } = await (supabase as any)
        .from('user_roles')
        .select('user_id')
        .eq('role', 'user');

      if (roles) {
        const userIds = (roles as any[]).map((r) => r.user_id);
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, name, email, business_name')
            .in('id', userIds)
            .eq('account_status', 'active');

        if (profiles) {
          // Fetch business names
          const { data: businesses } = await (supabase as any)
            .from('businesses')
            .select('user_id, business_name')
            .in('user_id', userIds);

          const usersWithBusiness = (profiles as any[]).map((p) => {
            const business = (businesses as any[])?.find((b: any) => b.user_id === p.id);
            return {
              ...p,
              business_name: business?.business_name || p.business_name || null,
            };
          });

          setUsers(usersWithBusiness as UserContact[]);
           if (usersWithBusiness.length > 0) {
             setSelectedUser(usersWithBusiness[0] as UserContact);
           }

           // On mobile start on list view (don't auto-open chat)
           if (isMobile) setMobileView('list');
        }
      }
      setLoading(false);
    };

    fetchUsers();
   }, [isMobile]);

  // If assist taps a client on mobile, open chat view.
  useEffect(() => {
    if (!isMobile) return;
    if (selectedUser) setMobileView('chat');
  }, [isMobile, selectedUser]);

  // Unread notifications per contact (for contacts list badge)
  useEffect(() => {
    if (!user?.id) return;
    if (users.length === 0) {
      setUnreadByUserId({});
      return;
    }

    const userIds = users.map((u) => u.id);

    const refreshUnreadByUser = async () => {
      const { data } = await (supabase as any)
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        // treat NULL as unread too
        .or("is_read.is.null,is_read.eq.false")
        .in("sender_id", userIds);

      const next: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        const sid = row?.sender_id;
        if (!sid) return;
        next[sid] = (next[sid] || 0) + 1;
      });

      setUnreadByUserId(next);
    };

    refreshUnreadByUser();

    const channel = supabase
      .channel(`assist-messages-unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as any;
          if (row?.receiver_id !== user.id) return;
          if (row?.is_read) return;

          // If this chat is currently open, it will be marked read immediately by the thread handler.
          if (row?.sender_id === selectedUser?.id) return;

          const sender = users.find((u) => u.id === row.sender_id);
          toast({
            title: `New message from ${sender?.name ?? 'Client'}`,
            description: (row?.content as string | undefined) ?? 'You have received a new message.',
          });

          setUnreadByUserId((prev) => ({
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
            setUnreadByUserId((prev) => {
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
  }, [user?.id, users, selectedUser?.id]);

  // Fetch messages for selected user (respect per-user clear marker)
  useEffect(() => {
    const fetchMessages = async () => {
      if (!user || !selectedUser) return;

      // Load per-user clear marker (if exists)
      const { data: clearRow, error: clearErr } = await (supabase as any)
        .from('chat_clears')
        .select('cleared_at')
        .eq('user_id', user.id)
        .eq('peer_id', selectedUser.id)
        .maybeSingle();

      if (!clearErr) {
        const ts = (clearRow as any)?.cleared_at ?? null;
        setClearedAt(ts);
        clearedAtRef.current = ts;
      }

      const clearedAtLocal = (clearRow as any)?.cleared_at as string | undefined;

      let query = (supabase as any)
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (clearedAtLocal) query = query.gt('created_at', clearedAtLocal);

      const { data } = await query;

      if (data) {
        const normalized = (data as any[]).map((m) => ({
          ...(m as any),
          is_read: Boolean((m as any).is_read),
        })) as Message[];

        setMessages(normalized);

        // Mark messages as read (incoming only)
        await (supabase as any)
          .from('messages')
          .update({ is_read: true })
          .eq('receiver_id', user.id)
          .eq('sender_id', selectedUser.id)
          .or('is_read.is.null,is_read.eq.false');

        // Tell sidebar badge to refresh immediately (no reload needed)
        window.dispatchEvent(new CustomEvent('messages:refresh-unread'));

        // Optimistic local update
        setMessages((prev) =>
          prev.map((m) =>
            m.receiver_id === user.id && m.sender_id === selectedUser.id
              ? { ...m, is_read: true }
              : m
          )
        );

        // Remove unread badge for this contact
        setUnreadByUserId((prev) => ({ ...prev, [selectedUser.id]: 0 }));
      }
    };

    fetchMessages();

    // Set up real-time subscription
    if (!user || !selectedUser) return;

    const channel = supabase
      .channel('assist-messages-changes')
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
            (newMsg.sender_id === user.id && newMsg.receiver_id === selectedUser.id) ||
            (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === user.id);

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
            normalized.sender_id === selectedUser.id &&
            !normalized.is_read
          ) {
            setMessages((prev) =>
              prev.some((m) => m.id === normalized.id)
                ? prev
                : [...prev, { ...normalized, is_read: true }]
            );
            (supabase as any).from('messages').update({ is_read: true }).eq('id', normalized.id);
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
            (updated.sender_id === user.id && updated.receiver_id === selectedUser.id) ||
            (updated.sender_id === selectedUser.id && updated.receiver_id === user.id);

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
  }, [user, selectedUser, toast]);

  const scrollToBottom = () => {
    const root = scrollRef.current;
    if (!root) return;

    // Radix ScrollArea: the scrollable element is the Viewport, not the Root
    const viewport = root.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;

    const el = viewport ?? root;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    requestAnimationFrame(scrollToBottom);
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleSend = async () => {
    if (!user || !selectedUser || (!newMessage.trim() && !uploadedFile)) return;

    const contentToSend = newMessage.trim() || (uploadedFile ? `📎 ${uploadedFile.name}` : '');
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: contentToSend,
      file_url: null,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    // Ensure contacts list jumps to top immediately
    bumpActivity(selectedUser.id, optimistic.created_at);

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
          receiver_id: selectedUser.id,
          content: contentToSend,
          file_url: fileUrl,
        })
        .select('*')
        .single();

      if (error) throw error;

      if (inserted) {
        const normalized: Message = {
          ...(inserted as Message),
          is_read: Boolean((inserted as any).is_read),
        };
        setMessages((prev) => prev.map((m) => (m.id === tempId ? normalized : m)));
      }

      setUploadedFile(null);
    } catch (error: any) {
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
    if (!user || !selectedUser) return;

    try {
      const nowIso = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('chat_clears')
        .upsert(
          {
            user_id: user.id,
            peer_id: selectedUser.id,
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
    // Remove timestamp prefix
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

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.business_name && u.business_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const unreadA = unreadByUserId[a.id] || 0;
    const unreadB = unreadByUserId[b.id] || 0;
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
    <div className="h-full flex flex-col gap-6">
      <div className="shrink-0">
        <h1 className="text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground">Chat with your clients</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contacts List */}
        <Card
          className={cn(
            'md:col-span-1 flex flex-col min-h-0',
            isMobile && mobileView === 'chat' ? 'hidden md:flex' : ''
          )}
        >
          <CardHeader className="border-b py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-[60vh] md:h-full">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No clients available</p>
                </div>
              ) : (
                sortedUsers.map((client) => {
                  const unread = unreadByUserId[client.id] || 0;

                  return (
                    <div
                      key={client.id}
                      onClick={() => {
                        setSelectedUser(client);
                        setUnreadByUserId((prev) => ({ ...prev, [client.id]: 0 }));
                        if (isMobile) setMobileView('chat');
                      }}
                      className={cn(
                        "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                        selectedUser?.id === client.id && "bg-muted"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {client.name?.charAt(0)?.toUpperCase() || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.business_name || 'No business name'}
                        </p>
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
            'md:col-span-2 flex flex-col min-h-0',
            isMobile && mobileView === 'list' ? 'hidden md:flex' : ''
          )}
        >
          {selectedUser ? (
            <>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isMobile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileView('list')}
                        aria-label="Back to clients"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {selectedUser.name?.charAt(0)?.toUpperCase() || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{selectedUser.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {selectedUser.business_name || 'No business name'}
                      </p>
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
                {/* Messages Area */}
                <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-foreground">
                        {clearedAt ? 'Chat cleared' : 'No messages yet'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {clearedAt
                          ? 'This chat is hidden for your account. New messages will appear here.'
                          : `Start a conversation with ${selectedUser.name}`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, idx) => {
                        const isOwn = message.sender_id === user?.id;

                        const prev = messages[idx - 1];
                        const showDateSeparator =
                          !prev ||
                          new Date(prev.created_at).toDateString() !==
                            new Date(message.created_at).toDateString();

                        return (
                          <div key={message.id} className="space-y-2">
                            {showDateSeparator && (
                              <div className="flex justify-center">
                                <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
                                  {formatDate(message.created_at)}
                                </span>
                              </div>
                            )}

                            <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-lg px-4 py-2",
                                  isOwn
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground"
                                )}
                              >
                                <p className="text-sm">{message.content}</p>
                                {message.file_url && (
                                  <a
                                    href={message.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className={cn(
                                      "flex items-center gap-1 text-xs mt-2 underline",
                                      isOwn
                                        ? "text-primary-foreground/80"
                                        : "text-primary"
                                    )}
                                  >
                                    <Download className="h-3 w-3" />
                                    {getFileName(message.file_url)}
                                  </a>
                                )}
                                <p
                                  className={cn(
                                    "text-xs mt-1 inline-flex items-center justify-end gap-1 w-full",
                                    isOwn
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  <span>{formatTime(message.created_at)}</span>
                                  {isOwn &&
                                    (message.is_read ? (
                                      <CheckCheck className="h-3 w-3" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    ))}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t space-y-2">
                  {uploadedFile && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                      <Paperclip className="h-4 w-4" />
                      <span className="flex-1 truncate">{uploadedFile.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUploadedFile(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="min-h-[44px] max-h-32 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={(!newMessage.trim() && !uploadedFile) || sending}
                      className="shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground">Select a client</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a client from the list to start chatting
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}