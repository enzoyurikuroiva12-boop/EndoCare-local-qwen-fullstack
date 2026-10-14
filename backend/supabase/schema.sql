-- Execute este arquivo no Supabase Dashboard > SQL Editor.
-- A chave service_role nunca deve ser usada no frontend.

create extension if not exists "pgcrypto";

create table if not exists public.community_stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  author_alias text not null check (char_length(author_alias) between 1 and 80),
  content text not null check (char_length(content) between 40 and 2400),
  helpfulness smallint not null check (helpfulness between 0 and 5),
  consent_to_publish boolean not null default false,
  shared_with_professional boolean not null default false,
  requires_review_for_claims boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (char_length(category) between 1 and 80),
  title text not null check (char_length(title) between 1 and 180),
  summary text not null check (char_length(summary) between 1 and 600),
  content text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.endobot_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 80),
  language text not null default 'pt' check (language in ('pt', 'en', 'es')),
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.endobot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.endobot_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 2400),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create or replace function public.is_endoacolhe_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create index if not exists community_stories_public_idx on public.community_stories(status, created_at desc);
create index if not exists community_stories_owner_idx on public.community_stories(owner_id);
create index if not exists blog_posts_public_idx on public.blog_posts(status, published_at desc);
create index if not exists endobot_conversations_owner_updated_idx on public.endobot_conversations(owner_id, updated_at desc);
create index if not exists endobot_messages_conversation_created_idx on public.endobot_messages(conversation_id, created_at asc);

revoke all on public.community_stories from anon, authenticated;
revoke all on public.blog_posts from anon, authenticated;
revoke all on public.endobot_conversations from anon, authenticated;
revoke all on public.endobot_messages from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;
grant select on public.community_stories to anon, authenticated;
grant insert on public.community_stories to authenticated;
grant update on public.community_stories to authenticated;
grant select on public.blog_posts to anon, authenticated;
grant insert, update, delete on public.blog_posts to authenticated;
grant select, insert, update, delete on public.endobot_conversations to authenticated;
grant select, insert, delete on public.endobot_messages to authenticated;
grant select on public.admin_users to authenticated;
revoke execute on function public.is_endoacolhe_admin() from public;
revoke execute on function public.is_endoacolhe_admin() from anon;
grant execute on function public.is_endoacolhe_admin() to authenticated;

alter table public.community_stories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.endobot_conversations enable row level security;
alter table public.endobot_messages enable row level security;
alter table public.admin_users enable row level security;

create policy "Pessoas veem somente relatos aprovados ou próprios"
on public.community_stories for select
to anon, authenticated
using (status = 'approved' or (select auth.uid()) = owner_id);

create policy "Pessoas autenticadas enviam somente seus próprios relatos"
on public.community_stories for insert
to authenticated
with check ((select auth.uid()) = owner_id and consent_to_publish = true and status = 'pending');

create policy "Administradores leem relatos em moderação"
on public.community_stories for select
to authenticated
using ((select public.is_endoacolhe_admin()));

create policy "Administradores moderam relatos"
on public.community_stories for update
to authenticated
using ((select public.is_endoacolhe_admin()))
with check ((select public.is_endoacolhe_admin()));

create policy "Todos leem artigos publicados"
on public.blog_posts for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Somente administradores criam artigos" on public.blog_posts;
drop policy if exists "Somente administradores alteram artigos" on public.blog_posts;
drop policy if exists "Somente administradores removem artigos" on public.blog_posts;

create policy "Administradores leem artigos completos"
on public.blog_posts for select
to authenticated
using ((select public.is_endoacolhe_admin()));

create policy "Somente administradores criam artigos"
on public.blog_posts for insert
to authenticated
with check ((select public.is_endoacolhe_admin()) and (select auth.uid()) = author_id);

create policy "Somente administradores alteram artigos"
on public.blog_posts for update
to authenticated
using ((select public.is_endoacolhe_admin()))
with check ((select public.is_endoacolhe_admin()));

create policy "Somente administradores removem artigos"
on public.blog_posts for delete
to authenticated
using ((select public.is_endoacolhe_admin()));

create policy "Administradores consultam a lista permitida"
on public.admin_users for select
to authenticated
using ((select public.is_endoacolhe_admin()));

create policy "Pessoas acessam somente suas conversas EndoBot"
on public.endobot_conversations for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Pessoas criam somente suas conversas EndoBot"
on public.endobot_conversations for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Pessoas atualizam somente suas conversas EndoBot"
on public.endobot_conversations for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Pessoas removem somente suas conversas EndoBot"
on public.endobot_conversations for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Pessoas acessam somente mensagens das próprias conversas"
on public.endobot_messages for select
to authenticated
using (exists (select 1 from public.endobot_conversations conversation where conversation.id = conversation_id and conversation.owner_id = (select auth.uid())));

create policy "Pessoas criam mensagens somente nas próprias conversas"
on public.endobot_messages for insert
to authenticated
with check (exists (select 1 from public.endobot_conversations conversation where conversation.id = conversation_id and conversation.owner_id = (select auth.uid())));

create policy "Pessoas removem mensagens somente das próprias conversas"
on public.endobot_messages for delete
to authenticated
using (exists (select 1 from public.endobot_conversations conversation where conversation.id = conversation_id and conversation.owner_id = (select auth.uid())));
