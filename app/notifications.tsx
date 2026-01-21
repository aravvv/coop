import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Heart, MessageCircle, Music, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) {
            fetchNotifications();
            markAllRead();
        }
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    id,
                    type,
                    created_at,
                    is_read,
                    origin_user:origin_user_id (username, avatar_url),
                    track:track_id (id, title, cover_art_url)
                `)
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const markAllRead = async () => {
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user!.id)
            .eq('is_read', false);
    };

    const handleNotificationPress = (item: any) => {
        if (item.track) {
            router.push(`/track/${item.track.id}`);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <Heart size={20} color="#F43F5E" fill="#F43F5E" />;
            case 'comment': return <MessageCircle size={20} color="#3B82F6" fill="#3B82F6" />;
            case 'reply': return <MessageCircle size={20} color="#10B981" fill="#10B981" />; // Green for replies
            case 'like_comment': return <Heart size={20} color="#F59E0B" fill="#F59E0B" />; // Amber for comment likes
            case 'remix': return <Music size={20} color="#8B5CF6" />;
            default: return <Bell size={20} color="#9CA3AF" />;
        }
    };

    const getMessage = (item: any) => {
        const username = item.origin_user?.username || 'Someone';
        const trackTitle = item.track?.title || 'your track';

        switch (item.type) {
            case 'like': return <Text><Text style={styles.bold}>{username}</Text> liked your track <Text style={styles.bold}>{trackTitle}</Text></Text>;
            case 'comment': return <Text><Text style={styles.bold}>{username}</Text> commented on <Text style={styles.bold}>{trackTitle}</Text></Text>;
            case 'reply': return <Text><Text style={styles.bold}>{username}</Text> replied to your comment on <Text style={styles.bold}>{trackTitle}</Text></Text>;
            case 'like_comment': return <Text><Text style={styles.bold}>{username}</Text> liked your comment on <Text style={styles.bold}>{trackTitle}</Text></Text>;
            case 'remix': return <Text><Text style={styles.bold}>{username}</Text> remixed <Text style={styles.bold}>{trackTitle}</Text></Text>;
            default: return <Text>New interaction from {username}</Text>;
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator color="#6366F1" size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor="#6366F1" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Bell size={48} color="#334155" />
                        <Text style={styles.emptyStateText}>No notifications yet</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.item, !item.is_read && styles.unreadItem]} onPress={() => handleNotificationPress(item)}>
                        <View style={styles.avatarContainer}>
                            {item.origin_user?.avatar_url ? (
                                <Image source={{ uri: item.origin_user.avatar_url }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <User size={20} color="#CBD5E1" />
                                </View>
                            )}
                            <View style={styles.iconBadge}>
                                {getIcon(item.type)}
                            </View>
                        </View>
                        <View style={styles.content}>
                            <Text style={styles.message}>{getMessage(item)}</Text>
                            <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                        {item.track?.cover_art_url && (
                            <Image source={{ uri: item.track.cover_art_url }} style={styles.trackThumb} />
                        )}
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    item: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        alignItems: 'center',
    },
    unreadItem: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#0F172A',
        borderRadius: 12,
        padding: 2,
    },
    content: {
        flex: 1,
        marginRight: 12,
    },
    message: {
        color: '#E2E8F0',
        fontSize: 14,
        lineHeight: 20,
    },
    bold: {
        fontWeight: 'bold',
        color: 'white',
    },
    time: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 4,
    },
    trackThumb: {
        width: 40,
        height: 40,
        borderRadius: 8,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        marginTop: 40,
    },
    emptyStateText: {
        color: '#64748B',
        marginTop: 16,
        fontSize: 16,
    },
});
