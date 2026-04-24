import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Item = { videoId: string; title: string; channel?: string; thumbnail?: string };

async function runDue(now = new Date()) {
  const dow = now.getUTCDay(); // 0..6
  const hour = now.getUTCHours(); // 0..23
  // Bucket the hour for idempotency
  const runHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0)).toISOString();

  const { data: playlists, error } = await supabaseAdmin
    .from("scheduled_playlists")
    .select("id, name, items, day_of_week, start_hour, active")
    .eq("active", true)
    .eq("day_of_week", dow)
    .eq("start_hour", hour);

  if (error) throw error;

  const results: Array<{ id: string; enqueued: number; skipped?: string }> = [];

  for (const pl of playlists ?? []) {
    // Idempotency: try to insert run row first
    const { error: runErr } = await supabaseAdmin
      .from("scheduled_playlist_runs")
      .insert({ playlist_id: pl.id, run_hour: runHour, items_enqueued: 0 });

    if (runErr) {
      // Unique violation — already ran this hour
      results.push({ id: pl.id, enqueued: 0, skipped: "already-ran" });
      continue;
    }

    const items = (pl.items as unknown as Item[]) || [];
    if (items.length === 0) {
      results.push({ id: pl.id, enqueued: 0, skipped: "empty" });
      continue;
    }

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

    const { error: insertErr } = await supabaseAdmin.from("queue").insert(rows);
    if (insertErr) {
      results.push({ id: pl.id, enqueued: 0, skipped: insertErr.message });
      continue;
    }

    await supabaseAdmin
      .from("scheduled_playlist_runs")
      .update({ items_enqueued: rows.length })
      .eq("playlist_id", pl.id)
      .eq("run_hour", runHour);

    await supabaseAdmin.from("messages").insert({
      type: "system",
      content: `🎵 Scheduled playlist "${pl.name}" started (${rows.length} tracks)`,
      user_id: null,
    });

    results.push({ id: pl.id, enqueued: rows.length });
  }

  return { ranAt: runHour, day_of_week: dow, hour, results };
}

export const Route = createFileRoute("/api/public/hooks/run-scheduled-playlists")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const out = await runDue();
          return Response.json({ ok: true, ...out });
        } catch (e: any) {
          console.error("run-scheduled-playlists failed", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
      GET: async () => {
        // Allow manual GET trigger for debugging
        try {
          const out = await runDue();
          return Response.json({ ok: true, ...out });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});
