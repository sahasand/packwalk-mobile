import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ArrowLeft, Star, Heart, ThumbsUp, Sparkles } from 'lucide-react-native';
import { useAuthQuery, useAuthMutation, useAuthAction } from '@/lib/useAuthQuery';

import { Card, Avatar, Button, PawIcon } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes, animation } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useToast } from '@/components/ui/Toast';

const { width } = Dimensions.get('window');

const quickTags = [
  { id: '1', label: 'Great with dogs', icon: Heart },
  { id: '2', label: 'On time', icon: ThumbsUp },
  { id: '3', label: 'Excellent updates', icon: Sparkles },
  { id: '4', label: 'Very friendly', icon: Heart },
];

export default function ReviewScreen() {
  const router = useRouter();
  const { walkId } = useLocalSearchParams<{ walkId: string }>();
  const toast = useToast();

  // Fetch walk data
  const walk = useAuthQuery(api.walks.getById, walkId ? { walkId: walkId as Id<'walks'> } : 'skip');

  // Fetch walker info for review (includes canReceiveTips status)
  const walkerData = useAuthQuery(
    api.walkerProfiles.getWalkerForReview,
    walk?.walkerId ? { userId: walk.walkerId } : 'skip'
  );

  // Check if already reviewed
  const existingReview = useAuthQuery(api.reviews.getByWalkId, walkId ? { walkId: walkId as Id<'walks'> } : 'skip');

  // Create review mutation (without tip) and payment action (with tip)
  const createReview = useAuthMutation(api.reviews.create);
  const createReviewWithTip = useAuthAction(api.payments.createReviewWithTip);

  // Calculate duration in minutes from actual walk times (must be before early returns)
  const durationMinutes = React.useMemo(() => {
    if (walk?.startedAt && walk?.completedAt) {
      return Math.round((walk.completedAt - walk.startedAt) / (1000 * 60));
    }
    return 30; // Default fallback
  }, [walk?.startedAt, walk?.completedAt]);

  // Check if within 7-day tip window (must be before early returns)
  const isWithinTipWindow = React.useMemo(() => {
    if (!walk?.completedAt) return false;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - walk.completedAt <= SEVEN_DAYS_MS;
  }, [walk?.completedAt]);

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [review, setReview] = useState('');
  const [tip, setTip] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Star animation scales - must be explicit hooks (not in loop)
  const starScale0 = useSharedValue(1);
  const starScale1 = useSharedValue(1);
  const starScale2 = useSharedValue(1);
  const starScale3 = useSharedValue(1);
  const starScale4 = useSharedValue(1);
  const starScales = [starScale0, starScale1, starScale2, starScale3, starScale4];

  // Animated styles for stars - must be explicit hooks (not in map)
  const starStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: starScale0.value }] }));
  const starStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: starScale1.value }] }));
  const starStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: starScale2.value }] }));
  const starStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: starScale3.value }] }));
  const starStyle4 = useAnimatedStyle(() => ({ transform: [{ scale: starScale4.value }] }));
  const starStyles = [starStyle0, starStyle1, starStyle2, starStyle3, starStyle4];

  const handleStarPress = (index: number) => {
    setRating(index + 1);
    starScales[index].value = withSpring(1.3, animation.spring.bouncy);
    setTimeout(() => {
      starScales[index].value = withSpring(1, animation.spring.gentle);
    }, 150);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    if (!walk || rating === 0) return;

    setIsSubmitting(true);
    try {
      // Build comment from review text and tags
      const tagLabels = selectedTags.map(id => quickTags.find(t => t.id === id)?.label).filter(Boolean);
      const comment = [review.trim(), ...tagLabels].filter(Boolean).join(' • ') || undefined;

      // Convert tip from dollars to cents
      const tipAmountCents = tip && tip > 0 ? Math.round(tip * 100) : 0;

      if (tipAmountCents > 0) {
        // Use payment action to charge the tip
        await createReviewWithTip({
          walkId: walk._id,
          rating,
          comment,
          tipAmount: tipAmountCents,
        });
        toast.show('Review submitted with tip!', 'success');
      } else {
        // No tip, use simple mutation
        await createReview({
          walkId: walk._id,
          rating: rating as 1 | 2 | 3 | 4 | 5,
          comment,
          tipAmount: undefined,
        });
        toast.show('Review submitted successfully!', 'success');
      }

      router.replace('/(owner)/walks');
    } catch (error: unknown) {
      // Parse Convex error codes for specific messages
      let message = 'Failed to submit review. Please try again.';

      if (error && typeof error === 'object' && 'data' in error) {
        const convexError = error as { data?: { code?: string; message?: string } };
        const code = convexError.data?.code;

        switch (code) {
          case 'payments/connect_required':
            message = "This walker isn't set up to receive tips yet. Try submitting without a tip.";
            break;
          case 'state/invalid_transition':
            message = 'This walk has already been reviewed.';
            break;
          case 'validation/error':
            message = convexError.data?.message || 'Please check your input and try again.';
            break;
          case 'auth/not_authenticated':
            message = 'Please log in and try again.';
            break;
          default:
            // Check for Stripe-related errors in the message
            const errMsg = convexError.data?.message?.toLowerCase() || '';
            if (errMsg.includes('card') || errMsg.includes('declined') || errMsg.includes('payment')) {
              message = 'Payment failed. Please try again.';
            }
        }
      }

      toast.show(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tipOptions = [3, 5, 10];

  // Loading state
  if (walk === undefined || existingReview === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Rate Your Walk</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.ember} />
        </View>
      </View>
    );
  }

  // Walk not found or not completed
  if (!walk || walk.status !== 'completed') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Rate Your Walk</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {!walk ? 'Walk not found' : 'Only completed walks can be reviewed'}
          </Text>
          <Button onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  // Already reviewed - show read-only view
  if (existingReview) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Your Review</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Card style={styles.reviewedCard} variant="paper">
            <View style={styles.reviewedHeader}>
              <View style={styles.starsContainer}>
                {[0, 1, 2, 3, 4].map((index) => (
                  <Star
                    key={index}
                    size={32}
                    color={index < existingReview.rating ? colors.gold : colors.stone}
                    fill={index < existingReview.rating ? colors.gold : 'transparent'}
                    strokeWidth={1.5}
                  />
                ))}
              </View>
              <Text style={styles.reviewedDate}>
                {new Date(existingReview.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>

            {existingReview.comment && (
              <Text style={styles.reviewedComment}>{existingReview.comment}</Text>
            )}

            {existingReview.tipAmount && existingReview.tipAmount > 0 && (
              <View style={styles.reviewedTip}>
                <Text style={styles.reviewedTipLabel}>Tip:</Text>
                <Text style={styles.reviewedTipAmount}>
                  ${(existingReview.tipAmount / 100).toFixed(2)}
                </Text>
              </View>
            )}
          </Card>

          <Button
            fullWidth
            size="lg"
            onPress={() => router.back()}
            style={{ marginTop: spacing.xl }}
          >
            Done
          </Button>
        </ScrollView>
      </View>
    );
  }

  const walkPrice = walk.totalPrice / 100; // Convert from cents to dollars

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Rate Your Walk</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Walk Info */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.walkerSection}>
          <Avatar
            size="xl"
            showRing
            ringColor={colors.ember}
            source={walkerData?.user?.avatarUrl}
            name={walkerData?.user?.name}
          />
          <Text style={styles.walkerName}>{walkerData?.user?.name || 'Your Walker'}</Text>
          <Text style={styles.walkInfo}>
            {durationMinutes} min walk
          </Text>
        </Animated.View>

        {/* Star Rating */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>How was your experience?</Text>
          <View style={styles.starsContainer}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Pressable key={index} onPress={() => handleStarPress(index)}>
                <Animated.View style={starStyles[index]}>
                  <Star
                    size={44}
                    color={index < rating ? colors.gold : colors.stone}
                    fill={index < rating ? colors.gold : 'transparent'}
                    strokeWidth={1.5}
                  />
                </Animated.View>
              </Pressable>
            ))}
          </View>
          {rating > 0 && (
            <Animated.Text entering={FadeIn} style={styles.ratingLabel}>
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </Animated.Text>
          )}
        </Animated.View>

        {/* Quick Tags */}
        {rating > 0 && (
          <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>What stood out?</Text>
            <View style={styles.tagsGrid}>
              {quickTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.tag, isSelected && styles.tagSelected]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <tag.icon
                      size={16}
                      color={isSelected ? colors.ember : colors.inkMuted}
                    />
                    <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Written Review */}
        {rating > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.reviewSection}>
            <Text style={styles.sectionTitle}>Write a review (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="Share your experience..."
              placeholderTextColor={colors.inkMuted}
              value={review}
              onChangeText={setReview}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>
        )}

        {/* Tip Section - only show if walker can receive tips AND within 7-day window */}
        {rating > 0 && walkerData?.canReceiveTips && isWithinTipWindow && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.tipSection}>
            <View style={styles.tipHeader}>
              <Text style={styles.sectionTitle}>Add a tip</Text>
              <Text style={styles.tipSubtitle}>80% to walker + 20% to shelters</Text>
            </View>

            <View style={styles.tipOptions}>
              {tipOptions.map((amount) => (
                <Pressable
                  key={amount}
                  style={[styles.tipOption, tip === amount && styles.tipOptionSelected]}
                  onPress={() => setTip(tip === amount ? null : amount)}
                >
                  <Text style={[styles.tipAmount, tip === amount && styles.tipAmountSelected]}>
                    ${amount}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Tip window closed message (walker CAN receive tips but window expired) */}
        {rating > 0 && walkerData?.canReceiveTips && !isWithinTipWindow && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.tipUnavailable}>
            <Text style={styles.tipUnavailableText}>
              Tip window has closed (7 days)
            </Text>
          </Animated.View>
        )}

        {/* Tip unavailable message (walker can't receive tips) */}
        {rating > 0 && walkerData && !walkerData.canReceiveTips && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.tipUnavailable}>
            <Text style={styles.tipUnavailableText}>
              Tips are currently unavailable for this walker
            </Text>
          </Animated.View>
        )}

        {/* Summary */}
        {rating > 0 && (
          <Animated.View entering={FadeInUp.delay(400).duration(400)}>
            <Card style={styles.summaryCard} variant="paper">
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Walk price</Text>
                <Text style={styles.summaryValue}>${walkPrice.toFixed(2)}</Text>
              </View>
              {tip && tip > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tip</Text>
                    <Text style={styles.summaryValue}>${tip.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRowIndented}>
                    <Text style={styles.summaryLabelSmall}>Walker receives</Text>
                    <Text style={styles.summaryValueSmall}>${(tip * 0.8).toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRowIndented}>
                    <Text style={styles.summaryLabelSmall}>Shelter donation</Text>
                    <Text style={[styles.summaryValueSmall, { color: colors.sage }]}>
                      ${(tip * 0.2).toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${(walkPrice + (tip || 0)).toFixed(2)}</Text>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <Button
            fullWidth
            size="lg"
            onPress={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            loading={isSubmitting}
          >
            {rating === 0 ? 'Select a Rating' : isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
          <Pressable style={styles.skipButton} onPress={() => router.replace('/(owner)/walks')}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
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
    paddingTop: 60,
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

  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  errorText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textAlign: 'center',
  },

  // Reviewed State
  reviewedCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  reviewedHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  reviewedDate: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },

  reviewedComment: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.ink,
    lineHeight: typography.sizes.base * typography.leading.relaxed,
    marginTop: spacing.md,
  },

  reviewedTip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.stone,
  },

  reviewedTipLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  reviewedTipAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ember,
  },

  // Walker Section
  walkerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  walkerName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  walkInfo: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  // Rating Section
  ratingSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },

  starsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  ratingLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gold,
    marginTop: spacing.md,
  },

  // Tags Section
  tagsSection: {
    marginBottom: spacing.xl,
  },

  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.stone,
  },

  tagSelected: {
    backgroundColor: colors.emberGlow,
    borderColor: colors.ember,
  },

  tagText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  tagTextSelected: {
    color: colors.ember,
  },

  // Review Section
  reviewSection: {
    marginBottom: spacing.xl,
  },

  reviewInput: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 100,
    fontSize: typography.sizes.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.stone,
  },

  // Tip Section
  tipSection: {
    marginBottom: spacing.xl,
  },

  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  tipSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  tipOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  tipOption: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.stone,
  },

  tipOptionSelected: {
    backgroundColor: colors.emberGlow,
    borderColor: colors.ember,
  },

  tipAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },

  tipAmountSelected: {
    color: colors.ember,
  },

  tipUnavailable: {
    marginBottom: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.paperDark,
    borderRadius: radius.lg,
  },

  tipUnavailableText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textAlign: 'center',
  },

  // Summary Card
  summaryCard: {
    padding: spacing.md,
    marginBottom: spacing.xl,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },

  summaryLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  summaryValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  summaryRowIndented: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
  },

  summaryLabelSmall: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  summaryValueSmall: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.stone,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },

  totalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  totalValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ember,
  },

  // Submit Section
  submitSection: {
    marginBottom: spacing.lg,
  },

  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },

  skipText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
});
