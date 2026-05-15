import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { Card, Button } from '@/components/ui';
import { useAuthQuery, useAuthMutation } from '@/lib/useAuthQuery';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/components/ui/Toast';

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const initialAvailability = {
  monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  friday: { enabled: true, startTime: '09:00', endTime: '17:00' },
  saturday: { enabled: false, startTime: '10:00', endTime: '14:00' },
  sunday: { enabled: false, startTime: '10:00', endTime: '14:00' },
};

// Time options for picker
const timeOptions = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00',
];

interface CalendarDay {
  date: number;
  fullDate: Date;
  day: string;
  isToday: boolean;
  walkCount: number;
}

// Generate calendar days for a given month offset (without walk data - that comes from query)
const generateCalendarDays = (monthOffset: number): { days: CalendarDay[]; startTimestamp: number; endTimestamp: number } => {
  const days: CalendarDay[] = [];
  const today = new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const startDate = new Date(targetMonth);
  startDate.setDate(startDate.getDate() - 3); // Start a few days before
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 17);
  endDate.setHours(23, 59, 59, 999);

  for (let i = 0; i < 17; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const isToday = date.toDateString() === today.toDateString();
    days.push({
      date: date.getDate(),
      fullDate: new Date(date),
      day: dayLabels[date.getDay() === 0 ? 6 : date.getDay() - 1],
      isToday,
      walkCount: 0, // Will be populated from query
    });
  }
  return { days, startTimestamp: startDate.getTime(), endTimestamp: endDate.getTime() };
};

export default function ScheduleScreen() {
  const router = useRouter();
  const toast = useToast();

  // Fetch walker profile
  const walkerProfile = useAuthQuery(api.walkerProfiles.getMine, {});
  const updateProfile = useAuthMutation(api.walkerProfiles.upsertMine);

  const [availability, setAvailability] = useState(initialAvailability);
  const [selectedDay, setSelectedDay] = useState(3); // Today index
  const [monthOffset, setMonthOffset] = useState(0);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingTime, setEditingTime] = useState<{
    day: string;
    type: 'start' | 'end';
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Populate form when profile loads
  // Merge with initialAvailability to ensure all days exist (database may have partial data)
  useEffect(() => {
    if (walkerProfile?.availability) {
      setAvailability({ ...initialAvailability, ...walkerProfile.availability });
    }
  }, [walkerProfile]);

  // Generate calendar days and get date range for query
  const { days: baseDays, startTimestamp, endTimestamp } = useMemo(
    () => generateCalendarDays(monthOffset),
    [monthOffset]
  );

  // Fetch walks for the date range
  const walksInRange = useAuthQuery(api.walks.listByDateRange, {
    startTimestamp,
    endTimestamp,
  });

  // Enrich calendar days with walk counts from query
  const calendarDays = useMemo(() => {
    if (!walksInRange) return baseDays;

    return baseDays.map((day) => {
      // Count walks on this specific day
      const dayStart = new Date(day.fullDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day.fullDate);
      dayEnd.setHours(23, 59, 59, 999);

      const walkCount = walksInRange.filter((walk) => {
        const walkTime = walk.scheduledTime;
        return walkTime >= dayStart.getTime() && walkTime <= dayEnd.getTime();
      }).length;

      return { ...day, walkCount };
    });
  }, [baseDays, walksInRange]);

  // Get walks for the selected day
  const selectedDayWalks = useMemo(() => {
    if (!walksInRange || !calendarDays[selectedDay]) return [];

    const day = calendarDays[selectedDay];
    const dayStart = new Date(day.fullDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day.fullDate);
    dayEnd.setHours(23, 59, 59, 999);

    return walksInRange.filter((walk) => {
      const walkTime = walk.scheduledTime;
      return walkTime >= dayStart.getTime() && walkTime <= dayEnd.getTime();
    }).sort((a, b) => a.scheduledTime - b.scheduledTime);
  }, [walksInRange, calendarDays, selectedDay]);

  const toggleDay = (day: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day as keyof typeof prev], enabled: !prev[day as keyof typeof prev].enabled },
    }));
  };

  const openTimePicker = (day: string, type: 'start' | 'end') => {
    setEditingTime({ day, type });
    setTimePickerVisible(true);
  };

  const selectTime = (time: string) => {
    if (editingTime) {
      setAvailability((prev) => ({
        ...prev,
        [editingTime.day]: {
          ...prev[editingTime.day as keyof typeof prev],
          [editingTime.type === 'start' ? 'startTime' : 'endTime']: time,
        },
      }));
    }
    setTimePickerVisible(false);
    setEditingTime(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setMonthOffset((prev) => prev + (direction === 'next' ? 1 : -1));
    setSelectedDay(3); // Reset selection
  };

  const handleSaveSchedule = async () => {
    if (!walkerProfile) {
      toast.show('Please complete your profile first', 'warning');
      router.push('/(walker)/edit-profile');
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        hourlyRate: walkerProfile.hourlyRate,
        bio: walkerProfile.bio,
        yearsExperience: walkerProfile.yearsExperience,
        serviceAreas: walkerProfile.serviceAreas,
        maxDistanceKm: walkerProfile.maxDistanceKm,
        availability,
        isVisible: walkerProfile.isVisible,
      });

      toast.show('Schedule updated successfully!', 'success');
      router.replace('/(walker)/profile');
    } catch (error) {
      toast.show('Failed to update schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthOffset);
  const currentMonth = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(walker)/profile')} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Schedule</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar Strip */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthText}>{currentMonth}</Text>
            <View style={styles.calendarNav}>
              <Pressable style={styles.navButton} onPress={() => navigateMonth('prev')}>
                <ChevronLeft size={20} color={colors.inkMuted} />
              </Pressable>
              <Pressable style={styles.navButton} onPress={() => navigateMonth('next')}>
                <ChevronRight size={20} color={colors.inkMuted} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarStrip}
          >
            {calendarDays.map((day, index) => (
              <Pressable
                key={index}
                style={[
                  styles.calendarDay,
                  selectedDay === index && styles.calendarDaySelected,
                  day.isToday && styles.calendarDayToday,
                ]}
                onPress={() => setSelectedDay(index)}
              >
                <Text
                  style={[
                    styles.calendarDayLabel,
                    selectedDay === index && styles.calendarDayLabelSelected,
                  ]}
                >
                  {day.day}
                </Text>
                <Text
                  style={[
                    styles.calendarDayNumber,
                    selectedDay === index && styles.calendarDayNumberSelected,
                  ]}
                >
                  {day.date}
                </Text>
                <View
                  style={[
                    styles.walkIndicator,
                    selectedDay === index && styles.walkIndicatorSelected,
                    day.walkCount === 0 && styles.walkIndicatorEmpty,
                  ]}
                >
                  <Text style={[
                    styles.walkIndicatorText,
                    selectedDay === index && styles.walkIndicatorTextSelected,
                    day.walkCount === 0 && styles.walkIndicatorTextEmpty,
                  ]}>
                    {day.walkCount}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Today's Schedule */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Walks on {calendarDays[selectedDay]?.day}, {calendarDays[selectedDay]?.date}</Text>

          {selectedDayWalks.length > 0 ? (
            <View style={styles.scheduleItems}>
              {selectedDayWalks.map((walk) => {
                const walkTime = new Date(walk.scheduledTime);
                const timeStr = walkTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });
                // Calculate duration from walk request (approximate from price/rate)
                const durationMin = walk.startedAt && walk.completedAt
                  ? Math.round((walk.completedAt - walk.startedAt) / 60000)
                  : 30; // Default to 30 min if not available

                return (
                  <Card key={walk._id} style={styles.scheduleItem} variant="outlined">
                    <View style={styles.scheduleTime}>
                      <Text style={styles.scheduleTimeText}>{timeStr}</Text>
                      <Text style={styles.scheduleDuration}>{durationMin} min</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleOwner}>{walk.ownerName}</Text>
                      <Text style={styles.scheduleDogs}>{walk.dogNames?.join(' & ') || 'Dogs'}</Text>
                    </View>
                    <Text style={styles.schedulePrice}>${(walk.totalPrice / 100).toFixed(0)}</Text>
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card style={styles.emptySchedule} variant="paper">
              <Text style={styles.emptyText}>No walks scheduled</Text>
            </Card>
          )}
        </Animated.View>

        {/* Weekly Availability */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Availability</Text>
          <Text style={styles.sectionSubtitle}>Set your regular working hours</Text>

          <Card style={styles.availabilityCard} variant="outlined">
            {daysOfWeek.map((day, index) => (
              <View
                key={day}
                style={[
                  styles.availabilityRow,
                  index !== daysOfWeek.length - 1 && styles.availabilityRowBorder,
                ]}
              >
                <View style={styles.availabilityDay}>
                  <Switch
                    value={availability[day as keyof typeof availability].enabled}
                    onValueChange={() => toggleDay(day)}
                    trackColor={{ false: colors.stone, true: colors.sageLight }}
                    thumbColor={availability[day as keyof typeof availability].enabled ? colors.sage : colors.white}
                    ios_backgroundColor={colors.stone}
                  />
                  <Text
                    style={[
                      styles.dayName,
                      !availability[day as keyof typeof availability].enabled && styles.dayNameDisabled,
                    ]}
                  >
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </Text>
                </View>

                {availability[day as keyof typeof availability].enabled && (
                  <View style={styles.timeRange}>
                    <Pressable style={styles.timeButton} onPress={() => openTimePicker(day, 'start')}>
                      <Clock size={14} color={colors.inkMuted} />
                      <Text style={styles.timeText}>
                        {availability[day as keyof typeof availability].startTime}
                      </Text>
                    </Pressable>
                    <Text style={styles.timeSeparator}>–</Text>
                    <Pressable style={styles.timeButton} onPress={() => openTimePicker(day, 'end')}>
                      <Text style={styles.timeText}>
                        {availability[day as keyof typeof availability].endTime}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </Card>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.buttonContainer}>
          <Button fullWidth size="lg" onPress={handleSaveSchedule} loading={saving}>
            Save Changes
          </Button>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTimePickerVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {editingTime?.type === 'start' ? 'Start' : 'End'} Time
              </Text>
              <Pressable onPress={() => setTimePickerVisible(false)}>
                <X size={24} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
              {timeOptions.map((time) => (
                <Pressable
                  key={time}
                  style={[
                    styles.timeOption,
                    editingTime &&
                      availability[editingTime.day as keyof typeof availability][
                        editingTime.type === 'start' ? 'startTime' : 'endTime'
                      ] === time && styles.timeOptionSelected,
                  ]}
                  onPress={() => selectTime(time)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      editingTime &&
                        availability[editingTime.day as keyof typeof availability][
                          editingTime.type === 'start' ? 'startTime' : 'endTime'
                        ] === time && styles.timeOptionTextSelected,
                    ]}
                  >
                    {time}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  },

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  // Calendar
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  monthText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  calendarNav: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  navButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },

  calendarStrip: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },

  calendarDay: {
    width: 56,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    ...shadows.soft,
  },

  calendarDaySelected: {
    backgroundColor: colors.sage,
  },

  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.sage,
  },

  calendarDayLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },

  calendarDayLabelSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },

  calendarDayNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  calendarDayNumberSelected: {
    color: colors.white,
  },

  walkIndicator: {
    marginTop: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  walkIndicatorSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },

  walkIndicatorText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  walkIndicatorTextSelected: {
    color: colors.white,
  },

  walkIndicatorEmpty: {
    backgroundColor: colors.stone,
  },

  walkIndicatorTextEmpty: {
    color: colors.inkMuted,
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },

  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },

  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },

  // Schedule Items
  scheduleItems: {
    gap: spacing.sm,
  },

  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },

  scheduleTime: {
    alignItems: 'center',
    marginRight: spacing.md,
  },

  scheduleTimeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  scheduleDuration: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  scheduleInfo: {
    flex: 1,
  },

  scheduleOwner: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    marginBottom: spacing['2xs'],
  },

  scheduleDogs: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  schedulePrice: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  emptySchedule: {
    padding: spacing.xl,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  // Availability
  availabilityCard: {
    padding: 0,
    overflow: 'hidden',
  },

  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  availabilityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  availabilityDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  dayName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  dayNameDisabled: {
    color: colors.inkMuted,
  },

  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.paper,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },

  timeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },

  timeSeparator: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
  },

  buttonContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '60%',
    ...shadows.elevated,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  timeList: {
    padding: spacing.md,
  },

  timeOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },

  timeOptionSelected: {
    backgroundColor: colors.sageLight,
  },

  timeOptionText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    textAlign: 'center',
  },

  timeOptionTextSelected: {
    color: colors.sage,
    fontWeight: typography.weights.semibold,
  },
});
