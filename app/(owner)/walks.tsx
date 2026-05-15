import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Calendar, Clock } from 'lucide-react-native';
import { useAuthQuery } from '@/lib/useAuthQuery';

import { Card, Avatar, Badge, PawIcon, EmptyState } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, TAB_BAR_HEIGHT } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

// Helper to format date from timestamp
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Reset time to compare dates only
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Today';
  } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

// Helper to format time from timestamp
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Helper to calculate duration in minutes
const calculateDuration = (startTime: number, endTime?: number): number => {
  if (!endTime) return 30; // Default for scheduled walks
  return Math.round((endTime - startTime) / (60 * 1000));
};

// Enriched walk type from backend
interface EnrichedWalk {
  _id: Id<'walks'>;
  scheduledTime: number;
  startedAt?: number;
  completedAt?: number;
  status: string;
  totalPrice: number;
  dogIds: Id<'dogs'>[];
  walkerName: string;
  walkerAvatar?: string;
  hasReview?: boolean;
}

// WalkCard component - uses pre-fetched walker data
interface WalkCardProps {
  walk: EnrichedWalk;
  dogNames: string[];
  onPress: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

function WalkCard({ walk, dogNames, onPress, getStatusBadge }: WalkCardProps) {
  const router = useRouter();

  // Calculate price in dollars (stored in cents)
  const priceInDollars = walk.totalPrice / 100;
  const donationAmount = Math.round(priceInDollars * 0.2);

  // Calculate duration
  const duration = calculateDuration(walk.startedAt || walk.scheduledTime, walk.completedAt);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.walkCard}>
        <View style={styles.walkHeader}>
          <Avatar size="md" source={walk.walkerAvatar} name={walk.walkerName} />
          <View style={styles.walkInfo}>
            <Text style={styles.walkerName}>{walk.walkerName}</Text>
            {getStatusBadge(walk.status)}
          </View>
          <Text style={styles.price}>${priceInDollars.toFixed(2)}</Text>
        </View>

        <View style={styles.walkDetails}>
          <View style={styles.detailRow}>
            <Calendar size={16} color={colors.inkMuted} />
            <Text style={styles.detailText}>{formatDate(walk.scheduledTime)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Clock size={16} color={colors.inkMuted} />
            <Text style={styles.detailText}>
              {formatTime(walk.scheduledTime)} · {duration} min
            </Text>
          </View>
          {dogNames.length > 0 && (
            <View style={styles.detailRow}>
              <PawIcon size={16} color={colors.inkMuted} />
              <Text style={styles.detailText}>{dogNames.join(' & ')}</Text>
            </View>
          )}
        </View>

        {/* Mission visibility - show donation on completed walks */}
        {walk.status === 'completed' && (
          <Text style={styles.missionNote}>
            ${donationAmount} of this walk supported Toronto rescues
          </Text>
        )}

        {walk.status === 'completed' && (
          walk.hasReview ? (
            <View style={styles.reviewedIndicator}>
              <Text style={styles.reviewedText}>Reviewed</Text>
            </View>
          ) : (
            <Pressable
              style={styles.reviewButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push(`/(owner)/review/${walk._id}`);
              }}
              accessibilityRole="button"
              accessibilityLabel="Leave a review"
            >
              <Text style={styles.reviewButtonText}>Leave a Review</Text>
            </Pressable>
          )
        )}
      </Card>
    </Pressable>
  );
}

export default function WalksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Fetch enriched walks from Convex (includes walker data)
  const scheduledWalks = useAuthQuery(api.walks.listMineOwnerEnriched, { status: 'scheduled' });
  const inProgressWalks = useAuthQuery(api.walks.listMineOwnerEnriched, { status: 'in_progress' });
  const completedWalks = useAuthQuery(api.walks.listMineOwnerEnriched, { status: 'completed' });

  // Fetch all dogs to map dogIds to names
  const allDogs = useAuthQuery(api.dogs.listMine, {});

  // Create a map of dogId to dog name
  const dogMap = useMemo(() => {
    if (!allDogs) return new Map<Id<'dogs'>, string>();
    return new Map(allDogs.map(dog => [dog._id, dog.name]));
  }, [allDogs]);


  // Combine scheduled and in_progress for upcoming
  const upcomingWalks = useMemo(() => {
    if (!scheduledWalks || !inProgressWalks) return [];
    return [...scheduledWalks, ...inProgressWalks].sort((a, b) => a.scheduledTime - b.scheduledTime);
  }, [scheduledWalks, inProgressWalks]);

  const walks = activeTab === 'upcoming' ? upcomingWalks : (completedWalks || []);

  const isLoading = scheduledWalks === undefined ||
                    inProgressWalks === undefined ||
                    completedWalks === undefined ||
                    allDogs === undefined;

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="success">Scheduled</Badge>;
      case 'in_progress':
        return <Badge variant="warning">In Progress</Badge>;
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="default">Cancelled</Badge>;
      case 'no_show':
        return <Badge variant="default">No Show</Badge>;
      default:
        return null;
    }
  }, []);

  const renderWalkItem = useCallback(({ item: walk }: { item: EnrichedWalk }) => {
    const dogNames = walk.dogIds
      .map(dogId => dogMap.get(dogId))
      .filter((name): name is string => name !== undefined);

    return (
      <WalkCard
        walk={walk}
        dogNames={dogNames}
        onPress={() => router.push(`/(owner)/walk/${walk._id}`)}
        getStatusBadge={getStatusBadge}
      />
    );
  }, [dogMap, router, getStatusBadge]);

  const keyExtractor = useCallback((item: EnrichedWalk) => item._id, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Activity</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'upcoming' }}
          >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
              Upcoming
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'past' }}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              Past
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Walks list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.ember} />
          <Text style={styles.loadingText}>Loading walks...</Text>
        </View>
      ) : walks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            title={`No ${activeTab} walks`}
            subtitle={
              activeTab === 'upcoming'
                ? 'Book a walker to get started!'
                : 'Your completed walks will appear here'
            }
            ctaLabel={activeTab === 'upcoming' ? 'Find a Walker' : undefined}
            onCtaPress={activeTab === 'upcoming' ? () => router.push('/(owner)/search') : undefined}
          />
        </View>
      ) : (
        <FlatList
          data={walks}
          keyExtractor={keyExtractor}
          renderItem={renderWalkItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: TAB_BAR_HEIGHT }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  header: {
    paddingTop: 0, // Set dynamically with insets
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    ...shadows.soft,
  },

  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.md,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: spacing.xs,
  },

  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },

  tabActive: {
    backgroundColor: colors.white,
    ...shadows.soft,
  },

  tabText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
  },

  tabTextActive: {
    color: colors.ember,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  loadingContainer: {
    flex: 1,
    paddingTop: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.md,
  },

  loadingText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

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
    marginLeft: spacing.sm,
    gap: spacing.xs,
  },

  walkerName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  price: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ember,
  },

  walkDetails: {
    gap: spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  detailText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  reviewButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },

  reviewButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ember,
    textAlign: 'center',
  },

  reviewedIndicator: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },

  reviewedText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.sage,
    textAlign: 'center',
  },

  missionNote: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.sage,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
