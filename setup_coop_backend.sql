/*
  COOP BACKEND SETUP - MASTER SCRIPT
  ==================================
  Run this entire script in the Supabase SQL Editor for your NEW "Coop" project.
  It sets up:
  1. Tables (Profiles, Tracks, Likes, Comments, Notifications)
  2. RLS Policies (Security)
  3. Triggers (Auto-create profile, Auto-notify)
  4. Cascading Deletes (Fixing the "Foreign Key" bugs)
  5. Storage Policies
*/

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  role text check (role in ('Artist', 'Producer', 'Fan')),
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.profiles enable row level security;

-- 2. TRACKS
create table if not exists public.tracks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  description text,
  lyrics text,
  genre text,
  file_url text not null,
  cover_art_url text,
  duration float,
  bpm integer,
  is_remix boolean default false,
  parent_track_id uuid references public.tracks(id) on delete set null, -- FIX: Set null if parent deleted
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.tracks enable row level security;

-- 3. LIKES
create table if not exists public.likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  track_id uuid references public.tracks(id) on delete cascade not null, -- FIX: Cascade delete
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, track_id)
);
alter table public.likes enable row level security;

-- 4. COMMENTS
create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  track_id uuid references public.tracks(id) on delete cascade not null, -- FIX: Cascade delete
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.comments enable row level security;

-- 5. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null, -- Recipient
  type text not null check (type in ('like', 'comment', 'remix')),
  origin_user_id uuid references public.profiles(id) on delete cascade not null, -- Actor
  track_id uuid references public.tracks(id) on delete cascade, -- content (Cascade delete)
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.notifications enable row level security;


-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Profiles
create policy "Public profiles are viewable by everyone." on profiles for select using ( true );
create policy "Users can insert their own profile." on profiles for insert with check ( auth.uid() = id );
create policy "Users can update own profile." on profiles for update using ( auth.uid() = id );

-- Tracks
create policy "Tracks are viewable by everyone." on tracks for select using ( true );
create policy "Users can insert their own tracks." on tracks for insert with check ( auth.uid() = user_id );
create policy "Users can update own tracks." on tracks for update using ( auth.uid() = user_id );
create policy "Users can delete own tracks." on tracks for delete using ( auth.uid() = user_id );

-- Likes
create policy "Likes are viewable by everyone." on likes for select using ( true );
create policy "Users can insert likes." on likes for insert with check ( auth.uid() = user_id );
create policy "Users can delete own likes." on likes for delete using ( auth.uid() = user_id );

-- Comments
create policy "Comments are viewable by everyone." on comments for select using ( true );
create policy "Users can insert comments." on comments for insert with check ( auth.uid() = user_id );
create policy "Users can delete own comments." on comments for delete using ( auth.uid() = user_id );

-- Notifications
create policy "Users view their own notifications" on notifications for select using (auth.uid() = user_id);
create policy "System can insert notifications" on notifications for insert with check (true); -- Triggers need this


-- ==========================================
-- TRIGGERS & AUTOMATION
-- ==========================================

-- 1. Handle New User Signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, role, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'username', coalesce(new.raw_user_meta_data ->> 'role', 'Fan'), '');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Handle Notifications (Likes, Comments, Remixes)
create or replace function public.handle_new_interaction()
returns trigger language plpgsql security definer as $$
declare
  recipient_id uuid;
begin
  if TG_TABLE_NAME = 'likes' then
     select user_id into recipient_id from public.tracks where id = new.track_id;
     if recipient_id is not null and recipient_id != new.user_id then
       insert into public.notifications (user_id, type, origin_user_id, track_id)
       values (recipient_id, 'like', new.user_id, new.track_id);
     end if;
     
  elsif TG_TABLE_NAME = 'comments' then
     select user_id into recipient_id from public.tracks where id = new.track_id;
     if recipient_id is not null and recipient_id != new.user_id then
       insert into public.notifications (user_id, type, origin_user_id, track_id)
       values (recipient_id, 'comment', new.user_id, new.track_id);
     end if;

  elsif TG_TABLE_NAME = 'tracks' and new.parent_track_id is not null then
     select user_id into recipient_id from public.tracks where id = new.parent_track_id;
     if recipient_id is not null and recipient_id != new.user_id then
       insert into public.notifications (user_id, type, origin_user_id, track_id)
       values (recipient_id, 'remix', new.user_id, new.id); 
     end if;
  end if;
  return new;
end;
$$;

-- Attach Notification Triggers
drop trigger if exists on_like_created on public.likes;
create trigger on_like_created after insert on public.likes for each row execute procedure public.handle_new_interaction();

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created after insert on public.comments for each row execute procedure public.handle_new_interaction();

drop trigger if exists on_remix_created on public.tracks;
create trigger on_remix_created after insert on public.tracks for each row execute procedure public.handle_new_interaction();


-- ==========================================
-- STORAGE POLICIES
-- ==========================================
-- Note: You must MANUALLY create the buckets: 'audio-files', 'post-images', 'avatars' in the Supabase Dashboard.
-- Make sure to check "Public Bucket" for all of them.
-- Then run these policies:

-- Audio Files
create policy "Public Access Audio" on storage.objects for select using ( bucket_id = 'audio-files' );
create policy "Auth Upload Audio" on storage.objects for insert to authenticated with check ( bucket_id = 'audio-files' );

-- Post Images
create policy "Public Access Images" on storage.objects for select using ( bucket_id = 'post-images' );
create policy "Auth Upload Images" on storage.objects for insert to authenticated with check ( bucket_id = 'post-images' );

-- Avatars
create policy "Public Access Avatars" on storage.objects for select using ( bucket_id = 'avatars' );
create policy "Auth Upload Avatars" on storage.objects for insert to authenticated with check ( bucket_id = 'avatars' );
