-- Remove a rota de fallback da audiência pública e oferece reset somente ao Dono.
delete from public.site_monitoring_events
where route_path = '/404';

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
        'admin_actions', (
          (select count(*) from public.account_admin_actions where created_at >= now() - make_interval(days => safe_days)) +
          (select count(*) from public.admin_content_deletions where created_at >= now() - make_interval(days => safe_days)) +
          (select count(*) from public.admin_password_actions where created_at >= now() - make_interval(days => safe_days)) +
          (select count(*) from public.admin_role_actions where created_at >= now() - make_interval(days => safe_days))
        )
      )
      from public.site_monitoring_events
      where route_path <> '/404'
        and occurred_at >= now() - make_interval(days => safe_days)
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
        where route_path <> '/404'
          and occurred_at >= now() - make_interval(days => safe_days)
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
        where route_path <> '/404'
          and occurred_at >= now() - make_interval(days => safe_days)
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

create or replace function public.reset_endoacolhe_site_monitoring()
returns jsonb language plpgsql security definer set search_path = public as $$
declare deleted_events integer;
begin
  if not public.is_endoacolhe_owner() then
    raise exception 'only the owner can reset site monitoring' using errcode = '42501';
  end if;

  delete from public.site_monitoring_events;
  get diagnostics deleted_events = row_count;
  return jsonb_build_object('deleted_events', deleted_events);
end;
$$;

revoke all on function public.list_endoacolhe_site_monitoring(integer) from public, anon;
grant execute on function public.list_endoacolhe_site_monitoring(integer) to authenticated;
revoke all on function public.reset_endoacolhe_site_monitoring() from public, anon;
grant execute on function public.reset_endoacolhe_site_monitoring() to authenticated;
