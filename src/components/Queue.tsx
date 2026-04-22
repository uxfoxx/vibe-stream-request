import { useEffect, useState } from "react";
import { Music2, ListMusic, Heart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { QueueItem, Profile, QueueUpvote } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequestModal } from "@/components/RequestModal";
import { toast } from "sonner";

export function Queue() {
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [upvotes, setUpvotes] = useState<QueueUpvote[]>([]);
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("queue").select("*").eq("status", "pending")
        .order("position", { ascending: true }).limit(20);
      setItems((data as QueueItem[]) || []);
    }
    load();
    const ch = supabase.channel(`queue-public-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Load upvotes for visible items
  useEffect(() => {
    if (!items.length) { setUpvotes([]); return; }
    const ids = items.map(i => i.id);
    supabase.from("queue_upvotes").select("*").in("queue_id", ids).then(({ data }) => {
      setUpvotes((data as QueueUpvote[]) ?? []);
    });

    const ch = supabase.channel(`queue-upvotes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_upvotes" }, async () => {
        const { data } = await supabase.from("queue_upvotes").select("*").in("queue_id", ids);
        setUpvotes((data as QueueUpvote[]) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [items.map(i => i.id).join(",")]);

  useEffect(() => {
    const ids = Array.from(new Set(items.map(i => i.requested_by).filter(Boolean))) as string[];
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
  }, [items]);

  async function upvoteItem(queueId: string) {
    if (!user) return;
    const mine = upvotes.find(u => u.queue_id === queueId && u.user_id === user.id);
    if (mine) {
      await supabase.from("queue_upvotes").delete().eq("id", mine.id);
    } else {
      const { error } = await supabase.from("queue_upvotes").insert({ queue_id: queueId, user_id: user.id });
      if (error && error.code !== "23505") toast.error(error.message);
    }
  }

  async function removeOwnItem(queueId: string) {
    if (!user) return;
    const { error } = await supabase.from("queue").delete().eq("id", queueId).eq("requested_by", user.id);
    if (error) toast.error(error.message);
  }

  function getUpvoteCount(queueId: string) {
    return upvotes.filter(u => u.queue_id === queueId).length;
  }

  function hasUpvoted(queueId: string) {
    return user ? upvotes.some(u => u.queue_id === queueId && u.user_id === user.id) : false;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <ListMusic className="h-4 w-4" /> Up next ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center space-y-2">
          <p>Queue is empty.</p>
          {user && <RequestModal triggerLabel="Be the first to request a song →" />}
          {!user && <p className="text-xs">Log in to request songs!</p>}
        </div>
      ) : (
        <ul className="space-y-2 max-h-[400px] overflow-auto">
          {items.map((it) => {
            const isOwn = user && it.requested_by === user.id;
            const upvoteCount = getUpvoteCount(it.id);
            const voted = hasUpvoted(it.id);
            return (
              <li key={it.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0 grid place-items-center">
                  {it.thumbnail ? <img src={it.thumbnail} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{it.title}</p>
                    {isOwn && (
                      <Badge variant="secondary" className="text-xs shrink-0">Your pick</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {it.artist || (it.source === "youtube" ? "YouTube" : "Upload")}
                    {it.requested_by && profiles[it.requested_by] && (
                      <> · by @{profiles[it.requested_by].username}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* F12: Upvote */}
                  <button
                    onClick={() => upvoteItem(it.id)}
                    disabled={!user}
                    className={`flex items-center gap-0.5 px-1.5 py-1 rounded text-xs transition-colors
                      ${voted ? "text-red-500" : "text-muted-foreground hover:text-red-400"}
                      ${!user ? "cursor-default" : "cursor-pointer"}`}
                    title={voted ? "Remove upvote" : "Upvote"}
                  >
                    <Heart className={`h-3.5 w-3.5 ${voted ? "fill-current" : ""}`} />
                    {upvoteCount > 0 && <span>{upvoteCount}</span>}
                  </button>
                  {/* F13: Remove own request */}
                  {isOwn && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => removeOwnItem(it.id)}
                      title="Remove your request"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
