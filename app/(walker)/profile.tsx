import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  User,
  DollarSign,
  Calendar,
  LogOut,
  ChevronRight,
  Camera,
  Star,
  Shield,
  MapPin,
  Clock,
  HelpCircle,
} from 'lucide-react-native';
import { Avatar, Card, Badge } from '@/components/ui';
import { useAuthQuery, useAuthMutation } from '@/lib/useAuthQuery';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/components/ui/Toast';

export default function WalkerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAppStore();
  const toast = useToast();

  // Fetch walker profile
  const walkerProfile = useAuthQuery(api.walkerProfiles.getMine, {});
  const updateProfile = useAuthMutation(api.walkerProfiles.upsertMine);

  // Fetch real stats data
  const completedWalks = useAuthQuery(api.walks.listMineWalker, { status: 'completed' });
  const earnings = useAuthQuery(api.earnings.listMine, {});

  // Calculate real stats
  const totalWalks = completedWalks?.length || 0;

  // Calculate this month's earnings
  const thisMonthEarnings = React.useMemo(() => {
    if (!earnings) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthlyEarnings = earnings
      .filter((e) => e.createdAt >= startOfMonth)
      .reduce((sum, e) => sum + e.amount, 0);
    return monthlyEarnings / 100; // Convert cents to dollars
  }, [earnings]);

  // Format earnings as K if >= 1000
  const formattedEarnings = thisMonthEarnings >= 1000
    ? `$${(thisMonthEarnings / 1000).toFixed(1)}k`
    : `$${thisMonthEarnings.toFixed(0)}`;

  const [available, setAvailable] = useState(walkerProfile?.isVisible ?? true);

  // Update available state when profile loads
  React.useEffect(() => {
    if (walkerProfile) {
      setAvailable(walkerProfile.isVisible);
    }
  }, [walkerProfile]);

  const handleAvailabilityToggle = async (newValue: boolean) => {
    setAvailable(newValue);

    // If no profile exists yet, don't try to update
    if (!walkerProfile) {
      toast.show('Please complete your profile first', 'warning');
      setAvailable(false);
      router.push('/(walker)/edit-profile');
      return;
    }

    try {
      await updateProfile({
        hourlyRate: walkerProfile.hourlyRate,
        bio: walkerProfile.bio,
        yearsExperience: walkerProfile.yearsExperience,
        serviceAreas: walkerProfile.serviceAreas,
        maxDistanceKm: walkerProfile.maxDistanceKm,
        availability: walkerProfile.availability,
        isVisible: newValue,
      });
      toast.show(newValue ? 'You are now visible to owners' : 'You are now invisible to owners', 'success');
    } catch (error) {
      toast.show('Failed to update availability', 'error');
      setAvailable(!newValue); // Revert on error
    }
  };

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
          { text: 'Log Out', style: 'destructive', onPress: doLogout },
        ]
      );
    }
  };

  const stats = [
    { value: totalWalks.toString(), label: 'Total Walks', icon: Calendar, color: colors.sage },
    {
      value: walkerProfile?.avgRating ? walkerProfile.avgRating.toFixed(1) : '0.0',
      label: 'Rating',
      icon: Star,
      color: colors.gold
    },
    { value: formattedEarnings, label: 'This Month', icon: DollarSign, color: colors.ember },
  ];

  const menuItems = [
    {
      icon: User,
      label: 'Edit Profile',
      onPress: () => router.push('/(walker)/edit-profile'),
    },
    {
      icon: Calendar,
      label: 'Schedule',
      onPress: () => router.push('/(walker)/schedule'),
    },
    {
      icon: MapPin,
      label: 'Service Areas',
      onPress: () => router.push('/(walker)/service-areas'),
    },
    {
      icon: DollarSign,
      label: 'Earnings & Payouts',
      onPress: () => router.push('/(walker)/earnings'),
    },
    {
      icon: Star,
      label: 'My Reviews',
      onPress: () => router.push('/(walker)/reviews'),
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      onPress: () => router.push('/(walker)/help'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Avatar
                source={user?.avatar}
                name={user?.name}
                size="2xl"
                showRing
                ringColor={colors.sage}
              />
              <Pressable style={styles.cameraButton}>
                <Camera size={iconSizes.sm} color={colors.white} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.name}>{user?.name || 'Walker'}</Text>
              <Badge variant="info" size="sm">
                <View style={styles.verifiedBadge}>
                  <Shield size={12} color={colors.sage} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </Badge>
            </View>
            <Text style={styles.email}>{user?.email || 'walker@example.com'}</Text>

            {/* Availability Toggle */}
            <View style={styles.availabilityToggle}>
              <View style={styles.availabilityInfo}>
                <Clock size={16} color={available ? colors.success : colors.inkMuted} />
                <Text style={[styles.availabilityText, available && styles.availabilityTextActive]}>
                  {available ? 'Available for walks' : 'Currently unavailable'}
                </Text>
              </View>
              <Switch
                value={available}
                onValueChange={handleAvailabilityToggle}
                trackColor={{ false: colors.stone, true: colors.sageLight }}
                thumbColor={available ? colors.sage : colors.white}
                ios_backgroundColor={colors.stone}
              />
            </View>
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

        {/* Rate Card */}
        <Animated.View entering={FadeInUp.delay(250).duration(500)} style={styles.section}>
          <Card style={styles.rateCard} variant="outlined">
            <View style={styles.rateInfo}>
              <Text style={styles.rateLabel}>Your Rate</Text>
              <Text style={styles.rateValue}>
                ${walkerProfile?.hourlyRate ? (walkerProfile.hourlyRate / 100).toFixed(0) : '25'}
                <Text style={styles.rateUnit}>/hour</Text>
              </Text>
            </View>
            <Pressable style={styles.editRateButton} onPress={() => router.push('/(walker)/edit-profile')}>
              <Text style={styles.editRateText}>Edit</Text>
            </Pressable>
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

        <Text style={styles.version}>Packwalk Walker v1.0.0</Text>

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
    paddingTop: 60,
    paddingBottom: spacing.lg,
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
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },

  name: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },

  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  verifiedText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  email: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },

  availabilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    ...shadows.soft,
    width: '80%',
  },

  availabilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  availabilityText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  availabilityTextActive: {
    color: colors.success,
  },

  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
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
    textAlign: 'center',
  },

  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },

  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  rateInfo: {},

  rateLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.xs,
  },

  rateValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.sage,
  },

  rateUnit: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  editRateButton: {
    backgroundColor: colors.sageLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },

  editRateText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  menuSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
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
    marginTop: spacing.xl,
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
    marginTop: spacing.lg,
  },
});
