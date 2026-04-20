import { useEffect, useState } from "react";
import { Volume2, VolumeX, Play, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PlaybackState, QueueItem } from "@/lib/db-types";
import { Button } from "@/components/ui/button";

interface Props {
  hasJoined: boolean;
  muted: boolean;
  setMuted: (m: boolean | ((prev: boolean) => boolean)) => void;
  joinAndPlay: () => void;
}

export function MiniPlayer({ hasJoined, muted, setMuted, joinAndPlay }: Props) {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<PlaybackState | null>(null);
  const [track, setTrack] = useState<QueueItem | null>(null);

  // Detect scroll past player (~420px)
  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 420);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.from("playback_state").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      setState(data as PlaybackState);
    });
    const ch = supabase.channel("mini-playback")
      .on("postgres_changes", { event: "*", schema: "public", table: "playback_state" }, (p) => {
        setState(p.new as PlaybackState);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!state?.current_queue_id) { setTrack(null); return; }
    supabase.from("queue").select("*").eq("id", state.current_queue_id).maybeSingle().then(({ data }) => {
      setTrack(data as QueueItem);
    });
  }, [state?.current_queue_id]);

  if (!visible || !state?.is_playing) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border shadow-lg">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
        <div className="h-9 w-9 rounded overflow-hidden bg-muted shrink-0 grid place-items-center">
          {track?.thumbnail
            ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
            : <Music2 className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{track?.title ?? "Now playing"}</p>
          {track?.artist && <p className="text-xs text-muted-foreground truncate">{track.artist}</p>}
        </div>
        {!hasJoined ? (
          <Button size="sm" onClick={joinAndPlay} className="shrink-0">
            <Play className="h-4 w-4 mr-1" /> Tune in
          </Button>
        ) : (
          <Button size="icon" variant="ghost" onClick={() => setMuted(m => !m)} className="shrink-0">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
