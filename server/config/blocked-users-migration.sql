create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create index if not exists idx_blocked_users_blocker_id
  on public.blocked_users (blocker_id);

create index if not exists idx_blocked_users_blocked_id
  on public.blocked_users (blocked_id);
