import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const EMOJIS = ["🔥", "❤️", "😂", "🎵", "👏"];

interface Props {
  queueId: string;
}

type ReactionCounts = Record<string, number>;
type UserReactions = Set<string>;

export function TrackReactions({ queueId }: Props) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<ReactionCounts>({});
  const [mine, setMine] = useState<UserReactions>(new Set());

  useEffect(() => {
    async function load() {
      const [{ data: all }, { data: userReactions }] = await Promise.all([
        supabase.from("track_reactions").select("emoji").eq("queue_id", queueId),
        user
          ? supabase.from("track_reactions").select("emoji").eq("queue_id", queueId).eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);
      const c: ReactionCounts = {};
      for (const r of (all ?? [])) c[r.emoji] = (c[r.emoji] ?? 0) + 1;
      setCounts(c);
      setMine(new Set((userReactions ?? []).map((r: { emoji: string }) => r.emoji)));
    }
    load();

    const ch = supabase.channel(`track-reactions-${queueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "track_reactions", filter: `queue_id=eq.${queueId}` }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queueId, user?.id]);

  async function toggle(emoji: string) {
    if (!user) return;
    if (mine.has(emoji)) {
      await supabase.from("track_reactions").delete()
        .eq("queue_id", queueId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("track_reactions").insert({ queue_id: queueId, user_id: user.id, emoji });
    }
  }

  const hasAny = EMOJIS.some(e => (counts[e] ?? 0) > 0) || !!user;
  if (!hasAny) return null;

  return (
    <div className="mt-3 flex items-center gap-1 flex-wrap">
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => toggle(emoji)}
          disabled={!user}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors border
            ${mine.has(emoji)
              ? "bg-primary/20 border-primary/40 text-foreground"
              : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/70"
            } ${!user ? "cursor-default" : "cursor-pointer"}`}
        >
          <span>{emoji}</span>
          {(counts[emoji] ?? 0) > 0 && <span className="text-xs">{counts[emoji]}</span>}
        </button>
      ))}
    </div>
  );
}
