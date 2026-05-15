import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Calendar, Clock, MapPin, MessageCircle, Navigation } from 'lucide-react-native';
import { useAuthQuery, useAuthAction } from '@/lib/useAuthQuery';

import { Button, Card, Avatar, Badge, PawIcon, ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

export default function WalkDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Fetch walk data
  const walk = useAuthQuery(api.walks.getById, id ? { walkId: id as Id<'walks'> } : 'skip');
  // Use payment-aware cancel action to issue refund
  const cancelWalk = useAuthAction(api.payments.cancelWalkWithRefund);

  // Fetch related data
  const dogs = useAuthQuery(api.dogs.listMine, {});

  // Fetch walker profile
  const walkerProfile = useAuthQuery(
    api.walkerProfiles.getPublicByUserId,
    walk?.walkerId ? { userId: walk.walkerId } : 'skip'
  );

  const handleMessage = () => {
    if (walk?.walkerId) {
      router.push(`/(owner)/chat/${walk.walkerId}`);
    }
  };

  const handleCancelConfirm = async () => {
    if (!id) return;

    try {
      await cancelWalk({ walkId: id as Id<'walks'> });
      toast.show('Walk cancelled successfully', 'success');
      setShowCancelDialog(false);
      router.back();
    } catch (error) {
      toast.show('Failed to cancel walk', 'error');
    }
  };

  // Loading state
  if (!walk) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>Walk Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.ember} />
          <Text style={styles.loadingText}>Loading walk details...</Text>
        </View>
      </View>
    );
  }

  // Format date and time
  const walkDate = new Date(walk.scheduledTime);
  const dateStr = walkDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: walkDate.toDateString() === new Date().toDateString() ? 'short' : undefined
  });
  const timeStr = walkDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Calculate duration in minutes (estimate from scheduled time)
  const duration = 30; // Default for now, can be enhanced later

  // Get dog names
  const dogNames = dogs
    ?.filter(dog => walk.dogIds.includes(dog._id))
    .map(dog => dog.name) || [];

  // Get status badge variant
  const getStatusVariant = () => {
    switch (walk.status) {
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'scheduled':
        return 'info';
      case 'cancelled':
      case 'no_show':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get status label
  const getStatusLabel = () => {
    switch (walk.status) {
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'scheduled':
        return 'Scheduled';
      case 'cancelled':
        return 'Cancelled';
      case 'no_show':
        return 'No Show';
      default:
        return walk.status;
    }
  };

  const canCancel = walk.status === 'scheduled';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Walk Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.statusContainer}>
          <Badge variant={getStatusVariant()} size="md">
            {getStatusLabel()}
          </Badge>
        </Animated.View>

        {/* Live Tracking Button - show when walk is in progress */}
        {walk.status === 'in_progress' && (
          <Animated.View entering={FadeInDown.delay(150)} style={styles.trackingContainer}>
            <Button
              onPress={() => router.push(`/(owner)/tracking/${id}`)}
              fullWidth
              size="lg"
              icon={<Navigation size={18} color={colors.white} />}
            >
              Track Live
            </Button>
          </Animated.View>
        )}

        {/* Walker Card */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Card style={styles.walkerCard}>
            <View style={styles.walkerHeader}>
              <Avatar
                size="lg"
                showBorder
                source={walkerProfile?.user?.avatarUrl}
                name={walkerProfile?.user?.name}
              />
              <View style={styles.walkerInfo}>
                <Text style={styles.walkerName}>{walkerProfile?.user?.name || 'Your Walker'}</Text>
                <Text style={styles.walkerLabel}>Professional Walker</Text>
              </View>
            </View>
            <View style={styles.walkerActions}>
              <TouchableOpacity style={styles.walkerAction} onPress={handleMessage}>
                <MessageCircle size={20} color={colors.ember} />
                <Text style={styles.walkerActionText}>Message</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </Animated.View>

        {/* Walk Info */}
        <Animated.View entering={FadeInDown.delay(300)}>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Calendar size={20} color={colors.ember} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{dateStr}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Clock size={20} color={colors.ember} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Time</Text>
                <Text style={styles.infoValue}>{timeStr} • {duration} min</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <PawIcon size={20} color={colors.ember} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Dogs</Text>
                <Text style={styles.infoValue}>
                  {dogNames.length > 0 ? dogNames.join(' & ') : 'Loading...'}
                </Text>
              </View>
            </View>

            {walk.pickupLocationSnapshot?.addressLine1 && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <MapPin size={20} color={colors.ember} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Pickup Location</Text>
                  <Text style={styles.infoValue}>{walk.pickupLocationSnapshot.addressLine1}</Text>
                </View>
              </View>
            )}

            {/* Distance - show for completed/in_progress walks with tracked distance */}
            {(walk.status === 'completed' || walk.status === 'in_progress') &&
              walk.distanceMeters !== undefined && walk.distanceMeters > 0 && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Navigation size={20} color={colors.ember} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>Distance Walked</Text>
                  <Text style={styles.infoValue}>
                    {(walk.distanceMeters / 1000).toFixed(2)} km
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Notes */}
        {walk.pickupLocationSnapshot?.notes && (
          <Animated.View entering={FadeInDown.delay(400)}>
            <Card style={styles.notesCard}>
              <Text style={styles.notesTitle}>Notes for Walker</Text>
              <Text style={styles.notesText}>{walk.pickupLocationSnapshot.notes}</Text>
            </Card>
          </Animated.View>
        )}

        {/* Price */}
        <Animated.View entering={FadeInDown.delay(500)}>
          <Card style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>Total</Text>
              {walk.status === 'completed' && (
                <Text style={styles.missionNote}>
                  ${((walk.totalPrice * 0.2) / 100).toFixed(2)} supports Toronto rescues
                </Text>
              )}
            </View>
            <Text style={styles.priceValue}>
              ${(walk.totalPrice / 100).toFixed(2)}
            </Text>
          </Card>
        </Animated.View>

        {/* Cancel Button - only show if walk can be cancelled */}
        {canCancel && (
          <Animated.View entering={FadeInDown.delay(600)} style={styles.cancelContainer}>
            <Button variant="outline" onPress={() => setShowCancelDialog(true)} fullWidth>
              Cancel Walk
            </Button>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        visible={showCancelDialog}
        title="Cancel Walk?"
        message="Are you sure you want to cancel this walk? This action cannot be undone."
        confirmLabel="Yes, Cancel Walk"
        cancelLabel="Keep Walk"
        variant="danger"
        icon="cancel"
        onConfirm={handleCancelConfirm}
        onCancel={() => setShowCancelDialog(false)}
      />
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
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trackingContainer: {
    marginBottom: spacing.lg,
  },
  walkerCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  walkerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  walkerInfo: {
    marginLeft: spacing.md,
  },
  walkerName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  walkerLabel: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
  },
  walkerActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },
  walkerAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.emberGlow,
    borderRadius: radius.md,
  },
  walkerActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ember,
  },
  infoCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoLabel: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
  },
  infoValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  notesCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  notesTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  notesText: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  priceCard: {
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  priceLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    color: colors.ember,
  },
  missionNote: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.sage,
    marginTop: spacing.xs,
  },
  cancelContainer: {
    marginTop: spacing.md,
  },
});
