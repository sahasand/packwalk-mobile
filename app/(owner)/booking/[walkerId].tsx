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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Check, Calendar, Clock, Dog } from 'lucide-react-native';
import { useAuthQuery, useAuthMutation, useAuthAction } from '@/lib/useAuthQuery';
import { useStripe } from '@stripe/stripe-react-native';

import { Button, Card, Avatar, PawIcon } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import type { Id, Doc } from '@/convex/_generated/dataModel';

const allTimeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];

// Convert time string to hours (24h format) for comparison
const parseTimeToHours = (time: string): number => {
  const [timePart, period] = time.split(' ');
  const [hours, minutes] = timePart.split(':').map(Number);
  let hour = hours;
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour + minutes / 60;
};

// Filter time slots to only show future times when "Today" is selected
const getAvailableTimeSlots = (selectedDate: string): string[] => {
  if (selectedDate !== 'Today') {
    return allTimeSlots;
  }

  const now = new Date();
  const currentHours = now.getHours() + now.getMinutes() / 60;

  // Add 30 min buffer so walks can't be booked too close to current time
  const minBookingTime = currentHours + 0.5;

  return allTimeSlots.filter((time) => parseTimeToHours(time) > minBookingTime);
};

export default function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { walkerId } = useLocalSearchParams<{ walkerId: string }>();

  // Fetch owner's dogs
  const dogs = useAuthQuery(api.dogs.listMine, { isActive: true });

  // Fetch user profile for default location
  const profile = useAuthQuery(api.me.getProfile, {});

  // Fetch walker profile to get hourly rate
  const walkerProfile = useAuthQuery(
    api.walkerProfiles.getPublicByUserId,
    walkerId ? { userId: walkerId as Id<'users'> } : 'skip'
  );

  // Stripe hooks
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Create walk request with payment action (unified - handles both dev and production)
  const createBookingWithPayment = useAuthAction(api.payments.createBookingWithPayment);
  // Cancel walk request if payment fails
  const cancelWalkRequest = useAuthMutation(api.walkRequests.cancel);

  const [step, setStep] = useState(1);
  const [selectedDogs, setSelectedDogs] = useState<Id<'dogs'>[]>([]);
  const [selectedDate, setSelectedDate] = useState('Today');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDurationValue, setSelectedDurationValue] = useState(30);
  const [isBooking, setIsBooking] = useState(false);

  // Calculate dynamic prices based on walker's hourly rate
  // hourlyRate is stored in cents in the database
  const hourlyRateCents = walkerProfile?.profile?.hourlyRate ?? 4500; // Default to $45 if not loaded
  const hourlyRate = hourlyRateCents / 100;
  const durations = [
    { value: 30, label: '30 min', price: Math.round(hourlyRate * 0.5) },
    { value: 60, label: '1 hour', price: hourlyRate },
    { value: 90, label: '1.5 hours', price: Math.round(hourlyRate * 1.5) },
  ];

  const selectedDuration = durations.find((d) => d.value === selectedDurationValue) || durations[0];

  // Calculate donation amount (20% of walk price)
  const donationAmount = Math.round(selectedDuration.price * 0.2);

  const toggleDog = (id: Id<'dogs'>) => {
    setSelectedDogs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  // Helper function to compute the next occurrence of a weekday
  const getNextWeekday = (dayName: string): Date => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const currentDay = today.getDay();
    const targetDay = days.indexOf(dayName);

    if (targetDay === -1) return today; // Invalid day name

    let daysUntil = targetDay - currentDay;
    // If the target day is today or already passed this week, go to next week
    if (daysUntil <= 0) daysUntil += 7;

    const result = new Date(today);
    result.setDate(result.getDate() + daysUntil);
    return result;
  };

  // Convert date + time to timestamp
  const getScheduledTimestamp = () => {
    let baseDate: Date;

    if (selectedDate === 'Today') {
      baseDate = new Date();
    } else if (selectedDate === 'Tomorrow') {
      baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 1);
    } else {
      // For weekday names (Wed, Thu, Fri, etc.), compute actual next occurrence
      baseDate = getNextWeekday(selectedDate);
    }

    // Parse time (simple format: "9:00 AM")
    if (selectedTime) {
      const [time, period] = selectedTime.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let hour = hours;
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;

      baseDate.setHours(hour, minutes, 0, 0);
    }

    return baseDate.getTime();
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Final step: Create walk request with payment
      let requestId: Id<'walkRequests'> | null = null;

      try {
        setIsBooking(true);

        const scheduledTime = getScheduledTimestamp();

        // 1. Create walk request with PaymentIntent via Convex action
        // Use user's default location if set, otherwise fallback to Toronto
        const userLocation = profile?.user?.defaultLocation;
        const result = await createBookingWithPayment({
          walkerId: walkerId as Id<'users'>,
          dogIds: selectedDogs,
          scheduledTime,
          durationMinutes: selectedDuration.value,
          pickupLocation: {
            lat: userLocation?.lat ?? 43.6532,
            lng: userLocation?.lng ?? -79.3832,
            addressLine1: userLocation?.addressLine1 ?? 'Toronto, ON',
            notes: userLocation?.notes,
          },
          message: undefined,
          currency: 'cad',
        });

        requestId = result.requestId as Id<'walkRequests'>;

        // Ensure we got a valid client secret
        if (!result.clientSecret) {
          toast.show('Payment setup failed. Please try again.', 'error');
          await cancelWalkRequest({ requestId });
          return;
        }

        // 2. Initialize PaymentSheet with clientSecret from backend
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: result.clientSecret,
          merchantDisplayName: 'Packwalk',
          style: 'automatic',
          defaultBillingDetails: {
            email: profile?.user?.email ?? undefined,
          },
          applePay: {
            merchantCountryCode: 'CA',
          },
          googlePay: {
            merchantCountryCode: 'CA',
            testEnv: __DEV__,
          },
        });

        if (initError) {
          console.error('PaymentSheet init error:', initError);
          toast.show('Payment setup failed. Please try again.', 'error');
          // Cancel the walk request since payment setup failed
          await cancelWalkRequest({ requestId });
          return;
        }

        // 3. Present PaymentSheet to user
        const { error: paymentError } = await presentPaymentSheet();

        if (paymentError) {
          if (paymentError.code === 'Canceled') {
            // User cancelled - clean up walk request silently
            await cancelWalkRequest({ requestId });
            toast.show('Payment cancelled', 'info');
            return;
          }
          console.error('Payment error:', paymentError);
          toast.show('Payment failed. Please try again.', 'error');
          await cancelWalkRequest({ requestId });
          return;
        }

        // 4. Payment authorized successfully!
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toast.show('Walk booked! Waiting for walker confirmation.', 'success');
        router.replace('/(owner)/walks');
      } catch (error) {
        // If we created a request but hit an error, try to cancel it
        if (requestId) {
          try {
            await cancelWalkRequest({ requestId });
          } catch {
            // Ignore cancel errors
          }
        }
        toast.show(
          error instanceof Error ? error.message : 'Failed to book walk. Please try again.',
          'error'
        );
      } finally {
        setIsBooking(false);
      }
    }
  };

  const canProceed = () => {
    if (step === 1) return selectedDogs.length > 0;
    if (step === 2) return selectedTime !== null;
    return true;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Book Walk</Text>
        <Text style={styles.stepText}>Step {step}/3</Text>
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Select Dogs */}
        {step === 1 && (
          <Animated.View entering={FadeInDown}>
            <Text style={styles.stepTitle}>Which pups are going?</Text>
            {dogs === undefined ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.ember} />
                <Text style={styles.loadingText}>Loading your dogs...</Text>
              </View>
            ) : dogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Dog size={48} color={colors.inkMuted} />
                <Text style={styles.emptyStateTitle}>No dogs yet</Text>
                <Text style={styles.emptyStateText}>
                  Add your dogs to your profile to book a walk.
                </Text>
              </View>
            ) : (
              <View style={styles.dogList}>
                {dogs.map((dog: Doc<'dogs'>) => (
                  <TouchableOpacity
                    key={dog._id}
                    style={[
                      styles.dogCard,
                      selectedDogs.includes(dog._id) && styles.dogCardSelected,
                    ]}
                    onPress={() => toggleDog(dog._id)}
                  >
                    <View style={styles.dogIcon}>
                      <Dog size={24} color={selectedDogs.includes(dog._id) ? colors.ember : colors.inkMuted} />
                    </View>
                    <View style={styles.dogInfo}>
                      <Text style={styles.dogName}>{dog.name}</Text>
                      <Text style={styles.dogBreed}>{dog.breed || 'Mixed breed'}</Text>
                    </View>
                    {selectedDogs.includes(dog._id) && (
                      <View style={styles.checkmark}>
                        <Check size={16} color={colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <Animated.View entering={FadeInDown}>
            <Text style={styles.stepTitle}>When?</Text>

            {/* Date selector (simplified) */}
            <View style={styles.dateRow}>
              {['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri'].map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dateChip,
                    selectedDate === day && styles.dateChipSelected,
                  ]}
                  onPress={() => {
                    setSelectedDate(day);
                    setSelectedTime(null); // Reset time when date changes to force selection
                  }}
                >
                  <Text
                    style={[
                      styles.dateChipText,
                      selectedDate === day && styles.dateChipTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time slots - Gated */}
            {selectedDate && (
              <Animated.View entering={FadeInDown.delay(100)}>
                <Text style={styles.subTitle}>Available Times</Text>
                {getAvailableTimeSlots(selectedDate).length === 0 ? (
                  <View style={styles.noTimesContainer}>
                    <Clock size={32} color={colors.inkMuted} />
                    <Text style={styles.noTimesText}>
                      No more slots available today. Please select another day.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.timeGrid}>
                    {getAvailableTimeSlots(selectedDate).map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.timeSlot,
                          selectedTime === time && styles.timeSlotSelected,
                        ]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text
                          style={[
                            styles.timeSlotText,
                            selectedTime === time && styles.timeSlotTextSelected,
                          ]}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}

            {/* Duration - Gated by Time Selection */}
            {selectedTime && (
              <Animated.View entering={FadeInDown.delay(200)}>
                <Text style={styles.subTitle}>Duration</Text>
                {walkerProfile === undefined ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.ember} />
                    <Text style={styles.loadingText}>Loading prices...</Text>
                  </View>
                ) : (
                  <View style={styles.durationRow}>
                    {durations.map((d) => (
                      <TouchableOpacity
                        key={d.value}
                        style={[
                          styles.durationCard,
                          selectedDurationValue === d.value && styles.durationCardSelected,
                        ]}
                        onPress={() => setSelectedDurationValue(d.value)}
                      >
                        <Text
                          style={[
                            styles.durationLabel,
                            selectedDurationValue === d.value && styles.durationLabelSelected,
                          ]}
                        >
                          {d.label}
                        </Text>
                        <Text
                          style={[
                            styles.durationPrice,
                            selectedDurationValue === d.value && styles.durationPriceSelected,
                          ]}
                        >
                          ${d.price.toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <Animated.View entering={FadeInDown}>
            <Text style={styles.stepTitle}>Confirm Booking</Text>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Dogs</Text>
                <Text style={styles.summaryValue}>
                  {dogs && dogs.filter((d: Doc<'dogs'>) => selectedDogs.includes(d._id)).map((d: Doc<'dogs'>) => d.name).join(', ')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>{selectedDate}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time</Text>
                <Text style={styles.summaryValue}>{selectedTime}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{selectedDuration.label}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${selectedDuration.price.toFixed(2)}</Text>
              </View>

              {/* Mission visibility */}
              <Text style={styles.missionNote}>
                ${donationAmount.toFixed(2)} of this walk supports Toronto rescues
              </Text>
            </Card>
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomButton, { paddingBottom: insets.bottom + 20 }]}>
        <Button
          onPress={handleNext}
          fullWidth
          size="lg"
          disabled={!canProceed() || isBooking}
          loading={isBooking}
        >
          {step < 3 ? 'Continue' : 'Confirm Booking'}
        </Button>
      </View>
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
    backgroundColor: colors.white,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  stepText: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
    width: 60,
    textAlign: 'right',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.paperDark,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: colors.ember,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  subTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dogList: {
    gap: spacing.md,
  },
  dogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.paperDark,
  },
  dogCardSelected: {
    borderColor: colors.ember,
    backgroundColor: colors.emberLight + '20',
  },
  dogIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dogInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dogName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  dogBreed: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  dateChipSelected: {
    backgroundColor: colors.ember,
    borderColor: colors.ember,
  },
  dateChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  dateChipTextSelected: {
    color: colors.white,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  noTimesContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  noTimesText: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  timeSlot: {
    width: '31%',
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  timeSlotSelected: {
    backgroundColor: colors.ember,
    borderColor: colors.ember,
  },
  timeSlotText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  timeSlotTextSelected: {
    color: colors.white,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.paperDark,
  },
  durationCardSelected: {
    borderColor: colors.ember,
    backgroundColor: colors.emberLight + '20',
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  durationLabelSelected: {
    color: colors.ember,
  },
  durationPrice: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    marginTop: 4,
  },
  durationPriceSelected: {
    color: colors.ember,
  },
  summaryCard: {
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
  },
  summaryValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  totalLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  totalValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ember,
  },
  missionNote: {
    fontSize: typography.sizes.sm,
    color: colors.sage,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: typography.weights.medium,
  },
  bottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    ...shadows.elevated,
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
  },
  emptyState: {
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginTop: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
