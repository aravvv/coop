import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FeedItem from '../../components/FeedItem';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function SingleTrackScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const [thread, setThread] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchThread();
    }, [id]);

    const fetchThread = async () => {
        setLoading(true);
        try {
            // 1. Fetch MAIN track
            const { data: mainTrack, error } = await supabase
                .from('tracks')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error("Error fetching main track:", error);
                throw error;
            }

            if (!mainTrack) {
                console.error("No track found with id:", id);
                return;
            }

            // 2. Fetch User Profile for Main Track
            const { data: mainProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', mainTrack.user_id)
                .single();

            // 3. Fetch Parent (if exists)
            let parentTrack = null;
            if (mainTrack.parent_track_id) {
                const { data: pTrack } = await supabase
                    .from('tracks')
                    .select('*')
                    .eq('id', mainTrack.parent_track_id)
                    .single();
                if (pTrack) {
                    const { data: pProfile } = await supabase.from('profiles').select('username, avatar_url').eq('id', pTrack.user_id).single();
                    parentTrack = {
                        ...pTrack,
                        user: pProfile?.username || 'Unknown',
                        avatar_url: pProfile?.avatar_url,
                        isParent: true
                    };
                }
            }

            // 4. Fetch Children (Remixes)
            const { data: children } = await supabase
                .from('tracks')
                .select('*')
                .eq('parent_track_id', id);

            let childrenWithProfiles: any[] = [];
            if (children && children.length > 0) {
                const userIds = [...new Set(children.map((c: any) => c.user_id))];
                const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
                childrenWithProfiles = children.map((c: any) => ({
                    ...c,
                    user: profiles?.find((p: any) => p.id === c.user_id)?.username || 'Unknown',
                    avatar_url: profiles?.find((p: any) => p.id === c.user_id)?.avatar_url,
                    isChild: true
                }));
            }

            // Format Main Track
            const formattedMain = {
                ...mainTrack,
                user: mainProfile?.username || 'Unknown',
                avatar_url: mainProfile?.avatar_url,
                isMain: true
            };

            // Combine for Linear Thread View: [Parent?, Main, ...Children]
            const fullThread = [];
            if (parentTrack) fullThread.push(parentTrack);
            fullThread.push(formattedMain);
            if (childrenWithProfiles) fullThread.push(...childrenWithProfiles);

            setThread(fullThread);

        } catch (error) {
            console.error("Error in fetchThread:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Version History</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={thread}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    renderItem={({ item }) => (
                        <View style={[
                            styles.threadItem,
                            item.isMain && styles.mainTrackContainer,
                            item.isParent && styles.parentTrackContainer
                        ]}>
                            {item.isParent && <Text style={styles.relationLabel}>Original Wave</Text>}
                            {item.isMain && item.parent_track_id && <Text style={styles.relationLabel}>Current Version</Text>}
                            {item.isChild && <Text style={styles.relationLabel}>Remix</Text>}

                            <FeedItem
                                post={item}
                                isVisible={true}
                                variant="standard"
                            />
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backBtn: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    threadItem: {
        marginBottom: 24,
    },
    mainTrackContainer: {
        transform: [{ scale: 1.0 }],
        borderColor: '#6366F1',
        borderWidth: 1,
        borderRadius: 24,
        padding: 4,
    },
    parentTrackContainer: {
        opacity: 0.8,
        transform: [{ scale: 0.95 }],
    },
    relationLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 12,
        textTransform: 'uppercase',
    }
});
