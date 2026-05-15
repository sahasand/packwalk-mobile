import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Clock, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthQuery } from '@/lib/useAuthQuery';

import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { Avatar, Card, Button, PawIcon } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

export default function TrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch walk data - this will auto-update when walker sends location updates
  const walk = useAuthQuery(api.walks.getById, id ? { walkId: id as Id<'walks'> } : 'skip');
  const dogs = useAuthQuery(api.dogs.listMine, {});
  // Fetch walker info to display name
  const walkerInfo = useAuthQuery(
    api.walkerProfiles.getPublicByUserId,
    walk ? { userId: walk.walkerId } : 'skip',
  );

  const handleEmergency = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      Alert.alert(
        'Emergency',
        'Please call 911 for emergencies.',
        [{ text: 'OK' }]
      );
    } else {
      Linking.openURL('tel:911');
    }
  };

  // Calculate elapsed time
  const getElapsedTime = () => {
    if (!walk?.startedAt) return '00:00';
    const elapsed = Date.now() - walk.startedAt;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format start time
  const getStartTime = () => {
    if (!walk?.scheduledTime) return '';
    const date = new Date(walk.scheduledTime);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format distance (2 decimal places for consistency with other screens)
  const getDistance = () => {
    if (!walk?.distanceMeters) return '0.00 km';
    return `${(walk.distanceMeters / 1000).toFixed(2)} km`;
  };

  // Get dog names
  const dogNames = dogs
    ?.filter(dog => walk?.dogIds.includes(dog._id))
    .map(dog => dog.name) || [];

  // Force re-render every second to update elapsed time
  const [, setTick] = useState(0);
  useEffect(() => {
    if (walk?.status === 'in_progress') {
      const timer = setInterval(() => {
        setTick(t => t + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [walk?.status]);

  // Loading state
  if (!walk) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.ember} />
          <Text style={styles.loadingText}>Loading walk details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Status Card (Replaces Map) */}
        <View style={styles.statusContainer}>
            <View style={styles.statusIcon}>
                <PawIcon size={64} color={colors.ember} />
            </View>
            <Text style={styles.statusTitle}>Walk in Progress</Text>
            <Text style={styles.statusSubtitle}>
                Your walker is taking excellent care of {dogNames.join(' & ')}.
            </Text>
            <Text style={styles.elapsedTime}>{getElapsedTime()}</Text>
            <Text style={styles.elapsedLabel}>ELAPSED TIME</Text>

            {/* Location info */}
            {walk.lastLocation && (
              <View style={styles.locationInfo}>
                <MapPin size={16} color={colors.inkMuted} />
                <Text style={styles.locationText}>
                  Last updated: {new Date(walk.lastLocation.timestamp).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
              </View>
            )}
        </View>

        {/* Walker Info Card */}
        <Card style={styles.walkerCard}>
          <View style={styles.walkerHeader}>
            <Avatar size="md" online source={walkerInfo?.user?.avatarUrl} name={walkerInfo?.user?.name} />
            <View style={styles.walkerInfo}>
              <Text style={styles.walkerName}>
                {walkerInfo?.user.name ?? 'Your Walker'}
              </Text>
              <Text style={styles.walkerRole}>Professional Walker</Text>
            </View>
          </View>
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard} variant="outlined">
            <Clock size={20} color={colors.ember} style={styles.statIcon} />
            <Text style={styles.statValue}>{getStartTime()}</Text>
            <Text style={styles.statLabel}>Start Time</Text>
          </Card>
          <Card style={styles.statCard} variant="outlined">
            <MapPin size={20} color={colors.sage} style={styles.statIcon} />
            <Text style={styles.statValue}>{getDistance()}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </Card>
        </View>

        {/* Emergency Button */}
        <Button
          variant="outline"
          style={styles.emergencyButton}
          textStyle={styles.emergencyText}
          onPress={handleEmergency}
          icon={<Shield size={18} color={colors.error} />}
        >
          Safety & Emergency
        </Button>
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
    backgroundColor: colors.paper,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...shadows.subtle,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
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
    padding: spacing.lg,
    paddingBottom: 100,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  statusIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 4,
    borderColor: colors.white,
    ...shadows.soft,
  },
  statusTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  statusSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  elapsedTime: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.ember,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  elapsedLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },
  locationText: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
  },
  walkerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  walkerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walkerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  walkerName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  walkerRole: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  statIcon: {
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
  },
  emergencyButton: {
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
  },
  emergencyText: {
    color: colors.error,
  },
});