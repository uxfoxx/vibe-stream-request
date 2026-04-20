import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send, MessageSquare, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Message, MessageReaction, Profile } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube } from "@/lib/youtube.functions";
import { toast } from "sonner";

const MSG_EMOJIS = ["🔥", "❤️", "😂"];
const GUEST_NAME_KEY = "radio-guest-name";

function getAvatarUrl(username: string, avatarUrl: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=6366f1&textColor=ffffff`;
}

export function Chat() {
  const { user, profile, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const search = useServerFn(searchYouTube);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<Profile[]>([]);

  // Guest name state
  const [guestName, setGuestName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(GUEST_NAME_KEY) ?? "";
  });
  const [guestNameInput, setGuestNameInput] = useState("");
  const [settingGuestName, setSettingGuestName] = useState(false);

  // Word filter list (for client-side pre-check)
  const [wordFilters, setWordFilters] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("word_filters").select("word").then(({ data }) => {
      if (data) setWordFilters(data.map((r: { word: string }) => r.word));
    });
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("messages").select("*").order("created_at", { ascending: true }).limit(100);
      setMessages((data as Message[]) || []);
    }
    load();
    const ch = supabase.channel("chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        setMessages(m => [...m, p.new as Message]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        setMessages(m => m.filter(x => x.id !== (p.old as Message).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Load message reactions
  useEffect(() => {
    if (!messages.length) return;
    const ids = messages.map(m => m.id);
    supabase.from("message_reactions").select("*").in("message_id", ids).then(({ data }) => {
      if (!data) return;
      const map: Record<string, MessageReaction[]> = {};
      for (const r of data as MessageReaction[]) {
        if (!map[r.message_id]) map[r.message_id] = [];
        map[r.message_id].push(r);
      }
      setReactions(map);
    });

    const ch = supabase.channel("message-reactions-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (p) => {
        if (p.eventType === "INSERT") {
          const r = p.new as MessageReaction;
          setReactions(prev => ({
            ...prev,
            [r.message_id]: [...(prev[r.message_id] ?? []), r],
          }));
        } else if (p.eventType === "DELETE") {
          const r = p.old as MessageReaction;
          setReactions(prev => ({
            ...prev,
            [r.message_id]: (prev[r.message_id] ?? []).filter(x => x.id !== r.id),
          }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [messages.length > 0]);

  useEffect(() => {
    const ids = Array.from(new Set(messages.map(m => m.user_id).filter(Boolean))) as string[];
    const missing = ids.filter(id => !profiles[id]);
    if (!missing.length) return;
    supabase.from("profiles").select("*").in("id", missing).then(({ data }) => {
      if (!data) return;
      setProfiles(p => {
        const next = { ...p };
        for (const pr of data as Profile[]) next[pr.id] = pr;
        return next;
      });
    });
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // @mention autocomplete
  useEffect(() => {
    if (mentionQuery === null || mentionQuery.length === 0) {
      setMentionSuggestions([]);
      return;
    }
    supabase.from("profiles").select("*").ilike("username", `${mentionQuery}%`).limit(5).then(({ data }) => {
      setMentionSuggestions((data as Profile[]) ?? []);
    });
  }, [mentionQuery]);

  function handleTextChange(val: string) {
    setText(val);
    // Detect @mention
    const match = val.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(username: string) {
    const newText = text.replace(/@\w*$/, `@${username} `);
    setText(newText);
    setMentionQuery(null);
    setMentionSuggestions([]);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function deleteMessage(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  async function toggleMessageReaction(messageId: string, emoji: string) {
    if (!user) return;
    const existing = reactions[messageId]?.find(r => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
  }

  function getReactionSummary(messageId: string) {
    const all = reactions[messageId] ?? [];
    const summary: Record<string, number> = {};
    for (const r of all) summary[r.emoji] = (summary[r.emoji] ?? 0) + 1;
    return summary;
  }

  function renderContent(content: string) {
    // Highlight @mentions
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith("@")
        ? <span key={i} className="text-primary font-semibold">{part}</span>
        : <span key={i}>{part}</span>
    );
  }

  async function sendMessage() {
    const content = text.trim();
    if (!content || sending) return;

    // Guest flow
    if (!user) {
      if (!guestName) return;
      // Client-side word filter check
      const lower = content.toLowerCase();
      if (wordFilters.some(w => lower.includes(w.toLowerCase()))) {
        toast.error("Message contains prohibited content");
        return;
      }
      setSending(true);
      try {
        const { error } = await supabase.from("messages").insert({
          user_id: null,
          guest_name: guestName,
          content,
          type: "chat",
        });
        if (error) {
          if (error.message?.toLowerCase().includes("policy") || error.code === "42501") {
            toast.error("You have been removed from this chat.");
          } else {
            toast.error("Failed to send");
          }
          return;
        }
        setText("");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!profile) return;

    // Client-side word filter check
    const lower = content.toLowerCase();
    if (wordFilters.some(w => lower.includes(w.toLowerCase()))) {
      toast.error("Message contains prohibited content");
      return;
    }

    setText("");
    setSending(true);
    const isRequest = content.toLowerCase().startsWith("/request ") || content.toLowerCase().startsWith("!request ");

    try {
      if (isRequest) {
        const query = content.replace(/^\/?!?request\s+/i, "").trim();
        if (!query) { toast.error("Tell me what to play: /request <song>"); return; }

        await supabase.from("messages").insert({
          user_id: user.id, content: `🎵 requested: ${query}`, type: "request",
        });

        const { results, error } = await search({ data: { query } });
        if (error || !results?.length) {
          await supabase.from("messages").insert({
            user_id: null, content: `Couldn't find a track for "${query}".`, type: "system",
          });
          return;
        }
        const top = results[0];

        // F2: Duplicate prevention
        const { data: existing } = await supabase.from("queue")
          .select("id").eq("external_id", top.videoId).in("status", ["pending", "playing"]).maybeSingle();
        if (existing) { toast.error("This song is already in the queue"); return; }

        // F3: Request limit per user (max 2 pending)
        const { count } = await supabase.from("queue")
          .select("id", { count: "exact" }).eq("requested_by", user.id).eq("status", "pending");
        if ((count ?? 0) >= 2) { toast.error("You already have 2 songs in the queue"); return; }

        const { data: inserted } = await supabase.from("queue").insert({
          source: "youtube",
          external_id: top.videoId,
          title: top.title,
          artist: top.channel,
          thumbnail: top.thumbnail,
          requested_by: user.id,
          status: "pending",
        }).select("*").single();

        if (inserted) {
          await supabase.from("messages").insert({
            user_id: null, content: `Added "${top.title}" to the queue.`, type: "system", queue_id: inserted.id,
          });
        }
      } else {
        const { error } = await supabase.from("messages").insert({ user_id: user.id, content, type: "chat" });
        if (error) {
          // F5: Banned user explanation
          if (error.message?.toLowerCase().includes("policy") || error.code === "42501") {
            toast.error("You have been removed from this chat.");
          } else {
            toast.error("Failed to send");
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    await sendMessage();
  }

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-[600px]">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> Live chat
        <span className="ml-auto text-xs font-normal text-muted-foreground hidden sm:inline">
          Tip: type <code>/request &lt;song&gt;</code>
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
        {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>}
        {messages.map((m) => {
          const author = m.user_id ? profiles[m.user_id] : null;
          const displayName = author?.username ?? m.guest_name ?? "guest";
          const avatarUrl = author ? getAvatarUrl(author.username, author.avatar_url) : null;
          const reactionSummary = getReactionSummary(m.id);
          const hasReactions = Object.keys(reactionSummary).length > 0;

          if (m.type === "system") {
            return <div key={m.id} className="text-xs text-muted-foreground italic px-2 py-1">{m.content}</div>;
          }
          return (
            <div key={m.id} className={`group relative text-sm px-2 py-1 rounded ${m.type === "request" ? "bg-primary/10" : ""}`}>
              <div className="flex items-start gap-2">
                {avatarUrl && (
                  <img src={avatarUrl} alt={displayName} className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold mr-2">@{displayName}</span>
                  {m.guest_name && <span className="text-xs text-muted-foreground mr-1">(guest)</span>}
                  <span>{renderContent(m.content)}</span>
                  {hasReactions && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(reactionSummary).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleMessageReaction(m.id, emoji)}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors
                            ${user && reactions[m.id]?.some(r => r.user_id === user.id && r.emoji === emoji)
                              ? "bg-primary/20 border-primary/40"
                              : "bg-muted/40 border-transparent hover:bg-muted/70"
                            }`}
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Admin controls + reaction picker */}
              <span className="absolute right-1 top-1 hidden group-hover:flex items-center gap-0.5">
                {user && (
                  <span className="flex items-center gap-0.5 mr-1">
                    {MSG_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => toggleMessageReaction(m.id, emoji)}
                        className="p-1 rounded hover:bg-muted/70 text-sm"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </span>
                )}
                {isAdmin && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="p-3 border-t border-border space-y-2">
        {user ? (
          <div className="relative">
            {/* @mention suggestions dropdown */}
            {mentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-10">
                {mentionSuggestions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => insertMention(s.username)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/70 flex items-center gap-2"
                  >
                    <img
                      src={getAvatarUrl(s.username, s.avatar_url)}
                      alt={s.username}
                      className="h-5 w-5 rounded-full"
                    />
                    @{s.username}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Say something or /request a song"
                disabled={sending}
                rows={1}
                className="flex-1 min-h-[36px] max-h-[100px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button type="submit" size="icon" disabled={sending || !text.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : guestName ? (
          /* Guest has set a name — show chat input */
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder={`Chatting as ${guestName}…`}
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : settingGuestName ? (
          /* Guest name entry form */
          <div className="flex gap-2">
            <Input
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              placeholder="Enter a display name…"
              maxLength={30}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && guestNameInput.trim()) {
                  const name = guestNameInput.trim();
                  setGuestName(name);
                  localStorage.setItem(GUEST_NAME_KEY, name);
                  setSettingGuestName(false);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!guestNameInput.trim()) return;
                const name = guestNameInput.trim();
                setGuestName(name);
                localStorage.setItem(GUEST_NAME_KEY, name);
                setSettingGuestName(false);
              }}
            >
              Go
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center space-y-1">
            <div>
              <Link to="/login" className="text-primary underline">Log in</Link> to chat and request songs.
            </div>
            <button
              type="button"
              onClick={() => setSettingGuestName(true)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              or chat as a guest
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
