import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function Index() {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    if (session) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href="/auth/login" />;
}
