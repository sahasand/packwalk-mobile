import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { Avatar, Button, Card } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, iconSizes } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/components/ui/Toast';
import { useAuthQuery, useAuthMutation, useAuthAction } from '@/lib/useAuthQuery';
import { uploadImageWithSignature } from '@/lib/cloudinary';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user: storeUser, setUser } = useAppStore();
  const toast = useToast();

  // Fetch current profile from database (like owner side)
  const profile = useAuthQuery(api.me.getProfile, {});
  // Fetch walker-specific profile
  const walkerProfile = useAuthQuery(api.walkerProfiles.getMine, {});
  const updateProfile = useAuthMutation(api.walkerProfiles.upsertMine);
  const updateUserProfile = useAuthMutation(api.me.updateProfile);
  const generateUploadSignature = useAuthAction(api.uploads.generateUploadSignature);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [rate, setRate] = useState('25');
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isNewPhoto, setIsNewPhoto] = useState(false);

  // Populate form when profile loads (from database, like owner side)
  useEffect(() => {
    if (profile?.user) {
      setName(profile.user.name || '');
      setEmail(profile.user.email || '');
      if (profile.user.avatarUrl) {
        setPhoto(profile.user.avatarUrl);
        setIsNewPhoto(false);
      }
    }
  }, [profile]);

  // Populate walker-specific fields
  useEffect(() => {
    if (walkerProfile) {
      setBio(walkerProfile.bio || '');
      setRate((walkerProfile.hourlyRate / 100).toFixed(0));
      setIsVisible(walkerProfile.isVisible);
    }
  }, [walkerProfile]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const message = 'We need camera roll permissions to change your photo.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Permission Required', message);
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setIsNewPhoto(true);
    }
  };

  const handleSave = async () => {
    // Validate inputs
    if (!name.trim()) {
      toast.show('Please enter your name', 'error');
      return;
    }

    if (bio.length > 300) {
      toast.show('Bio must be 300 characters or less', 'error');
      return;
    }

    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      toast.show('Please enter a valid hourly rate', 'error');
      return;
    }

    // Client-side rate validation to match backend limits
    if (rateNum < 10 || rateNum > 100) {
      toast.show('Hourly rate must be between $10 and $100', 'error');
      return;
    }

    setLoading(true);

    try {
      // Upload photo to Cloudinary if it's a new photo (same folder as owner)
      let avatarUrl: string | undefined;
      if (photo && isNewPhoto) {
        try {
          const signatureData = await generateUploadSignature({ folder: 'avatars' });
          const result = await uploadImageWithSignature(photo, signatureData);
          avatarUrl = result.url;
        } catch (uploadErr) {
          console.error('Photo upload failed:', uploadErr);
          toast.show('Photo upload failed, saving without photo', 'warning');
        }
      }

      // Update user profile (name and avatar)
      await updateUserProfile({
        name: name.trim(),
        avatarUrl: avatarUrl,
      });

      await updateProfile({
        hourlyRate: Math.round(rateNum * 100), // Convert to cents
        bio: bio.trim() || undefined,
        yearsExperience: walkerProfile?.yearsExperience,
        serviceAreas: walkerProfile?.serviceAreas || [],
        maxDistanceKm: walkerProfile?.maxDistanceKm || 10,
        availability: walkerProfile?.availability || {},
        isVisible,
      });

      // Update Zustand store so UI reflects changes immediately
      if (storeUser) {
        setUser({
          ...storeUser,
          name: name.trim(),
          avatar: avatarUrl || storeUser.avatar,
        });
      }

      toast.show('Profile updated successfully!', 'success');
      router.replace('/(walker)/profile');
    } catch (error: unknown) {
      // Extract error message from Convex errors
      let message = 'Failed to update profile';
      if (error instanceof Error) {
        // ConvexError extends Error, so message is available
        message = error.message;
      }
      toast.show(message, 'error');
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
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Avatar Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.avatarSection}>
          <Pressable onPress={pickImage} style={styles.avatarWrapper}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImage} />
            ) : (
              <Avatar
                source={profile?.user?.avatarUrl || undefined}
                name={name || profile?.user?.name}
                size="2xl"
                showRing
                ringColor={colors.sage}
              />
            )}
            <View style={styles.cameraButton}>
              <Camera size={iconSizes.sm} color={colors.white} strokeWidth={2} />
            </View>
          </Pressable>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Card style={styles.formCard}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.inkMuted}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={colors.inkMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell dog owners about yourself..."
                placeholderTextColor={colors.inkMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length}/300</Text>
            </View>

            {/* Rate */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hourly Rate ($)</Text>
              <TextInput
                style={styles.input}
                value={rate}
                onChangeText={setRate}
                placeholder="25"
                placeholderTextColor={colors.inkMuted}
                keyboardType="numeric"
              />
              <Text style={styles.rateHint}>This is what owners will see when booking</Text>
            </View>

            {/* Visibility Toggle */}
            <View style={styles.inputGroup}>
              <View style={styles.visibilityRow}>
                <View style={styles.visibilityInfo}>
                  <Text style={styles.label}>Visible to Owners</Text>
                  <Text style={styles.visibilityHint}>
                    {isVisible ? 'Your profile is visible in search' : 'Your profile is hidden from search'}
                  </Text>
                </View>
                <Switch
                  value={isVisible}
                  onValueChange={setIsVisible}
                  trackColor={{ false: colors.stone, true: colors.sageLight }}
                  thumbColor={isVisible ? colors.sage : colors.white}
                  ios_backgroundColor={colors.stone}
                />
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.buttonSection}>
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

  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.sm,
  },

  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.sage,
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

  changePhotoText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.sage,
  },

  formCard: {
    padding: spacing.lg,
  },

  inputGroup: {
    marginBottom: spacing.lg,
  },

  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.stone,
  },

  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },

  charCount: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  rateHint: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },

  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  visibilityInfo: {
    flex: 1,
    marginRight: spacing.md,
  },

  visibilityHint: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },

  buttonSection: {
    marginTop: spacing.lg,
  },
});
