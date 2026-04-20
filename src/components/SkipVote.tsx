import { useEffect, useState } from "react";
import { SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const SKIP_THRESHOLD = 3;

interface Props {
  queueId: string;
  onThresholdReached: () => void;
}

export function SkipVote({ queueId, onThresholdReached }: Props) {
  const { user } = useAuth();
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ count }, { data: myVote }] = await Promise.all([
        supabase.from("skip_votes").select("id", { count: "exact" }).eq("queue_id", queueId),
        user
          ? supabase.from("skip_votes").select("id").eq("queue_id", queueId).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setVoteCount(count ?? 0);
      setHasVoted(!!myVote);
    }
    load();

    const ch = supabase.channel(`skip-votes-${queueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "skip_votes", filter: `queue_id=eq.${queueId}` }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queueId, user?.id]);

  if (!user) return null;

  async function vote() {
    if (!user || loading) return;
    setLoading(true);
    try {
      if (hasVoted) {
        await supabase.from("skip_votes").delete().eq("queue_id", queueId).eq("user_id", user.id);
        setHasVoted(false);
      } else {
        const { error } = await supabase.from("skip_votes").insert({ queue_id: queueId, user_id: user.id });
        if (error) {
          if (error.code === "23505") { toast.error("Already voted"); return; }
          toast.error(error.message);
          return;
        }
        setHasVoted(true);
        // The DB trigger handles auto-advance; client side just for snappy UX
        if (voteCount + 1 >= SKIP_THRESHOLD) onThresholdReached();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={hasVoted ? "secondary" : "outline"}
      size="sm"
      onClick={vote}
      disabled={loading}
      title={`Vote to skip (${voteCount}/${SKIP_THRESHOLD})`}
    >
      <SkipForward className="h-4 w-4" />
      <span className="ml-1 text-xs">{voteCount}/{SKIP_THRESHOLD}</span>
    </Button>
  );
}
