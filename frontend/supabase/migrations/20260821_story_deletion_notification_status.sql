-- A exclusão de relatos deve respeitar o resultado anterior da moderação.
create or replace function public.delete_endoacolhe_content(p_content_type text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
  story_owner uuid;
  previous_story_status text;
begin
  if not public.is_endoacolhe_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_content_type not in ('story', 'post') or p_target_id is null then raise exception 'invalid content target' using errcode = '22023'; end if;
  if p_content_type = 'story' then
    select owner_id, status into story_owner, previous_story_status
    from public.community_stories where id = p_target_id for update;
    delete from public.community_stories where id = p_target_id returning id into deleted_id;
    if story_owner is not null and previous_story_status = 'approved' then
      insert into public.account_notifications (user_id, kind, message)
      values (story_owner, 'story_deleted', 'Seu relato publicado foi removido pela administração e não está mais disponível.');
    elsif story_owner is not null and previous_story_status = 'pending' then
      insert into public.account_notifications (user_id, kind, message)
      values (story_owner, 'story_deleted', 'Seu relato enviado foi removido antes da conclusão da revisão.');
    end if;
  else
    delete from public.blog_posts where id = p_target_id returning id into deleted_id;
  end if;
  if deleted_id is null then raise exception 'content not found' using errcode = 'P0002'; end if;
  insert into public.admin_content_deletions (content_type, target_id, actor_user_id)
  values (p_content_type, deleted_id, auth.uid());
  return jsonb_build_object('content_type', p_content_type, 'id', deleted_id);
end;
$$;

revoke all on function public.delete_endoacolhe_content(text, uuid) from public, anon;
grant execute on function public.delete_endoacolhe_content(text, uuid) to authenticated;
