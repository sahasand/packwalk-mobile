import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ArrowLeft, Star, DollarSign } from 'lucide-react-native';

import { Card, Avatar, Badge, EmptyState } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, TAB_BAR_HEIGHT } from '@/constants/theme';
import { useAuthQuery } from '@/lib/useAuthQuery';
import { api } from '@/convex/_generated/api';

// Format date for display
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Review item component
interface ReviewItemProps {
  review: {
    _id: string;
    rating: number;
    comment?: string;
    tipAmount?: number;
    currency: string;
    createdAt: number;
    ownerFirstName: string;
  };
  index: number;
}

function ReviewItem({ review, index }: ReviewItemProps) {
  const tipInDollars = review.tipAmount ? (review.tipAmount * 0.8) / 100 : 0; // 80% of tip goes to walker

  return (
    <Animated.View entering={FadeInUp.delay(300 + index * 50).duration(400)}>
      <Card style={styles.reviewCard} variant="outlined">
        <View style={styles.reviewHeader}>
          <Avatar size="md" name={review.ownerFirstName} />
          <View style={styles.reviewInfo}>
            <View style={styles.starsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  size={16}
                  color={i < review.rating ? colors.gold : colors.stone}
                  fill={i < review.rating ? colors.gold : 'transparent'}
                  strokeWidth={1.5}
                />
              ))}
            </View>
            <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
          </View>
          {tipInDollars > 0 && (
            <View style={styles.tipBadge}>
              <DollarSign size={12} color={colors.sage} />
              <Text style={styles.tipAmount}>+${tipInDollars.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {review.comment && (
          <Text style={styles.reviewComment}>{review.comment}</Text>
        )}

        {!review.comment && (
          <Text style={styles.noComment}>No written review</Text>
        )}
      </Card>
    </Animated.View>
  );
}

export default function WalkerReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get current user profile
  const profile = useAuthQuery(api.me.getProfile, {});

  // Fetch reviews for this walker
  const reviews = useAuthQuery(
    api.reviews.listByWalker,
    profile?.user?._id ? { walkerId: profile.user._id, limit: 50 } : 'skip'
  );

  // Calculate stats
  const avgRating = profile?.walkerProfile?.avgRating ?? 0;
  const reviewCount = profile?.walkerProfile?.reviewCount ?? 0;

  // Loading state
  if (profile === undefined || reviews === undefined) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>My Reviews</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>My Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Summary */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Card style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={styles.ratingDisplay}>
                <Star size={28} color={colors.gold} fill={colors.gold} />
                <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
              </View>
              <Text style={styles.statLabel}>Average Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{reviewCount}</Text>
              <Text style={styles.statLabel}>Total Reviews</Text>
            </View>
          </Card>
        </Animated.View>

        {/* Reviews List */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <Text style={styles.sectionTitle}>RECENT REVIEWS</Text>
        </Animated.View>

        {reviews.length === 0 ? (
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <EmptyState
              title="No reviews yet"
              subtitle="After completing walks, your reviews will appear here"
              variant="compact"
            />
          </Animated.View>
        ) : (
          reviews.map((review, index) => (
            <ReviewItem key={review._id} review={review} index={index} />
          ))
        )}

        {/* Bottom spacing for tab bar */}
        <View style={{ height: TAB_BAR_HEIGHT + spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    ...shadows.soft,
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Stats Card
  statsCard: {
    flexDirection: 'row',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statDivider: {
    width: 1,
    backgroundColor: colors.stone,
    marginHorizontal: spacing.md,
  },

  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  ratingValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },

  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },

  statLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },

  // Section Title
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },

  // Review Card
  reviewCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  reviewInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },

  reviewDate: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },

  tipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.sageLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },

  tipAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  reviewComment: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.ink,
    lineHeight: typography.sizes.base * 1.5,
    marginTop: spacing.md,
  },

  noComment: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
});
