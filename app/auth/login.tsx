import { useRouter } from 'expo-router';
import { Lock, Mail, Music } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const router = useRouter();
    const { signIn } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await signIn(email, password);
            router.replace('/(tabs)');
        } catch (err: any) {
            Alert.alert('Login Failed', err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Music size={32} color="white" />
                    </View>
                    <Text style={styles.title}>Welcome back</Text>
                </View>

                <View style={styles.form}>
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
                            placeholder="Password"
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.forgotPassword}>
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.buttonText}>Log In</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <View style={styles.divider}>
                        <Text style={styles.dividerText}>OR</Text>
                    </View>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/auth/signup')}>
                        <Text style={styles.secondaryButtonText}>Create an Account</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // Dark blue background similar to typical dark mode
    },
    keyboardView: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#6366F1', // Indigo primary
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
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
    forgotPassword: {
        alignItems: 'flex-end',
    },
    forgotPasswordText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    button: {
        backgroundColor: '#6366F1',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        marginTop: 32,
    },
    divider: {
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerText: {
        color: '#64748B',
        fontSize: 14,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    secondaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
