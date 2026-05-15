import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Camera, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuthMutation, useAuthQuery, useAuthAction } from '@/lib/useAuthQuery';

import { Button, Card, Avatar } from '@/components/ui';
import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/convex/_generated/api';
import { uploadImageWithSignature } from '@/lib/cloudinary';
import { useAppStore } from '@/stores/appStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user: storeUser, setUser } = useAppStore();

  // Fetch current profile
  const profile = useAuthQuery(api.me.getProfile, {});
  const updateProfile = useAuthMutation(api.me.updateProfile);
  const generateUploadSignature = useAuthAction(api.uploads.generateUploadSignature);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isNewPhoto, setIsNewPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Populate form with existing data
  useEffect(() => {
    if (profile?.user) {
      setName(profile.user.name || '');
      setPhone(profile.user.phone || '');
      setAddress(profile.user.defaultLocation?.addressLine1 || '');
      if (profile.user.avatarUrl) {
        setPhoto(profile.user.avatarUrl);
        setIsNewPhoto(false);
      }
    }
  }, [profile]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const message = 'We need camera roll permissions to update your photo.';
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
    if (!name.trim()) {
      toast.show('Please enter your name', 'error');
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      let avatarUrl: string | undefined;

      // Upload new photo if changed
      if (isNewPhoto && photo) {
        try {
          const signature = await generateUploadSignature({ folder: 'avatars' });
          const result = await uploadImageWithSignature(photo, signature);
          avatarUrl = result.url;
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          toast.show('Photo upload failed, saving without photo', 'warning');
        }
      }

      // Update profile
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: avatarUrl,
        defaultLocation: address.trim()
          ? {
              lat: profile?.user?.defaultLocation?.lat ?? 43.6532,
              lng: profile?.user?.defaultLocation?.lng ?? -79.3832,
              addressLine1: address.trim(),
            }
          : undefined,
      });

      // Update local store
      if (storeUser) {
        setUser({
          ...storeUser,
          name: name.trim(),
          avatar: avatarUrl || storeUser.avatar,
        });
      }

      toast.show('Profile updated!', 'success');
      router.replace('/(owner)/profile');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.show('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.replace('/(owner)/profile')}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
            <Avatar
              source={photo || undefined}
              name={name || profile?.user?.name}
              size="2xl"
              showRing
              ringColor={colors.ember}
            />
            <View style={styles.cameraButton}>
              <Camera size={18} color={colors.white} strokeWidth={2} />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Card style={styles.formCard}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.inkMuted}
                autoCapitalize="words"
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="(optional)"
                placeholderTextColor={colors.inkMuted}
                keyboardType="phone-pad"
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Default Pickup Address</Text>
              <View style={styles.addressInputWrapper}>
                <MapPin size={20} color={colors.inkMuted} style={styles.addressIcon} />
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter your address"
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
              <Text style={styles.helperText}>
                Used as default location when booking walks
              </Text>
            </View>
          </Card>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Button
          onPress={handleSave}
          fullWidth
          size="lg"
          loading={saving}
          disabled={saving || !name.trim()}
        >
          Save Changes
        </Button>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.paper,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
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
  changePhotoText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
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
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  addressInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.paperDark,
  },
  addressIcon: {
    marginLeft: spacing.md,
  },
  addressInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  helperText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    ...shadows.elevated,
  },
});
