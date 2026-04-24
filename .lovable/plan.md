
# Fix Radio Playback, Skip & Sync Issues

## What's broken (confirmed by inspecting the database)

1. **Two tracks have `status = "playing"` at the same time.** When a track ends, *every* listener's browser races to call `advanceQueue()`. Multiple concurrent `UPDATE`s mark the next track playing more than once and skip past the actual next song. This is the root cause of the "not playing live properly" symptom.

2. **Skip doesn't work reliably.** Both the admin Skip button and the listener skip-vote use the same racy client-side `advanceQueue()`. When several clients press it, the queue jumps unpredictably.

3. **Inconsistent `position` scheme breaks queue order.** Some rows store position as epoch seconds (1.77e9), others as epoch milliseconds (1.77e12) from drag-reorder. Newly requested songs always sort before drag-reordered ones.

4. **`started_at` drifts.** `playback_state.updated_at` is stale; no trigger keeps it fresh.

## Fix — one atomic server-side advance, called from one place

### Database migration

Create a single SQL function `public.advance_queue(expected_current uuid)` (SECURITY DEFINER) that:
- Locks `playback_state` row 1 with `FOR UPDATE`
- If `current_queue_id` no longer matches `expected_current` → exit (someone else already advanced; this kills the race)
- Marks current track `played`
- Picks the next `pending` track ordered by `position`
- Marks it `playing` and updates `playback_state` with new `started_at = now()`
- If no next track, sets state to idle

Also:
- Add a trigger to keep `playback_state.updated_at` fresh
- Normalise existing `position` values to a consistent millisecond scale, and fix the `queue.position` default to use `(EXTRACT(epoch FROM now()) * 1000)::bigint`
- One-time cleanup: set the older of the two duplicate "playing" rows back to `played` and ensure only one row is `playing`
- Grant `EXECUTE` on `advance_queue` to `authenticated` and `anon` (RLS still protects underlying tables)

### Client changes

- **`src/components/Player.tsx`**: Replace the body of `advanceQueue()` with a single `supabase.rpc("advance_queue", { expected_current: state.current_queue_id })` call. Remove all the race-prone `update`/`select`/`update` chain.
- **`src/components/SkipVote.tsx`**: Keep the vote insert; on threshold, also call the same RPC instead of relying on every client.
- **`src/routes/admin.tsx`**:
  - `maybeStartPlayback()` — wrap in the same RPC pattern (call `advance_queue(NULL)` which only starts if state is idle).
  - Drag-reorder: switch positions to use millisecond-scale (`Date.now() + idx`) which matches the new default and existing newer rows.

### Player resync hardening

In `Player.tsx`, when `state.current_queue_id` changes:
- For YouTube: always call `loadVideoById` with `startSeconds: currentOffsetSeconds()` — don't trust the stale player state.
- For uploads: force `audio.src` reload before `play()`.

This guarantees every client lands on the new track immediately when the server state changes, fixing "live sync drops out after skip."

## What you'll see after the fix

- Track ends → exactly one client-or-anyone triggers `advance_queue`; all listeners jump to the same next track within ~1 sec via the existing realtime subscription.
- Admin Skip / vote-skip → instant, single, atomic transition.
- Queue order is stable and matches what admin sees.
- No more duplicate "playing" rows.

No new secrets or env vars needed.
