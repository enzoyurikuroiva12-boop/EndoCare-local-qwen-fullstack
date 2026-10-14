-- Aceites de documentos legais no cadastro EndoAcolhe.
-- Mantém recibos imutáveis por documento, sem salvar IP, respostas de questionário ou conteúdo privado.

create table if not exists public.endoacolhe_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (document_key in ('terms', 'privacy')),
  document_version text not null check (char_length(document_version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  source text not null default 'web' check (source in ('web', 'mobile')),
  unique (user_id, document_key, document_version)
);

create index if not exists endoacolhe_legal_acceptances_user_date_idx
on public.endoacolhe_legal_acceptances (user_id, accepted_at desc);

alter table public.endoacolhe_legal_acceptances enable row level security;
revoke all on public.endoacolhe_legal_acceptances from public, anon, authenticated;

drop policy if exists "Pessoas leem os próprios aceites legais" on public.endoacolhe_legal_acceptances;
create policy "Pessoas leem os próprios aceites legais"
on public.endoacolhe_legal_acceptances
for select
to authenticated
using ((select auth.uid()) = user_id);
grant select on public.endoacolhe_legal_acceptances to authenticated;

create or replace function public.record_endoacolhe_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  terms_version text := nullif(new.raw_user_meta_data ->> 'terms_version', '');
  privacy_version text := nullif(new.raw_user_meta_data ->> 'privacy_version', '');
  source_value text := coalesce(nullif(new.raw_user_meta_data ->> 'consent_source', ''), 'web');
begin
  if coalesce(new.raw_user_meta_data ->> 'terms_accepted', 'false') <> 'true'
    or coalesce(new.raw_user_meta_data ->> 'privacy_accepted', 'false') <> 'true'
    or terms_version is null
    or privacy_version is null
  then
    return new;
  end if;

  if source_value not in ('web', 'mobile') then
    source_value := 'web';
  end if;

  insert into public.endoacolhe_legal_acceptances (user_id, document_key, document_version, accepted_at, source)
  values
    (new.id, 'terms', terms_version, coalesce(new.created_at, now()), source_value),
    (new.id, 'privacy', privacy_version, coalesce(new.created_at, now()), source_value)
  on conflict (user_id, document_key, document_version) do nothing;
  return new;
end;
$$;

drop trigger if exists record_endoacolhe_signup_legal_acceptance on auth.users;
create trigger record_endoacolhe_signup_legal_acceptance
after insert on auth.users
for each row execute function public.record_endoacolhe_signup_legal_acceptance();

revoke all on function public.record_endoacolhe_signup_legal_acceptance() from public, anon, authenticated;
