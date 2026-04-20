
# Web Radio App — Plan

A live, synced web radio where guests can listen and authenticated users can chat and request songs. An admin curates and controls the queue.

## Core experience

- **Landing / Player page** (public): big "now playing" card (album art, title, artist), play/pause + volume, live listener count, current queue, and a chat panel on the side.
- **Login / Signup** via Lovable Cloud auth (email + password). Guests can listen without logging in; chatting and requesting requires login.
- **Admin dashboard** (role-gated): search YouTube, upload audio files, manage queue (reorder/skip/remove), and ban users from chat.

## Audio playback

- Queue items are either:
  - **YouTube tracks** — searched via YouTube Data API, played through a hidden YouTube IFrame player on each listener's browser.
  - **Uploaded files** — MP3/WAV uploaded by admin to Cloud Storage, played via HTML5 `<audio>`.
- **Live sync**: server stores `current_track`, `started_at`, and `is_playing`. When a listener joins or a new track starts, the client seeks to `now - started_at` so everyone hears the same moment. When a track ends, the server auto-advances to the next queue item and broadcasts the change in real time.

## Song requests

- Logged-in users type a song name in chat (or use a "Request a song" button).
- Server runs a YouTube search, picks the top music result, and appends it to the queue automatically.
- A small "🎵 requested by @user" badge appears on that queue item and in chat.

## Chat

- Real-time chat panel beside the player (Lovable Cloud Realtime).
- Messages show username, timestamp, and a special style for song requests and admin announcements.
- Login required to send; guests see messages read-only.
- Basic moderation: admin can delete messages and ban users.

## Roles & data

- `profiles` table (username, avatar)
- `user_roles` table with `admin` / `user` enum (separate table, security-definer `has_role` function)
- `queue` table (position, source: youtube/upload, external_id or file_url, title, artist, thumbnail, requested_by, status)
- `playback_state` singleton (current_queue_id, started_at, is_playing)
- `messages` table (user_id, content, type: chat/request/system, created_at)
- `listeners` presence channel for live count

## Pages

- `/` — Player + chat (public)
- `/login`, `/signup`
- `/admin` — Admin dashboard (queue manager, YouTube search, upload, moderation) — protected route

## What you'll need to provide after approval

- **YouTube Data API key** (free from Google Cloud Console) for searching tracks. I'll guide you when we get there.
- Decide if guests should see chat messages or only see the player (default: read-only chat for guests).

## Out of scope (for v1)

- Native mobile apps
- DJ scheduling / multiple stations
- Monetization / ads
- Skipping/voting by listeners (only admin controls playback)
