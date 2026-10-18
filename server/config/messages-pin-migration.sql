-- Run this in your Supabase SQL Editor.
-- Adds persistent pin fields to the messages table so pinned messages survive a reload.

alter table public.messages
  add column if not exists pinned boolean default false,
  add column if not exists pinned_order integer default null;

create index if not exists messages_conversation_pinned_idx
  on public.messages (conversation_id, pinned, pinned_order);
