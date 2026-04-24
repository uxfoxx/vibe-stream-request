create table public.scheduled_playlist_runs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.scheduled_playlists(id) on delete cascade not null,
  run_hour timestamptz not null,
  items_enqueued int not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, run_hour)
);

alter table public.scheduled_playlist_runs enable row level security;

create policy "Admins can view scheduled runs"
  on public.scheduled_playlist_runs
  for select
  using (has_role(auth.uid(), 'admin'));

create index scheduled_playlist_runs_playlist_id_idx
  on public.scheduled_playlist_runs(playlist_id, run_hour desc);