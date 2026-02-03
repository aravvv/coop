import { supabase } from '@/lib/supabase';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FileText, GitBranch, Heart, MessageCircle, MoreVertical, Pause, Play } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CommentsModal from './CommentsModal';
import EditTrackModal from './EditTrackModal';
import OptionsModal from './OptionsModal';

type FeedItemProps = {
    post: any;
    variant?: 'immersive' | 'standard';
    isVisible?: boolean;
    onLike?: (liked: boolean) => void;
    onComment?: () => void;
    onRemix?: () => void;
    onDelete?: () => void;
    currentUser?: any;
};

export default function FeedItem({
    post,
    variant = 'standard',
    isVisible = true,
    onLike,
    onComment,
    onRemix,
    onDelete,
    currentUser
}: FeedItemProps) {
    // All state hooks at component level
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [liked, setLiked] = useState(post.isLiked || false);
    const [likeCount, setLikeCount] = useState(post.likes || 0);
    const [showComments, setShowComments] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [showRemixes, setShowRemixes] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showAllRemixes, setShowAllRemixes] = useState(false);

    // Realtime Likes Subscription
    useEffect(() => {
        if (!isVisible || !post.id) return;

        const channel = supabase
            .channel(`likes:${post.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'likes',
                    filter: `track_id=eq.${post.id}`,
                },
                (payload: any) => {
                    // Ignore our own actions (handled locally)
                    const userId = payload.new?.user_id || payload.old?.user_id;
                    if (currentUser && userId === currentUser.id) return;

                    if (payload.eventType === 'INSERT') {
                        setLikeCount((prev: number) => prev + 1);
                    } else if (payload.eventType === 'DELETE') {
                        setLikeCount((prev: number) => Math.max(0, prev - 1));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [post.id, isVisible, currentUser]);

    // Load sound when visible
    useEffect(() => {
        let soundObj: Audio.Sound | null = null;
        const loadSound = async () => {
            if (post.file_url && isVisible) {
                try {
                    setIsLoading(true);
                    if (sound) await sound.unloadAsync();
                    const { sound: newSound } = await Audio.Sound.createAsync(
                        { uri: post.file_url },
                        { shouldPlay: false }
                    );

                    // Set up status updates to track playback state
                    newSound.setOnPlaybackStatusUpdate((status) => {
                        if (status.isLoaded) {
                            setIsPlaying(status.isPlaying);
                        }
                    });

                    soundObj = newSound;
                    setSound(newSound);
                    setIsLoading(false);
                } catch (error) {
                    console.log('Error loading sound', error);
                    setIsLoading(false);
                }
            }
        };

        if (isVisible) {
            loadSound();
        } else {
            if (sound) {
                sound.unloadAsync();
                setSound(null);
                setIsPlaying(false);
            }
        }
        return () => {
            if (soundObj) {
                soundObj.unloadAsync();
            }
        };
    }, [isVisible, post.file_url]);

    const togglePlay = async () => {
        if (!sound || isLoading) return;

        try {
            // Check the current status of the sound
            const status = await sound.getStatusAsync();

            // Only proceed if sound is loaded
            if (!status.isLoaded) {
                console.log('Sound not loaded yet');
                return;
            }

            if (status.isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
        } catch (error) {
            console.error('Error toggling playback:', error);
        }
    };

    const handleLike = () => {
        const newLiked = !liked;
        setLiked(newLiked);
        setLikeCount(newLiked ? likeCount + 1 : likeCount - 1);
        onLike?.(newLiked);
    };

    const handleComment = () => {
        setShowComments(true);
        onComment?.();
    };

    const handleRemix = () => {
        router.push({
            pathname: '/(tabs)/upload',
            params: { parentTrackId: post.id }
        });
        onRemix?.();
    };

    const handleThread = () => {
        // TODO: Create thread route
        // router.push(`/thread/${post.id}`);
        Alert.alert('Thread View', 'Thread view coming soon!');
    };

    const handleMore = () => {
        setShowOptionsModal(true);
    };

    // Sync state with props change
    useEffect(() => {
        setLiked(post.isLiked || false);
        setLikeCount(post.likes || 0);
    }, [post.isLiked, post.likes]);

    // --- STANDARD VARIANT (Profile / Thread) ---
    if (variant === 'standard') {
        const topRemix = post.children && post.children.length > 0 ? post.children[0] : null;
        const remainingRemixCount = post.children ? post.children.length - 1 : 0;

        return (
            <View style={styles.cardContainer}>
                <CommentsModal
                    isVisible={showComments}
                    onClose={() => setShowComments(false)}
                    postId={post.id}
                />

                <EditTrackModal
                    visible={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    track={post}
                    onUpdate={() => {
                        // handled by parent refresh or subscriptions
                    }}
                />

                <OptionsModal
                    visible={showOptionsModal}
                    onClose={() => setShowOptionsModal(false)}
                    isOwner={currentUser?.id === post.user_id}
                    onEdit={() => setShowEditModal(true)}
                    onDelete={() => onDelete?.()}
                    onShare={() => Alert.alert('Share', 'Sharing coming soon!')}
                />

                <View style={styles.cardMain}>
                    {/* Left: Info */}
                    <View style={styles.cardInfo}>
                        <Text style={styles.cardUser}>@{post.user}</Text>
                        <Text style={styles.cardTitle}>{post.title}</Text>
                        {post.description && (
                            <Text style={styles.cardDesc} numberOfLines={2}>{post.description}</Text>
                        )}

                        {/* Waveform with Play Button */}
                        <View style={styles.waveformSection}>
                            <TouchableOpacity style={styles.waveformPlayBtn} onPress={togglePlay}>
                                {isPlaying ? (
                                    <Pause size={20} color="white" fill="white" />
                                ) : (
                                    <Play size={20} color="white" fill="white" />
                                )}
                            </TouchableOpacity>
                            <View style={styles.waveformBars}>
                                {[0.3, 0.7, 0.5, 0.9, 0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.6, 0.9, 0.4, 0.7, 0.5, 0.8, 0.6, 0.4, 0.9, 0.5, 0.7, 0.3, 0.8, 0.6, 0.5, 0.9, 0.4, 0.7, 0.5, 0.6].map((height, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.waveformBar,
                                            {
                                                height: `${height * 100}%`,
                                                backgroundColor: i < 12 ? '#4F46E5' : '#E5E7EB'
                                            }
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {/* Remix Preview */}
                        {topRemix && (
                            <View style={styles.remixPreview}>
                                <Text style={styles.remixPreviewTitle}>Top Remix:</Text>
                                <View style={styles.remixPreviewItem}>
                                    <Image
                                        source={{ uri: topRemix.cover_art_url || 'https://via.placeholder.com/40' }}
                                        style={styles.remixPreviewThumb}
                                    />
                                    <View style={styles.remixPreviewInfo}>
                                        <Text style={styles.remixPreviewName} numberOfLines={1}>{topRemix.title}</Text>
                                        <Text style={styles.remixPreviewAuthor} numberOfLines={1}>
                                            by {topRemix.profiles?.username || 'Unknown'}
                                        </Text>
                                    </View>
                                </View>
                                {remainingRemixCount > 0 && !showAllRemixes && (
                                    <TouchableOpacity onPress={() => setShowAllRemixes(true)}>
                                        <Text style={styles.showMoreBtn}>
                                            Show {remainingRemixCount} more remix{remainingRemixCount > 1 ? 'es' : ''}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {showAllRemixes && post.children && (
                                    <View style={styles.allRemixesList}>
                                        {post.children.slice(1).map((remix: any) => (
                                            <View key={remix.id} style={styles.remixPreviewItem}>
                                                <Image
                                                    source={{ uri: remix.cover_art_url || 'https://via.placeholder.com/40' }}
                                                    style={styles.remixPreviewThumb}
                                                />
                                                <View style={styles.remixPreviewInfo}>
                                                    <Text style={styles.remixPreviewName} numberOfLines={1}>{remix.title}</Text>
                                                    <Text style={styles.remixPreviewAuthor} numberOfLines={1}>
                                                        by {remix.profiles?.username || 'Unknown'}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Right: Cover Art */}
                    <Image
                        source={{ uri: post.cover_art_url || 'https://via.placeholder.com/150' }}
                        style={styles.cardCover}
                    />
                </View>

                {/* Actions Row */}
                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
                        <Heart size={20} color={liked ? '#F43F5E' : '#666'} fill={liked ? '#F43F5E' : 'transparent'} />
                        <Text style={styles.actionText}>{likeCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={handleComment}>
                        <MessageCircle size={20} color="#666" />
                        <Text style={styles.actionText}>{post.comments || 0}</Text>
                    </TouchableOpacity>


                    <TouchableOpacity style={styles.actionItem} onPress={handleRemix}>
                        <GitBranch size={20} color="#666" />
                        <Text style={styles.actionText}>{post.remixCount || 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionItem} onPress={handleMore}>
                        <MoreVertical size={20} color="#666" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // --- IMMERSIVE VARIANT (Home Feed) ---
    return (
        <View style={styles.container}>
            <CommentsModal
                isVisible={showComments}
                onClose={() => setShowComments(false)}
                postId={post.id}
            />

            <EditTrackModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                track={post}
                onUpdate={() => { }}
            />

            <OptionsModal
                visible={showOptionsModal}
                onClose={() => setShowOptionsModal(false)}
                isOwner={currentUser?.id === post.user_id}
                onEdit={() => setShowEditModal(true)}
                onDelete={() => onDelete?.()}
                onShare={() => Alert.alert('Share', 'Sharing coming soon!')}
            />

            {/* Lyrics Modal */}
            <Modal visible={showLyrics} animationType="slide" transparent>
                <TouchableOpacity
                    style={styles.lyricsModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowLyrics(false)}
                >
                    <View style={styles.lyricsModal}>
                        <View style={styles.lyricsHeader}>
                            <Text style={styles.lyricsTitle}>Lyrics</Text>
                            <TouchableOpacity onPress={() => setShowLyrics(false)}>
                                <Text style={styles.lyricsClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.lyricsContent}>
                            <Text style={styles.lyricsText}>{post.lyrics || 'No lyrics available'}</Text>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Cover Art / Background */}
            <View style={styles.coverContainer}>
                {post.cover_art_url ? (
                    <Image source={{ uri: post.cover_art_url }} style={styles.coverArt} resizeMode="cover" />
                ) : (
                    <View style={[styles.coverPlaceholder, { backgroundColor: '#4F46E5' }]}>
                        <Text style={styles.placeholderText}>WAVE</Text>
                    </View>
                )}
                <TouchableOpacity style={styles.playOverlay} onPress={togglePlay}>
                    <View style={styles.playButton}>
                        {isPlaying ? (
                            <Pause size={48} color="white" fill="white" />
                        ) : (
                            <Play size={48} color="white" fill="white" />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Remix Expansion Section */}
            {showRemixes && post.children && post.children.length > 0 && (
                <View style={styles.remixSection}>
                    <Text style={styles.remixSectionTitle}>REMIXES ({post.children.length})</Text>
                    <ScrollView style={styles.remixScroll} showsVerticalScrollIndicator={false}>
                        {post.children.map((remix: any) => (
                            <TouchableOpacity
                                key={remix.id}
                                style={styles.remixItem}
                                onPress={() => router.push(`/track/${remix.id}`)}
                            >
                                <Image
                                    source={{ uri: remix.cover_art_url || 'https://via.placeholder.com/60' }}
                                    style={styles.remixThumb}
                                />
                                <View style={styles.remixInfo}>
                                    <Text style={styles.remixTitle} numberOfLines={1}>{remix.title}</Text>
                                    <Text style={styles.remixAuthor} numberOfLines={1}>by {remix.profiles?.username || 'Unknown'}</Text>
                                    {remix.description && (
                                        <Text style={styles.remixCaption} numberOfLines={2}>{remix.description}</Text>
                                    )}
                                </View>
                                <GitBranch size={18} color="#60A5FA" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity
                        style={styles.remixCloseBtn}
                        onPress={() => setShowRemixes(false)}
                    >
                        <Text style={styles.remixCloseText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Immersive Footer */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
                style={styles.footer}
            >
                <View style={styles.userInfo}>
                    {post.parentTrack && (
                        <TouchableOpacity
                            style={styles.remixLabelContainer}
                            onPress={() => router.push(`/track/${post.parent_track_id}`)}
                        >
                            <GitBranch size={14} color="#60A5FA" />
                            <Text style={styles.remixLabelText}>
                                Remixed from {post.parentTrack.title} • @{post.parentTrack.author_username}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.username}>@{post.user}</Text>
                    <Text style={styles.title}>{post.title}</Text>
                    {post.description && <Text style={styles.description} numberOfLines={2}>{post.description}</Text>}
                </View>

                {/* Horizontal Action Bar - Matching JamWave exactly */}
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                        <Heart size={28} color={liked ? '#F43F5E' : 'white'} fill={liked ? '#F43F5E' : 'transparent'} />
                        <Text style={styles.actionBtnLabel}>{likeCount}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={handleComment}>
                        <MessageCircle size={28} color="white" />
                        <Text style={styles.actionBtnLabel}>{post.comments || 0}</Text>
                    </TouchableOpacity>

                    {post.lyrics && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowLyrics(true)}>
                            <FileText size={28} color={showLyrics ? '#fbbf24' : 'white'} />
                            <Text style={styles.actionBtnLabel}>Lyrics</Text>
                        </TouchableOpacity>
                    )}


                    <TouchableOpacity style={styles.actionBtn} onPress={() => setShowRemixes(!showRemixes)}>
                        <View style={{ transform: [{ rotate: '90deg' }] }}>
                            <MoreVertical size={28} color={showRemixes ? '#60A5FA' : 'white'} />
                        </View>
                        <Text style={styles.actionBtnLabel}>Remixes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={handleRemix}>
                        <GitBranch size={28} color="white" />
                        <Text style={styles.actionBtnLabel}>Remix</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={handleMore}>
                        <MoreVertical size={28} color="white" />
                        <Text style={styles.actionBtnLabel}>Options</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    // Shared
    container: {
        flex: 1,
        backgroundColor: 'black',
    },

    // Standard Card Styles
    cardContainer: {
        backgroundColor: 'white',
        borderRadius: 24,
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardMain: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    cardInfo: {
        flex: 1,
        marginRight: 16,
    },
    cardUser: {
        fontWeight: '600',
        color: '#4F46E5',
        marginBottom: 4,
    },
    cardTitle: {
        fontWeight: 'bold',
        color: '#1F2937',
        fontSize: 18,
        marginBottom: 8,
    },
    cardDesc: {
        color: '#6B7280',
        fontSize: 14,
        marginBottom: 12,
    },
    waveformSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        height: 48,
    },
    waveformPlayBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    waveformBars: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: '100%',
    },
    waveformBar: {
        flex: 1,
        borderRadius: 2,
        minWidth: 2,
    },
    remixPreview: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
    },
    remixPreviewTitle: {
        fontWeight: '600',
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    remixPreviewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    remixPreviewThumb: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 10,
    },
    remixPreviewInfo: {
        flex: 1,
    },
    remixPreviewName: {
        fontWeight: '600',
        fontSize: 14,
        color: '#1F2937',
    },
    remixPreviewAuthor: {
        fontSize: 12,
        color: '#6B7280',
    },
    showMoreBtn: {
        color: '#4F46E5',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    allRemixesList: {
        marginTop: 8,
    },
    cardCover: {
        width: 120,
        height: 120,
        borderRadius: 16,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionItem: {
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
    },

    // Immersive Styles
    coverContainer: {
        flex: 1,
        width: '100%',
    },
    coverArt: {
        flex: 1,
        width: '100%',
    },
    coverPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: 'white',
        opacity: 0.5,
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 40,
    },
    userInfo: {
        marginBottom: 16,
    },
    remixLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(96, 165, 250, 0.2)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 8,
        gap: 6,
    },
    remixLabelText: {
        color: '#60A5FA',
        fontSize: 12,
        fontWeight: '600',
    },
    username: {
        fontWeight: '600',
        color: 'white',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 4,
    },
    description: {
        color: 'white',
        fontSize: 14,
        marginTop: 8,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 40,
        paddingTop: 16,
    },
    actionBtn: {
        alignItems: 'center',
        gap: 4,
    },
    actionBtnLabel: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },

    // Lyrics Modal
    lyricsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    lyricsModal: {
        backgroundColor: 'white',
        maxHeight: '70%',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    lyricsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    lyricsTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    lyricsClose: {
        fontSize: 24,
        color: '#6B7280',
    },
    lyricsContent: {
        maxHeight: 400,
    },
    lyricsText: {
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'monospace',
        fontStyle: 'italic',
    },

    // Remix Section
    remixSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.95)',
        maxHeight: '60%',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#374151',
    },
    remixSectionTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 12,
        letterSpacing: 1,
        textAlign: 'center',
    },
    remixScroll: {
        maxHeight: 300,
    },
    remixItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginBottom: 10,
    },
    remixThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#374151',
    },
    remixInfo: {
        flex: 1,
    },
    remixTitle: {
        fontWeight: '600',
        color: 'white',
        fontSize: 16,
    },
    remixAuthor: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    remixCaption: {
        color: '#6B7280',
        fontSize: 12,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    remixCloseBtn: {
        paddingVertical: 12,
        backgroundColor: '#4F46E5',
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
    },
    remixCloseText: {
        fontWeight: '600',
        fontSize: 16,
        color: 'white',
    },
});
