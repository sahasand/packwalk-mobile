import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle, ChevronRight } from 'lucide-react-native';

import { Avatar, Card, EmptyState } from '@/components/ui';
import { useAuthQuery } from '@/lib/useAuthQuery';
import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppStore } from '@/stores/appStore';
import type { Doc } from '@/convex/_generated/dataModel';

export default function WalkerMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAppStore();

  // Fetch all conversations
  const conversations = useAuthQuery(api.conversations.listMine, {});

  // Get owner IDs to fetch their profiles
  const ownerIds = conversations?.map((c) => c.ownerId) || [];

  // Fetch owner profiles for display
  const ownerProfiles = useAuthQuery(
    api.users.getPublicProfiles,
    ownerIds.length > 0 ? { userIds: ownerIds } : 'skip'
  );

  const handleConversationPress = (conversation: Doc<'conversations'>) => {
    router.push(`/(walker)/chat/${conversation.ownerId}`);
  };

  const formatTime = (timestamp: number | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderConversation = ({ item, index }: { item: Doc<'conversations'>; index: number }) => {
    const ownerProfile = ownerProfiles?.find((p) => p?._id === item.ownerId);
    const unreadCount = item.unreadCountWalker || 0;
    const hasUnread = unreadCount > 0;

    // Check if current user sent the last message
    const isOwnMessage = item.lastMessageSenderId === user?.id;
    const messagePreview = item.lastMessagePreview
      ? (isOwnMessage ? `You: ${item.lastMessagePreview}` : item.lastMessagePreview)
      : 'No messages yet';

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            source={ownerProfile?.avatarUrl}
            name={ownerProfile?.name || 'Owner'}
            size="lg"
          />
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.ownerName, hasUnread && styles.ownerNameUnread]}>
              {ownerProfile?.name || 'Owner'}
            </Text>
            <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </View>

          <View style={styles.subtitleRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>Dog Owner</Text>
            </View>
          </View>

          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {messagePreview}
          </Text>
        </View>

        <ChevronRight size={20} color={colors.inkMuted} style={styles.chevron} />
      </TouchableOpacity>
    );
  };

  // Loading state
  if (conversations === undefined) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon={<MessageCircle size={48} color={colors.inkMuted} />}
            title="No messages yet"
            subtitle="When owners book walks with you, you can chat with them here"
          />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    ...shadows.soft,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 120,
    gap: spacing.sm,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    ...shadows.soft,
  },
  avatarContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  conversationContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ownerName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  ownerNameUnread: {
    fontWeight: typography.weights.bold,
  },
  timestamp: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
  },
  timestampUnread: {
    color: colors.sage,
    fontWeight: typography.weights.medium,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['2xs'],
  },
  roleBadge: {
    backgroundColor: colors.emberGlow,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.ember,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastMessage: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  lastMessageUnread: {
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
