import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Heart, Send, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Comment = {
    id: string;
    user_id: string;
    track_id: string;
    content: string;
    created_at: string;
    parent_id: string | null;
    profiles: { username: string; avatar_url?: string } | null;
    likes_count: number;
    user_has_liked: boolean;
    replies: Comment[];
};

type CommentsModalProps = {
    isVisible: boolean;
    onClose: () => void;
    postId: string | null;
};

export default function CommentsModal({ isVisible, onClose, postId }: CommentsModalProps) {
    const { user } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [sending, setSending] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isVisible && postId) {
            fetchComments();
            setReplyingTo(null);
            setExpandedComments(new Set());
        } else {
            setComments([]);
        }
    }, [isVisible, postId]);

    const fetchComments = async () => {
        if (!postId) return;
        setLoading(true);
        try {
            // 1. Fetch Comments
            const { data: commentsData, error: commentsError } = await supabase
                .from('comments')
                .select(`
                    *,
                    profiles (id, username, avatar_url)
                `)
                .eq('track_id', postId)
                .order('created_at', { ascending: true });

            if (commentsError) throw commentsError;

            if (!commentsData || commentsData.length === 0) {
                setComments([]);
                return;
            }

            // 2. Fetch User Likes for these comments (if user logged in)
            let userLikesSet = new Set<string>();
            if (user) {
                const commentIds = commentsData.map(c => c.id);
                const { data: userLikes, error: userLikesError } = await supabase
                    .from('comment_likes')
                    .select('comment_id')
                    .eq('user_id', user.id)
                    .in('comment_id', commentIds);

                if (!userLikesError && userLikes) {
                    userLikes.forEach(l => userLikesSet.add(l.comment_id));
                }
            }

            // 3. Fetch Total Likes for these comments
            // Note: For scalability, this should ideally be a view or a separate counters table,
            // but for now, we'll count via a grouped query or just fetch all likes (careful with volume).
            // Optimization: Supabase doesn't easily return counts per ID in one select without a join/view.
            // Let's use a simpler approach: fetch all likes for this track's comments.
            // CAUTION: This might be heavy if thousands of likes. For MVP it's okay.
            const commentIds = commentsData.map(c => c.id);
            const { data: allLikes, error: allLikesError } = await supabase
                .from('comment_likes')
                .select('comment_id')
                .in('comment_id', commentIds);

            const likeCounts: Record<string, number> = {};
            if (!allLikesError && allLikes) {
                allLikes.forEach(l => {
                    likeCounts[l.comment_id] = (likeCounts[l.comment_id] || 0) + 1;
                });
            }

            // 4. Structure into Tree
            const commentMap: Record<string, Comment> = {};
            commentsData.forEach((c: any) => {
                commentMap[c.id] = {
                    ...c,
                    likes_count: likeCounts[c.id] || 0,
                    user_has_liked: userLikesSet.has(c.id),
                    replies: []
                };
            });

            const roots: Comment[] = [];
            commentsData.forEach((c: any) => {
                if (c.parent_id && commentMap[c.parent_id]) {
                    commentMap[c.parent_id].replies.push(commentMap[c.id]);
                } else {
                    roots.push(commentMap[c.id]);
                }
            });

            setComments(roots);

        } catch (error) {
            console.error('Error fetching comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!newComment.trim() || !user || !postId) return;
        setSending(true);
        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    user_id: user.id,
                    track_id: postId,
                    content: newComment.trim(),
                    parent_id: replyingTo ? replyingTo.id : null
                })
                .select('*, profiles(username, avatar_url)')
                .single();

            if (error) throw error;

            // Optimistic Update
            const newCommentObj: Comment = {
                ...data,
                likes_count: 0,
                user_has_liked: false,
                replies: []
            };

            if (replyingTo) {
                // Find parent and append
                setComments(prev => prev.map(c => {
                    if (c.id === replyingTo.id) {
                        return { ...c, replies: [...c.replies, newCommentObj] };
                    }
                    return c;
                }));
                // Auto-expand the parent
                setExpandedComments(prev => new Set(prev).add(replyingTo.id));
            } else {
                setComments(prev => [...prev, newCommentObj]);
            }

            setNewComment('');
            setReplyingTo(null);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSending(false);
        }
    };

    const toggleLike = async (comment: Comment) => {
        if (!user) return;

        // Optimistic Update
        const isLiked = comment.user_has_liked;
        const newLikeStatus = !isLiked;
        const newCount = isLiked ? comment.likes_count - 1 : comment.likes_count + 1;

        const updateCommentInTree = (list: Comment[]): Comment[] => {
            return list.map(c => {
                if (c.id === comment.id) {
                    return { ...c, user_has_liked: newLikeStatus, likes_count: newCount };
                }
                if (c.replies.length > 0) {
                    return { ...c, replies: updateCommentInTree(c.replies) };
                }
                return c;
            });
        };

        setComments(prev => updateCommentInTree(prev));

        try {
            if (isLiked) {
                await supabase
                    .from('comment_likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('comment_id', comment.id);
            } else {
                await supabase
                    .from('comment_likes')
                    .insert({ user_id: user.id, comment_id: comment.id });
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert on error would go here
        }
    };

    const toggleReplies = (commentId: string) => {
        setExpandedComments(prev => {
            const next = new Set(prev);
            if (next.has(commentId)) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });
    };

    const renderCommentFunc = (item: Comment, isReply = false) => (
        <View key={item.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
            <View style={styles.commentRow}>
                <View style={styles.avatarContainer}>
                    {item.profiles?.avatar_url ? (
                        <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder} />
                    )}
                </View>

                <View style={styles.contentContainer}>
                    <View style={styles.textBubble}>
                        <Text style={styles.username}>{item.profiles?.username || 'Unknown'}</Text>
                        <Text style={styles.content}>{item.content}</Text>
                    </View>

                    <View style={styles.actionsRow}>
                        <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleDateString()}</Text>

                        {item.likes_count > 0 && (
                            <Text style={styles.likesCountText}>{item.likes_count} likes</Text>
                        )}

                        <TouchableOpacity onPress={() => setReplyingTo(item)}>
                            <Text style={styles.replyButton}>Reply</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Replies Toggle */}
                    {!isReply && item.replies.length > 0 && (
                        <TouchableOpacity
                            style={styles.viewRepliesBtn}
                            onPress={() => toggleReplies(item.id)}
                        >
                            <View style={styles.lineIndicator} />
                            <Text style={styles.viewRepliesText}>
                                {expandedComments.has(item.id)
                                    ? 'Hide replies'
                                    : `View ${item.replies.length} replies`}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Render Replies */}
                    {!isReply && expandedComments.has(item.id) && (
                        <View style={styles.repliesList}>
                            {item.replies.map(reply => renderCommentFunc(reply, true))}
                        </View>
                    )}
                </View>

                <View style={styles.likeContainer}>
                    <TouchableOpacity onPress={() => toggleLike(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Heart
                            size={16}
                            color={item.user_has_liked ? "#EF4444" : "#9CA3AF"}
                            fill={item.user_has_liked ? "#EF4444" : "transparent"}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Comments</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color="#1E293B" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#6366F1" />
                    ) : (
                        <FlatList
                            data={comments}
                            renderItem={({ item }) => renderCommentFunc(item)}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
                            }
                        />
                    )}

                    {/* Input Area */}
                    <View style={styles.inputWrapper}>
                        {replyingTo && (
                            <View style={styles.replyingBar}>
                                <Text style={styles.replyingText}>
                                    Replying to <Text style={{ fontWeight: 'bold' }}>{replyingTo.profiles?.username}</Text>
                                </Text>
                                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                    <X size={16} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder={replyingTo ? `Reply to ${replyingTo.profiles?.username}...` : "Write a comment..."}
                                placeholderTextColor="#94A3B8"
                                value={newComment}
                                onChangeText={setNewComment}
                            />
                            <TouchableOpacity
                                style={styles.sendBtn}
                                onPress={handleSend}
                                disabled={sending || !newComment.trim()}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Send size={20} color="white" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0F172A',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100, // Space for input
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 40,
    },
    commentContainer: {
        marginBottom: 16,
    },
    replyContainer: {
        marginTop: 12,
        marginBottom: 0,
    },
    commentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatarContainer: {
        marginRight: 10,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E2E8F0',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#CBD5E1',
    },
    contentContainer: {
        flex: 1,
    },
    textBubble: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    username: {
        fontWeight: 'bold',
        color: '#0F172A',
        marginRight: 6,
        fontSize: 14,
    },
    content: {
        color: '#334155',
        fontSize: 14,
        lineHeight: 20,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 12,
    },
    timestamp: {
        fontSize: 12,
        color: '#94A3B8',
    },
    likesCountText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    replyButton: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    viewRepliesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    lineIndicator: {
        width: 24,
        height: 1,
        backgroundColor: '#CBD5E1',
        marginRight: 8,
    },
    viewRepliesText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    repliesList: {
        // Indentation handled by padding or margin in render
    },
    likeContainer: {
        marginLeft: 8,
        paddingTop: 2,
    },
    inputWrapper: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: 'white',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    replyingBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    replyingText: {
        fontSize: 12,
        color: '#64748B',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#F1F5F9', // Gray background for input like IG
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 10,
        color: '#0F172A',
        fontSize: 14,
    },
    sendBtn: {
        backgroundColor: '#3B82F6', // Blue send button
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
