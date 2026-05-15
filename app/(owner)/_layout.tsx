import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { FloatingPawTabBar } from '@/components/navigation/FloatingPawTabBar';

export default function OwnerLayout() {
  // Sync user data from Convex to Zustand store (including avatarUrl)
  useCurrentUser();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          // Hide the default tab bar - we use our custom FloatingPawTabBar
          tabBarStyle: { display: 'none' },
        }}
      >
        {/* Main visible tabs (handled by FloatingPawTabBar) */}
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="walks" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />

        {/* Hidden screens - not in tab bar */}
        <Tabs.Screen name="dog-editor" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="walker/[id]" options={{ href: null }} />
        <Tabs.Screen name="booking/[walkerId]" options={{ href: null }} />
        <Tabs.Screen name="walk/[id]" options={{ href: null }} />
        <Tabs.Screen name="chat/[id]" options={{ href: null }} />
        <Tabs.Screen name="tracking/[id]" options={{ href: null }} />
        <Tabs.Screen name="review/[walkId]" options={{ href: null }} />
      </Tabs>

      {/* Our beautiful custom floating tab bar */}
      <FloatingPawTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
});
