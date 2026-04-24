# Scheduled playlists — automatic enqueue

## Current state

The admin already has a **Schedule** tab where admins can create weekly recurring playlists (name, day of week, hour 0–23, list of YouTube URLs/IDs) and enable/disable/delete them. Data is saved to the `scheduled_playlists` table.

What's missing: **nothing actually enqueues the playlist items when the scheduled hour arrives.** We'll add that automation plus a few UX polish items on the existing tab.

## What we'll build

### 1. Automatic enqueue (the core piece)

Add a public hook route that, when called, looks at every active scheduled playlist whose `day_of_week` + `start_hour` matches the current time (UTC) and enqueues all of its items into the `queue` table as `pending` tracks. A `pg_cron` job will hit this route once an hour, on the hour.

- **Route**: `src/routes/api/public/hooks/run-scheduled-playlists.ts` (POST)
  - Uses `supabaseAdmin` (service role) to bypass RLS
  - Computes current UTC `day_of_week` (0–6) and `hour` (0–23)
  - Fetches active playlists matching both
  - Inserts each playlist's items into `queue` with:
    - `source: 'youtube'`, `external_id: item.videoId`, `title`, `thumbnail`
    - `status: 'pending'`, `position: Date.now() + index` (ms, matching existing convention)
    - `requested_by: null`
  - Idempotency: track which playlist+hour was last run via a small `scheduled_playlist_runs` table (playlist_id + run_at unique) so re-invocations within the same hour don't double-enqueue
  - Posts a system chat message: "🎵 Playlist '{name}' started"
- **Cron**: `pg_cron` job `run-scheduled-playlists` at `0 * * * *` (every hour on the hour) calling the route
- **Schema migration**:
  ```sql
  create table public.scheduled_playlist_runs (
    id uuid primary key default gen_random_uuid(),
    playlist_id uuid references public.scheduled_playlists(id) on delete cascade not null,
    run_at timestamptz not null default now(),
    items_enqueued int not null default 0,
    unique (playlist_id, date_trunc('hour', run_at))
  );
  alter table public.scheduled_playlist_runs enable row level security;
  create policy "Admins can view runs" on public.scheduled_playlist_runs
    for select using (has_role(auth.uid(), 'admin'));
  ```

### 2. Resolve YouTube titles when creating a playlist

Right now, items added by URL/ID store the videoId as the title (placeholder). We'll call the existing YouTube search infrastructure to fetch real titles/channels at playlist creation time. New server fn `resolveYouTubeVideos({ videoIds })` calls the YouTube `videos?part=snippet` endpoint and returns `{ videoId, title, channel, thumbnail, duration_seconds }` for each.

The Create form will call this on save, so saved `items` have real metadata that the queue and "now playing" will display correctly.

### 3. Schedule tab UX polish

- **Hour picker**: replace the bare number input with a dropdown of `00:00`–`23:00` (clearer for non-technical admins) and label it as **server time (UTC)**
- **Items preview**: in the playlists list, expand each row to show a small thumbnail+title list of the items (collapsible)
- **"Run now" button** per playlist: manually trigger the enqueue for testing without waiting for the hour. Calls the same logic via a server fn `runPlaylistNow({ id })` (admin-only via `requireSupabaseAuth` + role check)
- **Last run indicator**: show "Last run: {relative time} · {N tracks}" pulled from `scheduled_playlist_runs`
- **Validation**: prevent creating a playlist with zero valid video IDs; show an error instead of silently creating an empty one

## Technical details

- **Files created**
  - `src/routes/api/public/hooks/run-scheduled-playlists.ts` — POST handler
  - `src/lib/scheduled.functions.ts` — `resolveYouTubeVideos`, `runPlaylistNow` server fns
  - One SQL migration (table + RLS) and one cron-job insert (separate, since it contains a hard-coded URL/key)
- **Files edited**
  - `src/routes/admin.tsx` — `ScheduleTab`: title resolution on create, hour dropdown, items preview, Run-now button, last-run display, empty-items validation
- **No changes to**: queue/playback logic, RLS on `queue`/`scheduled_playlists`, existing types (the new types regenerate automatically)
- **Time zone**: scheduling uses **UTC** to match server time and avoid surprises across listeners' time zones. We'll label it clearly in the UI.

## Out of scope

- Per-minute precision (hourly cadence is sufficient for "live radio" weekly schedules)
- One-off (non-recurring) scheduled playlists
- Drag-to-reorder items inside a saved playlist
- Editing a playlist after creation (delete + recreate for now)
