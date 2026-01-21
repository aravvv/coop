import { Edit2, Share2, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

type OptionsModalProps = {
    visible: boolean;
    onClose: () => void;
    isOwner: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onShare: () => void;
};

export default function OptionsModal({ visible, onClose, isOwner, onEdit, onDelete, onShare }: OptionsModalProps) {
    if (!visible) return null;

    const handleDeletePress = () => {
        onClose();
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Are you sure you want to delete this wave? This action cannot be undone.');
            if (confirmed) {
                onDelete();
            }
        } else {
            Alert.alert(
                'Delete Wave',
                'Are you sure you want to delete this wave? This action cannot be undone.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDelete }
                ]
            );
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.container}>
                            <View style={styles.header}>
                                <Text style={styles.title}>Options</Text>
                                <TouchableOpacity onPress={onClose}>
                                    <X size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.options}>
                                {isOwner && (
                                    <>
                                        <TouchableOpacity style={styles.optionItem} onPress={() => { onClose(); onEdit(); }}>
                                            <Edit2 size={24} color="#4F46E5" />
                                            <Text style={styles.optionText}>Edit Wave</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.optionItem} onPress={handleDeletePress}>
                                            <Trash2 size={24} color="#EF4444" />
                                            <Text style={[styles.optionText, styles.deleteText]}>Delete Wave</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                <TouchableOpacity style={styles.optionItem} onPress={() => { onClose(); onShare(); }}>
                                    <Share2 size={24} color="#10B981" />
                                    <Text style={styles.optionText}>Share</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    options: {
        gap: 8,
        marginBottom: 24,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        gap: 16,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    deleteText: {
        color: '#EF4444',
    },
    cancelButton: {
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4B5563',
    },
});
