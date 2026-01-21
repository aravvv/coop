import { useRouter } from 'expo-router';
import { ArrowLeft, Headphones, Lock, Mail, Mic, Music, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
    { id: 'singer', label: 'Singer', icon: Mic, color: '#F43F5E', bg: '#4C0519' }, // Darker bg for dark mode
    { id: 'producer', label: 'Producer', icon: Headphones, color: '#3B82F6', bg: '#172554' },
    { id: 'musician', label: 'Musician', icon: Music, color: '#10B981', bg: '#064E3B' },
];

export default function SignUp() {
    const router = useRouter();
    const { signUp } = useAuth();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        console.log('handleSignUp: starting', { email, username, role: selectedRole });

        if (!username || !email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (!selectedRole) {
            Alert.alert('Error', 'Pick your vibe! (Select a role)');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);
        try {
            const data = await signUp(email, password, { username, role: selectedRole });
            console.log('SignUp Success Data:', data);

            if (data?.session) {
                // Auto-logged in (Email Confirmation is likely OFF)
                console.log('Session exists, redirecting to tabs...');
                // The _layout.tsx listener will handle the redirect, but we can force it too
                // router.replace('/(tabs)'); 
            } else {
                // Email confirmation might be ON
                Alert.alert('Success', 'Check your email to verify your account!');
                router.push('/auth/login');
            }
        } catch (err: any) {
            console.error('SignUp Error:', err);
            Alert.alert('Signup Failed', err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.title}>Join the <Text style={styles.titleHighlight}>Wave</Text></Text>
                        <Text style={styles.subtitle}>Create your artist profile.</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <User size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Username"
                                placeholderTextColor="#9CA3AF"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor="#9CA3AF"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password (min 6 chars)"
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>
                        {password.length > 0 && password.length < 6 && (
                            <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 4 }}>Password must be at least 6 characters</Text>
                        )}

                        <View style={styles.roleSection}>
                            <Text style={styles.label}>I am a...</Text>
                            <View style={styles.rolesGrid}>
                                {ROLES.map((role) => {
                                    const isSelected = selectedRole === role.id;
                                    const Icon = role.icon;
                                    return (
                                        <TouchableOpacity
                                            key={role.id}
                                            style={[
                                                styles.roleCard,
                                                { borderColor: isSelected ? role.color : '#334155', backgroundColor: isSelected ? role.bg : '#1E293B' }
                                            ]}
                                            onPress={() => setSelectedRole(role.id)}
                                        >
                                            <Icon size={24} color={isSelected ? 'white' : role.color} />
                                            <Text style={[styles.roleLabel, { color: isSelected ? 'white' : '#9CA3AF' }]}>{role.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>Create Account</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/auth/login')}>
                            <Text style={styles.linkText}>Log in</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 48,
    },
    backButton: {
        marginBottom: 24,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
    },
    titleHighlight: {
        color: '#818CF8', // Indigo-400
    },
    subtitle: {
        fontSize: 16,
        color: '#9CA3AF',
        marginTop: 8,
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: '#334155',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: 'white',
        fontSize: 16,
    },
    roleSection: {
        marginTop: 8,
    },
    label: {
        color: '#E2E8F0',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    rolesGrid: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
    },
    roleCard: {
        flex: 1,
        height: 100,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    roleLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    button: {
        backgroundColor: '#6366F1',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    footerText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    linkText: {
        color: '#818CF8',
        fontSize: 14,
        fontWeight: '600',
    },
});
