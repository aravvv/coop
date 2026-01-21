import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Link, Tabs } from 'expo-router';
import { Bell, Home, PlusSquare, User } from 'lucide-react-native';
import React from 'react';
import { Platform, TouchableOpacity } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: '#0F172A',
            borderTopColor: '#1E293B',
          },
          default: {
            backgroundColor: '#0F172A',
            borderTopColor: '#1E293B',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Coop',
          headerShown: true,
          headerStyle: { backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#1E293B', shadowColor: 'transparent' },
          headerTintColor: '#fff',
          headerRight: () => (
            <Link href="/notifications" asChild>
              <TouchableOpacity style={{ marginRight: 16 }}>
                <Bell size={24} color="white" />
              </TouchableOpacity>
            </Link>
          ),
          tabBarIcon: ({ color }) => <Home size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color }) => <PlusSquare size={32} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
