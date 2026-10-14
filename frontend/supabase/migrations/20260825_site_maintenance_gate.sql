-- A alteração do modo de manutenção exige cargo de Dono e a segunda etapa do Admin.
create or replace function public.set_endoacolhe_maintenance(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not public.is_endoacolhe_owner()
     or not public.has_endoacolhe_admin_access() then
    raise exception 'owner admin access gate required' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'maintenance state is required' using errcode = '22023';
  end if;
  insert into public.endoacolhe_site_settings (singleton, maintenance_enabled, updated_at, updated_by)
  values (true, p_enabled, now(), auth.uid())
  on conflict (singleton) do update
    set maintenance_enabled = excluded.maintenance_enabled,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  return p_enabled;
end;
$$;

revoke all on function public.set_endoacolhe_maintenance(boolean) from public;
grant execute on function public.set_endoacolhe_maintenance(boolean) to authenticated;
