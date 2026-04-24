import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ResolvedVideo = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration_seconds: number | null;
};

function parseISODuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

export const resolveYouTubeVideos = createServerFn({ method: "POST" })
  .inputValidator((input: { videoIds: string[] }) => {
    if (!input || !Array.isArray(input.videoIds)) throw new Error("videoIds required");
    const ids = input.videoIds
      .map((s) => String(s).trim())
      .filter((s) => /^[A-Za-z0-9_-]{11}$/.test(s))
      .slice(0, 50);
    return { videoIds: ids };
  })
  .handler(async ({ data }) => {
    if (data.videoIds.length === 0) return { results: [] as ResolvedVideo[] };
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", data.videoIds.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      console.error("YouTube videos lookup failed", res.status, text);
      return { results: [] as ResolvedVideo[], error: `YouTube lookup failed (${res.status})` };
    }
    const json = await res.json();
    const results: ResolvedVideo[] = (json.items || []).map((it: any) => ({
      videoId: it.id,
      title: it.snippet?.title || it.id,
      channel: it.snippet?.channelTitle || "",
      thumbnail:
        it.snippet?.thumbnails?.medium?.url ||
        it.snippet?.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`,
      duration_seconds: parseISODuration(it.contentDetails?.duration),
    }));
    return { results };
  });

export const runPlaylistNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || typeof input.id !== "string") throw new Error("id required");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Verify admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { data: pl, error } = await supabaseAdmin
      .from("scheduled_playlists")
      .select("id, name, items")
      .eq("id", data.id)
      .single();
    if (error || !pl) throw new Error(error?.message || "Playlist not found");

    const items = (pl.items as unknown as Array<{ videoId: string; title?: string; channel?: string; thumbnail?: string }>) || [];
    if (items.length === 0) return { enqueued: 0 };

    const baseTs = Date.now();
    const rows = items.map((it, i) => ({
      source: "youtube" as const,
      external_id: it.videoId,
      title: it.title || it.videoId,
      artist: it.channel || null,
      thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${it.videoId}/mqdefault.jpg`,
      status: "pending" as const,
      position: baseTs + i,
      requested_by: null,
    }));
    const { error: insErr } = await supabaseAdmin.from("queue").insert(rows);
    if (insErr) throw new Error(insErr.message);

    // Log a manual run
    const now = new Date();
    const runHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0)).toISOString();
    await supabaseAdmin.from("scheduled_playlist_runs").upsert(
      { playlist_id: pl.id, run_hour: runHour, items_enqueued: rows.length },
      { onConflict: "playlist_id,run_hour" }
    );

    await supabaseAdmin.from("messages").insert({
      type: "system",
      content: `🎵 Playlist "${pl.name}" started (manual, ${rows.length} tracks)`,
      user_id: null,
    });

    return { enqueued: rows.length };
  });
