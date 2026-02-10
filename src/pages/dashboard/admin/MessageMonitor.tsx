import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowLeft, Download, MessageCircle, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatAssistStatusLabel } from "@/lib/assistStatus";

type AssistRow = {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
  status?: string;
};

type PeerRow = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  business_name: string | null;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  file_url: string | null;
  is_read: boolean | null;
  created_at: string;
};

function initials(name: string) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getFileName(url: string) {
  const parts = url.split("/");
  const fileName = parts[parts.length - 1] ?? "Attachment";
  return fileName.replace(/^\d+-/, "");
}

export default function AdminMessageMonitor() {
  const isMobile = useIsMobile();
  const [isTabletOrSmaller, setIsTabletOrSmaller] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track tablet/mobile breakpoint (< 1024px = below md breakpoint)
  useEffect(() => {
    const checkSize = () => setIsTabletOrSmaller(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const [loadingAssists, setLoadingAssists] = useState(true);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const [assists, setAssists] = useState<AssistRow[]>([]);
  const [selectedAssistId, setSelectedAssistId] = useState<string>("");

  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<PeerRow | null>(null);
  const [peerQuery, setPeerQuery] = useState("");

  const [messages, setMessages] = useState<MessageRow[]>([]);

  // Mobile UX: show either list OR chat
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingAssists(true);
      try {
        // Keep the dropdown source consistent with /dashboard/admin/assistants:
        // user_roles(role=assist) -> profiles(full name)
        const { data: assistRoles, error: rolesError } = await (supabase as any)
          .from("user_roles")
          .select("user_id")
          .eq("role", "assist");

        if (rolesError) throw rolesError;

        const assistIds = ((assistRoles as any[]) ?? []).map((r) => r.user_id).filter(Boolean);
        if (assistIds.length === 0) {
          if (!mounted) return;
          setAssists([]);
          setSelectedAssistId("");
          return;
        }

        const { data: profiles, error: profilesError } = await (supabase as any)
          .from("profiles")
          .select("id,name,email,avatar_url,account_status")
          .in("id", assistIds);

        if (profilesError) throw profilesError;

        const normalized = (((profiles as any[]) ?? [])
          .map((p) => ({
            id: String(p.id),
            name: String(p.name ?? ""),
            email: String(p.email ?? ""),
            avatar_url: (p.avatar_url ?? null) as string | null,
            status: p.account_status != null ? String(p.account_status) : undefined,
          }))
          .sort((a: AssistRow, b: AssistRow) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "en-US"))) as AssistRow[];

        if (!mounted) return;
        setAssists(normalized);
        // Do not auto-select an assistant on page load.
        // This keeps the Select placeholder visible until admin explicitly chooses one.
        setSelectedAssistId((prev) => prev);

        // On mobile start on list view (don't auto-open chat)
        if (isMobile) setMobileView("list");
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to load assists", e);
        setAssists([]);
        setSelectedAssistId("");
      } finally {
        if (!mounted) return;
        setLoadingAssists(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedAssistId) {
        setPeers([]);
        setSelectedPeer(null);
        setMessages([]);
        return;
      }

      setLoadingPeers(true);
      setPeers([]);
      setSelectedPeer(null);
      setMessages([]);

      const { data, error } = await supabase.functions.invoke("admin-message-monitor", {
        body: { action: "list_peers", assistId: selectedAssistId },
      });

      if (!mounted) return;
      if (error || data?.error) {
        console.error("Failed to load assist conversations", error ?? data?.error);
        setPeers([]);
        setSelectedPeer(null);
      } else {
        const rows = ((data?.peers ?? []) as any[])
          .map((p) => ({
            id: String(p.id),
            name: String(p.name ?? ""),
            email: String(p.email ?? ""),
            avatar_url: (p.avatar_url ?? null) as string | null,
            business_name: (p.business_name ?? null) as string | null,
            last_message_at: (p.last_message_at ?? null) as string | null,
          }))
          .sort((a: PeerRow, b: PeerRow) => {
            const tsA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const tsB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            if (tsA !== tsB) return tsB - tsA;
            return String(a.name ?? "").localeCompare(String(b.name ?? ""), "en-US");
          }) as PeerRow[];
        setPeers(rows);
        setSelectedPeer(rows[0] ?? null);

        if (isMobile) setMobileView("list");
      }
      setLoadingPeers(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isMobile, selectedAssistId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedAssistId || !selectedPeer?.id) {
        setMessages([]);
        return;
      }
      setLoadingThread(true);
      const { data, error } = await supabase.functions.invoke("admin-message-monitor", {
        body: {
          action: "fetch_thread",
          assistId: selectedAssistId,
          peerId: selectedPeer.id,
          limit: 500,
        },
      });

      if (!mounted) return;
      if (error || data?.error) {
        console.error("Failed to load thread", error ?? data?.error);
        setMessages([]);
      } else {
        const rows = ((data?.messages ?? []) as any[]).map((m) => ({
          id: String(m.id),
          sender_id: String(m.sender_id),
          receiver_id: String(m.receiver_id),
          content: String(m.content ?? ""),
          file_url: (m.file_url ?? null) as string | null,
          is_read: (m.is_read ?? null) as boolean | null,
          created_at: String(m.created_at),
        })) as MessageRow[];
        setMessages(rows);
      }
      setLoadingThread(false);
    })();

    return () => {
      mounted = false;
    };
  }, [selectedAssistId, selectedPeer?.id]);

  // If admin taps a contact on mobile, open chat view.
  useEffect(() => {
    if (!isMobile && !isTabletOrSmaller) return;
    if (selectedPeer) setMobileView("chat");
  }, [isMobile, isTabletOrSmaller, selectedPeer]);

  const scrollToBottom = () => {
    const root = scrollRef.current;
    if (!root) return;
    const viewport = root.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const el = viewport ?? root;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [messages]);

  const selectedAssist = useMemo(
    () => assists.find((a) => a.id === selectedAssistId) ?? null,
    [assists, selectedAssistId]
  );

  const filteredPeers = useMemo(() => {
    const q = peerQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) => {
      return (
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.business_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [peerQuery, peers]);

  if (loadingAssists) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-96 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full min-h-[calc(100vh-8rem)]">
      <div className="shrink-0 space-y-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Message Monitor</h1>
          <p className="text-muted-foreground">Read-only monitoring of Assist conversations</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="text-sm text-muted-foreground sm:w-48">Monitor Assist</div>
          <div className="w-full sm:max-w-md">
            <Select value={selectedAssistId} onValueChange={(v) => setSelectedAssistId(v)}>
              <SelectTrigger>
                {/* Placeholder shown before selection; once selected, trigger shows the selected assistant name */}
                <SelectValue placeholder="Select Assistant" />
              </SelectTrigger>
              <SelectContent>
                {assists.map((a) => (
                  <SelectItem
                    key={a.id}
                    value={a.id}
                    className="data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                  >
                    {(a.name || a.email || a.id) + ` (${formatAssistStatusLabel(a.status)})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contacts List */}
        <Card className={cn("lg:col-span-1 flex flex-col min-h-[600px] lg:min-h-0 lg:h-full", (isMobile || isTabletOrSmaller) && mobileView === "chat" ? "hidden lg:flex" : "")}>
          <CardHeader className="border-b py-3 space-y-3">
            <CardTitle className="text-base">Conversations</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or business..."
                value={peerQuery}
                onChange={(e) => setPeerQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full w-full">
              {!selectedAssistId ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">Select an Assist to load conversations</p>
                </div>
              ) : loadingPeers ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">Loading conversations...</p>
                </div>
              ) : filteredPeers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">No conversations found</p>
                </div>
              ) : (
                filteredPeers.map((peer) => (
                  <div
                    key={peer.id}
                    onClick={() => {
                      setSelectedPeer(peer);
                      if (isMobile || isTabletOrSmaller) setMobileView("chat");
                    }}
                    className={cn(
                      "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                      selectedPeer?.id === peer.id ? "bg-muted" : ""
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      {peer.avatar_url ? (
                        <AvatarImage src={peer.avatar_url} alt={peer.name || "Contact avatar"} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary">{initials(peer.name || "Client")}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate break-words">{peer.name || "(Unnamed)"}</p>
                      <p className="text-xs text-muted-foreground truncate break-words">
                        {peer.business_name || peer.email}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className={cn("flex flex-col min-h-[600px] lg:min-h-0 lg:h-full", 
          (isMobile || isTabletOrSmaller) && mobileView === "list" ? "hidden lg:flex" : "",
          (isMobile || isTabletOrSmaller) && mobileView === "chat" ? "col-span-full" : "lg:col-span-2"
        )}>
          {selectedPeer ? (
            <>
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Show back button on tablet and mobile (< 1024px md breakpoint) */}
                    {isTabletOrSmaller ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileView("list")}
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    ) : null}

                    <Avatar className="h-10 w-10">
                      {selectedPeer.avatar_url ? (
                        <AvatarImage src={selectedPeer.avatar_url} alt={selectedPeer.name || "Contact avatar"} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary">{initials(selectedPeer.name || "Client")}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{selectedPeer.name || "(Unnamed)"}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate break-words">
                        {selectedPeer.business_name || selectedPeer.email}
                      </p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" disabled>
                    Read-only
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 min-h-0 flex flex-col p-0">
                <ScrollArea className="flex-1 min-h-0 p-4" ref={scrollRef}>
                  {loadingThread ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12">
                      <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium text-foreground">No messages yet</h3>
                      <p className="text-sm text-muted-foreground">This conversation has no messages.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, idx) => {
                        const isOwn = message.sender_id === selectedAssistId;
                        const prev = messages[idx - 1];
                        const showDateSeparator =
                          !prev ||
                          new Date(prev.created_at).toDateString() !== new Date(message.created_at).toDateString();

                        return (
                          <div key={message.id} className="space-y-2">
                            {showDateSeparator ? (
                              <div className="flex justify-center">
                                <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
                                  {formatDate(message.created_at)}
                                </span>
                              </div>
                            ) : null}

                            <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-lg px-4 py-2",
                                  isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                                )}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                                {message.file_url ? (
                                  <a
                                    href={message.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "flex items-center gap-1 text-xs mt-2 underline underline-offset-4",
                                      isOwn ? "text-primary-foreground/80" : "text-primary"
                                    )}
                                  >
                                    <Download className="h-3 w-3" />
                                    {getFileName(message.file_url)}
                                  </a>
                                ) : null}

                                <p
                                  className={cn(
                                    "text-xs mt-1 inline-flex items-center justify-end gap-1 w-full",
                                    isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                                  )}
                                >
                                  <span>{formatTime(message.created_at)}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground">Select a conversation</h3>
                <p className="text-sm text-muted-foreground">Choose a contact from the list to view the chat</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {selectedAssist ? (
        <div className="text-xs text-muted-foreground">
          Monitoring: <span className="text-foreground">{selectedAssist.name || selectedAssist.email || selectedAssist.id}</span>
        </div>
      ) : null}
    </div>
  );
}
