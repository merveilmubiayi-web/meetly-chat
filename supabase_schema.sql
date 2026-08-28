create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  name text,
  phone_number text,
  avatar_url text,
  cover_url text,
  bio text default '',
  region text,
  is_public boolean not null default true,
  is_verified boolean not null default false,
  algorithm_preferences jsonb not null default '{"boostFriends":true,"showNewPostsFirst":true,"reduceSponsored":false}'::jsonb,
  notification_settings jsonb not null default '{"likes":true,"comments":true,"newFollowers":true,"liveFriends":true}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Meetly user',
  author_avatar text,
  caption text not null default '',
  type text not null default 'text' check (type in ('text', 'image', 'video')),
  media_url text,
  likes_count integer not null default 0,
  liked_by uuid[] not null default '{}',
  is_story boolean not null default false,
  latest_comments jsonb not null default '[]'::jsonb,
  comments_count integer not null default 0,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Meetly user',
  author_avatar text,
  type text not null default 'image' check (type in ('image', 'video')),
  media_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  reply_to_id uuid references public.comments(id) on delete set null,
  body text not null,
  media_type text not null default 'text' check (media_type in ('text', 'audio', 'image', 'video')),
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.comments add column if not exists reply_to_id uuid references public.comments(id) on delete set null;
alter table public.post_likes add column if not exists reaction text not null default 'like';
alter table public.post_likes drop constraint if exists post_likes_reaction_check;
alter table public.post_likes add constraint post_likes_reaction_check check (reaction in ('like', 'love', 'haha', 'wow', 'sad', 'angry'));

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.story_reactions (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'heart',
  created_at timestamptz not null default now(),
  primary key (story_id, user_id, reaction)
);

create table if not exists public.saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.hashtags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  primary key (post_id, hashtag_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('like', 'comment', 'follow', 'message', 'live', 'call', 'system')),
  post_id uuid references public.posts(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('like', 'comment', 'follow', 'message', 'live', 'call', 'system'));

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  media_type text not null default 'text' check (media_type in ('text', 'audio', 'image', 'video')),
  media_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete set null,
  room_name text not null,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video', 'live')),
  status text not null default 'started' check (status in ('started', 'ended', 'missed', 'rejected')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.follows enable row level security;
alter table public.blocked_users enable row level security;
alter table public.story_views enable row level security;
alter table public.story_comments enable row level security;
alter table public.story_reactions enable row level security;
alter table public.saved_posts enable row level security;
alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.call_sessions enable row level security;
alter table public.support_messages enable row level security;
alter table public.verification_requests enable row level security;

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_admin(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id and role = 'admin'
  );
$$;

revoke execute on function public.is_conversation_member(uuid, uuid) from public, anon;
revoke execute on function public.is_conversation_admin(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_conversation_admin(uuid, uuid) to authenticated, service_role;

drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles own write" on public.profiles;
create policy "profiles own write" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "posts read authenticated" on public.posts;
create policy "posts read authenticated" on public.posts for select to authenticated using (true);
drop policy if exists "posts own insert" on public.posts;
create policy "posts own insert" on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "posts own update" on public.posts;
create policy "posts own update" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "posts own delete" on public.posts;
create policy "posts own delete" on public.posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists "stories read authenticated" on public.stories;
create policy "stories read authenticated" on public.stories for select to authenticated using (true);
drop policy if exists "stories own insert" on public.stories;
create policy "stories own insert" on public.stories for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "stories own update" on public.stories;
create policy "stories own update" on public.stories for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "stories own delete" on public.stories;
create policy "stories own delete" on public.stories for delete to authenticated using (author_id = auth.uid());

drop policy if exists "comments read authenticated" on public.comments;
create policy "comments read authenticated" on public.comments for select to authenticated using (true);
drop policy if exists "comments own insert" on public.comments;
create policy "comments own insert" on public.comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "comments own update" on public.comments;
create policy "comments own update" on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "comments own delete" on public.comments;
create policy "comments own delete" on public.comments for delete to authenticated using (author_id = auth.uid());

drop policy if exists "post likes read authenticated" on public.post_likes;
create policy "post likes read authenticated" on public.post_likes for select to authenticated using (true);
drop policy if exists "post likes own insert" on public.post_likes;
create policy "post likes own insert" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "post likes own delete" on public.post_likes;
create policy "post likes own delete" on public.post_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "follows read authenticated" on public.follows;
create policy "follows read authenticated" on public.follows for select to authenticated using (true);
drop policy if exists "follows own insert" on public.follows;
create policy "follows own insert" on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "follows own delete" on public.follows;
create policy "follows own delete" on public.follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists "blocked users own access" on public.blocked_users;
create policy "blocked users own access" on public.blocked_users for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

drop policy if exists "story views read own" on public.story_views;
create policy "story views read own" on public.story_views for select to authenticated using (user_id = auth.uid());
drop policy if exists "story views own insert" on public.story_views;
create policy "story views own insert" on public.story_views for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "story views own update" on public.story_views;
create policy "story views own update" on public.story_views for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "story comments read authenticated" on public.story_comments;
create policy "story comments read authenticated" on public.story_comments for select to authenticated using (true);
drop policy if exists "story comments own insert" on public.story_comments;
create policy "story comments own insert" on public.story_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "story comments own update" on public.story_comments;
create policy "story comments own update" on public.story_comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "story comments own delete" on public.story_comments;
create policy "story comments own delete" on public.story_comments for delete to authenticated using (author_id = auth.uid());

drop policy if exists "story reactions read authenticated" on public.story_reactions;
create policy "story reactions read authenticated" on public.story_reactions for select to authenticated using (true);
drop policy if exists "story reactions own insert" on public.story_reactions;
create policy "story reactions own insert" on public.story_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "story reactions own delete" on public.story_reactions;
create policy "story reactions own delete" on public.story_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "saved posts own access" on public.saved_posts;
create policy "saved posts own access" on public.saved_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "hashtags read authenticated" on public.hashtags;
create policy "hashtags read authenticated" on public.hashtags for select to authenticated using (true);
drop policy if exists "hashtags authenticated insert" on public.hashtags;
create policy "hashtags authenticated insert" on public.hashtags for insert to authenticated with check (true);
drop policy if exists "post hashtags read authenticated" on public.post_hashtags;
create policy "post hashtags read authenticated" on public.post_hashtags for select to authenticated using (true);
drop policy if exists "post hashtags post owner write" on public.post_hashtags;
create policy "post hashtags post owner write" on public.post_hashtags for all to authenticated using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())) with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "notifications recipient access" on public.notifications;
create policy "notifications recipient access" on public.notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "notifications recipient update" on public.notifications;
create policy "notifications recipient update" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists "notifications authenticated insert" on public.notifications;

drop policy if exists "conversation member access" on public.conversations;
create policy "conversation member access" on public.conversations for select to authenticated using (created_by = (select auth.uid()) or public.is_conversation_member(id));
drop policy if exists "conversation creator insert" on public.conversations;
create policy "conversation creator insert" on public.conversations for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "conversation member update" on public.conversations;
create policy "conversation member update" on public.conversations for update to authenticated using (public.is_conversation_admin(id)) with check (public.is_conversation_admin(id));

drop policy if exists "conversation members access" on public.conversation_members;
create policy "conversation members access" on public.conversation_members for select to authenticated using (user_id = auth.uid() or public.is_conversation_member(conversation_id));
drop policy if exists "conversation members admin write" on public.conversation_members;
create policy "conversation members admin write" on public.conversation_members for all to authenticated using (public.is_conversation_admin(conversation_id)) with check (public.is_conversation_admin(conversation_id));
drop policy if exists "conversation creator add members" on public.conversation_members;
create policy "conversation creator add members" on public.conversation_members for insert to authenticated with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()));

drop policy if exists "messages member access" on public.messages;
create policy "messages member access" on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "messages sender insert" on public.messages;
create policy "messages sender insert" on public.messages for insert to authenticated with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
drop policy if exists "messages sender update" on public.messages;
create policy "messages sender update" on public.messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists "call sessions participant access" on public.call_sessions;
create policy "call sessions participant access" on public.call_sessions for select to authenticated using (initiated_by = auth.uid() or public.is_conversation_member(conversation_id));
drop policy if exists "call sessions own write" on public.call_sessions;
create policy "call sessions own write" on public.call_sessions for all to authenticated using (initiated_by = auth.uid()) with check (initiated_by = auth.uid());

drop policy if exists "support messages own insert" on public.support_messages;
create policy "support messages own insert" on public.support_messages for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "support messages own read" on public.support_messages;
create policy "support messages own read" on public.support_messages for select to authenticated using (user_id = auth.uid());

drop policy if exists "verification requests own access" on public.verification_requests;
create policy "verification requests own access" on public.verification_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "verification requests own insert" on public.verification_requests;
create policy "verification requests own insert" on public.verification_requests for insert to authenticated with check (user_id = auth.uid());

create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at asc);
create index if not exists comments_reply_to_idx on public.comments (reply_to_id);
create index if not exists story_comments_created_idx on public.story_comments (story_id, created_at asc);
create index if not exists stories_author_created_idx on public.stories (author_id, created_at desc);
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at asc);
create index if not exists call_sessions_conversation_started_idx on public.call_sessions (conversation_id, started_at desc);
create index if not exists support_messages_user_created_idx on public.support_messages (user_id, created_at desc);
create index if not exists verification_requests_user_created_idx on public.verification_requests (user_id, created_at desc);

create or replace function public.create_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  notification_type text;
  notification_message text;
begin
  if tg_table_name = 'follows' then
    insert into public.notifications (recipient_id, actor_id, type, message)
    values (new.following_id, new.follower_id, 'follow', 'Vous avez un nouvel abonné.')
    on conflict do nothing;
    return new;
  elsif tg_table_name = 'post_likes' then
    select author_id into recipient from public.posts where id = new.post_id;
    if recipient is not null and recipient <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id, message)
      values (recipient, new.user_id, 'like', new.post_id, 'Quelqu’un a aimé votre publication.');
    end if;
    return new;
  elsif tg_table_name = 'messages' then
    notification_type := 'message';
    notification_message := 'Vous avez reçu un nouveau message.';
    insert into public.notifications (recipient_id, actor_id, type, message)
    select user_id, new.sender_id, notification_type, notification_message
    from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id;
    return new;
  elsif tg_table_name = 'call_sessions' and new.call_type = 'live' then
    notification_type := 'live';
    notification_message := 'Un compte que vous suivez est en direct.';
    insert into public.notifications (recipient_id, actor_id, type, message)
    select follower_id, new.initiated_by, notification_type, notification_message
    from public.follows
    where following_id = new.initiated_by;
    return new;
  else
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists follows_activity_notification on public.follows;
create trigger follows_activity_notification after insert on public.follows for each row execute procedure public.create_activity_notification();
drop trigger if exists likes_activity_notification on public.post_likes;
create trigger likes_activity_notification after insert on public.post_likes for each row execute procedure public.create_activity_notification();
drop trigger if exists messages_activity_notification on public.messages;
create trigger messages_activity_notification after insert on public.messages for each row execute procedure public.create_activity_notification();
drop trigger if exists live_activity_notification on public.call_sessions;
create trigger live_activity_notification after insert on public.call_sessions for each row execute procedure public.create_activity_notification();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, name, phone_number)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'phoneNumber'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Trigger pour synchroniser likes_count et liked_by sur les posts
create or replace function public.update_post_likes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set likes_count = likes_count + 1,
        liked_by = array_append(liked_by, new.user_id)
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set likes_count = greatest(0, likes_count - 1),
        liked_by = array_remove(liked_by, old.user_id)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_post_like_changed on public.post_likes;
create trigger on_post_like_changed
after insert or delete on public.post_likes
for each row execute procedure public.update_post_likes();

-- Trigger pour synchroniser comments_count sur les posts
create or replace function public.update_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comments_count = comments_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set comments_count = greatest(0, comments_count - 1)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_comment_count_changed on public.comments;
create trigger on_comment_count_changed
after insert or delete on public.comments
for each row execute procedure public.update_post_comments_count();
