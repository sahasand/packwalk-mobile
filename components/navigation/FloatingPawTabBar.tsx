import React, { useEffect, useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Text,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { Home, MessageCircle, Activity, User } from 'lucide-react-native';

import { useAuthQuery } from '@/lib/useAuthQuery';

import { PawIcon } from '@/components/ui';
import { colors, spacing, radius, shadows, animation } from '@/constants/theme';
import { api } from '@/convex/_generated/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Tab configuration - 4 tabs with central paw FAB
// Home | Messages | 🐾 | Activity | Profile
const TABS = [
  { key: 'index', label: 'Home', icon: Home, route: '/(owner)/' },
  { key: 'messages', label: 'Messages', icon: MessageCircle, route: '/(owner)/messages' },
  // PAW FAB goes here - THE booking action
  { key: 'walks', label: 'Activity', icon: Activity, route: '/(owner)/walks' },
  { key: 'profile', label: 'Profile', icon: User, route: '/(owner)/profile' },
];

// Dimensions
const TAB_BAR_HEIGHT = 68;
const TAB_BAR_MARGIN = 20;
const TAB_BAR_RADIUS = 34;
const PAW_BUTTON_SIZE = 62;
const PAW_BUTTON_OFFSET = -18;

interface TabItemProps {
  tab: typeof TABS[0];
  index: number;
  isActive: boolean;
  onPress: () => void;
  badgeCount?: number;
}

function TabItem({ tab, index, isActive, onPress, badgeCount = 0 }: TabItemProps) {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(isActive ? 1 : 0.9);
  const glowOpacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    iconScale.value = withSpring(isActive ? 1 : 0.85, animation.spring.snappy);
    glowOpacity.value = withSpring(isActive ? 1 : 0, animation.spring.gentle);
  }, [isActive]);

  const handlePress = () => {
    // Bounce animation
    scale.value = withSequence(
      withSpring(0.85, { damping: 10, stiffness: 400 }),
      withSpring(1.12, { damping: 10, stiffness: 400 }),
      withSpring(1, animation.spring.snappy)
    );

    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    onPress();
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.8, 1]) }],
  }));

  const Icon = tab.icon;
  const showBadge = badgeCount > 0;

  return (
    <AnimatedPressable
      style={[styles.tabItem, containerStyle]}
      onPress={handlePress}
    >
      {/* Glow background for active state */}
      <Animated.View style={[styles.tabGlow, glowStyle]} />

      <Animated.View style={[styles.tabIconContainer, iconContainerStyle]}>
        <Icon
          size={24}
          color={isActive ? colors.sage : colors.inkMuted}
          strokeWidth={isActive ? 2.5 : 1.5}
        />

        {/* Unread badge */}
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Active indicator dot */}
      {isActive && (
        <View style={styles.activeIndicator}>
          <View style={styles.indicatorDot} />
        </View>
      )}
    </AnimatedPressable>
  );
}

interface PawFABProps {
  onPress: () => void;
}

function PawFAB({ onPress }: PawFABProps) {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);
  const rotation = useSharedValue(0);

  // Subtle idle pulse animation - the heartbeat
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const handlePress = () => {
    // Dramatic press animation
    scale.value = withSequence(
      withSpring(0.8, { damping: 10, stiffness: 500 }),
      withSpring(1.15, { damping: 8, stiffness: 400 }),
      withSpring(1, animation.spring.bouncy)
    );

    // Playful rotation wiggle
    rotation.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 100 }),
      withTiming(-4, { duration: 75 }),
      withTiming(0, { duration: 75 })
    );

    // Strong haptic
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    onPress();
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const pulseOuterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const pulseInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseScale.value, [1, 1.2], [1, 1.1]) }],
    opacity: interpolate(pulseOpacity.value, [0.2, 0.5], [0.3, 0.6]),
  }));

  return (
    <View style={styles.pawContainer}>
      {/* Outer pulse ring */}
      <Animated.View style={[styles.pawPulseOuter, pulseOuterStyle]} />

      {/* Inner pulse ring */}
      <Animated.View style={[styles.pawPulseInner, pulseInnerStyle]} />

      {/* Main button with gradient effect */}
      <AnimatedPressable style={[styles.pawButton, buttonStyle]} onPress={handlePress}>
        <View style={styles.pawGradient}>
          {/* Gradient overlay layers for depth */}
          <View style={styles.pawGradientTop} />
          <View style={styles.pawGradientBottom} />
          <View style={styles.pawIconWrapper}>
            <PawIcon size={28} color={colors.white} filled />
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

export const FloatingPawTabBar = React.memo(function FloatingPawTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const translateY = useSharedValue(100);
  const barOpacity = useSharedValue(0);

  // Fetch unread message count for badge
  const conversations = useAuthQuery(api.conversations.listMine, {});
  const unreadCount = useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce((sum, conv) => sum + (conv.unreadCountOwner || 0), 0);
  }, [conversations]);

  // Entry animation
  useEffect(() => {
    translateY.value = withDelay(
      150,
      withSpring(0, { damping: 20, stiffness: 180 })
    );
    barOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 300 })
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: barOpacity.value,
  }));

  const getActiveTab = () => {
    if (pathname === '/(owner)/' || pathname === '/(owner)' || pathname === '/') return 'index';
    if (pathname?.includes('/messages')) return 'messages';
    if (pathname?.includes('/walks')) return 'walks';
    if (pathname?.includes('/profile')) return 'profile';
    return 'index';
  };

  const activeTab = getActiveTab();

  const handleTabPress = (route: string) => {
    router.push(route as any);
  };

  const handlePawPress = () => {
    // Navigate to search/explore for booking - the main action!
    router.push('/(owner)/search');
  };

  // Don't show on certain screens
  const hiddenPaths = [
    '/dog-editor',
    '/edit-profile',
    '/walker/',
    '/booking/',
    '/walk/',
    '/chat/',
    '/tracking/',
    '/review/',
    '/notifications',
  ];

  const shouldHide = hiddenPaths.some(path => pathname?.includes(path));
  if (shouldHide) return null;

  return (
    <Animated.View style={[styles.container, barStyle]}>
      {/* Frosted glass background effect */}
      <View style={styles.glassBackground}>
        <View style={styles.glassOverlay} />
        <View style={styles.glassBorder} />
      </View>

      {/* Tab items */}
      <View style={styles.tabsContainer}>
        {/* Left tabs (Home, Messages) */}
        {TABS.slice(0, 2).map((tab, index) => (
          <TabItem
            key={tab.key}
            tab={tab}
            index={index}
            isActive={activeTab === tab.key}
            onPress={() => handleTabPress(tab.route)}
            badgeCount={tab.key === 'messages' ? unreadCount : 0}
          />
        ))}

        {/* Center spacer for PAW */}
        <View style={styles.pawSpacer} />

        {/* Right tabs (Activity, Profile) */}
        {TABS.slice(2).map((tab, index) => (
          <TabItem
            key={tab.key}
            tab={tab}
            index={index + 2}
            isActive={activeTab === tab.key}
            onPress={() => handleTabPress(tab.route)}
          />
        ))}
      </View>

      {/* Central PAW FAB - The Hero */}
      <PawFAB onPress={handlePawPress} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 36 : 24,
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'visible',
    ...shadows.elevated,
  },

  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'hidden',
  },

  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${colors.paper}F2`, // 95% opacity warm paper
  },

  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_BAR_RADIUS,
    borderWidth: 1,
    borderColor: `${colors.white}90`,
  },

  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },

  tabGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.sageLight,
  },

  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.paper,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },

  activeIndicator: {
    position: 'absolute',
    bottom: 6,
    alignItems: 'center',
  },

  indicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.sage,
  },

  pawSpacer: {
    width: PAW_BUTTON_SIZE + spacing.lg,
  },

  pawContainer: {
    position: 'absolute',
    top: PAW_BUTTON_OFFSET,
    left: '50%',
    marginLeft: -PAW_BUTTON_SIZE / 2,
    width: PAW_BUTTON_SIZE,
    height: PAW_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pawPulseOuter: {
    position: 'absolute',
    width: PAW_BUTTON_SIZE + 8,
    height: PAW_BUTTON_SIZE + 8,
    borderRadius: (PAW_BUTTON_SIZE + 8) / 2,
    backgroundColor: colors.ember,
  },

  pawPulseInner: {
    position: 'absolute',
    width: PAW_BUTTON_SIZE + 2,
    height: PAW_BUTTON_SIZE + 2,
    borderRadius: (PAW_BUTTON_SIZE + 2) / 2,
    backgroundColor: colors.ember,
  },

  pawButton: {
    width: PAW_BUTTON_SIZE,
    height: PAW_BUTTON_SIZE,
    borderRadius: PAW_BUTTON_SIZE / 2,
    overflow: 'hidden',
    ...shadows.glow,
  },

  pawGradient: {
    width: '100%',
    height: '100%',
    borderRadius: PAW_BUTTON_SIZE / 2,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  pawGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: colors.emberLight,
    opacity: 0.3,
  },

  pawGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: colors.emberDark,
    opacity: 0.4,
  },

  pawIconWrapper: {
    zIndex: 1,
  },
});

export default FloatingPawTabBar;
