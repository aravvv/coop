/*
  COOP SOCIAL FEATURES UPDATE
  ===========================
  Run this script in the Supabase SQL Editor.
*/

-- 1. Add parent_id to comments for nesting
alter table public.comments 
add column if not exists parent_id uuid references public.comments(id) on delete cascade;

-- 2. Create comment_likes table
create table if not exists public.comment_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, comment_id)
);

alter table public.comment_likes enable row level security;

-- RLS for comment_likes
create policy "Comment likes are viewable by everyone" on comment_likes for select using (true);
create policy "Users can like comments" on comment_likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike comments" on comment_likes for delete using (auth.uid() = user_id);

-- 3. Update Notification Trigger to handle Replies and Comment Likes

-- We need to extend the notification type check if strict, or just insert new types.
-- First, let's update the check constraint on notifications.type if it exists.
-- (The original setup had: check (type in ('like', 'comment', 'remix')))
-- We need to add 'reply' and 'like_comment'.

alter table public.notifications 
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check 
check (type in ('like', 'comment', 'remix', 'reply', 'like_comment'));

-- Update the handle_new_interaction function
create or replace function public.handle_new_interaction()
returns trigger language plpgsql security definer as $$
declare
  recipient_id uuid;
  parent_comment_user_id uuid;
  comment_owner_id uuid;
begin
  -- 1. Track Likes
  if TG_TABLE_NAME = 'likes' then
     select user_id into recipient_id from public.tracks where id = new.track_id;
     if recipient_id is not null and recipient_id != new.user_id then
       insert into public.notifications (user_id, type, origin_user_id, track_id)
       values (recipient_id, 'like', new.user_id, new.track_id);
     end if;
     
  -- 2. Track Comments (and Replies)
  elsif TG_TABLE_NAME = 'comments' then
     -- Check if it is a reply
     if new.parent_id is not null then
       -- It's a reply: Notify the author of the PARENT comment
       select user_id into parent_comment_user_id from public.comments where id = new.parent_id;
       if parent_comment_user_id is not null and parent_comment_user_id != new.user_id then
         insert into public.notifications (user_id, type, origin_user_id, track_id)
         values (parent_comment_user_id, 'reply', new.user_id, new.track_id);
       end if;
     else
       -- It's a top-level comment: Notify the TRACK owner
       select user_id into recipient_id from public.tracks where id = new.track_id;
       if recipient_id is not null and recipient_id != new.user_id then
         insert into public.notifications (user_id, type, origin_user_id, track_id)
         values (recipient_id, 'comment', new.user_id, new.track_id);
       end if;
     end if;

  -- 3. Comment Likes
  elsif TG_TABLE_NAME = 'comment_likes' then
     -- Notify the comment owner
     select user_id, track_id into comment_owner_id, recipient_id -- reusing recipient_id as track_id var here is a bit messy, let's grab track_id just for context if needed
     from public.comments where id = new.comment_id;
     
     -- Actually we need track_id to link deep link
     select track_id into recipient_id from public.comments where id = new.comment_id;

     if comment_owner_id is not null and comment_owner_id != new.user_id then
       insert into public.notifications (user_id, type, origin_user_id, track_id)
       values (comment_owner_id, 'like_comment', new.user_id, recipient_id);
     end if;

  end if;
  return new;
end;
$$;

-- Add trigger for comment_likes
drop trigger if exists on_comment_like_created on public.comment_likes;
create trigger on_comment_like_created
  after insert on public.comment_likes
  for each row execute procedure public.handle_new_interaction();

