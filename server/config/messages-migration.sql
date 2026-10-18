-- Run this in your Supabase SQL Editor.
-- This adds the fields the app expects for real chat messages.

-- Add the columns the app expects.
alter table public.messages
  add column if not exists content text,
  add column if not exists message_type text default 'text',
  add column if not exists attachment jsonb,
  add column if not exists read_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default now(),
  add column if not exists deleted_for uuid[] default '{}'::uuid[],
  add column if not exists deleted_for_everyone boolean default false;

-- Only backfill if a legacy text column exists.
DO $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'text'
  ) then
    update public.messages
    set content = text
    where content is null and text is not null;
  end if;
end $$;

update public.messages
set message_type = 'text'
where message_type is null;

-- Realtime publication for message updates
DO $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
