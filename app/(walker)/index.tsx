import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Bell, Calendar, Clock, MapPin, TrendingUp, Star, ArrowRight, Play } from 'lucide-react-native';
import { api } from '@/convex/_generated/api';

import { Card, Avatar, Badge, Button, PawIcon, EmptyState, SkeletonLoader } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { useAuthQuery } from '@/lib/useAuthQuery';

// Track if we've prompted for location permissions this session
let hasPromptedForLocation = false;

export default function WalkerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppStore((state) => state.user);

  // Fetch data from Convex (enriched query includes owner/dog info)
  // useAuthQuery skips query when not logged in
  const upcomingWalksData = useAuthQuery(api.walks.listMineWalkerEnriched, { status: 'scheduled' });
  const inProgressWalksData = useAuthQuery(api.walks.listMineWalkerEnriched, { status: 'in_progress' });
  const pendingRequestsData = useAuthQuery(api.walkRequests.listForWalker, { status: 'pending' });
  const earningsData = useAuthQuery(api.earnings.listMine, {});

  // Get the active walk (if any) - walker should only have one at a time
  const activeWalk = inProgressWalksData?.[0] ?? null;

  // Calculate earnings stats
  const { todayEarnings, weekEarnings } = useMemo(() => {
    if (!earningsData) return { todayEarnings: 0, weekEarnings: 0 };

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;

    const today = earningsData
      .filter((e) => e.createdAt >= todayStart && (e.status === 'ready_for_payout' || e.status === 'paid_out'))
      .reduce((sum, e) => sum + e.amount, 0);

    const week = earningsData
      .filter((e) => e.createdAt >= weekStart && (e.status === 'ready_for_payout' || e.status === 'paid_out'))
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      todayEarnings: Math.round(today / 100), // Convert cents to dollars
      weekEarnings: Math.round(week / 100),
    };
  }, [earningsData]);

  const pendingRequests = pendingRequestsData?.length ?? 0;

  // Request location permissions early (on first dashboard load)
  // This gives walkers a chance to enable location before they need to start a walk
  useEffect(() => {
    const requestLocationPermission = async () => {
      if (hasPromptedForLocation) return;
      hasPromptedForLocation = true;

      try {
        const Location = await import('expo-location');
        const { status } = await Location.getForegroundPermissionsAsync();

        if (status === 'undetermined') {
          // First time - show explanation then request
          Alert.alert(
            'Enable Location Access',
            'Packwalk needs your location to track walks and help dog owners find you. This is required for walk tracking.',
            [
              { text: 'Not Now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
                  if (newStatus === 'granted') {
                    // Also request background for better tracking
                    await Location.requestBackgroundPermissionsAsync();
                  }
                },
              },
            ]
          );
        } else if (status === 'denied') {
          // Previously denied - prompt to open settings
          Alert.alert(
            'Location Permission Required',
            'Location access is required to track walks. Please enable it in Settings.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
        // If 'granted', do nothing - already good
      } catch {
        // Native modules not available (e.g., Expo Go) - skip silently
      }
    };

    // Delay slightly so the dashboard loads first
    const timer = setTimeout(requestLocationPermission, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Format walks for display (using enriched data from Convex)
  const upcomingWalks = useMemo(() => {
    if (!upcomingWalksData) return [];

    return upcomingWalksData
      .sort((a, b) => a.scheduledTime - b.scheduledTime)
      .map((walk) => {
        const walkDate = new Date(walk.scheduledTime);
        const now = new Date();
        const isToday = walkDate.toDateString() === now.toDateString();

        return {
          id: walk._id,
          date: isToday ? 'Today' : walkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          time: walkDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          price: Math.round(walk.totalPrice / 100), // Convert cents to dollars
          location: walk.pickupLocationSnapshot.addressLine1 || 'Location set',
          // Use enriched data from listMineWalkerEnriched query
          ownerName: walk.ownerName,
          ownerAvatar: walk.ownerAvatar,
          dogNames: walk.dogNames,
          duration: 30, // Default - could be stored in walk if needed
        };
      });
  }, [upcomingWalksData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.split(' ')[0] || 'Walker';

  const handleStartWalk = (walkId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(walker)/active-walk',
      params: { walkId },
    });
  };

  const handleContinueActiveWalk = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate without params - active-walk screen will auto-recover the in_progress walk
    router.push('/(walker)/active-walk');
  };

  // Calculate elapsed time for active walk
  const getActiveWalkElapsedTime = () => {
    if (!activeWalk?.startedAt) return '';
    const elapsed = Date.now() - activeWalk.startedAt;
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const isLoading = upcomingWalksData === undefined || earningsData === undefined;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(50)}>
            <Pressable
              style={styles.notificationButton}
              onPress={() => router.push('/(walker)/requests')}
            >
              <Bell size={iconSizes.md} color={colors.ink} strokeWidth={1.5} />
              {pendingRequests > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{pendingRequests}</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>

        {/* Active Walk Banner - shows when walker has in_progress walk */}
        {activeWalk && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Pressable
              style={styles.activeWalkBanner}
              onPress={handleContinueActiveWalk}
            >
              <View style={styles.activeWalkPulse} />
              <View style={styles.activeWalkContent}>
                <View style={styles.activeWalkInfo}>
                  <View style={styles.activeWalkHeader}>
                    <View style={styles.activeWalkDot} />
                    <Text style={styles.activeWalkLabel}>WALK IN PROGRESS</Text>
                  </View>
                  <Text style={styles.activeWalkDogs}>
                    {activeWalk.dogNames?.join(' & ') || 'Dog walk'}
                  </Text>
                  {getActiveWalkElapsedTime() && (
                    <Text style={styles.activeWalkTime}>
                      {getActiveWalkElapsedTime()} elapsed
                    </Text>
                  )}
                </View>
                <View style={styles.activeWalkButton}>
                  <Text style={styles.activeWalkButtonText}>Continue</Text>
                  <ArrowRight size={16} color={colors.white} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Earnings Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.earningsCard}>
            <View style={styles.earningsBackground}>
              <PawIcon size={120} color={colors.white} filled />
            </View>

            <View style={styles.earningsContent}>
              <View style={styles.earningsHeader}>
                <Text style={styles.earningsLabel}>Today's Earnings</Text>
                <Badge variant="success" size="sm">
                  <View style={styles.trendBadge}>
                    <TrendingUp size={12} color={colors.success} />
                    <Text style={styles.trendText}>+12%</Text>
                  </View>
                </Badge>
              </View>

              <Text style={styles.earningsAmount}>${todayEarnings}</Text>

              <View style={styles.earningsFooter}>
                <View style={styles.earningsStat}>
                  <Text style={styles.earningsStatLabel}>This Week</Text>
                  <Text style={styles.earningsStatValue}>${weekEarnings}</Text>
                </View>
                <Pressable
                  style={styles.earningsButton}
                  onPress={() => router.push('/(walker)/earnings')}
                >
                  <Text style={styles.earningsButtonText}>View Details</Text>
                  <ArrowRight size={iconSizes.xs} color={colors.white} />
                </Pressable>
              </View>
            </View>
          </View>
          
          {/* Mission Statement */}
          <Text style={styles.missionText}>
            20% of every walk goes to local rescues.
          </Text>
        </Animated.View>

        {/* Upcoming Walks */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Walks</Text>
            <Pressable onPress={() => router.push('/(walker)/schedule')}>
              <Text style={styles.sectionLink}>Schedule</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <>
              <SkeletonLoader variant="walkCard" />
              <SkeletonLoader variant="walkCard" />
            </>
          ) : upcomingWalks.length === 0 ? (
            <EmptyState
              title="Your schedule is clear"
              subtitle="Time to relax—or find new clients!"
              ctaLabel="View Requests"
              onCtaPress={() => router.push('/(walker)/requests')}
              variant="compact"
            />
          ) : (
            upcomingWalks.map((walk, index) => (
              <Animated.View
                key={walk.id}
                entering={FadeInRight.delay(250 + index * 50).duration(300)}
              >
                <Card style={styles.walkCard} variant="outlined">
                  <View style={styles.walkHeader}>
                    <Avatar source={walk.ownerAvatar} size="md" />
                    <View style={styles.walkInfo}>
                      <Text style={styles.walkOwner}>{walk.ownerName}</Text>
                      <Text style={styles.walkDogs}>{walk.dogNames.join(' & ')}</Text>
                    </View>
                    <Text style={styles.walkPrice}>${walk.price}</Text>
                  </View>

                  <View style={styles.walkDetails}>
                    <View style={styles.walkDetail}>
                      <Clock size={14} color={colors.inkMuted} />
                      <Text style={styles.walkDetailText}>
                        {walk.date} · {walk.time} · {walk.duration} min
                      </Text>
                    </View>
                    <View style={styles.walkDetail}>
                      <MapPin size={14} color={colors.inkMuted} />
                      <Text style={styles.walkDetailText}>{walk.location}</Text>
                    </View>
                  </View>

                  <Button
                    variant="primary"
                    size="md"
                    onPress={() => handleStartWalk(walk.id)}
                    icon={<Play size={16} color={colors.white} />}
                    style={styles.startButton}
                  >
                    Start Walk
                  </Button>
                </Card>
              </Animated.View>
            ))
          )}
        </Animated.View>

        <View style={{ height: TAB_BAR_HEIGHT }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  scrollContent: {
    paddingTop: 0, // Set dynamically with insets
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },

  greeting: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing['2xs'],
  },

  name: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: typography.tracking.tight,
  },

  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },

  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  notificationBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },

  // Earnings Card
  earningsCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.sage,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    minHeight: 180,
    ...shadows.elevated,
  },

  earningsBackground: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    opacity: 0.05,
  },

  earningsContent: {
    padding: spacing.lg,
    flex: 1,
    justifyContent: 'space-between',
  },

  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  earningsLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
  },

  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  trendText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },

  earningsAmount: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: spacing.md,
  },

  earningsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  earningsStat: {},

  earningsStatLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing['2xs'],
  },

  earningsStatValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },

  earningsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },

  earningsButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.white,
  },

  missionText: {
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: typography.sizes.xs,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    fontWeight: typography.weights.medium,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },

  statIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  // Section
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  sectionLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.sage,
  },

  // Walk Card
  walkCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },

  walkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  walkInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },

  walkOwner: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  walkDogs: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  walkPrice: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.sage,
  },

  walkDetails: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },

  walkDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  walkDetailText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  startButton: {
    marginTop: spacing.sm,
  },

  // Active Walk Banner
  activeWalkBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.ember,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.elevated,
  },

  activeWalkPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.emberGlow,
    opacity: 0.3,
  },

  activeWalkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  activeWalkInfo: {
    flex: 1,
  },

  activeWalkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  activeWalkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },

  activeWalkLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: typography.tracking.wider,
  },

  activeWalkDogs: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.white,
    marginBottom: spacing['2xs'],
  },

  activeWalkTime: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  activeWalkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },

  activeWalkButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },

});
