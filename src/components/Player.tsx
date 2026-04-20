import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Music2, Radio } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { PlaybackState, QueueItem } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) return resolve();
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return ytApiPromise;
}

export function Player() {
  const { isAdmin } = useAuth();
  const [state, setState] = useState<PlaybackState | null>(null);
  const [track, setTrack] = useState<QueueItem | null>(null);
  const [muted, setMuted] = useState(true); // browsers block autoplay with sound
  const [volume, setVolume] = useState(80);
  const [hasJoined, setHasJoined] = useState(false);
  const ytRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load playback state + subscribe
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data } = await supabase.from("playback_state").select("*").eq("id", 1).maybeSingle();
      setState(data as PlaybackState);
      ch = supabase
        .channel("playback")
        .on("postgres_changes", { event: "*", schema: "public", table: "playback_state" }, (payload) => {
          setState(payload.new as PlaybackState);
        })
        .subscribe();
    }
    init();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);

  // When playback state changes, fetch the current track
  useEffect(() => {
    async function fetchTrack() {
      if (!state?.current_queue_id) { setTrack(null); return; }
      const { data } = await supabase.from("queue").select("*").eq("id", state.current_queue_id).maybeSingle();
      setTrack(data as QueueItem);
    }
    fetchTrack();
  }, [state?.current_queue_id]);

  // Compute current playback offset (live sync)
  function currentOffsetSeconds(): number {
    if (!state?.started_at) return 0;
    return Math.max(0, (Date.now() - new Date(state.started_at).getTime()) / 1000);
  }

  // Sync YouTube playback
  useEffect(() => {
    if (!track || track.source !== "youtube" || !track.external_id) return;
    if (!hasJoined) return;

    let cancelled = false;
    (async () => {
      await loadYouTubeAPI();
      if (cancelled) return;

      if (!ytRef.current) {
        ytRef.current = new window.YT.Player(ytContainerRef.current, {
          height: "0",
          width: "0",
          videoId: track.external_id,
          playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
          events: {
            onReady: (e: any) => {
              e.target.setVolume(muted ? 0 : volume);
              const offset = currentOffsetSeconds();
              e.target.seekTo(offset, true);
              if (state?.is_playing) e.target.playVideo(); else e.target.pauseVideo();
            },
            onStateChange: (e: any) => {
              // when the video ends, an admin/cron should advance; we just stop
              if (e.data === window.YT.PlayerState.ENDED && isAdmin) {
                advanceQueue();
              }
            },
          },
        });
      } else {
        try {
          const cur = ytRef.current.getVideoData?.()?.video_id;
          if (cur !== track.external_id) {
            ytRef.current.loadVideoById({ videoId: track.external_id, startSeconds: currentOffsetSeconds() });
          } else {
            const offset = currentOffsetSeconds();
            const playerTime = ytRef.current.getCurrentTime?.() ?? 0;
            if (Math.abs(playerTime - offset) > 2) ytRef.current.seekTo(offset, true);
            if (state?.is_playing) ytRef.current.playVideo(); else ytRef.current.pauseVideo();
          }
        } catch {}
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, state?.is_playing, state?.started_at, hasJoined]);

  // Sync HTML5 audio for uploads
  useEffect(() => {
    if (!track || track.source !== "upload" || !audioRef.current) return;
    if (!hasJoined) return;
    const a = audioRef.current;
    const offset = currentOffsetSeconds();
    if (Math.abs(a.currentTime - offset) > 2) a.currentTime = offset;
    if (state?.is_playing) a.play().catch(() => {}); else a.pause();
  }, [track?.id, state?.is_playing, state?.started_at, hasJoined]);

  // Volume / mute
  useEffect(() => {
    if (ytRef.current?.setVolume) ytRef.current.setVolume(muted ? 0 : volume);
    if (audioRef.current) { audioRef.current.muted = muted; audioRef.current.volume = volume / 100; }
  }, [muted, volume]);

  async function advanceQueue() {
    // Mark current as played, pick next pending by position
    if (!state?.current_queue_id) return;
    await supabase.from("queue").update({ status: "played" }).eq("id", state.current_queue_id);
    const { data: next } = await supabase
      .from("queue").select("*").eq("status", "pending").order("position", { ascending: true }).limit(1).maybeSingle();
    if (next) {
      await supabase.from("queue").update({ status: "playing" }).eq("id", next.id);
      await supabase.from("playback_state").update({
        current_queue_id: next.id,
        started_at: new Date().toISOString(),
        is_playing: true,
      }).eq("id", 1);
    } else {
      await supabase.from("playback_state").update({
        current_queue_id: null, started_at: null, is_playing: false,
      }).eq("id", 1);
    }
  }

  function joinAndPlay() {
    setHasJoined(true);
    setMuted(false);
  }

  return (
    <div className="rounded-2xl border border-border p-6 md:p-8 relative overflow-hidden"
      style={{ background: "var(--gradient-radio)", boxShadow: "var(--shadow-glow)" }}>
      <div className="absolute inset-0 bg-card/60 backdrop-blur-xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-4">
          <Radio className="h-3.5 w-3.5" /> {state?.is_playing ? "Live now" : "Off air"}
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="h-40 w-40 rounded-xl overflow-hidden bg-muted shrink-0 grid place-items-center">
            {track?.thumbnail
              ? <img src={track.thumbnail} alt={track.title} className="h-full w-full object-cover" />
              : <Music2 className="h-12 w-12 text-muted-foreground" />}
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h2 className="text-2xl md:text-3xl font-bold truncate">{track?.title ?? "Nothing playing"}</h2>
            <p className="text-muted-foreground truncate">{track?.artist ?? (track ? "" : "Waiting for the next track…")}</p>

            <div className="mt-6 flex items-center gap-3 justify-center sm:justify-start">
              {!hasJoined ? (
                <Button onClick={joinAndPlay} size="lg" className="rounded-full">
                  <Play className="h-5 w-5" /> Tune in
                </Button>
              ) : (
                <Button variant="secondary" size="icon" className="rounded-full h-12 w-12"
                  onClick={() => setMuted(m => !m)}>
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
              )}
              <div className="flex-1 max-w-[200px]">
                <Slider value={[volume]} onValueChange={(v) => setVolume(v[0])} max={100} step={1} />
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={advanceQueue}>
                  <Pause className="h-4 w-4" /> Skip
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Hidden players */}
        <div className="absolute -z-10 opacity-0 pointer-events-none">
          <div ref={ytContainerRef} />
          {track?.source === "upload" && track.file_url && (
            <audio ref={audioRef} src={track.file_url} onEnded={() => isAdmin && advanceQueue()} />
          )}
        </div>
      </div>
    </div>
  );
}
