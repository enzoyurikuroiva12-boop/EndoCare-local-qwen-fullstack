-- Monitoramento interno do site: eventos mínimos, sem IP em claro, e visibilidade exclusiva do Dono.
create table if not exists public.site_monitoring_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('page_view', 'engaged_15s', 'scroll_50', 'scroll_90', 'runtime_error', 'admin_open')),
  route_path text not null check (route_path in ('/', '/diario', '/blog', '/admin', '/404')),
  session_id text not null check (char_length(session_id) between 16 and 64),
  locale text not null check (locale in ('pt', 'en', 'es')),
  viewport text not null check (viewport in ('mobile', 'desktop'))
);

create index if not exists site_monitoring_events_occurred_idx on public.site_monitoring_events (occurred_at desc);
create index if not exists site_monitoring_events_route_idx on public.site_monitoring_events (route_path, occurred_at desc);
create index if not exists site_monitoring_events_session_idx on public.site_monitoring_events (session_id, occurred_at desc);

alter table public.site_monitoring_events enable row level security;
revoke all on public.site_monitoring_events from anon, authenticated;

-- Cada inserção preserva somente os últimos 90 dias de telemetria mínima.
create or replace function public.prune_endoacolhe_site_monitoring_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.site_monitoring_events where occurred_at < now() - interval '90 days';
  return new;
end;
$$;

drop trigger if exists prune_endoacolhe_site_monitoring_events_trigger on public.site_monitoring_events;
create trigger prune_endoacolhe_site_monitoring_events_trigger
after insert on public.site_monitoring_events
for each statement execute function public.prune_endoacolhe_site_monitoring_events();

create or replace function public.list_endoacolhe_site_monitoring(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare safe_days integer := greatest(1, least(coalesce(p_days, 7), 90));
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can view site monitoring' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', safe_days,
    'overview', (
      select jsonb_build_object(
        'views', count(*) filter (where event_type = 'page_view'),
        'sessions', count(distinct session_id) filter (where event_type = 'page_view'),
        'engaged_sessions', count(distinct session_id) filter (where event_type in ('engaged_15s', 'scroll_50', 'scroll_90')),
        'errors', count(*) filter (where event_type = 'runtime_error'),
        'admin_opens', count(*) filter (where event_type = 'admin_open')
      )
      from public.site_monitoring_events
      where occurred_at >= now() - make_interval(days => safe_days)
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', day::text,
        'views', views,
        'sessions', sessions,
        'engaged_sessions', engaged_sessions,
        'errors', errors
      ) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', occurred_at)::date as day,
          count(*) filter (where event_type = 'page_view')::integer as views,
          count(distinct session_id) filter (where event_type = 'page_view')::integer as sessions,
          count(distinct session_id) filter (where event_type in ('engaged_15s', 'scroll_50', 'scroll_90'))::integer as engaged_sessions,
          count(*) filter (where event_type = 'runtime_error')::integer as errors
        from public.site_monitoring_events
        where occurred_at >= now() - make_interval(days => safe_days)
        group by 1
      ) daily
    ),
    'routes', (
      select coalesce(jsonb_agg(jsonb_build_object('path', route_path, 'views', views, 'sessions', sessions) order by views desc, route_path), '[]'::jsonb)
      from (
        select route_path,
          count(*) filter (where event_type = 'page_view')::integer as views,
          count(distinct session_id) filter (where event_type = 'page_view')::integer as sessions
        from public.site_monitoring_events
        where occurred_at >= now() - make_interval(days => safe_days)
        group by route_path
      ) route_totals
    ),
    'admin_actions', (
      select jsonb_build_object(
        'account_controls', (select count(*) from public.account_admin_actions where created_at >= now() - make_interval(days => safe_days)),
        'content_deletions', (select count(*) from public.admin_content_deletions where created_at >= now() - make_interval(days => safe_days)),
        'password_actions', (select count(*) from public.admin_password_actions where created_at >= now() - make_interval(days => safe_days)),
        'role_changes', (select count(*) from public.admin_role_actions where created_at >= now() - make_interval(days => safe_days))
      )
    )
  );
end;
$$;

revoke all on function public.prune_endoacolhe_site_monitoring_events() from public, anon, authenticated;
revoke all on function public.list_endoacolhe_site_monitoring(integer) from public, anon;
grant execute on function public.list_endoacolhe_site_monitoring(integer) to authenticated;
