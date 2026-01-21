/*
  ENABLE REALTIME SUBSCRIPTIONS
  =============================
  Run this script in the Supabase SQL Editor to enable real-time updates.
*/

-- 1. Enable replication for the 'likes' table (for FeedItem like counts)
alter publication supabase_realtime add table public.likes;

-- 2. Enable replication for the 'comments' table (for CommentsModal live chat)
alter publication supabase_realtime add table public.comments;

-- 3. Enable replication for the 'comment_likes' table (for live comment liking)
alter publication supabase_realtime add table public.comment_likes;

-- Note: 'tracks' and 'profiles' can also be added if we want live feed updates,
-- but for now we focus on social interactions.
