import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  User,
  Dog,
  LogOut,
  ChevronRight,
  Camera,
  Calendar,
  Star,
  Heart,
} from 'lucide-react-native';
import { useAuthQuery } from '@/lib/useAuthQuery';

import { Avatar, Card } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/convex/_generated/api';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAppStore();

  // Fetch real data for stats
  const dogs = useAuthQuery(api.dogs.listMine, { isActive: true });
  const completedWalks = useAuthQuery(api.walks.listMineOwner, { status: 'completed' });
  const scheduledWalks = useAuthQuery(api.walks.listMineOwner, { status: 'scheduled' });
  const impact = useAuthQuery(api.me.getImpact, {});

  // Calculate real stats
  const totalWalks = (completedWalks?.length || 0) + (scheduledWalks?.length || 0);
  const dogsCount = dogs?.length || 0;
  // Reviews given - count walks that are completed (each completed walk can have a review)
  const reviewsCount = completedWalks?.length || 0;

  const handleLogout = () => {
    const doLogout = () => {
      logout();
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        doLogout();
      }
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: doLogout,
          },
        ]
      );
    }
  };

  const stats = [
    { value: totalWalks.toString(), label: 'Walks', icon: Calendar, color: colors.ember },
    { value: dogsCount.toString(), label: 'Dogs', icon: Dog, color: colors.sage },
    { value: reviewsCount.toString(), label: 'Reviews', icon: Star, color: colors.gold },
  ];

  const menuItems = [
    {
      icon: User,
      label: 'Edit Profile',
      onPress: () => router.push('/(owner)/edit-profile'),
    },
    {
      icon: Dog,
      label: 'My Dogs',
      onPress: () => router.push('/(owner)/dog-editor'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header with Avatar */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Avatar
                source={user?.avatar}
                name={user?.name}
                size="2xl"
                showRing
                ringColor={colors.ember}
              />
              <Pressable style={styles.cameraButton} onPress={() => router.push('/(owner)/edit-profile')}>
                <Camera size={iconSizes.sm} color={colors.white} strokeWidth={2} />
              </Pressable>
            </View>

            <Text style={styles.name}>{user?.name || 'User'}</Text>
            <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
          </Animated.View>
        </View>

        {/* Stats Cards */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <Card key={index} style={styles.statCard} variant="default">
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <stat.icon size={iconSizes.md} color={stat.color} strokeWidth={1.5} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </Animated.View>

        {/* Impact Card */}
        <Animated.View entering={FadeInUp.delay(250).duration(500)} style={styles.impactSection}>
          <Card style={styles.impactCard} variant="default">
            <View style={styles.impactHeader}>
              <View style={styles.impactIconWrapper}>
                <Heart size={24} color={colors.white} fill={colors.white} strokeWidth={1.5} />
              </View>
              <View style={styles.impactTextWrapper}>
                <Text style={styles.impactTitle}>Your Impact</Text>
                <Text style={styles.impactSubtitle}>Supporting local rescues</Text>
              </View>
            </View>
            <View style={styles.impactAmount}>
              <Text style={styles.impactDollar}>$</Text>
              <Text style={styles.impactValue}>
                {((impact?.totalDonated || 0) / 100).toFixed(2)}
              </Text>
              <Text style={styles.impactCurrency}>CAD</Text>
            </View>
            <Text style={styles.impactDescription}>
              {impact?.walksCount === 0
                ? 'Book your first walk to start making a difference!'
                : `From ${impact?.walksCount || 0} walk${(impact?.walksCount || 0) !== 1 ? 's' : ''}, 20% donated to shelters`}
            </Text>
          </Card>
        </Animated.View>

        {/* Menu Section */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Settings</Text>

          <Card style={styles.menuCard} variant="outlined" noPadding>
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                style={[
                  styles.menuItem,
                  index !== menuItems.length - 1 && styles.menuItemBorder,
                ]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.menuItemIcon}>
                  <item.icon size={iconSizes.md} color={colors.ink} strokeWidth={1.5} />
                </View>

                <Text style={styles.menuItemLabel}>{item.label}</Text>

                <ChevronRight size={iconSizes.sm} color={colors.inkMuted} />
              </Pressable>
            ))}
          </Card>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.logoutSection}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={iconSizes.md} color={colors.error} strokeWidth={1.5} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </Animated.View>

        {/* App Version */}
        <Text style={styles.version}>Packwalk v1.0.0</Text>

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

  scrollContent: {
    paddingTop: 0,
  },

  header: {
    paddingTop: 0, // Set dynamically with insets
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },

  avatarSection: {
    alignItems: 'center',
  },

  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },

  cameraButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },

  name: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  email: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },

  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },

  statIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  statLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
  },

  impactSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },

  impactCard: {
    padding: spacing.lg,
    backgroundColor: colors.sage,
    borderRadius: radius.xl,
  },

  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  impactIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  impactTextWrapper: {
    flex: 1,
  },

  impactTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },

  impactSubtitle: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  impactAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },

  impactDollar: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginRight: 2,
  },

  impactValue: {
    fontSize: 40,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },

  impactCurrency: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: spacing.xs,
  },

  impactDescription: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },

  menuSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },

  menuSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },

  menuCard: {
    overflow: 'hidden',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  menuItemLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  logoutSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(196, 92, 92, 0.08)',
    gap: spacing.sm,
  },

  logoutText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },

  version: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
