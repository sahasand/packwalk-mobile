import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  Search as SearchIcon,
  MapPin,
  SlidersHorizontal,
  Star,
  Shield,
  ChevronRight,
} from 'lucide-react-native';
import { useAuthQuery } from '@/lib/useAuthQuery';

import { Card, Avatar, Badge } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';
import { api } from '@/convex/_generated/api';

const DEFAULT_LAT = 43.6532;
const DEFAULT_LNG = -79.3832;

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get user's location from profile
  const profile = useAuthQuery(api.me.getProfile, {});
  const userLocation = profile?.user?.defaultLocation;
  const searchLat = userLocation?.lat ?? DEFAULT_LAT;
  const searchLng = userLocation?.lng ?? DEFAULT_LNG;
  const locationLabel = userLocation?.addressLine1 ?? 'Toronto, ON';

  const results = useAuthQuery(api.walkerProfiles.searchNearby, {
    lat: searchLat,
    lng: searchLng,
    radiusKm: 10,
    limit: 25,
  });

  const filteredWalkers =
    results?.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const name = r.user.name.toLowerCase();
      const bio = r.profile.bio?.toLowerCase() ?? '';
      const services = r.profile.serviceAreas.join(' ').toLowerCase();
      return name.includes(q) || bio.includes(q) || services.includes(q);
    }) ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.title}>Find a Walker</Text>
          <Text style={styles.subtitle}>Trusted companions near you</Text>
        </Animated.View>
      </View>

      {/* Search Bar */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(500)}
        style={styles.searchContainer}
      >
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          <SearchIcon
            size={iconSizes.sm}
            color={isFocused ? colors.ember : colors.inkMuted}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or specialty..."
            placeholderTextColor={colors.inkMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
        <Pressable style={styles.filterButton}>
          <SlidersHorizontal size={iconSizes.sm} color={colors.ember} strokeWidth={1.5} />
        </Pressable>
      </Animated.View>

      {/* Location */}
      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        style={styles.locationBar}
      >
        <MapPin size={iconSizes.xs} color={colors.ember} />
        <Text style={styles.locationText}>{locationLabel}</Text>
        <Pressable>
          <Text style={styles.changeText}>Change</Text>
        </Pressable>
      </Animated.View>

      {/* Results */}
      <ScrollView
        style={styles.results}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsContent}
      >
        <Text style={styles.resultsCount}>
          {filteredWalkers.length} walkers available
        </Text>

        {filteredWalkers.map((walker, index) => {
          const distanceMi = walker.distanceKm * 0.621371;
          const verified = walker.user.walkerVerificationStatus === 'approved';
          const rate = Math.round(walker.profile.hourlyRate / 100);
          return (
          <Animated.View
            key={walker.user._id}
            entering={FadeInUp.delay(400 + index * 100).duration(400)}
          >
            <Card
              style={styles.walkerCard}
              onPress={() => router.push(`/(owner)/walker/${walker.user._id}`)}
              variant="outlined"
            >
              <View style={styles.walkerMain}>
                <Avatar
                  source={walker.user.avatarUrl}
                  name={walker.user.name}
                  size="lg"
                  online={false}
                  verified={verified}
                />

                <View style={styles.walkerInfo}>
                  <View style={styles.walkerHeader}>
                    <Text style={styles.walkerName}>{walker.user.name}</Text>
                    {verified && (
                      <View style={styles.verifiedBadge}>
                        <Shield size={12} color={colors.ember} strokeWidth={2} />
                      </View>
                    )}
                  </View>

                  <View style={styles.ratingRow}>
                    <Star size={14} color={colors.gold} fill={colors.gold} />
                    <Text style={styles.rating}>{walker.profile.avgRating.toFixed(1)}</Text>
                    <Text style={styles.reviewCount}>
                      ({walker.profile.reviewCount} reviews)
                    </Text>
                  </View>

                  <Text style={styles.bio} numberOfLines={1}>
                    {walker.profile.bio ?? ''}
                  </Text>
                </View>
              </View>

              <View style={styles.walkerFooter}>
                <View style={styles.statGroup}>
                  <View style={styles.stat}>
                    <MapPin size={14} color={colors.inkMuted} />
                    <Text style={styles.statText}>{distanceMi.toFixed(1)} mi</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <Text style={styles.statText}>Available</Text>
                </View>

                <View style={styles.priceSection}>
                  <Text style={styles.price}>${rate}</Text>
                  <Text style={styles.priceUnit}>/hr</Text>
                </View>
              </View>
            </Card>
          </Animated.View>
          );
        })}

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
    paddingTop: 0, // Set dynamically with insets
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: typography.tracking.tight,
    marginBottom: spacing['2xs'],
  },

  subtitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.white,
    ...shadows.soft,
  },

  searchBarFocused: {
    borderColor: colors.ember,
    backgroundColor: colors.white,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.ink,
    height: '100%',
  },

  filterButton: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },

  locationText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  changeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ember,
  },

  results: {
    flex: 1,
  },

  resultsContent: {
    paddingHorizontal: spacing.lg,
  },

  resultsCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wider,
    marginBottom: spacing.md,
  },

  walkerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },

  walkerMain: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  walkerInfo: {
    flex: 1,
    justifyContent: 'center',
  },

  walkerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  walkerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.emberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  rating: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  reviewCount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  bio: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    lineHeight: typography.sizes.sm * typography.leading.normal,
  },

  walkerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },

  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xs'],
  },

  statText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  statDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.stone,
  },

  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  price: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ember,
  },

  priceUnit: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginLeft: spacing['2xs'],
  },
});
