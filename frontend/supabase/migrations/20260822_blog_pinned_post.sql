alter table public.blog_posts add column if not exists is_pinned boolean not null default false;
alter table public.blog_posts add column if not exists pinned_at timestamptz;

create unique index if not exists blog_posts_single_pinned_idx on public.blog_posts ((is_pinned)) where is_pinned;
create index if not exists blog_posts_public_order_idx on public.blog_posts (is_pinned desc, pinned_at desc, published_at desc) where status = 'published';

create or replace function public.enforce_endoacolhe_blog_pin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'published' then
    new.is_pinned := false;
    new.pinned_at := null;
  elsif new.is_pinned and (tg_op = 'INSERT' or not old.is_pinned) then
    new.pinned_at := now();
  elsif not new.is_pinned then
    new.pinned_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_endoacolhe_blog_pin_trigger on public.blog_posts;
create trigger enforce_endoacolhe_blog_pin_trigger
before insert or update of status, is_pinned on public.blog_posts
for each row execute function public.enforce_endoacolhe_blog_pin();

create or replace function public.set_endoacolhe_blog_post_pinned(p_post_id uuid, p_is_pinned boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_status text;
begin
  if not public.has_endoacolhe_permission('blog_manage') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_post_id is null then raise exception 'invalid post' using errcode = '22023'; end if;
  select status into target_status from public.blog_posts where id = p_post_id for update;
  if target_status is null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if target_status <> 'published' then raise exception 'only published posts can be pinned' using errcode = '22023'; end if;
  if p_is_pinned then update public.blog_posts set is_pinned = false where is_pinned and id <> p_post_id; end if;
  update public.blog_posts set is_pinned = p_is_pinned where id = p_post_id;
  return jsonb_build_object('id', p_post_id, 'is_pinned', p_is_pinned);
end;
$$;

revoke all on function public.enforce_endoacolhe_blog_pin() from public, anon, authenticated;
revoke all on function public.set_endoacolhe_blog_post_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_endoacolhe_blog_post_pinned(uuid, boolean) to authenticated;
