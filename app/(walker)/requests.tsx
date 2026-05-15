import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Clock,
  MapPin,
  Calendar,
  Check,
  X,
  MessageCircle,
} from 'lucide-react-native';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { Card, Avatar, Badge, Button, PawIcon } from '@/components/ui';
import { useAuthQuery, useAuthAction, useAuthMutation } from '@/lib/useAuthQuery';
import { useToast } from '@/components/ui/Toast';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';

// Helper to format date/time from timestamp
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export default function RequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Convex queries and mutations - use enriched query for owner info
  // useAuthQuery skips query when not logged in
  const walkRequests = useAuthQuery(api.walkRequests.listForWalkerEnriched, {});
  // Use payment-aware accept action to capture the authorized payment
  const acceptAction = useAuthAction(api.payments.acceptWalkRequestWithCapture);
  const declineMutation = useAuthMutation(api.walkRequests.decline);

  // Track loading states for individual requests
  const [loadingRequestId, setLoadingRequestId] = useState<Id<'walkRequests'> | null>(null);

  const handleAccept = async (requestId: Id<'walkRequests'>) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoadingRequestId(requestId);
      // Use payment-aware action to capture payment on accept
      await acceptAction({ requestId });
      toast.show('Walk request accepted!', 'success');
    } catch (error: any) {
      toast.show(error?.message || 'Failed to accept request', 'error');
    } finally {
      setLoadingRequestId(null);
    }
  };

  const handleDecline = async (requestId: Id<'walkRequests'>) => {
    try {
      setLoadingRequestId(requestId);
      await declineMutation({ requestId });
      toast.show('Request declined', 'info');
    } catch (error: any) {
      toast.show(error?.message || 'Failed to decline request', 'error');
    } finally {
      setLoadingRequestId(null);
    }
  };

  // Loading state
  if (walkRequests === undefined) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>Walk Requests</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptySubtitle}>Loading requests...</Text>
        </View>
      </View>
    );
  }

  const requests = walkRequests || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Walk Requests</Text>
        <Badge variant="warning" size="md">
          {requests.length} pending
        </Badge>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <PawIcon size={80} color={colors.stone} />
            <Text style={styles.emptyTitle}>No pending requests</Text>
            <Text style={styles.emptySubtitle}>
              New walk requests will appear here
            </Text>
          </View>
        ) : (
          requests.map((request, index) => {
            const isLoading = loadingRequestId === request._id;

            return (
              <Animated.View
                key={request._id}
                entering={FadeInDown.delay(index * 100).duration(400)}
                exiting={FadeOut.duration(300)}
                layout={Layout.springify()}
              >
                <Card style={styles.requestCard} variant="default">
                  {/* Header */}
                  <View style={styles.requestHeader}>
                    <Avatar size="lg" source={request.owner?.avatarUrl} name={request.owner?.name} />
                    <View style={styles.requestInfo}>
                      <Text style={styles.ownerName}>{request.owner?.name || 'Unknown Owner'}</Text>
                      <Text style={styles.dogNames}>
                        {request.dogNames?.join(', ') || `${request.dogIds.length} ${request.dogIds.length === 1 ? 'dog' : 'dogs'}`}
                      </Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.price}>${(request.quotedPrice / 100).toFixed(2)}</Text>
                      <Text style={styles.duration}>{request.durationMinutes} min</Text>
                    </View>
                  </View>

                  {/* Details */}
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Calendar size={16} color={colors.inkMuted} />
                        <Text style={styles.detailText}>{formatDate(request.scheduledTime)}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Clock size={16} color={colors.inkMuted} />
                        <Text style={styles.detailText}>{formatTime(request.scheduledTime)}</Text>
                      </View>
                    </View>
                    <View style={styles.detailItem}>
                      <MapPin size={16} color={colors.inkMuted} />
                      <Text style={styles.detailText}>
                        {request.pickupLocation.addressLine1 ||
                          `${request.pickupLocation.lat.toFixed(4)}, ${request.pickupLocation.lng.toFixed(4)}`}
                      </Text>
                    </View>
                  </View>

                  {/* Notes */}
                  {request.message && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes:</Text>
                      <Text style={styles.notesText}>{request.message}</Text>
                    </View>
                  )}

                  {/* Time ago */}
                  <Text style={styles.timeAgo}>Requested {formatTimeAgo(request.createdAt)}</Text>

                  {/* Actions */}
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.messageButton}
                      onPress={() => router.push(`/(walker)/chat/${request.ownerId}`)}
                      disabled={isLoading}
                    >
                      <MessageCircle size={20} color={colors.sage} />
                    </Pressable>
                    <Button
                      variant="outline"
                      size="md"
                      onPress={() => handleDecline(request._id)}
                      style={styles.declineButton}
                      disabled={isLoading}
                      loading={isLoading}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onPress={() => handleAccept(request._id)}
                      icon={<Check size={18} color={colors.white} />}
                      style={styles.acceptButton}
                      disabled={isLoading}
                      loading={isLoading}
                    >
                      Accept
                    </Button>
                  </View>
                </Card>
              </Animated.View>
            );
          })
        )}

        <View style={{ height: 120 }} />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: typography.tracking.tight,
  },

  content: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 100,
  },

  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: spacing.lg,
  },

  emptySubtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },

  requestCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },

  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  requestInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },

  ownerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  dogNames: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  priceContainer: {
    alignItems: 'flex-end',
  },

  price: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.sage,
  },

  duration: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    marginTop: spacing['2xs'],
  },

  detailsContainer: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },

  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  detailText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  notesContainer: {
    marginBottom: spacing.md,
  },

  notesLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.xs,
  },

  notesText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.ink,
    lineHeight: typography.sizes.sm * typography.leading.relaxed,
  },

  timeAgo: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },

  messageButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  declineButton: {
    flex: 1,
  },

  acceptButton: {
    flex: 1.5,
  },
});
