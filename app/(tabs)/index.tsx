import FeedItem from '@/components/FeedItem';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet, View, ViewToken } from 'react-native';

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewableItems, setViewableItems] = useState<ViewToken[]>([]);

  useEffect(() => {
    fetchTracks();
  }, [user]);

  const fetchTracks = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserId = currentUser?.id;

      // 1. Fetch ALL Tracks (Newest First)
      const { data: tracks, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tracksError) throw tracksError;

      if (!tracks || tracks.length === 0) {
        setPosts([]);
        return;
      }

      // 2. Extract IDs
      const userIds = [...new Set(tracks.map((t: any) => t.user_id))];
      const trackIds = tracks.map((t: any) => t.id);

      // Identify Parents needed (for remixes)
      const parentIds = tracks
        .filter((t: any) => t.parent_track_id)
        .map((t: any) => t.parent_track_id);

      // 3. Fetch Profiles (Authors)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, role, avatar_url')
        .in('id', userIds);

      // 4. Fetch Stats (Likes - Counts Only - Warning: Unscalable without aggregation, but cleaner than fetching all user_ids)
      // Actually, fetching all likes for counts is still heavy. Ideally we'd have a trigger updating a count column.
      // For now, to fix the "isLiked" bug, we strictly fetch the CURRENT USER'S likes separately.

      const { data: allLikes } = await supabase.from('likes').select('track_id').in('track_id', trackIds);

      let myLikedTrackIds = new Set();
      if (currentUserId) {
        const { data: myLikes } = await supabase
          .from('likes')
          .select('track_id')
          .eq('user_id', currentUserId)
          .in('track_id', trackIds);

        if (myLikes) {
          myLikedTrackIds = new Set(myLikes.map(l => l.track_id));
        }
      }

      const { data: allComments } = await supabase.from('comments').select('track_id').in('track_id', trackIds);

      // 5. Fetch Children (Remixes of these tracks - for counters/nesting)
      const { data: allChildren } = await supabase
        .from('tracks')
        .select('id, parent_track_id, title, user_id, cover_art_url')
        .in('parent_track_id', trackIds);

      // 6. Fetch Parent Details (For Attributions)
      let parentTracks: any[] = [];
      let parentProfiles: any[] = [];

      if (parentIds.length > 0) {
        const { data: pTracks } = await supabase
          .from('tracks')
          .select('id, title, user_id, cover_art_url')
          .in('id', parentIds);
        parentTracks = pTracks || [];

        const parentUserIds = [...new Set(parentTracks.map(p => p.user_id))];
        const { data: pProfiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', parentUserIds);
        parentProfiles = pProfiles || [];
      }

      // 7. Merge Data
      const formattedPosts = tracks.map((track: any) => {
        const author = profiles?.find((p: any) => p.id === track.user_id);

        // Count likes for this track from the big list (still subject to limit approx, but better than nothing)
        const trackLikesCount = allLikes?.filter((l: any) => l.track_id === track.id).length || 0;

        const trackComments = allComments?.filter((c: any) => c.track_id === track.id) || [];
        const trackChildren = allChildren?.filter((c: any) => c.parent_track_id === track.id) || [];

        // Resolve Parent Info
        let parentInfo = null;
        if (track.parent_track_id) {
          const pTrack = parentTracks.find(p => p.id === track.parent_track_id);
          if (pTrack) {
            const pAuthor = parentProfiles.find(p => p.id === pTrack.user_id);
            parentInfo = {
              ...pTrack,
              author_username: pAuthor?.username || 'Unknown'
            };
          }
        }

        return {
          id: track.id,
          user_id: track.user_id,
          user: author?.username || 'Unknown Artist',
          avatar_url: author?.avatar_url,
          avatarColor: '#4ADE80',
          title: track.title,
          description: track.description,
          cover_art_url: track.cover_art_url,
          file_url: track.file_url,
          lyrics: track.lyrics,
          likes: trackLikesCount,
          isLiked: myLikedTrackIds.has(track.id),
          comments: trackComments.length,
          remixCount: trackChildren.length,
          children: trackChildren,
          is_remix: !!track.parent_track_id,
          parent_track_id: track.parent_track_id,
          parentTrack: parentInfo, // Attach full parent object
        };
      });

      // Show EVERYTHING (Remixes and Originals)
      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching tracks:', error);
    } finally {
      if (!isRefreshing) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTracks(true);
  };

  const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setViewableItems(viewableItems);
  }).current;

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 80
  }).current;

  // Dynamic height for feed items (calculated on layout)
  const [feedHeight, setFeedHeight] = useState(0); // Kept for future safety, though currently unused in favor of Dimensions
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);

  // ... (keep fetchTracks etc)

  const renderItem = ({ item }: { item: any }) => {
    const isVisible = viewableItems.some(v => v.item.id === item.id && v.isViewable);
    const isFocused = currentPlayingId === item.id;

    return (
      <View style={{ height: Dimensions.get('window').height - 80 }}>
        <FeedItem
          post={item}
          isVisible={true}
          isFocused={isFocused}
          onPlay={() => setCurrentPlayingId(item.id)}
          variant="immersive"
          currentUser={user}
          onDelete={() => handleDeleteTrack(item.id)}
          onLike={() => handleToggleLike(item.id)}
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={Dimensions.get('window').height - 80}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
