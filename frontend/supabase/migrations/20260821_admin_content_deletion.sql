create table if not exists public.admin_content_deletions (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('story', 'post')),
  target_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_content_deletions enable row level security;
revoke all on table public.admin_content_deletions from anon, authenticated;

create or replace function public.delete_endoacolhe_content(p_content_type text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if not public.is_endoacolhe_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_content_type not in ('story', 'post') or p_target_id is null then
    raise exception 'invalid content target' using errcode = '22023';
  end if;

  if p_content_type = 'story' then
    delete from public.community_stories where id = p_target_id returning id into deleted_id;
  else
    delete from public.blog_posts where id = p_target_id returning id into deleted_id;
  end if;

  if deleted_id is null then
    raise exception 'content not found' using errcode = 'P0002';
  end if;

  insert into public.admin_content_deletions (content_type, target_id, actor_user_id)
  values (p_content_type, deleted_id, auth.uid());

  return jsonb_build_object('content_type', p_content_type, 'id', deleted_id);
end;
$$;

revoke all on function public.delete_endoacolhe_content(text, uuid) from public, anon;
grant execute on function public.delete_endoacolhe_content(text, uuid) to authenticated;
