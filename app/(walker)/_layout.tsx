import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { FloatingPawTabBarWalker } from '@/components/navigation/FloatingPawTabBarWalker';

export default function WalkerLayout() {
  // Sync user data from Convex to Zustand store (including avatarUrl)
  useCurrentUser();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          // Hide the default tab bar - we use our custom FloatingPawTabBarWalker
          tabBarStyle: { display: 'none' },
        }}
      >
        {/* Main visible tabs (handled by FloatingPawTabBarWalker) */}
        <Tabs.Screen name="index" />
        <Tabs.Screen name="requests" />
        <Tabs.Screen name="earnings" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />

        {/* Hidden screens - not in tab bar */}
        <Tabs.Screen name="schedule" options={{ href: null }} />
        <Tabs.Screen name="active-walk" options={{ href: null }} />
        <Tabs.Screen name="chat/[id]" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
        <Tabs.Screen name="service-areas" options={{ href: null }} />
        <Tabs.Screen name="help" options={{ href: null }} />
      </Tabs>

      {/* Custom floating tab bar with availability toggle */}
      <FloatingPawTabBarWalker />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
});
