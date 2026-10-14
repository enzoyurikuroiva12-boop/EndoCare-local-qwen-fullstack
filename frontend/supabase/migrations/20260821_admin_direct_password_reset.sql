-- Registra redefinições administrativas diretas sem armazenar senhas.
-- A alteração de senha permanece no Supabase Auth e usa service_role apenas no backend.

create table if not exists public.admin_password_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('direct_reset')),
  created_at timestamptz not null default now(),
  check (actor_user_id is null or actor_user_id <> target_user_id)
);

create index if not exists admin_password_actions_target_created_idx
  on public.admin_password_actions(target_user_id, created_at desc);

alter table public.admin_password_actions enable row level security;
revoke all on public.admin_password_actions from anon, authenticated;
