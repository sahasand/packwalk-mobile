import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, MapPin, Plus, Check, X } from 'lucide-react-native';
import { Button, Card } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuthQuery, useAuthMutation } from '@/lib/useAuthQuery';
import { useToast } from '@/components/ui/Toast';

interface ServiceArea {
  id: string;
  name: string;
  enabled: boolean;
}

const defaultAreas: ServiceArea[] = [
  { id: '1', name: 'Downtown Toronto', enabled: true },
  { id: '2', name: 'High Park', enabled: true },
  { id: '3', name: 'The Annex', enabled: true },
  { id: '4', name: 'Yorkville', enabled: false },
  { id: '5', name: 'Liberty Village', enabled: false },
  { id: '6', name: 'Queen West', enabled: true },
  { id: '7', name: 'Leslieville', enabled: false },
  { id: '8', name: 'Beaches', enabled: false },
];

export default function ServiceAreasScreen() {
  const router = useRouter();
  const toast = useToast();

  // Fetch walker profile from backend
  const walkerProfile = useAuthQuery(api.walkerProfiles.getMine, {});
  const updateProfile = useAuthMutation(api.walkerProfiles.upsertMine);

  const [areas, setAreas] = useState<ServiceArea[]>(defaultAreas);
  const [loading, setLoading] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');

  // Sync areas from backend when profile loads
  useEffect(() => {
    if (walkerProfile?.serviceAreas && walkerProfile.serviceAreas.length > 0) {
      // Map backend serviceAreas (string[]) to local state format
      const backendAreas = walkerProfile.serviceAreas;
      setAreas(prev => prev.map(area => ({
        ...area,
        enabled: backendAreas.includes(area.name),
      })));
    }
  }, [walkerProfile?.serviceAreas]);

  const toggleArea = (id: string) => {
    setAreas((prev) =>
      prev.map((area) =>
        area.id === id ? { ...area, enabled: !area.enabled } : area
      )
    );
  };

  const openRequestModal = () => {
    setNewAreaName('');
    setRequestModalVisible(true);
  };

  const submitAreaRequest = () => {
    if (!newAreaName.trim()) {
      const message = 'Please enter a neighborhood name.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Missing Information', message);
      }
      return;
    }

    setRequestModalVisible(false);
    toast.show('Area requests coming soon!', 'info');
    setNewAreaName('');
  };

  const enabledCount = areas.filter((a) => a.enabled).length;

  const handleSave = async () => {
    if (!walkerProfile) {
      toast.show('Please complete your profile first', 'warning');
      router.push('/(walker)/edit-profile');
      return;
    }

    setLoading(true);

    try {
      // Convert local areas to string array for backend
      const enabledAreaNames = areas.filter((a) => a.enabled).map((a) => a.name);

      await updateProfile({
        hourlyRate: walkerProfile.hourlyRate,
        bio: walkerProfile.bio,
        yearsExperience: walkerProfile.yearsExperience,
        serviceAreas: enabledAreaNames,
        maxDistanceKm: walkerProfile.maxDistanceKm,
        availability: walkerProfile.availability,
        isVisible: walkerProfile.isVisible,
      });

      toast.show('Service areas updated!', 'success');
      router.replace('/(walker)/profile');
    } catch (error) {
      toast.show('Failed to update service areas', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(walker)/profile')} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Service Areas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Card style={styles.infoCard} variant="paper">
            <MapPin size={24} color={colors.sage} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Choose Your Areas</Text>
              <Text style={styles.infoText}>
                Select the neighborhoods where you're available to walk dogs. You'll only receive requests from these areas.
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.statsRow}>
          <Text style={styles.statsText}>
            <Text style={styles.statsNumber}>{enabledCount}</Text> areas selected
          </Text>
        </Animated.View>

        {/* Areas List */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Card style={styles.areasCard} noPadding>
            {areas.map((area, index) => (
              <Pressable
                key={area.id}
                style={[
                  styles.areaItem,
                  index !== areas.length - 1 && styles.areaItemBorder,
                ]}
                onPress={() => toggleArea(area.id)}
              >
                <View style={styles.areaInfo}>
                  <View style={[styles.areaIcon, area.enabled && styles.areaIconActive]}>
                    <MapPin
                      size={iconSizes.sm}
                      color={area.enabled ? colors.sage : colors.inkMuted}
                    />
                  </View>
                  <Text style={[styles.areaName, area.enabled && styles.areaNameActive]}>
                    {area.name}
                  </Text>
                </View>

                <Switch
                  value={area.enabled}
                  onValueChange={() => toggleArea(area.id)}
                  trackColor={{ false: colors.stone, true: colors.sageLight }}
                  thumbColor={area.enabled ? colors.sage : colors.white}
                  ios_backgroundColor={colors.stone}
                />
              </Pressable>
            ))}
          </Card>
        </Animated.View>

        {/* Add Custom Area */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Pressable style={styles.addButton} onPress={openRequestModal}>
            <Plus size={20} color={colors.sage} />
            <Text style={styles.addButtonText}>Request New Area</Text>
          </Pressable>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.buttonSection}>
          <Button
            fullWidth
            size="lg"
            onPress={handleSave}
            loading={loading}
            icon={<Check size={18} color={colors.white} />}
          >
            Save Changes
          </Button>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Request Area Modal */}
      <Modal
        visible={requestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRequestModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRequestModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request New Area</Text>
              <Pressable onPress={() => setRequestModalVisible(false)}>
                <X size={24} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Neighborhood Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Kensington Market"
                placeholderTextColor={colors.inkMuted}
                value={newAreaName}
                onChangeText={setNewAreaName}
                autoFocus
              />
              <Text style={styles.inputHint}>
                Enter the name of the Toronto neighborhood you'd like to service.
              </Text>

              <Button
                fullWidth
                size="lg"
                onPress={submitAreaRequest}
                icon={<Check size={18} color={colors.white} />}
              >
                Submit Request
              </Button>
            </View>
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
    backgroundColor: colors.white,
    ...shadows.soft,
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

  content: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  infoCard: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },

  infoText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    lineHeight: 20,
  },

  statsRow: {
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },

  statsText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
  },

  statsNumber: {
    fontWeight: typography.weights.bold,
    color: colors.sage,
  },

  areasCard: {
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },

  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },

  areaItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },

  areaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  areaIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },

  areaIconActive: {
    backgroundColor: colors.sageLight,
  },

  areaName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },

  areaNameActive: {
    color: colors.ink,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.sage,
    borderStyle: 'dashed',
  },

  addButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.sage,
  },

  buttonSection: {
    marginTop: spacing.xl,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  modalContent: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    width: '100%',
    maxWidth: 400,
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

  modalBody: {
    padding: spacing.lg,
  },

  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.stone,
    marginBottom: spacing.sm,
  },

  inputHint: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.inkMuted,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});
