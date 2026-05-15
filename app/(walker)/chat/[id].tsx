import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { Avatar, EmptyState } from '@/components/ui';
import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { useAuthQuery, useAuthMutation } from '@/lib/useAuthQuery';

export default function WalkerChatScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAppStore();

  // State to track resolved conversationId
  const [resolvedConversationId, setResolvedConversationId] = useState<Id<'conversations'> | undefined>(undefined);

  // Use explicit type param or infer from route context
  // When navigating from walk/request screens, we pass userId; from conversations list, we pass conversationId
  const isUserIdParam = type === 'user' || !type; // Default to user for backwards compatibility
  const otherUserId = isUserIdParam ? (id as Id<'users'>) : undefined;
  const directConversationId = !isUserIdParam ? (id as Id<'conversations'>) : undefined;

  // Get or create conversation from userId
  const getOrCreateConversation = useAuthMutation(api.conversations.getOrCreate);

  // Resolve userId to conversationId on mount
  useEffect(() => {
    if (otherUserId && !resolvedConversationId) {
      getOrCreateConversation({ otherUserId })
        .then((convId) => setResolvedConversationId(convId))
        .catch(() => {});
    }
  }, [otherUserId]);

  // Use direct conversationId or resolved one
  const conversationId = directConversationId || resolvedConversationId;

  // Fetch conversation details if we have a conversationId
  const conversation = useAuthQuery(
    api.conversations.getById,
    conversationId ? { conversationId } : 'skip'
  );

  // Fetch owner's public profile if we have a userId
  const ownerProfile = useAuthQuery(
    api.users.getPublicProfile,
    otherUserId ? { userId: otherUserId } : 'skip'
  );

  // Fetch messages
  const messages = useAuthQuery(
    api.messages.list,
    conversationId ? { conversationId, limit: 50 } : 'skip'
  );

  // Mutations
  const sendMessage = useAuthMutation(api.messages.send);
  const markRead = useAuthMutation(api.messages.markConversationRead);

  // Mark conversation as read when opening
  useEffect(() => {
    if (conversationId) {
      markRead({ conversationId });
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const result = await sendMessage({
        conversationId,
        otherUserId,
        body: messageText,
      });

      // Update conversationId if this was a new conversation
      if (!conversationId && result.conversationId) {
        // The conversationId is now available, but we're already on the chat screen
        // Future messages will use this conversationId automatically through the mutation
      }
    } catch (error) {
      setNewMessage(messageText); // Restore message on error
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    if (!item || !user) return null;

    const isWalker = item.senderId === user.id;
    const messageTime = new Date(item.createdAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });

    // Get other user info from owner profile
    const otherUserAvatar = ownerProfile?.avatarUrl || '';

    return (
      <View style={[styles.messageRow, isWalker && styles.messageRowWalker]}>
        {!isWalker && <Avatar source={otherUserAvatar} name={ownerProfile?.name} size="sm" />}
        <View style={[styles.messageBubble, isWalker && styles.messageBubbleWalker]}>
          <Text style={[styles.messageText, isWalker && styles.messageTextWalker]}>
            {item.body}
          </Text>
          <Text style={[styles.messageTime, isWalker && styles.messageTimeWalker]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  // Loading state - only show loading if we're fetching an existing conversation
  const isLoading = conversationId && (messages === undefined || conversation === undefined);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.sage} />
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.sage} />
        </View>
      </View>
    );
  }

  // For new conversations (userId only), we won't have conversation data yet
  const otherUserName = ownerProfile?.name || 'Owner';
  const otherUserAvatar = ownerProfile?.avatarUrl || '';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Avatar source={otherUserAvatar} name={otherUserName} size="sm" />
        <Text style={styles.headerName}>{otherUserName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      {messages && messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <EmptyState
            title="No messages yet"
            subtitle="Start the conversation by sending a message below"
            variant="compact"
          />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages || []}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.inkMuted}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim()}
        >
          <Send size={20} color={newMessage.trim() ? colors.white : colors.inkMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    gap: spacing.sm,
    ...shadows.soft,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  messageList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  messageRowWalker: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.xs,
    ...shadows.soft,
  },
  messageBubbleWalker: {
    backgroundColor: colors.sage,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
  },
  messageText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.ink,
    lineHeight: typography.sizes.base * typography.leading.relaxed,
  },
  messageTextWalker: {
    color: colors.white,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  messageTimeWalker: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingBottom: 34,
    backgroundColor: colors.white,
    gap: spacing.sm,
    ...shadows.elevated,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    fontSize: typography.sizes.base,
    color: colors.ink,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.stone,
  },
});
