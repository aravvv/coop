import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Upload, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type EditTrackModalProps = {
    visible: boolean;
    onClose: () => void;
    track: any;
    onUpdate: () => void;
};

export default function EditTrackModal({ visible, onClose, track, onUpdate }: EditTrackModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [coverArt, setCoverArt] = useState<any>(null);
    const [audioFile, setAudioFile] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible && track) {
            setTitle(track.title || '');
            setDescription(track.description || '');
            setLyrics(track.lyrics || '');
            setCoverArt(null);
            setAudioFile(null);
        }
    }, [visible, track]);

    const pickCoverArt = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setCoverArt(result.assets[0]);
        }
    };

    const pickAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
            });

            if (!result.canceled && result.assets[0]) {
                setAudioFile(result.assets[0]);
            }
        } catch (error) {
            console.error('Error picking audio:', error);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Title is required');
            return;
        }

        setSaving(true);
        try {
            let coverArtUrl = track.cover_art_url;
            let audioUrl = track.file_url;

            // Upload new cover art if selected
            if (coverArt) {
                const fileExt = coverArt.uri.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;

                const formData = new FormData();
                formData.append('file', {
                    uri: coverArt.uri,
                    name: fileName,
                    type: `image/${fileExt}`,
                } as any);

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('covers')
                    .upload(fileName, formData);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('covers')
                    .getPublicUrl(fileName);

                coverArtUrl = urlData.publicUrl;
            }

            // Upload new audio if selected
            if (audioFile) {
                const fileExt = audioFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;

                const formData = new FormData();
                formData.append('file', {
                    uri: audioFile.uri,
                    name: audioFile.name,
                    type: audioFile.mimeType || 'audio/mpeg',
                } as any);

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('tracks')
                    .upload(fileName, formData);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('tracks')
                    .getPublicUrl(fileName);

                audioUrl = urlData.publicUrl;
            }

            // Update track in database
            const { error: updateError } = await supabase
                .from('tracks')
                .update({
                    title: title.trim(),
                    description: description.trim(),
                    lyrics: lyrics.trim(),
                    cover_art_url: coverArtUrl,
                    file_url: audioUrl,
                })
                .eq('id', track.id);

            if (updateError) throw updateError;

            Alert.alert('Success', 'Track updated successfully!');
            onUpdate();
            onClose();
        } catch (error: any) {
            console.error('Error updating track:', error);
            Alert.alert('Error', error.message || 'Failed to update track');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
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
                        <Text style={styles.headerTitle}>Edit Track</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={24} color="#1E293B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content}>
                        {/* Cover Art */}
                        <Text style={styles.label}>Cover Art</Text>
                        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickCoverArt}>
                            {coverArt ? (
                                <Image source={{ uri: coverArt.uri }} style={styles.coverPreview} />
                            ) : track.cover_art_url ? (
                                <Image source={{ uri: track.cover_art_url }} style={styles.coverPreview} />
                            ) : (
                                <View style={styles.placeholderImage}>
                                    <Upload size={32} color="#94A3B8" />
                                    <Text style={styles.placeholderText}>Tap to change cover art</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Audio File */}
                        <Text style={styles.label}>Audio File</Text>
                        <TouchableOpacity style={styles.audioPickerBtn} onPress={pickAudio}>
                            <Upload size={20} color="#6366F1" />
                            <Text style={styles.audioPickerText}>
                                {audioFile ? audioFile.name : 'Tap to replace audio file (optional)'}
                            </Text>
                        </TouchableOpacity>

                        {/* Title */}
                        <Text style={styles.label}>Title</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Track title"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* Description */}
                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Track description"
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={3}
                        />

                        {/* Lyrics */}
                        <Text style={styles.label}>Lyrics (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={lyrics}
                            onChangeText={setLyrics}
                            placeholder="Track lyrics"
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={4}
                        />
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
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
        height: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0F172A',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
        marginTop: 16,
    },
    imagePickerBtn: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F1F5F9',
    },
    coverPreview: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        marginTop: 8,
        color: '#94A3B8',
        fontSize: 14,
    },
    audioPickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#C7D2FE',
        borderStyle: 'dashed',
    },
    audioPickerText: {
        marginLeft: 12,
        color: '#6366F1',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    input: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
    },
    saveBtn: {
        backgroundColor: '#6366F1',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    saveBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
