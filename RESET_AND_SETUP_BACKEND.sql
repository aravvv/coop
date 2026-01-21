/*
  COOP BACKEND - COMPLETE RESET & SETUP
  =====================================
  Run this script in the Supabase SQL Editor.
  
  WARNING: THIS WILL DELETE ALL DATA IN YOUR PUBLIC TABLES.
  (It does not delete Auth Users - you must delete those manually in the Auth Dashboard if you want to reuse emails).
*/

-- ==========================================
-- 1. CLEANUP (Drop Everything)
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_interaction() CASCADE;

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.tracks CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;


-- ==========================================
-- 2. SETUP TABLES
-- ==========================================

-- PROFILES (Relaxed constraints for smooth signup)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  username text, -- Can be duplicates initially if needed, logic handles it
  role text,     -- No CHECK constraint, allows 'singer', 'musician', 'Fan', etc.
  avatar_url text DEFAULT '',
  bio text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- TRACKS
CREATE TABLE public.tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  title text NOT NULL,
  description text,
  lyrics text,
  genre text,
  file_url text NOT NULL,
  cover_art_url text,
  duration float,
  bpm integer,
  is_remix boolean DEFAULT false,
  parent_track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

-- LIKES
CREATE TABLE public.likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, track_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- COMMENTS
CREATE TABLE public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'remix')),
  origin_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- 3. AUTOMATION (Triggers)
-- ==========================================

-- Robust Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Attempt to insert using metadata
  BEGIN
    INSERT INTO public.profiles (id, username, role, avatar_url)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
      COALESCE(new.raw_user_meta_data ->> 'role', 'Fan'),
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback safety net
    INSERT INTO public.profiles (id, username, role, avatar_url)
    VALUES (new.id, 'user_' || substr(new.id::text, 1, 8), 'Fan', '');
  END;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Notification Trigger
CREATE OR REPLACE FUNCTION public.handle_new_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recipient_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'likes' THEN
     SELECT user_id INTO recipient_id FROM public.tracks WHERE id = new.track_id;
     IF recipient_id IS NOT NULL AND recipient_id != new.user_id THEN
       INSERT INTO public.notifications (user_id, type, origin_user_id, track_id)
       VALUES (recipient_id, 'like', new.user_id, new.track_id);
     END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
     SELECT user_id INTO recipient_id FROM public.tracks WHERE id = new.track_id;
     IF recipient_id IS NOT NULL AND recipient_id != new.user_id THEN
       INSERT INTO public.notifications (user_id, type, origin_user_id, track_id)
       VALUES (recipient_id, 'comment', new.user_id, new.track_id);
     END IF;
  ELSIF TG_TABLE_NAME = 'tracks' AND new.parent_track_id IS NOT NULL THEN
     SELECT user_id INTO recipient_id FROM public.tracks WHERE id = new.parent_track_id;
     IF recipient_id IS NOT NULL AND recipient_id != new.user_id THEN
       INSERT INTO public.notifications (user_id, type, origin_user_id, track_id)
       VALUES (recipient_id, 'remix', new.user_id, new.id); 
     END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER on_like_created AFTER INSERT ON public.likes FOR EACH ROW EXECUTE PROCEDURE public.handle_new_interaction();
CREATE TRIGGER on_comment_created AFTER INSERT ON public.comments FOR EACH ROW EXECUTE PROCEDURE public.handle_new_interaction();
CREATE TRIGGER on_remix_created AFTER INSERT ON public.tracks FOR EACH ROW EXECUTE PROCEDURE public.handle_new_interaction();


-- ==========================================
-- 4. SECURITY POLICIES (RLS)
-- ==========================================

-- Profiles
CREATE POLICY "Public profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tracks
CREATE POLICY "Public tracks" ON tracks FOR SELECT USING (true);
CREATE POLICY "Users insert tracks" ON tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update tracks" ON tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete tracks" ON tracks FOR DELETE USING (auth.uid() = user_id);

-- Likes
CREATE POLICY "Public likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Users insert likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete likes" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE POLICY "Public comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Users insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- ==========================================
-- 5. STORAGE POLICIES
-- ==========================================
-- (Policies might exist, so we drop them first to be idempotent)

DROP POLICY IF EXISTS "Public Access Audio" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Audio" ON storage.objects;
CREATE POLICY "Public Access Audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio-files');
CREATE POLICY "Auth Upload Audio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio-files');

DROP POLICY IF EXISTS "Public Access Images" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Images" ON storage.objects;
CREATE POLICY "Public Access Images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Auth Upload Images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
