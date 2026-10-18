-- Run once in the Supabase SQL Editor.
-- This keeps public.users synchronized with Supabase Auth users,
-- including accounts that require email confirmation.

alter table public.users
  add column if not exists bio text default 'Available for a quick chat';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, username, full_name, avatar_url, bio)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'bio', new.raw_user_meta_data ->> 'status', 'Available for a quick chat')
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    bio = excluded.bio;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.users (id, email, username, full_name, avatar_url, bio)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'username', split_part(email, '@', 1)),
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  raw_user_meta_data ->> 'avatar_url',
  coalesce(raw_user_meta_data ->> 'bio', raw_user_meta_data ->> 'status', 'Available for a quick chat')
from auth.users
on conflict (id) do update set
  email = excluded.email,
  username = excluded.username,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  bio = excluded.bio;
