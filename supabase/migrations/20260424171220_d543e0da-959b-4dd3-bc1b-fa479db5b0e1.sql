create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'run-scheduled-playlists') then
    perform cron.unschedule('run-scheduled-playlists');
  end if;
end $$;

select cron.schedule(
  'run-scheduled-playlists',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://project--51a02f3d-796b-42ed-9b29-78d4ab8a7108.lovable.app/api/public/hooks/run-scheduled-playlists',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);