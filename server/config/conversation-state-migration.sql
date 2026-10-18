-- Run this in your Supabase SQL Editor.
-- Adds persistent pin/archive fields to the conversations table so chat state survives a reload.

alter table public.conversations
  add column if not exists pinned boolean default false,
  add column if not exists archived boolean default false;

create index if not exists conversations_pinned_archived_idx
  on public.conversations (pinned, archived, updated_at desc);
