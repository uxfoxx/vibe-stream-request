import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, MessageSquare, Trash2, UserX } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Message, Profile } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { searchYouTube } from "@/lib/youtube.functions";
import { toast } from "sonner";

export function Chat() {
  const { user, profile, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const search = useServerFn(searchYouTube);

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

  async function deleteMessage(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    // Realtime DELETE subscription removes it from local state automatically
  }

  async function banUser(userId: string) {
    const { error } = await supabase.from("profiles").update({ banned: true }).eq("id", userId);
    if (error) toast.error(error.message);
    else toast.success("User banned");
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile || !text.trim() || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);

    const isRequest = content.toLowerCase().startsWith("/request ") || content.toLowerCase().startsWith("!request ");

    try {
      if (isRequest) {
        const query = content.replace(/^\/?!?request\s+/i, "").trim();
        if (!query) { toast.error("Tell me what to play: /request <song>"); return; }

        // Post the request message
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
          // Playback auto-start is handled server-side by the maybe_start_playback trigger
        }
      } else {
        await supabase.from("messages").insert({ user_id: user.id, content, type: "chat" });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-[500px]">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> Live chat
        <span className="ml-auto text-xs font-normal text-muted-foreground">Tip: type <code>/request &lt;song&gt;</code></span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-2">
        {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>}
        {messages.map((m) => {
          const author = m.user_id ? profiles[m.user_id] : null;
          if (m.type === "system") {
            return <div key={m.id} className="text-xs text-muted-foreground italic px-2 py-1">{m.content}</div>;
          }
          return (
            <div key={m.id} className={`group relative text-sm px-2 py-1 rounded ${m.type === "request" ? "bg-primary/10" : ""}`}>
              <span className="font-semibold mr-2">@{author?.username ?? "user"}</span>
              <span>{m.content}</span>
              {isAdmin && (
                <span className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  {m.user_id && m.user_id !== user?.id && (
                    <button
                      onClick={() => banUser(m.user_id!)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Ban user"
                      title="Ban user"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMessage(m.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="p-3 border-t border-border">
        {user ? (
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something or /request a song"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center">
            <Link to="/login" className="text-primary underline">Log in</Link> to chat and request songs.
          </div>
        )}
      </form>
    </div>
  );
}
