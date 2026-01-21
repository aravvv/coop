import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FileAudio, GitBranch, Image as ImageIcon, UploadCloud, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function UploadScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useLocalSearchParams();

    // Track parentTrackId - only set if coming from remix button
    const [parentTrackId, setParentTrackId] = useState<string | null>(
        typeof params.parentTrackId === 'string' ? params.parentTrackId : null
    );

    const [file, setFile] = useState<any>(null);
    const [coverImage, setCoverImage] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [remixAllowed, setRemixAllowed] = useState(true);

    // UI State
    const [loading, setLoading] = useState(false);
    const [uiError, setUiError] = useState<string | null>(null);
    const [uiSuccess, setUiSuccess] = useState<string | null>(null);
    const [progressStep, setProgressStep] = useState<string>(''); // e.g., "Uploading Audio..."

    // Parent Track State
    const [parentTrack, setParentTrack] = useState<any>(null);

    // Clear parentTrackId when screen loses focus and regains without new params
    useFocusEffect(
        useCallback(() => {
            const newParentId = typeof params.parentTrackId === 'string' ? params.parentTrackId : null;
            setParentTrackId(newParentId);
            return () => { };
        }, [params.parentTrackId])
    );

    useEffect(() => {
        if (parentTrackId) {
            fetchParentTrack();
        }
    }, [parentTrackId]);

    const fetchParentTrack = async () => {
        const { data, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('id', parentTrackId)
            .single();

        if (data) {
            setParentTrack(data);
            setTitle(`Remix of ${data.title} `);
            setDescription(`Remixing ${data.title} by user ${data.user_id} `);
        }
    };

    const pickAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
            });

            if (result.canceled) return;

            const selectedFile = result.assets[0];
            setFile(selectedFile);
            if (!title) {
                const nameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
                setTitle(nameWithoutExt);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setCoverImage(result.assets[0]);
        }
    };

    const handleUpload = async () => {
        console.log('handleUpload started');
        setUiError(null);
        setUiSuccess(null);
        setProgressStep('Validating...');

        if (!user) {
            setUiError("You must be logged in.");
            return;
        }

        if (!file && !lyrics.trim()) {
            setUiError("Please upload an audio track OR lyrics.");
            return;
        }

        if (!title.trim()) {
            setUiError("Please give your track a title.");
            return;
        }

        setLoading(true);

        try {
            let publicAudioUrl = null;
            let publicCoverUrl = null;

            // 1. Upload Audio
            if (file) {
                setProgressStep(`Uploading ${file.name}...`);
                console.log('Uploading audio...', file.name);
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}/${Date.now()}.${fileExt}`;

                const formData = new FormData();
                if (Platform.OS === 'web') {
                    if (file.file) {
                        formData.append('file', file.file);
                    } else {
                        const req = await fetch(file.uri);
                        const blob = await req.blob();
                        formData.append('file', blob, file.name);
                    }
                } else {
                    formData.append('file', {
                        uri: file.uri,
                        name: file.name,
                        type: file.mimeType || 'audio/mpeg'
                    } as any);
                }

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('audio-files')
                    .upload(fileName, formData, { contentType: file.mimeType || 'audio/mpeg' });

                if (uploadError) {
                    console.error('Audio upload error:', uploadError);
                    throw new Error(`Audio upload failed: ${uploadError.message}`);
                }

                const { data } = supabase.storage.from('audio-files').getPublicUrl(fileName);
                publicAudioUrl = data.publicUrl;
                console.log('Audio uploaded:', publicAudioUrl);
            }

            // 2. Upload Cover
            if (coverImage) {
                setProgressStep('Uploading cover art...');
                console.log('Uploading cover...', coverImage.uri);
                const fileExt = coverImage.uri.split('.').pop();
                const fileName = `${user.id}/${Date.now()}_cover.${fileExt}`;

                const formData = new FormData();
                if (Platform.OS === 'web') {
                    // ImagePicker on web gives a blob URI, we need to fetch it
                    const req = await fetch(coverImage.uri);
                    const blob = await req.blob();
                    formData.append('file', blob, `cover.${fileExt}`);
                } else {
                    formData.append('file', {
                        uri: coverImage.uri,
                        name: `cover.${fileExt}`,
                        type: 'image/jpeg'
                    } as any);
                }

                const { error: uploadError } = await supabase.storage
                    .from('post-images')
                    .upload(fileName, formData, { contentType: 'image/jpeg' });

                if (uploadError) {
                    console.error('Cover upload error:', uploadError);
                    throw new Error(`Cover upload failed: ${uploadError.message}`);
                }

                const { data } = supabase.storage.from('post-images').getPublicUrl(fileName);
                publicCoverUrl = data.publicUrl;
                console.log('Cover uploaded:', publicCoverUrl);
            }

            // 3. Insert into DB
            setProgressStep('Saving to Feed...');
            console.log('Inserting into DB...');
            const { error: dbError } = await supabase.from('tracks').insert({
                user_id: user.id,
                title,
                description,
                lyrics,
                file_url: publicAudioUrl,
                cover_art_url: publicCoverUrl,
                is_remix: !!parentTrackId,
                parent_track_id: parentTrackId || null
            });

            if (dbError) {
                console.error('DB Insert error:', dbError);
                throw dbError;
            }

            console.log('Upload success!');
            setUiSuccess("Your Wave has been uploaded!");
            setProgressStep('Done!');

            // Navigate home after delay
            setTimeout(() => {
                router.push('/(tabs)');
                // Reset form
                setFile(null);
                setCoverImage(null);
                setTitle('');
                setDescription('');
                setLyrics('');
                setParentTrack(null);
                setParentTrackId(null);
                setUiSuccess(null);
                setProgressStep('');
            }, 1000);

        } catch (error: any) {
            console.error('HandleUpload Catch:', error);
            setUiError(error.message || "Unknown error occurred");
            setProgressStep('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            <Text style={styles.headerTitle}>
                {parentTrack ? 'Post Remix' : 'Upload Wave'}
            </Text>

            {parentTrack && (
                <View style={styles.remixBadge}>
                    <GitBranch size={16} color="#3B82F6" />
                    <Text style={styles.remixBadgeText}>Remixing: {parentTrack.title}</Text>
                </View>
            )}

            {/* ERROR UI */}
            {uiError && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{uiError}</Text>
                </View>
            )}

            {/* SUCCESS UI */}
            {uiSuccess && (
                <View style={styles.successContainer}>
                    <Text style={styles.successText}>{uiSuccess}</Text>
                </View>
            )}

            {/* Audio Upload */}
            <TouchableOpacity style={styles.uploadZone} onPress={pickAudio}>
                {file ? (
                    <View style={styles.filePreview}>
                        <FileAudio size={48} color="#3B82F6" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.fileName}>{file.name}</Text>
                            <Text style={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</Text>
                        </View>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); setFile(null); }}>
                            <X size={24} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <UploadCloud size={48} color="#94A3B8" />
                        <Text style={styles.uploadText}>Tap to select audio file</Text>
                    </>
                )}
            </TouchableOpacity>

            {/* Cover Upload */}
            <View style={styles.coverSection}>
                <TouchableOpacity style={styles.coverInput} onPress={pickImage}>
                    {coverImage ? (
                        <Image source={{ uri: coverImage.uri }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <ImageIcon size={32} color="#94A3B8" />
                    )}
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.label}>Cover Art (Optional)</Text>
                    <Text style={styles.subLabel}>Tap square to upload</Text>
                </View>
            </View>

            {/* Form Fields */}
            <View style={styles.formGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Midnight Idea"
                    placeholderTextColor="#475569"
                    value={title}
                    onChangeText={setTitle}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe your track..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={3}
                    value={description}
                    onChangeText={setDescription}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Lyrics</Text>
                <TextInput
                    style={[styles.input, styles.textArea, { fontFamily: 'monospace' }]}
                    placeholder="Verse 1..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={5}
                    value={lyrics}
                    onChangeText={setLyrics}
                />
            </View>

            <View style={styles.row}>
                <Text style={styles.label}>Allow Remixing</Text>
                <Switch
                    value={remixAllowed}
                    onValueChange={setRemixAllowed}
                    trackColor={{ false: "#334155", true: "#3B82F6" }}
                />
            </View>

            <TouchableOpacity
                style={[styles.submitBtn, loading && styles.disabledBtn]}
                onPress={handleUpload}
                disabled={loading}
            >
                {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.submitBtnText}>{progressStep || 'Uploading...'}</Text>
                    </View>
                ) : (
                    <Text style={styles.submitBtnText}>Post to Feed</Text>
                )}
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 10,
        marginTop: 40,
    },
    errorContainer: {
        backgroundColor: '#EF444420',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#EF4444',
        textAlign: 'center',
        fontWeight: '600',
    },
    successContainer: {
        backgroundColor: '#10B98120',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    successText: {
        color: '#10B981',
        textAlign: 'center',
        fontWeight: '600',
    },
    remixBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 24,
        alignSelf: 'flex-start',
    },
    remixBadgeText: {
        color: '#3B82F6',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    uploadZone: {
        backgroundColor: '#1E293B',
        borderWidth: 2,
        borderColor: '#334155',
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 30,
        alignItems: 'center',
        marginBottom: 24,
    },
    uploadText: {
        color: '#94A3B8',
        marginTop: 12,
        fontWeight: '600',
    },
    filePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    fileName: {
        color: 'white',
        fontWeight: 'bold',
    },
    fileSize: {
        color: '#94A3B8',
        fontSize: 12,
    },
    coverSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    coverInput: {
        width: 80,
        height: 80,
        backgroundColor: '#1E293B',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#E2E8F0',
        marginBottom: 8,
        fontWeight: '600',
    },
    subLabel: {
        color: '#64748B',
        fontSize: 12,
    },
    input: {
        backgroundColor: '#1E293B',
        borderRadius: 8,
        padding: 12,
        color: 'white',
        borderWidth: 1,
        borderColor: '#334155',
    },
    textArea: {
        textAlignVertical: 'top',
        minHeight: 80,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    submitBtn: {
        backgroundColor: '#3B82F6',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    disabledBtn: {
        opacity: 0.7,
    },
});
