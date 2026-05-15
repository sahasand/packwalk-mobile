import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, MapPin, Shield, Calendar, MessageCircle } from 'lucide-react-native';
import { useAuthQuery } from '@/lib/useAuthQuery';

import { Button, Card, Avatar, Rating, Badge } from '@/components/ui';
import { colors, spacing, radius, shadows } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

export default function WalkerProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const walker = useAuthQuery(
    api.walkerProfiles.getPublicByUserId,
    id ? { userId: id as Id<'users'> } : 'skip',
  );
  const reviews = useAuthQuery(
    api.reviews.listByWalker,
    id ? { walkerId: id as Id<'users'>, limit: 5 } : 'skip',
  );

  if (!walker) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.inkMuted }}>Loading walker...</Text>
      </View>
    );
  }

  const { user, profile } = walker;
  const verified = user.walkerVerificationStatus === 'approved';
  const rate = Math.round(profile.hourlyRate / 100);

  const handleBookWalker = () => {
    router.push(`/(owner)/booking/${id}`);
  };

  const handleMessage = () => {
    router.push(`/(owner)/chat/${id}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Walker Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.profileHeader}>
          <Avatar
            source={walker?.user?.avatarUrl}
            name={walker?.user?.name}
            size="xl"
            showBorder
          />
          <Text style={styles.name}>{user.name}</Text>
          <View style={styles.ratingRow}>
            <Rating value={profile.avgRating} size="md" showValue />
            <Text style={styles.reviewCount}>({profile.reviewCount} reviews)</Text>
          </View>
          {verified && (
            <Badge variant="premium">
              <View style={styles.verifiedBadge}>
                <Shield size={12} color={colors.emberDark} />
                <Text style={styles.verifiedText}>Verified Walker</Text>
              </View>
            </Badge>
          )}
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{walker.completedWalkCount ?? 0}</Text>
            <Text style={styles.statLabel}>Walks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>Nearby</Text>
            <Text style={styles.statLabel}>Location</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.reviewCount}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </Animated.View>

        {/* Bio */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>
              {profile.bio ??
                'This walker hasn\'t added a bio yet.'}
            </Text>
          </Card>
        </Animated.View>

        {/* Reviews */}
        <Animated.View entering={FadeInDown.delay(400)}>
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              {reviews && reviews.length > 0 && (
                <TouchableOpacity>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {reviews === undefined ? (
              <Text style={styles.reviewText}>Loading reviews...</Text>
            ) : reviews.length === 0 ? (
              <Text style={styles.reviewText}>No reviews yet</Text>
            ) : (
              reviews.map((review) => (
                <View key={review._id} style={styles.review}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{review.ownerFirstName}</Text>
                    <Rating value={review.rating} size="sm" />
                  </View>
                  <Text style={styles.reviewText}>{review.comment ?? ''}</Text>
                  <Text style={styles.reviewDate}>
                    {formatRelativeDate(review.createdAt)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>${rate}</Text>
          <Text style={styles.priceUnit}>/hour</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
            <MessageCircle size={22} color={colors.ember} />
          </TouchableOpacity>
          <Button onPress={handleBookWalker} size="lg">
            Book Walker
          </Button>
        </View>
      </View>
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
    paddingTop: 0, // Set dynamically with insets
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.white,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  reviewCount: {
    fontSize: 14,
    color: colors.inkMuted,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.emberDark,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    marginTop: 1,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.paperDark,
  },
  section: {
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  seeAll: {
    fontSize: 14,
    color: colors.ember,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 15,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  review: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  reviewText: {
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: 100, // Account for tab bar (72px) + safe area
    backgroundColor: colors.white,
    ...shadows.elevated,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ember,
  },
  priceUnit: {
    fontSize: 14,
    color: colors.inkMuted,
    marginLeft: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messageButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.emberLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
