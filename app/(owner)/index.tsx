import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Bell, Plus, Dog, Heart, ArrowRight } from 'lucide-react-native';
import { useAuthQuery } from '@/lib/useAuthQuery';

import { Card, Avatar, Badge, PawIcon } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/convex/_generated/api';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppStore((state) => state.user);

  // Fetch dogs from Convex
  const dogs = useAuthQuery(api.dogs.listMine, { isActive: true });
  const dogsLoading = dogs === undefined;

  // Fetch upcoming walks
  const upcomingWalks = useAuthQuery(api.walks.listMineOwner, { status: 'scheduled' });
  const walksLoading = upcomingWalks === undefined;

  // Fetch unread notifications count
  const unreadNotifications = useAuthQuery(api.notifications.listMine, { unreadOnly: true, limit: 1 });
  const hasUnreadNotifications = unreadNotifications && unreadNotifications.length > 0;

  // Fetch impact stats (donation total)
  const impactData = useAuthQuery(api.me.getImpact, {});

  // Get the next upcoming walk (sorted by scheduledTime)
  const nextWalk = useMemo(() => {
    if (!upcomingWalks || upcomingWalks.length === 0) return null;

    // Sort by scheduledTime ascending to get the soonest walk
    const sorted = [...upcomingWalks].sort((a, b) => a.scheduledTime - b.scheduledTime);
    return sorted[0];
  }, [upcomingWalks]);

  // Fetch walker profile for the next walk
  const nextWalkWalker = useAuthQuery(
    api.walkerProfiles.getPublicByUserId,
    nextWalk?.walkerId ? { userId: nextWalk.walkerId } : 'skip'
  );

  // Get dog names for the upcoming walk
  const walkDogNames = useMemo(() => {
    if (!nextWalk || !dogs) return [];

    return nextWalk.dogIds
      .map(dogId => dogs.find(dog => dog._id === dogId)?.name)
      .filter((name): name is string => name !== undefined);
  }, [nextWalk, dogs]);

  // Format walk date and time
  const formatWalkDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const walkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let dayLabel = '';
    if (walkDate.getTime() === today.getTime()) {
      dayLabel = 'Today';
    } else if (walkDate.getTime() === tomorrow.getTime()) {
      dayLabel = 'Tomorrow';
    } else {
      dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    const timeLabel = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return { dayLabel, timeLabel };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.split(' ')[0] || 'Friend';

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
              onPress={() => router.push('/(owner)/notifications')}
              accessibilityRole="button"
              accessibilityLabel={hasUnreadNotifications ? "Notifications, you have new notifications" : "Notifications"}
            >
              <Bell size={iconSizes.md} color={colors.ink} strokeWidth={1.5} />
              {hasUnreadNotifications && <View style={styles.notificationDot} />}
            </Pressable>
          </Animated.View>
        </View>

        {/* Impact Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.impactCard}>
            <View style={styles.impactBackground}>
              <PawIcon size={120} color={colors.white} filled />
            </View>

            <View style={styles.impactContent}>
              <View style={styles.impactHeader}>
                <Text style={styles.impactLabel}>Your Impact</Text>
                <View style={styles.impactBadge}>
                  <Heart size={12} color={colors.ember} fill={colors.ember} />
                  <Text style={styles.impactBadgeText}>Giving Back</Text>
                </View>
              </View>

              <Text style={styles.impactAmount}>
                ${impactData ? ((impactData.totalDonated || 0) / 100).toFixed(2) : '0.00'}
              </Text>
              <Text style={styles.impactSubtext}>
                From {impactData?.walksCount ?? 0} {(impactData?.walksCount ?? 0) === 1 ? 'walk' : 'walks'}, 20% donated to shelters
              </Text>

              <View style={styles.impactFooter}>
                <Pressable
                  style={styles.impactButton}
                  onPress={() => router.push('/(owner)/profile')}
                >
                  <Text style={styles.impactButtonText}>View Impact</Text>
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

        {/* Upcoming Walk Section */}
        {(walksLoading || (nextWalk && walkDogNames.length > 0)) && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Walk</Text>
              <Pressable onPress={() => router.push('/(owner)/walks')}>
                <Text style={styles.sectionLink}>See All</Text>
              </Pressable>
            </View>

            {walksLoading ? (
              <View style={styles.featuredCard}>
                <View style={styles.featuredContent}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              </View>
            ) : nextWalk && walkDogNames.length > 0 ? (
              <Pressable onPress={() => router.push(`/(owner)/walk/${nextWalk._id}`)}>
                <View style={styles.featuredCard}>
                  <View style={styles.featuredContent}>
                    <View style={styles.featuredHeader}>
                      <Badge variant="success" size="sm">Scheduled</Badge>
                      <Text style={styles.featuredTime}>
                        {formatWalkDateTime(nextWalk.scheduledTime).dayLabel} · {formatWalkDateTime(nextWalk.scheduledTime).timeLabel}
                      </Text>
                    </View>

                    <Text style={styles.featuredTitle}>
                      {walkDogNames.join(' & ')}
                    </Text>
                    <Text style={styles.featuredSubtitle}>
                      with {nextWalkWalker?.user?.name || 'Your walker'}
                    </Text>

                    <View style={styles.featuredFooter}>
                      <View style={styles.walkerInfo}>
                        <Avatar
                          source={nextWalkWalker?.user?.avatarUrl}
                          name={nextWalkWalker?.user?.name}
                          size="sm"
                          showRing
                          ringColor={colors.white}
                        />
                        <Text style={styles.walkerName}>View Details</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            ) : null}
          </Animated.View>
        )}

        {/* My Dogs Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Dogs</Text>
            <Pressable onPress={() => router.push('/(owner)/dog-editor')}>
              <Text style={styles.sectionLink}>Add New</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dogsScroll}
          >
            {dogsLoading ? (
              <View style={styles.dogsLoading}>
                <ActivityIndicator size="small" color={colors.ember} />
              </View>
            ) : dogs && dogs.length > 0 ? (
              dogs.map((dog, index) => (
                <Animated.View
                  key={dog._id}
                  entering={FadeInRight.delay(250 + index * 50).duration(300)}
                >
                  <Pressable onPress={() => router.push(`/(owner)/dog-editor?id=${dog._id}`)}>
                    <Card style={styles.dogCard} variant="outlined">
                      {dog.photoUrl || dog.photoFileId ? (
                        <Image source={{ uri: dog.photoUrl || dog.photoFileId }} style={styles.dogPhoto} />
                      ) : (
                        <View style={[styles.dogPhoto, styles.dogPhotoPlaceholder]}>
                          <Dog size={32} color={colors.inkMuted} />
                        </View>
                      )}
                      <View style={styles.dogInfo}>
                        <Text style={styles.dogName}>{dog.name}</Text>
                        <Text style={styles.dogBreed}>{dog.breed || 'Unknown breed'}</Text>
                      </View>
                    </Card>
                  </Pressable>
                </Animated.View>
              ))
            ) : null}

            {/* Add Dog Card */}
            <Animated.View entering={FadeInRight.delay(dogs?.length ? 250 + dogs.length * 50 : 250).duration(300)}>
              <Pressable onPress={() => router.push('/(owner)/dog-editor')}>
                <View style={styles.addDogCard}>
                  <View style={styles.addDogIcon}>
                    <Plus size={iconSizes.lg} color={colors.ember} strokeWidth={1.5} />
                  </View>
                  <Text style={styles.addDogText}>Add Dog</Text>
                </View>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </Animated.View>

        {/* Bottom Spacing */}
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

  notificationDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ember,
  },

  // Impact Card
  impactCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.sage,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    minHeight: 180,
    ...shadows.elevated,
  },

  impactBackground: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    opacity: 0.08,
  },

  impactContent: {
    padding: spacing.lg,
    flex: 1,
    justifyContent: 'space-between',
  },

  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  impactLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
  },

  impactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },

  impactBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },

  impactAmount: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.white,
  },

  impactSubtext: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing.md,
  },

  impactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  impactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },

  impactButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.white,
  },

  // Featured Card (Upcoming Walk)
  featuredCard: {
    backgroundColor: colors.ink,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    minHeight: 200,
    ...shadows.elevated,
  },

  featuredContent: {
    padding: spacing.lg,
    flex: 1,
    justifyContent: 'space-between',
  },

  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  featuredTime: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.7)',
  },

  featuredTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: spacing.xs,
  },

  featuredSubtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing.lg,
  },

  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  walkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  walkerName: {
    fontSize: typography.sizes.base,
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

  // Quick Actions
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.lg,
  },

  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },

  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
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
    color: colors.ember,
  },

  // Dogs
  dogsScroll: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },

  dogsLoading: {
    width: 140,
    aspectRatio: 0.85,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dogPhotoPlaceholder: {
    backgroundColor: colors.paperDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dogCard: {
    width: 140,
    padding: spacing.sm,
  },

  dogPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },

  dogInfo: {
    alignItems: 'center',
  },

  dogName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  dogBreed: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  addDogCard: {
    width: 140,
    aspectRatio: 0.85,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.stone,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  addDogIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addDogText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.ember,
  },
});
