-- Triagem automática conservadora: o status de publicação continua sob decisão humana.
alter table public.community_stories
  add column if not exists triage_status text not null default 'needs_review',
  add column if not exists triage_confidence numeric(4,3),
  add column if not exists triage_signals jsonb not null default '[]'::jsonb,
  add column if not exists triage_model text,
  add column if not exists triage_checked_at timestamptz;

alter table public.community_stories
  drop constraint if exists community_stories_triage_status_check;

alter table public.community_stories
  add constraint community_stories_triage_status_check
  check (triage_status in ('adequate', 'needs_review', 'likely_spam')) not valid;

alter table public.community_stories
  drop constraint if exists community_stories_triage_confidence_check;

alter table public.community_stories
  add constraint community_stories_triage_confidence_check
  check (triage_confidence is null or (triage_confidence >= 0 and triage_confidence <= 1)) not valid;

comment on column public.community_stories.triage_status is 'Resultado mínimo da triagem automática; não publica nem rejeita o relato.';
comment on column public.community_stories.triage_confidence is 'Confiança limitada da triagem, sem representar veracidade ou avaliação médica.';
comment on column public.community_stories.triage_signals is 'Sinais técnicos mínimos para orientar revisão humana; não contém prompt nem resposta bruta.';

-- Os campos são atualizados somente pelo endpoint server-side com service role.
-- O cliente continua sem permissão direta de update em relatos.
