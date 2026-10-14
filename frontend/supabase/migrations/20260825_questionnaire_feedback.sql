-- Questionário público editável pela administração e avaliação final do site.

create table if not exists public.endoacolhe_questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  prompt_pt text not null,
  prompt_en text,
  prompt_es text,
  helper_pt text,
  helper_en text,
  helper_es text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint endoacolhe_questionnaire_prompt_pt_length check (char_length(btrim(prompt_pt)) between 1 and 300),
  constraint endoacolhe_questionnaire_prompt_en_length check (prompt_en is null or char_length(btrim(prompt_en)) between 1 and 300),
  constraint endoacolhe_questionnaire_prompt_es_length check (prompt_es is null or char_length(btrim(prompt_es)) between 1 and 300),
  constraint endoacolhe_questionnaire_helper_pt_length check (helper_pt is null or char_length(btrim(helper_pt)) <= 320),
  constraint endoacolhe_questionnaire_helper_en_length check (helper_en is null or char_length(btrim(helper_en)) <= 320),
  constraint endoacolhe_questionnaire_helper_es_length check (helper_es is null or char_length(btrim(helper_es)) <= 320),
  constraint endoacolhe_questionnaire_position_nonnegative check (position >= 0)
);

create table if not exists public.endoacolhe_questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null default '{}'::jsonb,
  rating smallint not null,
  respondent_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint endoacolhe_questionnaire_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint endoacolhe_questionnaire_rating_range check (rating between 1 and 5)
);

alter table public.endoacolhe_questionnaire_questions enable row level security;
alter table public.endoacolhe_questionnaire_responses enable row level security;

create index if not exists endoacolhe_questionnaire_questions_position_idx
  on public.endoacolhe_questionnaire_questions (position, created_at);
create index if not exists endoacolhe_questionnaire_responses_created_at_idx
  on public.endoacolhe_questionnaire_responses (created_at desc);
create index if not exists endoacolhe_questionnaire_responses_rating_idx
  on public.endoacolhe_questionnaire_responses (rating);

create or replace function public.has_endoacolhe_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare active_role text;
begin
  active_role := public.current_endoacolhe_admin_role();
  if active_role = 'owner' then return true; end if;
  if active_role = 'admin' then return p_permission in ('view_users', 'apply_punishments', 'moderate_stories', 'content_manage', 'blog_manage', 'support_chat', 'view_punishment_logs', 'manage_questionnaire', 'view_questionnaire_results'); end if;
  if active_role = 'moderator' then return p_permission in ('view_users', 'apply_punishments', 'moderate_stories', 'support_chat', 'view_punishment_logs'); end if;
  if active_role = 'support' then return p_permission in ('support_chat', 'view_punishment_logs'); end if;
  return false;
end;
$$;

insert into public.endoacolhe_questionnaire_questions (
  prompt_pt, prompt_en, prompt_es,
  helper_pt, helper_en, helper_es,
  is_required, is_active, position
)
select * from (
  values
    (
      'O que mais ajudou você a encontrar no EndoAcolhe?',
      'What helped you most to find on EndoAcolhe?',
      '¿Qué fue lo que más te ayudó a encontrar en EndoAcolhe?',
      'Conte brevemente qual parte do site foi mais útil para você.',
      'Briefly tell us which part of the site was most useful to you.',
      'Cuéntanos brevemente qué parte del sitio te resultó más útil.',
      false, true, 0
    ),
    (
      'Há alguma informação ou recurso que você gostaria de ver aqui?',
      'Is there any information or feature you would like to see here?',
      '¿Hay alguna información o recurso que te gustaría ver aquí?',
      'Sua sugestão ajuda a orientar os próximos conteúdos.',
      'Your suggestion helps guide future content.',
      'Tu sugerencia ayuda a orientar los próximos contenidos.',
      false, true, 1
    ),
    (
      'Como poderíamos tornar sua experiência mais acolhedora?',
      'How could we make your experience more welcoming?',
      '¿Cómo podríamos hacer tu experiencia más acogedora?',
      'Evite incluir nomes, e-mails, diagnósticos ou outros dados pessoais.',
      'Please avoid names, emails, diagnoses, or other personal data.',
      'Evita incluir nombres, correos, diagnósticos u otros datos personales.',
      false, true, 2
    )
) as seed(prompt_pt, prompt_en, prompt_es, helper_pt, helper_en, helper_es, is_required, is_active, position)
where not exists (select 1 from public.endoacolhe_questionnaire_questions);

 drop policy if exists "Public reads active questionnaire questions" on public.endoacolhe_questionnaire_questions;
 drop policy if exists "Questionnaire managers read all questions" on public.endoacolhe_questionnaire_questions;
 drop policy if exists "Questionnaire managers create questions" on public.endoacolhe_questionnaire_questions;
 drop policy if exists "Questionnaire managers update questions" on public.endoacolhe_questionnaire_questions;
 drop policy if exists "Questionnaire managers delete questions" on public.endoacolhe_questionnaire_questions;

create policy "Public reads active questionnaire questions"
  on public.endoacolhe_questionnaire_questions for select
  to anon, authenticated
  using (is_active);

create policy "Questionnaire managers read all questions"
  on public.endoacolhe_questionnaire_questions for select
  to authenticated
  using ((select public.has_endoacolhe_permission('manage_questionnaire')));

create policy "Questionnaire managers create questions"
  on public.endoacolhe_questionnaire_questions for insert
  to authenticated
  with check ((select public.has_endoacolhe_permission('manage_questionnaire')));

create policy "Questionnaire managers update questions"
  on public.endoacolhe_questionnaire_questions for update
  to authenticated
  using ((select public.has_endoacolhe_permission('manage_questionnaire')))
  with check ((select public.has_endoacolhe_permission('manage_questionnaire')));

create policy "Questionnaire managers delete questions"
  on public.endoacolhe_questionnaire_questions for delete
  to authenticated
  using ((select public.has_endoacolhe_permission('manage_questionnaire')));

revoke all on table public.endoacolhe_questionnaire_responses from public, anon, authenticated;

create or replace function public.submit_endoacolhe_questionnaire(p_answers jsonb, p_rating smallint)
returns uuid language plpgsql security definer set search_path = public as $$
declare response_id uuid;
begin
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
      select 1 from public.endoacolhe_questionnaire_questions question
      where question.id::text = answer_key and question.is_active
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

  insert into public.endoacolhe_questionnaire_responses (answers, rating, respondent_id)
  values (p_answers, p_rating, auth.uid())
  returning id into response_id;

  return response_id;
end;
$$;

create or replace function public.list_endoacolhe_questionnaire_results()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.has_endoacolhe_permission('view_questionnaire_results') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_responses', count(*)::integer,
    'average_rating', coalesce(round(avg(rating)::numeric, 2), 0),
    'distribution', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('rating', rating_value, 'count', coalesce(distribution.rating_count, 0))
          order by rating_value
        ),
        '[]'::jsonb
      )
      from generate_series(1, 5) as rating_value
      left join (
        select rating, count(*)::integer as rating_count
        from public.endoacolhe_questionnaire_responses
        group by rating
      ) distribution on distribution.rating = rating_value
    )
  ) into result
  from public.endoacolhe_questionnaire_responses;

  return result;
end;
$$;

revoke all on function public.submit_endoacolhe_questionnaire(jsonb, smallint) from public, anon, authenticated;
revoke all on function public.list_endoacolhe_questionnaire_results() from public, anon, authenticated;

grant select on table public.endoacolhe_questionnaire_questions to anon, authenticated;
grant insert, update, delete on table public.endoacolhe_questionnaire_questions to authenticated;
grant execute on function public.submit_endoacolhe_questionnaire(jsonb, smallint) to anon, authenticated;
grant execute on function public.list_endoacolhe_questionnaire_results() to authenticated;
