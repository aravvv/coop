
import FeedItem from '@/components/FeedItem';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, RefreshControl, StyleSheet, View, ViewToken } from 'react-native';

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewableItems, setViewableItems] = useState<ViewToken[]>([]);
  // Use a safer initial height (window - approximate nav bar height) to avoid content being hidden
  const [feedHeight, setFeedHeight] = useState(Dimensions.get('window').height - 110);

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

      // 4. Fetch Stats
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

      // 5. Fetch Children
      const { data: allChildren } = await supabase
        .from('tracks')
        .select('id, parent_track_id, title, user_id, cover_art_url')
        .in('parent_track_id', trackIds);

      // 6. Fetch Parent Details
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
        const trackLikesCount = allLikes?.filter((l: any) => l.track_id === track.id).length || 0;
        const trackComments = allComments?.filter((c: any) => c.track_id === track.id) || [];
        const trackChildren = allChildren?.filter((c: any) => c.parent_track_id === track.id) || [];

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
          parentTrack: parentInfo,
        };
      });

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

  const handleDeleteTrack = async (trackId: string) => {
    try {
      const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId);

      if (error) throw error;
      setPosts(currentPosts => currentPosts.filter(p => p.id !== trackId));
      Alert.alert('Success', 'Track deleted successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || "Failed to delete track");
    }
  };

  const handleToggleLike = async (trackId: string) => {
    try {
      if (!user) return;
      const post = posts.find(p => p.id === trackId);
      if (!post) return;
      const wasLiked = post.isLiked;

      setPosts(current => current.map(p => {
        if (p.id === trackId) {
          return {
            ...p,
            isLiked: !wasLiked,
            likes: wasLiked ? p.likes - 1 : p.likes + 1
          }
        }
        return p;
      }));

      if (wasLiked) {
        const { error } = await supabase.from('likes').delete().eq('track_id', trackId).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').insert({ track_id: trackId, user_id: user.id });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isVisible = viewableItems.some(v => v.item.id === item.id && v.isViewable);
    return (
      <View style={{ height: feedHeight }}>
        <FeedItem
          post={item}
          isVisible={isVisible}
          variant="immersive"
          currentUser={user}
          onDelete={() => handleDeleteTrack(item.id)}
          onLike={() => handleToggleLike(item.id)}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        // Only set if different to avoid potential loops, though React handles basic equality
        if (height > 0 && Math.abs(height - feedHeight) > 1) {
          console.log('Update feed height', height);
          setFeedHeight(height);
        }
      }}
    >
      <FlatList
        key={feedHeight} // Force re-render when height changes to ensure snapToInterval works
        data={posts}
        renderItem={renderItem}
        contentContainerStyle={{ minHeight: feedHeight }}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={feedHeight}
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
