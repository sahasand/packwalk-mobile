import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  ChevronRight,
  ArrowDownRight,
  Check,
  AlertCircle,
  ExternalLink,
  Landmark,
} from 'lucide-react-native';
import { api } from '@/convex/_generated/api';

import { Card, Badge, Button, PawIcon, SkeletonLoader } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuthQuery, useAuthAction } from '@/lib/useAuthQuery';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function EarningsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [isConnectLoading, setIsConnectLoading] = useState(false);
  const [isManagePayoutsLoading, setIsManagePayoutsLoading] = useState(false);

  // Fetch earnings from Convex
  const earningsData = useAuthQuery(api.earnings.listMine, {});

  // Fetch user profile to get Stripe Connect status
  const profile = useAuthQuery(api.me.getProfile, {});
  const stripeConnectStatus = profile?.user?.stripeConnectStatus ?? 'not_started';

  // Stripe Connect actions
  const createConnectOnboardingLink = useAuthAction(api.payments.createConnectOnboardingLink);
  const createExpressDashboardLink = useAuthAction(api.payments.createExpressDashboardLink);

  // Calculate earnings overview
  const earningsOverview = useMemo(() => {
    if (!earningsData) return { today: 0, thisWeek: 0, thisMonth: 0, pending: 0 };

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;

    const today = earningsData
      .filter((e) => e.createdAt >= todayStart && (e.status === 'ready_for_payout' || e.status === 'paid_out'))
      .reduce((sum, e) => sum + e.amount, 0);

    const thisWeek = earningsData
      .filter((e) => e.createdAt >= weekStart && (e.status === 'ready_for_payout' || e.status === 'paid_out'))
      .reduce((sum, e) => sum + e.amount, 0);

    const thisMonth = earningsData
      .filter((e) => e.createdAt >= monthStart && (e.status === 'ready_for_payout' || e.status === 'paid_out'))
      .reduce((sum, e) => sum + e.amount, 0);

    const pending = earningsData
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      today: Math.round(today / 100), // Convert cents to dollars
      thisWeek: Math.round(thisWeek / 100),
      thisMonth: Math.round(thisMonth / 100),
      pending: Math.round(pending / 100),
    };
  }, [earningsData]);

  // Calculate weekly data for chart
  const weeklyData = useMemo(() => {
    if (!earningsData) return [0, 0, 0, 0, 0, 0, 0];

    const now = new Date();
    const dailyEarnings = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun

    earningsData
      .filter((e) => e.status === 'ready_for_payout' || e.status === 'paid_out')
      .forEach((earning) => {
        const earningDate = new Date(earning.createdAt);
        const daysAgo = Math.floor((now.getTime() - earningDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo < 7) {
          const dayIndex = (now.getDay() - daysAgo + 7) % 7;
          dailyEarnings[dayIndex] += earning.amount / 100;
        }
      });

    return dailyEarnings;
  }, [earningsData]);

  const maxEarning = Math.max(...weeklyData, 1); // Prevent division by zero

  // Format recent earnings
  const recentEarnings = useMemo(() => {
    if (!earningsData) return [];

    return earningsData
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map((earning) => {
        const earningDate = new Date(earning.createdAt);
        const now = new Date();
        const isToday = earningDate.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = earningDate.toDateString() === yesterday.toDateString();

        let dateString = 'Today';
        if (!isToday) {
          dateString = isYesterday
            ? 'Yesterday'
            : earningDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        // Each earnings row represents one source (walk OR tip OR adjustment),
        // not a combined transaction — so `amount` is the row's total and `tip`
        // stays at 0. Tip-type rows are still labelled "Tip" via ownerName.
        // Previously this set amount = tip = walker_share for tip rows, and the
        // renderer summed them → walkers saw 2× the actual amount.
        //
        // Keep amount as a float (dollars, not cents) and let the renderer
        // format with toFixed(2). The old Math.round() was truncating $2.40
        // tip earnings to "$2".
        return {
          id: earning._id,
          ownerName: earning.type === 'walk' ? 'Walk Earning' : earning.type === 'tip' ? 'Tip' : 'Adjustment',
          date: dateString,
          time: earningDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          amount: earning.amount / 100,
          tip: 0,
          status: earning.status === 'paid_out' ? 'paid' : 'pending',
        };
      });
  }, [earningsData]);

  const isLoading = earningsData === undefined;

  // Handle opening Stripe Express Dashboard for managing payouts
  const handleManagePayouts = async () => {
    if (stripeConnectStatus !== 'active') {
      toast.show('Please set up payouts first', 'warning');
      return;
    }

    setIsManagePayoutsLoading(true);
    try {
      const result = await createExpressDashboardLink({});
      if (result.url) {
        const canOpen = await Linking.canOpenURL(result.url);
        if (canOpen) {
          await Linking.openURL(result.url);
        } else {
          toast.show('Could not open Stripe dashboard', 'error');
        }
      }
    } catch (error) {
      console.error('Express dashboard error:', error);
      toast.show('Failed to open payout settings', 'error');
    } finally {
      setIsManagePayoutsLoading(false);
    }
  };

  // Handle Stripe Connect onboarding
  const handleSetupPayouts = async () => {
    setIsConnectLoading(true);
    try {
      const result = await createConnectOnboardingLink({});
      if (result.url) {
        // Open Stripe Connect onboarding in browser
        const canOpen = await Linking.canOpenURL(result.url);
        if (canOpen) {
          await Linking.openURL(result.url);
          toast.show('Complete your payout setup in the browser', 'info');
        } else {
          toast.show('Could not open onboarding link', 'error');
        }
      }
    } catch (error) {
      console.error('Connect onboarding error:', error);
      toast.show('Failed to start payout setup', 'error');
    } finally {
      setIsConnectLoading(false);
    }
  };

  // Get connect status display info
  const getConnectStatusInfo = () => {
    switch (stripeConnectStatus) {
      case 'active':
        return { label: 'Active', color: colors.success, icon: Check };
      case 'pending_verification':
        return { label: 'Pending Verification', color: colors.gold, icon: AlertCircle };
      case 'onboarding':
        return { label: 'Setup Incomplete', color: colors.gold, icon: AlertCircle };
      case 'restricted':
        return { label: 'Restricted', color: colors.error, icon: AlertCircle };
      case 'disabled':
        return { label: 'Disabled', color: colors.error, icon: AlertCircle };
      default:
        return { label: 'Not Set Up', color: colors.inkMuted, icon: AlertCircle };
    }
  };

  const connectStatus = getConnectStatusInfo();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
        {stripeConnectStatus === 'active' && (
          <Pressable
            style={styles.managePayoutsButton}
            onPress={handleManagePayouts}
            disabled={isManagePayoutsLoading}
          >
            {isManagePayoutsLoading ? (
              <ActivityIndicator size="small" color={colors.sage} />
            ) : (
              <>
                <ExternalLink size={16} color={colors.sage} />
                <Text style={styles.managePayoutsText}>Manage Payouts</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Total Balance Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          {isLoading ? (
            <SkeletonLoader variant="card" />
          ) : (
            <Card style={styles.balanceCard} variant="default">
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceAmount}>${earningsOverview.thisMonth}</Text>
                <Badge variant="success" size="sm">
                  <View style={styles.trendBadge}>
                    <TrendingUp size={12} color={colors.success} />
                    <Text style={styles.trendText}>+18%</Text>
                  </View>
                </Badge>
              </View>
              <Text style={styles.pendingText}>
                ${earningsOverview.pending} pending
              </Text>

              {/* Mini Chart */}
              <View style={styles.chartContainer}>
              {weeklyData.map((value, index) => (
                <View key={index} style={styles.chartBarContainer}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: (value / maxEarning) * 60,
                        backgroundColor: index === weeklyData.length - 1 ? colors.sage : colors.sageLight,
                      },
                    ]}
                  />
                  <Text style={styles.chartLabel}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                  </Text>
                </View>
              ))}
              </View>
            </Card>
          )}
        </Animated.View>

        {/* Period Tabs */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.periodTabs}>
          {(['week', 'month', 'year'] as const).map((period) => (
            <Pressable
              key={period}
              style={[
                styles.periodTab,
                selectedPeriod === period && styles.periodTabActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === period && styles.periodTabTextActive,
                ]}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.statsRow}>
          {isLoading ? (
            <>
              <SkeletonLoader variant="card" />
              <SkeletonLoader variant="card" />
            </>
          ) : (
            <>
              <Card style={styles.quickStatCard} variant="outlined">
                <View style={[styles.statIconSmall, { backgroundColor: colors.sageLight }]}>
                  <DollarSign size={16} color={colors.sage} />
                </View>
                <Text style={styles.quickStatValue}>${earningsOverview.today}</Text>
                <Text style={styles.quickStatLabel}>Today</Text>
              </Card>

              <Card style={styles.quickStatCard} variant="outlined">
                <View style={[styles.statIconSmall, { backgroundColor: colors.emberGlow }]}>
                  <Calendar size={16} color={colors.ember} />
                </View>
                <Text style={styles.quickStatValue}>${earningsOverview.thisWeek}</Text>
                <Text style={styles.quickStatLabel}>This Week</Text>
              </Card>
            </>
          )}
        </Animated.View>

        {/* Payout Setup Section */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Account</Text>

          {stripeConnectStatus === 'active' ? (
            // Connected - Show bank account info
            <Pressable onPress={handleSetupPayouts}>
              <Card style={styles.paymentCard} variant="outlined">
                <View style={[styles.paymentIcon, { backgroundColor: `${colors.success}15` }]}>
                  <Landmark size={iconSizes.md} color={colors.success} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentTitle}>Bank Account Connected</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.paymentSubtitle, { color: colors.success }]}>
                      Ready for payouts
                    </Text>
                  </View>
                </View>
                <ChevronRight size={iconSizes.sm} color={colors.inkMuted} />
              </Card>
            </Pressable>
          ) : stripeConnectStatus === 'pending_verification' || stripeConnectStatus === 'onboarding' ? (
            // Pending - Show status and continue button
            <Card style={styles.setupCard} variant="outlined">
              <View style={styles.setupHeader}>
                <View style={[styles.setupIcon, { backgroundColor: `${colors.gold}15` }]}>
                  <AlertCircle size={24} color={colors.gold} />
                </View>
                <View style={styles.setupInfo}>
                  <Text style={styles.setupTitle}>
                    {stripeConnectStatus === 'pending_verification'
                      ? 'Verification Pending'
                      : 'Setup Incomplete'}
                  </Text>
                  <Text style={styles.setupSubtitle}>
                    {stripeConnectStatus === 'pending_verification'
                      ? 'Stripe is verifying your information'
                      : 'Complete your payout setup to receive earnings'}
                  </Text>
                </View>
              </View>
              <Button
                onPress={handleSetupPayouts}
                fullWidth
                variant="secondary"
                loading={isConnectLoading}
                icon={<ExternalLink size={16} color={colors.sage} />}
              >
                {stripeConnectStatus === 'pending_verification' ? 'Check Status' : 'Continue Setup'}
              </Button>
            </Card>
          ) : (
            // Not started - Show setup CTA
            <Card style={styles.setupCard} variant="outlined">
              <View style={styles.setupHeader}>
                <View style={[styles.setupIcon, { backgroundColor: colors.sageLight }]}>
                  <Landmark size={24} color={colors.sage} />
                </View>
                <View style={styles.setupInfo}>
                  <Text style={styles.setupTitle}>Set Up Payouts</Text>
                  <Text style={styles.setupSubtitle}>
                    Connect your bank account to receive earnings from walks
                  </Text>
                </View>
              </View>
              <Button
                onPress={handleSetupPayouts}
                fullWidth
                loading={isConnectLoading}
                icon={<ExternalLink size={16} color={colors.white} />}
              >
                Get Started
              </Button>
            </Card>
          )}
        </Animated.View>

        {/* Recent Transactions */}
        <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>

          {isLoading ? (
            <>
              <SkeletonLoader variant="listItem" />
              <SkeletonLoader variant="listItem" />
              <SkeletonLoader variant="listItem" />
            </>
          ) : recentEarnings.length === 0 ? (
            <Card style={styles.transactionCard} variant="outlined">
              <Text style={styles.transactionName}>No earnings yet</Text>
              <Text style={styles.transactionDate}>Complete walks to start earning</Text>
            </Card>
          ) : (
            recentEarnings.map((earning, index) => (
              <Animated.View
                key={earning.id}
                entering={FadeInUp.delay(600 + index * 50).duration(400)}
              >
                <Card style={styles.transactionCard} variant="outlined">
                <View style={styles.transactionIcon}>
                  <ArrowDownRight size={18} color={colors.success} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionName}>{earning.ownerName}</Text>
                  <Text style={styles.transactionDate}>
                    {earning.date} · {earning.time}
                  </Text>
                </View>
                <View style={styles.transactionAmounts}>
                  <Text style={styles.transactionAmount}>
                    +${(earning.amount + earning.tip).toFixed(2)}
                  </Text>
                  {earning.tip > 0 && (
                    <Text style={styles.transactionTip}>
                      incl. ${earning.tip.toFixed(2)} tip
                    </Text>
                  )}
                  {earning.status === 'pending' && (
                    <Badge variant="warning" size="sm">Pending</Badge>
                  )}
                </View>
              </Card>
            </Animated.View>
            ))
          )}
        </Animated.View>

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
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: typography.tracking.tight,
  },

  managePayoutsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.sageLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    minWidth: 130,
    justifyContent: 'center',
  },

  managePayoutsText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Balance Card
  balanceCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  balanceLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.xs,
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },

  balanceAmount: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },

  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  trendText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },

  pendingText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing.lg,
  },

  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },

  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },

  chartBar: {
    width: 24,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },

  chartLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  // Period Tabs
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.soft,
  },

  periodTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },

  periodTabActive: {
    backgroundColor: colors.sage,
  },

  periodTabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  periodTabTextActive: {
    color: colors.white,
  },

  // Quick Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  quickStatCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },

  statIconSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  quickStatValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  quickStatLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.md,
  },

  // Payment Card
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  paymentInfo: {
    flex: 1,
  },

  paymentTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  paymentSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing['2xs'],
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Setup card styles
  setupCard: {
    padding: spacing.lg,
  },

  setupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },

  setupIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  setupInfo: {
    flex: 1,
  },

  setupTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },

  setupSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    lineHeight: typography.sizes.sm * 1.4,
  },

  // Transaction Card
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${colors.success}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  transactionInfo: {
    flex: 1,
  },

  transactionName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  transactionDate: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  transactionAmounts: {
    alignItems: 'flex-end',
  },

  transactionAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },

  transactionTip: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginTop: spacing['2xs'],
  },
});
