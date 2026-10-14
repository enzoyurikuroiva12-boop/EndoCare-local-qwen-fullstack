-- Limite de uma resposta do questionário a cada 7 dias por conta autenticada.
-- O reset é administrativo, individual e auditável; respostas escritas permanecem ocultas do painel.

create table if not exists public.endoacolhe_questionnaire_limits (
  respondent_id uuid primary key references auth.users(id) on delete cascade,
  reset_at timestamptz,
  reset_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.endoacolhe_questionnaire_reset_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists endoacolhe_questionnaire_reset_actions_target_created_idx
  on public.endoacolhe_questionnaire_reset_actions (target_user_id, created_at desc);

alter table public.endoacolhe_questionnaire_limits enable row level security;
alter table public.endoacolhe_questionnaire_reset_actions enable row level security;
revoke all on public.endoacolhe_questionnaire_limits, public.endoacolhe_questionnaire_reset_actions from public, anon, authenticated;

create or replace function public.get_endoacolhe_questionnaire_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  latest_response_at timestamptz;
  latest_reset_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'authentication required to answer the questionnaire' using errcode = '42501';
  end if;

  select max(response.created_at)
    into latest_response_at
  from public.endoacolhe_questionnaire_responses response
  where response.respondent_id = current_user_id;

  select limits.reset_at
    into latest_reset_at
  from public.endoacolhe_questionnaire_limits limits
  where limits.respondent_id = current_user_id;

  if latest_reset_at is not null
    and (latest_response_at is null or latest_reset_at > latest_response_at) then
    latest_response_at := null;
  end if;

  return jsonb_build_object(
    'can_submit', latest_response_at is null or latest_response_at <= now() - interval '7 days',
    'next_available_at', case
      when latest_response_at is null or latest_response_at <= now() - interval '7 days' then null
      else latest_response_at + interval '7 days'
    end,
    'last_response_at', latest_response_at
  );
end;
$$;

create or replace function public.submit_endoacolhe_questionnaire(p_answers jsonb, p_rating smallint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  response_id uuid;
  current_user_id uuid := auth.uid();
  latest_response_at timestamptz;
  latest_reset_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'authentication required to answer the questionnaire' using errcode = '42501';
  end if;

  -- Serializa envios concorrentes da mesma conta para impedir duas respostas simultâneas.
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be a JSON object' using errcode = '22023';
  end if;
  if char_length(p_answers::text) > 30000 then
    raise exception 'answers are too long' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_answers) as answer_key
    where jsonb_typeof(p_answers -> answer_key) <> 'string'
  ) then
    raise exception 'answers must contain text values' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each_text(p_answers) as answer_entry(answer_key, answer_value)
    where char_length(answer_value) > 1600
  ) then
    raise exception 'an answer is too long' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_answers) as answer_key
    where not exists (
      select 1
      from public.endoacolhe_questionnaire_questions question
      where question.id::text = answer_key
        and question.is_active
    )
  ) then
    raise exception 'answer references an inactive or unknown question' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.endoacolhe_questionnaire_questions question
    where question.is_active
      and question.is_required
      and char_length(btrim(coalesce(p_answers ->> question.id::text, ''))) = 0
  ) then
    raise exception 'a required question is unanswered' using errcode = '22023';
  end if;

  select max(response.created_at)
    into latest_response_at
  from public.endoacolhe_questionnaire_responses response
  where response.respondent_id = current_user_id;

  select limits.reset_at
    into latest_reset_at
  from public.endoacolhe_questionnaire_limits limits
  where limits.respondent_id = current_user_id;

  if latest_reset_at is not null
    and (latest_response_at is null or latest_reset_at > latest_response_at) then
    latest_response_at := null;
  end if;

  if latest_response_at is not null
    and latest_response_at > now() - interval '7 days' then
    raise exception 'questionnaire already submitted this week' using errcode = 'P0001';
  end if;

  insert into public.endoacolhe_questionnaire_responses (answers, rating, respondent_id)
  values (p_answers, p_rating, current_user_id)
  returning id into response_id;

  return response_id;
end;
$$;

create or replace function public.reset_endoacolhe_questionnaire_limit(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  reset_timestamp timestamptz := now();
begin
  if actor_user_id is null or not public.has_endoacolhe_permission('manage_questionnaire') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_target_user_id is null then
    raise exception 'target account is required' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text, 0));

  insert into public.endoacolhe_questionnaire_limits (respondent_id, reset_at, reset_by, updated_at)
  values (p_target_user_id, reset_timestamp, actor_user_id, reset_timestamp)
  on conflict (respondent_id) do update
    set reset_at = excluded.reset_at,
        reset_by = excluded.reset_by,
        updated_at = excluded.updated_at;

  insert into public.endoacolhe_questionnaire_reset_actions (actor_user_id, target_user_id, created_at)
  values (actor_user_id, p_target_user_id, reset_timestamp);

  return jsonb_build_object(
    'target_user_id', p_target_user_id,
    'reset_at', reset_timestamp
  );
end;
$$;

revoke all on function public.get_endoacolhe_questionnaire_status() from public, anon, authenticated;
revoke all on function public.submit_endoacolhe_questionnaire(jsonb, smallint) from public, anon, authenticated;
revoke all on function public.reset_endoacolhe_questionnaire_limit(uuid) from public, anon;
grant execute on function public.get_endoacolhe_questionnaire_status() to authenticated;
grant execute on function public.submit_endoacolhe_questionnaire(jsonb, smallint) to authenticated;
grant execute on function public.reset_endoacolhe_questionnaire_limit(uuid) to authenticated;
