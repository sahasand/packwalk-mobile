import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Check,
  MessageCircle,
  MapPin,
  DollarSign,
  Star,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthQuery, useAuthMutation } from '@/lib/useAuthQuery';

import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { Avatar, Card, Badge, EmptyState } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

// Helper function to format timestamp
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Map notification type and data to display info
const getNotificationDisplay = (type: string, data: any) => {
  const subtype = data?.subtype;

  switch (type) {
    case 'walk_request':
      return {
        icon: Bell,
        iconColor: colors.ember,
        iconBg: colors.emberLight,
        title: 'New Walk Request',
        message: 'You have a new walk request waiting for confirmation.',
      };

    case 'walk_update':
      switch (subtype) {
        case 'accepted':
          return {
            icon: CheckCircle,
            iconColor: colors.sage,
            iconBg: colors.sageLight,
            title: 'Walk Accepted',
            message: 'Your walk request has been accepted!',
          };
        case 'starting':
          return {
            icon: MapPin,
            iconColor: colors.ember,
            iconBg: colors.emberLight,
            title: 'Walk Starting',
            message: data?.walkerName ? `${data.walkerName} has started the walk.` : 'Your walker has started the walk.',
          };
        case 'completed':
          return {
            icon: CheckCircle,
            iconColor: colors.sage,
            iconBg: colors.sageLight,
            title: 'Walk Completed',
            message: 'Your walk is complete! Check out the report.',
          };
        case 'cancelled':
          return {
            icon: XCircle,
            iconColor: colors.error,
            iconBg: '#FCE8E8',
            title: 'Walk Cancelled',
            message: data?.reason || 'A walk has been cancelled.',
          };
        case 'no_show':
          return {
            icon: AlertCircle,
            iconColor: colors.warning,
            iconBg: '#FEF3DC',
            title: 'No Show',
            message: 'A walk was marked as no-show.',
          };
        default:
          return {
            icon: Clock,
            iconColor: colors.ember,
            iconBg: colors.emberLight,
            title: 'Walk Update',
            message: 'Your walk status has been updated.',
          };
      }

    case 'message':
      return {
        icon: MessageCircle,
        iconColor: colors.ember,
        iconBg: colors.emberLight,
        title: 'New Message',
        message: data?.preview || 'You received a new message.',
      };

    case 'payout_update':
      switch (subtype) {
        case 'ready':
          return {
            icon: DollarSign,
            iconColor: colors.sage,
            iconBg: colors.sageLight,
            title: 'Payout Ready',
            message: 'New earnings are ready for payout.',
          };
        case 'paid':
          return {
            icon: DollarSign,
            iconColor: colors.sage,
            iconBg: colors.sageLight,
            title: 'Payout Sent',
            message: data?.amount ? `$${data.amount} has been sent to your account.` : 'Your payout was sent.',
          };
        default:
          return {
            icon: DollarSign,
            iconColor: colors.ember,
            iconBg: colors.emberLight,
            title: 'Payout Update',
            message: 'Your payout status has been updated.',
          };
      }

    case 'review':
      return {
        icon: Star,
        iconColor: colors.ember,
        iconBg: colors.emberLight,
        title: 'New Review',
        message: data?.rating ? `You received a ${data.rating}-star review!` : 'You received a new review.',
      };

    case 'system':
      return {
        icon: Bell,
        iconColor: colors.ink,
        iconBg: colors.paperDark,
        title: data?.title || 'System Notification',
        message: data?.message || 'You have a new notification.',
      };

    default:
      return {
        icon: Bell,
        iconColor: colors.ink,
        iconBg: colors.paperDark,
        title: 'Notification',
        message: 'You have a new update.',
      };
  }
};

type Notification = {
  _id: Id<'notifications'>;
  userId: Id<'users'>;
  type: 'walk_request' | 'walk_update' | 'message' | 'payout_update' | 'review' | 'system';
  data: any;
  isRead: boolean;
  createdAt: number;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Fetch notifications from Convex
  const notifications = useAuthQuery(api.notifications.listMine, { limit: 50 });
  const markRead = useAuthMutation(api.notifications.markRead);
  const markAllRead = useAuthMutation(api.notifications.markAllRead);

  const handleMarkAsRead = async (notificationId: Id<'notifications'>) => {
    try {
      await markRead({ notificationId });
    } catch (error) {
      // Silent fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllRead({});
    } catch (error) {
      // Silent fail
    }
  };

  const renderItem = ({ item, index }: { item: Notification; index: number }) => {
    const display = getNotificationDisplay(item.type, item.data);
    const IconComponent = display.icon;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <TouchableOpacity
          style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
          onPress={() => !item.isRead && handleMarkAsRead(item._id)}
          activeOpacity={0.7}
        >
          <View style={styles.contentRow}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: display.iconBg }]}>
                <IconComponent size={20} color={display.iconColor} strokeWidth={2} />
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>

            {/* Text Content */}
            <View style={styles.textContent}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>
                  {display.title}
                </Text>
                <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
              </View>
              <Text style={styles.message} numberOfLines={2}>
                {display.message}
              </Text>
            </View>
          </View>

          {/* Action (Mark Read) */}
          {!item.isRead && (
            <TouchableOpacity
              style={styles.markReadAction}
              onPress={() => handleMarkAsRead(item._id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Mark notification as read"
              accessibilityRole="button"
            >
              <View style={styles.checkCircle}>
                <Check size={12} color={colors.white} />
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const isLoading = notifications === undefined;
  const hasUnreadNotifications = notifications?.some(n => !n.isRead) ?? false;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          onPress={handleMarkAllAsRead}
          style={styles.actionButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Mark all as read"
          accessibilityRole="button"
          disabled={!hasUnreadNotifications}
        >
          <Text style={[styles.actionText, !hasUnreadNotifications && styles.actionTextDisabled]}>
            Read All
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.ember} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={<Bell size={48} color={colors.stone} />}
              title="No notifications"
              subtitle="You're all caught up! Check back later for updates."
              variant="compact"
            />
          }
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  actionButton: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ember,
  },
  actionTextDisabled: {
    color: colors.inkMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  unreadCard: {
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.ember,
  },
  contentRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ember,
    borderWidth: 2,
    borderColor: colors.white,
  },
  textContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  unreadTitle: {
    fontWeight: typography.weights.bold,
  },
  time: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  markReadAction: {
    padding: spacing.sm,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
});