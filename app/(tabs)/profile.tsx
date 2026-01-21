import FeedItem from '@/components/FeedItem';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { LogOut, Settings, Share2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const [userTracks, setUserTracks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchUserTracks();
            }
        }, [user])
    );

    const fetchUserTracks = async () => {
        try {
            if (!user) return;
            // 1. Fetch RAW Tracks for this user
            const { data: tracks, error: tracksError } = await supabase
                .from('tracks')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (tracksError) throw tracksError;

            if (!tracks || tracks.length === 0) {
                setUserTracks([]);
                setLoading(false);
                return;
            }

            const trackIds = tracks.map((t: any) => t.id);

            // 2. Fetch Interactions (Likes, Comments)
            // Fetch ALL likes for counts (approx)
            const { data: allLikes } = await supabase.from('likes').select('track_id').in('track_id', trackIds);

            // Fetch MY likes for status
            let myLikedTrackIds = new Set();
            if (user) {
                const { data: myLikes } = await supabase
                    .from('likes')
                    .select('track_id')
                    .eq('user_id', user.id)
                    .in('track_id', trackIds);
                if (myLikes) {
                    myLikedTrackIds = new Set(myLikes.map(l => l.track_id));
                }
            }

            const { data: allComments } = await supabase.from('comments').select('track_id').in('track_id', trackIds);

            // 3. Fetch Children (Remixes) and their Authors
            const { data: allChildren } = await supabase.from('tracks').select('*').in('parent_track_id', trackIds);

            let childProfiles: any[] = [];
            if (allChildren && allChildren.length > 0) {
                const childUserIds = [...new Set(allChildren.map((c: any) => c.user_id))];
                const { data: cProfiles } = await supabase.from('profiles').select('id, username').in('id', childUserIds);
                childProfiles = cProfiles || [];
            }

            // 3b. Fetch Parents (for my remixes)
            const parentTrackIds = tracks.filter((t: any) => t.parent_track_id).map((t: any) => t.parent_track_id);
            let parentTracks: any[] = [];
            if (parentTrackIds.length > 0) {
                const { data: parents } = await supabase.from('tracks').select('id, title').in('id', parentTrackIds);
                parentTracks = parents || [];
            }

            // 4. Merge
            const formattedData = tracks.map((track: any) => {
                const trackLikesCount = allLikes?.filter((l: any) => l.track_id === track.id).length || 0;
                const trackComments = allComments?.filter((c: any) => c.track_id === track.id) || [];
                const trackChildren = allChildren?.filter((c: any) => c.parent_track_id === track.id) || [];

                const trackParent = track.parent_track_id
                    ? parentTracks.find((p: any) => p.id === track.parent_track_id)
                    : null;

                const displayName = user.user_metadata?.username || user.email?.split('@')[0];

                return {
                    id: track.id,
                    user_id: track.user_id,
                    user: displayName,
                    avatar_url: user.user_metadata?.avatar_url,
                    title: track.title,
                    description: track.description,
                    lyrics: track.lyrics,
                    file_url: track.file_url,
                    cover_art_url: track.cover_art_url,
                    likes: trackLikesCount,
                    isLiked: myLikedTrackIds.has(track.id),
                    comments: trackComments.length,
                    remixCount: trackChildren.length,
                    parentTrack: trackParent,
                    children: trackChildren.map((child: any) => ({
                        ...child,
                        profiles: childProfiles.find((p: any) => p.id === child.user_id) || { username: 'Remixer' }
                    })),
                    is_remix: track.is_remix || !!track.parent_track_id
                };
            });

            setUserTracks(formattedData);
        } catch (error) {
            console.error("Error loading profile tracks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            router.replace('/auth/login');
        } catch (error: any) {
            Alert.alert('Error', error.message || "Failed to sign out");
            console.error("Error signing out:", error);
        }
    };

    const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
    const role = user?.user_metadata?.role || 'Artist';

    // Filter Logic
    const originalTracks = userTracks.filter((t: any) => !t.is_remix && !t.parentTrack);
    const collaborations = userTracks.filter((t: any) => t.is_remix || t.parentTrack);

    const filteredTracks = activeTab === 0 ? originalTracks : collaborations;

    const renderHeader = () => (
        <View style={styles.profileContainer}>
            <View style={styles.header}>
                <Text style={styles.username}>@{displayName.toLowerCase().replace(/\s/g, '')}</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconBtn}><Share2 size={24} color="white" /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Settings size={24} color="white" /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={handleLogout}><LogOut size={24} color="#EF4444" /></TouchableOpacity>
                </View>
            </View>

            <View style={styles.profileCard}>
                <View style={styles.profileMain}>
                    <View style={styles.avatarLarge}>
                        {user?.user_metadata?.avatar_url ? (
                            <Image source={{ uri: user.user_metadata.avatar_url }} style={{ width: '100%', height: '100%' }} />
                        ) : null}
                    </View>
                    <View style={styles.statsGroup}>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>0</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{userTracks.length}</Text>
                            <Text style={styles.statLabel}>Tracks</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>0</Text>
                            <Text style={styles.statLabel}>Plays</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.realName}>{displayName}</Text>
                <Text style={styles.bio}>{user?.email}</Text>

                <View style={styles.tags}>
                    {/* Role Badge matching Web */}
                    <View style={[styles.roleBadge, role === 'Producer' ? styles.badgeProducer : styles.badgeArtist]}>
                        <Text style={[styles.roleText, role === 'Producer' ? styles.textProducer : styles.textArtist]}>{role.toUpperCase()}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.editBtn}>
                    <Text style={styles.editBtnText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 0 && styles.activeTab]} onPress={() => setActiveTab(0)}>
                    <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>My Waves</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, activeTab === 1 && styles.activeTab]} onPress={() => setActiveTab(1)}>
                    <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>Collaborations</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const handleDeleteTrack = async (trackId: string) => {
        try {
            const { error } = await supabase
                .from('tracks')
                .delete()
                .eq('id', trackId);

            if (error) throw error;
            Alert.alert('Success', 'Track deleted successfully');
            fetchUserTracks(); // Refresh data
        } catch (error: any) {
            Alert.alert('Error', error.message || "Failed to delete track");
        }
    };

    const handleToggleLike = async (trackId: string) => {
        try {
            if (!user) return;

            // Find current post to get its state
            const track = userTracks.find(t => t.id === trackId);
            if (!track) return;

            const wasLiked = track.isLiked;

            // 1. Optimistic Update
            setUserTracks(current => current.map(t => {
                if (t.id === trackId) {
                    return {
                        ...t,
                        isLiked: !wasLiked,
                        likes: wasLiked ? t.likes - 1 : t.likes + 1
                    }
                }
                return t;
            }));

            // 2. DB Interaction
            if (wasLiked) {
                const { error } = await supabase.from('likes').delete().eq('track_id', trackId).eq('user_id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('likes').insert({ track_id: trackId, user_id: user.id });
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert if needed
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    return (
        <FlatList
            data={filteredTracks}
            renderItem={({ item }) => (
                <View style={{ marginBottom: 20 }}>
                    <FeedItem
                        post={item}
                        isVisible={true}
                        variant="standard"
                        currentUser={user}
                        onDelete={() => handleDeleteTrack(item.id)}
                        onLike={() => handleToggleLike(item.id)}
                    />
                </View>
            )}
            keyExtractor={(item: any) => item.id.toString()}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No tracks found</Text>
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
        paddingTop: 50,
    },
    profileContainer: {
        backgroundColor: '#0F172A', // var(--color-bg)
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24, // .profile-header padding
        marginBottom: 24,
    },
    username: {
        fontSize: 17.6, // 1.1rem approx
        fontWeight: '800',
        color: 'white',
    },
    headerIcons: {
        flexDirection: 'row',
    },
    iconBtn: {
        marginLeft: 16, // gap: 16px
    },
    profileCard: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    profileMain: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarLarge: {
        width: 80, // .profile-avatar-lg
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F472B6', // background: #F472B6
        borderWidth: 4,
        borderColor: 'white', // border: 4px solid white
        marginRight: 24, // gap: 24px
        overflow: 'hidden',
        // boxShadow equivalent in React Native
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        elevation: 2,
    },
    statsGroup: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statVal: {
        color: 'white',
        fontSize: 17.6, // 1.1rem
        fontWeight: '800',
    },
    statLabel: {
        color: '#94A3B8', // var(--color-text-muted)
        fontSize: 12, // 0.75rem
    },
    realName: {
        color: 'white',
        fontSize: 20, // 1.25rem
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bio: {
        color: '#94A3B8', // var(--color-text-muted)
        fontSize: 14.4, // 0.9rem
        marginBottom: 12,
    },
    tags: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 8,
    },
    roleBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        // Default styling for Artist
        backgroundColor: 'rgba(244, 114, 182, 0.1)', // #FFE4E6 approximation
    },
    badgeArtist: {
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
    },
    badgeProducer: {
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
    },
    roleText: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    textArtist: {
        color: '#F43F5E',
    },
    textProducer: {
        color: '#38BDF8',
    },
    editBtn: {
        borderWidth: 1,
        borderColor: '#334155', // var(--color-border)
        borderRadius: 8, // var(--radius-md)
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    editBtnText: {
        color: 'white',
        fontWeight: '700',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        marginBottom: 0,
        backgroundColor: '#0F172A',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: 'white', // var(--color-text-main)
    },
    tabText: {
        color: '#94A3B8',
        fontWeight: '700',
    },
    activeTabText: {
        color: '#6366F1',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyStateText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
});
