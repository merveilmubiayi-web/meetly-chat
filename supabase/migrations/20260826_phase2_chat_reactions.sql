alter table public.post_likes
  add column if not exists reaction text not null default 'like';

alter table public.post_likes drop constraint if exists post_likes_reaction_check;
alter table public.post_likes
  add constraint post_likes_reaction_check
  check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry'));

alter table public.comments
  add column if not exists reply_to_id uuid references public.comments(id) on delete set null;

create index if not exists comments_reply_to_idx on public.comments (reply_to_id);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists "conversation creator insert" on public.conversations;
create policy "conversation creator insert"
on public.conversations
for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "conversation member access" on public.conversations;
create policy "conversation member access"
on public.conversations
for select to authenticated
using (created_by = (select auth.uid()) or public.is_conversation_member(id));

drop policy if exists "conversation members access" on public.conversation_members;
create policy "conversation members access"
on public.conversation_members
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_conversation_member(conversation_id)
);

drop policy if exists "conversation creator add members" on public.conversation_members;
create policy "conversation creator add members"
on public.conversation_members
for insert to authenticated
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = conversation_id
      and conversations.created_by = (select auth.uid())
  )
);

drop policy if exists "conversation members admin write" on public.conversation_members;
create policy "conversation members admin write"
on public.conversation_members
for update to authenticated
using (public.is_conversation_admin(conversation_id))
with check (public.is_conversation_admin(conversation_id));

drop policy if exists "post likes read authenticated" on public.post_likes;
create policy "post likes read authenticated"
on public.post_likes
for select to authenticated
using (true);

drop policy if exists "post likes own insert" on public.post_likes;
create policy "post likes own insert"
on public.post_likes
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "post likes own update" on public.post_likes;
create policy "post likes own update"
on public.post_likes
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "post likes own delete" on public.post_likes;
create policy "post likes own delete"
on public.post_likes
for delete to authenticated
using (user_id = (select auth.uid()));
