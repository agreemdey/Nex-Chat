alter table public.conversation_members
  drop constraint if exists conversation_members_pkey;

alter table public.conversation_members
  alter column conversation_id set not null,
  alter column user_id set not null;

alter table public.conversation_members
  add constraint conversation_members_pkey
  primary key (conversation_id, user_id);
