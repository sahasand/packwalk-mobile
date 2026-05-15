import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Text,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  interpolate,
  interpolateColor,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Home, ClipboardList, DollarSign, User } from 'lucide-react-native';
import { useMutation } from 'convex/react';

import { PawIcon } from '@/components/ui';
import { useAuthQuery } from '@/lib/useAuthQuery';
import { colors, spacing, shadows, animation, typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Storage key for tap count (progressive disclosure)
const TAP_COUNT_KEY = 'packwalk_paw_tap_count';

// Tab configuration - 4 tabs with central paw FAB
const TABS = [
  { key: 'index', label: 'Home', icon: Home, route: '/(walker)/' },
  { key: 'requests', label: 'Requests', icon: ClipboardList, route: '/(walker)/requests' },
  { key: 'earnings', label: 'Earnings', icon: DollarSign, route: '/(walker)/earnings' },
  { key: 'profile', label: 'Profile', icon: User, route: '/(walker)/profile' },
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
    scale.value = withSequence(
      withSpring(0.85, { damping: 10, stiffness: 400 }),
      withSpring(1.12, { damping: 10, stiffness: 400 }),
      withSpring(1, animation.spring.snappy)
    );

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
      <Animated.View style={[styles.tabGlow, glowStyle]} />

      <Animated.View style={[styles.tabIconContainer, iconContainerStyle]}>
        <Icon
          size={24}
          color={isActive ? colors.sage : colors.inkMuted}
          strokeWidth={isActive ? 2.5 : 1.5}
        />

        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        )}
      </Animated.View>

      {isActive && (
        <View style={styles.activeIndicator}>
          <View style={styles.indicatorDot} />
        </View>
      )}
    </AnimatedPressable>
  );
}

interface StatusBubbleProps {
  isOnline: boolean;
  isVisible: boolean;
  isFirstTime: boolean;
  pendingCount: number;
}

function StatusBubble({ isOnline, isVisible, isFirstTime, pendingCount }: StatusBubbleProps) {
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    if (isVisible) {
      // Animate in
      translateY.value = withSpring(0, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 12, stiffness: 400 });
    } else {
      // Animate out
      translateY.value = withTiming(10, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.9, { duration: 150 });
    }
  }, [isVisible]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  // Progressive disclosure text
  const getStatusText = () => {
    if (isOnline) {
      if (isFirstTime) {
        return pendingCount > 0
          ? `Online · ${pendingCount} request${pendingCount > 1 ? 's' : ''} waiting`
          : "Online · You're accepting walks";
      }
      return pendingCount > 0 ? `Online · ${pendingCount} pending` : 'Online';
    } else {
      if (isFirstTime) {
        return "Offline · Tap to go online";
      }
      return 'Offline';
    }
  };

  return (
    <Animated.View style={[styles.bubbleContainer, bubbleStyle]} pointerEvents="none">
      <View style={[styles.bubble, isOnline ? styles.bubbleOnline : styles.bubbleOffline]}>
        <View style={[styles.bubbleDot, isOnline ? styles.bubbleDotOnline : styles.bubbleDotOffline]} />
        <Text style={[styles.bubbleText, isOnline ? styles.bubbleTextOnline : styles.bubbleTextOffline]}>
          {getStatusText()}
        </Text>
      </View>
      {/* Arrow pointing down to paw */}
      <View style={[styles.bubbleArrow, isOnline ? styles.bubbleArrowOnline : styles.bubbleArrowOffline]} />
    </Animated.View>
  );
}

interface AvailabilityPawProps {
  isOnline: boolean;
  pendingCount: number;
  onToggle: () => Promise<void>;
  isLoading: boolean;
}

function AvailabilityPaw({ isOnline, pendingCount, onToggle, isLoading }: AvailabilityPawProps) {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);
  const rotation = useSharedValue(0);
  const colorProgress = useSharedValue(isOnline ? 1 : 0);

  const [showBubble, setShowBubble] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [isFirstTime, setIsFirstTime] = useState(true);

  // Load tap count from storage
  useEffect(() => {
    AsyncStorage.getItem(TAP_COUNT_KEY).then((value) => {
      const count = parseInt(value || '0', 10);
      setTapCount(count);
      setIsFirstTime(count < 3);
    }).catch(() => {});
  }, []);

  // Animate color transition when online status changes
  useEffect(() => {
    colorProgress.value = withTiming(isOnline ? 1 : 0, { duration: 300 });
  }, [isOnline]);

  // Pulse animation only when online
  useEffect(() => {
    if (isOnline) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isOnline]);

  const handlePress = async () => {
    if (isLoading) return;

    // Button animation
    scale.value = withSequence(
      withSpring(0.85, { damping: 10, stiffness: 500 }),
      withSpring(1.1, { damping: 8, stiffness: 400 }),
      withSpring(1, animation.spring.bouncy)
    );

    rotation.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 100 }),
      withTiming(-5, { duration: 75 }),
      withTiming(0, { duration: 75 })
    );

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    // Toggle availability
    try {
      await onToggle();

      // Success haptic
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Show bubble
      setShowBubble(true);

      // Update tap count
      const newCount = tapCount + 1;
      setTapCount(newCount);
      setIsFirstTime(newCount < 3);
      AsyncStorage.setItem(TAP_COUNT_KEY, newCount.toString()).catch(() => {});

      // Auto-dismiss bubble after 2 seconds
      setTimeout(() => {
        setShowBubble(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to toggle availability:', error);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }
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
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.inkMuted, colors.sage]
    ),
  }));

  const pulseInnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseScale.value, [1, 1.15], [1, 1.08]) }],
    opacity: interpolate(pulseOpacity.value, [0.2, 0.5], [0.3, 0.6]),
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.inkMuted, colors.sage]
    ),
  }));

  const buttonBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colors.inkMuted, colors.sage]
    ),
  }));

  const showPendingBadge = isOnline && pendingCount > 0 && !showBubble;

  return (
    <View style={styles.pawContainer}>
      {/* Status bubble - rises from paw on tap */}
      <StatusBubble
        isOnline={isOnline}
        isVisible={showBubble}
        isFirstTime={isFirstTime}
        pendingCount={pendingCount}
      />

      {/* Pulse rings - only visible when online */}
      <Animated.View style={[styles.pawPulseOuter, pulseOuterStyle]} />
      <Animated.View style={[styles.pawPulseInner, pulseInnerStyle]} />

      {/* Main button */}
      <AnimatedPressable
        style={[styles.pawButton, buttonStyle, isOnline ? styles.pawButtonOnline : styles.pawButtonOffline]}
        onPress={handlePress}
        disabled={isLoading}
      >
        <Animated.View style={[styles.pawGradient, buttonBgStyle]}>
          <View style={styles.pawGradientTop} />
          <View style={styles.pawGradientBottom} />
          <View style={styles.pawIconWrapper}>
            <PawIcon size={28} color={colors.white} filled />
          </View>
        </Animated.View>
      </AnimatedPressable>

      {/* Online/Offline status indicator dot */}
      <View style={[styles.statusIndicator, isOnline ? styles.statusOnline : styles.statusOffline]}>
        <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
      </View>

      {/* Pending requests badge - hidden when bubble is showing */}
      {showPendingBadge && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>
            {pendingCount > 9 ? '9+' : pendingCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export function FloatingPawTabBarWalker() {
  const router = useRouter();
  const pathname = usePathname();
  const translateY = useSharedValue(100);
  const barOpacity = useSharedValue(0);

  // Fetch walker profile for online status
  const walkerProfile = useAuthQuery(api.walkerProfiles.getMine, {});
  const toggleVisibility = useMutation(api.walkerProfiles.toggleVisibility);

  // Fetch pending requests for badge
  const pendingRequests = useAuthQuery(api.walkRequests.listForWalker, { status: 'pending' });
  const pendingCount = pendingRequests?.length ?? 0;

  const isOnline = walkerProfile?.isVisible ?? false;
  const isLoading = walkerProfile === undefined;

  // Entry animation
  useEffect(() => {
    translateY.value = withDelay(150, withSpring(0, { damping: 20, stiffness: 180 }));
    barOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: barOpacity.value,
  }));

  const getActiveTab = () => {
    if (pathname === '/(walker)/' || pathname === '/(walker)' || pathname === '/') return 'index';
    if (pathname?.includes('/requests')) return 'requests';
    if (pathname?.includes('/earnings')) return 'earnings';
    if (pathname?.includes('/profile')) return 'profile';
    return 'index';
  };

  const activeTab = getActiveTab();

  const handleTabPress = (route: string) => {
    router.push(route as any);
  };

  const handleAvailabilityToggle = async () => {
    await toggleVisibility();
  };

  // Don't show on certain screens
  const hiddenPaths = [
    '/schedule',
    '/active-walk',
    '/chat/',
    '/edit-profile',
    '/service-areas',
    '/help',
  ];

  const shouldHide = hiddenPaths.some(path => pathname?.includes(path));
  if (shouldHide) return null;

  return (
    <Animated.View style={[styles.container, barStyle]}>
      {/* Frosted glass background */}
      <View style={styles.glassBackground}>
        <View style={styles.glassOverlay} />
        <View style={styles.glassBorder} />
      </View>

      {/* Tab items */}
      <View style={styles.tabsContainer}>
        {/* Left tabs (Home, Requests) */}
        {TABS.slice(0, 2).map((tab, index) => (
          <TabItem
            key={tab.key}
            tab={tab}
            index={index}
            isActive={activeTab === tab.key}
            onPress={() => handleTabPress(tab.route)}
            badgeCount={tab.key === 'requests' ? pendingCount : 0}
          />
        ))}

        {/* Center spacer for PAW */}
        <View style={styles.pawSpacer} />

        {/* Right tabs (Earnings, Profile) */}
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

      {/* Central Availability Toggle Paw */}
      <AvailabilityPaw
        isOnline={isOnline}
        pendingCount={pendingCount}
        onToggle={handleAvailabilityToggle}
        isLoading={isLoading}
      />
    </Animated.View>
  );
}

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
    backgroundColor: `${colors.paper}F2`,
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

  // Status bubble styles
  bubbleContainer: {
    position: 'absolute',
    bottom: PAW_BUTTON_SIZE + 12,
    alignItems: 'center',
    zIndex: 100,
  },

  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    ...shadows.elevated,
  },

  bubbleOnline: {
    backgroundColor: colors.sage,
  },

  bubbleOffline: {
    backgroundColor: colors.inkMuted,
  },

  bubbleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  bubbleDotOnline: {
    backgroundColor: colors.white,
  },

  bubbleDotOffline: {
    backgroundColor: colors.stone,
  },

  bubbleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },

  bubbleTextOnline: {
    color: colors.white,
  },

  bubbleTextOffline: {
    color: colors.white,
  },

  bubbleArrow: {
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    marginTop: -6,
  },

  bubbleArrowOnline: {
    backgroundColor: colors.sage,
  },

  bubbleArrowOffline: {
    backgroundColor: colors.inkMuted,
  },

  // Paw button styles
  pawPulseOuter: {
    position: 'absolute',
    width: PAW_BUTTON_SIZE + 8,
    height: PAW_BUTTON_SIZE + 8,
    borderRadius: (PAW_BUTTON_SIZE + 8) / 2,
  },

  pawPulseInner: {
    position: 'absolute',
    width: PAW_BUTTON_SIZE + 2,
    height: PAW_BUTTON_SIZE + 2,
    borderRadius: (PAW_BUTTON_SIZE + 2) / 2,
  },

  pawButton: {
    width: PAW_BUTTON_SIZE,
    height: PAW_BUTTON_SIZE,
    borderRadius: PAW_BUTTON_SIZE / 2,
    overflow: 'hidden',
  },

  pawButtonOnline: {
    ...shadows.glow,
    shadowColor: colors.sage,
  },

  pawButtonOffline: {
    ...shadows.elevated,
  },

  pawGradient: {
    width: '100%',
    height: '100%',
    borderRadius: PAW_BUTTON_SIZE / 2,
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
    backgroundColor: colors.white,
    opacity: 0.15,
  },

  pawGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: colors.ink,
    opacity: 0.15,
  },

  pawIconWrapper: {
    zIndex: 1,
  },

  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.paper,
  },

  statusOnline: {
    backgroundColor: colors.sage,
  },

  statusOffline: {
    backgroundColor: colors.inkMuted,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusDotOnline: {
    backgroundColor: colors.white,
  },

  statusDotOffline: {
    backgroundColor: colors.stone,
  },

  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.paper,
  },

  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
});

export default FloatingPawTabBarWalker;
