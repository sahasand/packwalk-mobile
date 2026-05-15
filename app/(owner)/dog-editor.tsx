import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Camera, X, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuthMutation, useAuthQuery, useAuthAction } from '@/lib/useAuthQuery';

import { Button, Card, ConfirmDialog } from '@/components/ui';
import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { uploadImageWithSignature } from '@/lib/cloudinary';

export default function DogEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const toast = useToast();

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isNewPhoto, setIsNewPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Convex mutations and actions
  const createDog = useAuthMutation(api.dogs.create);
  const updateDog = useAuthMutation(api.dogs.update);
  const removeDog = useAuthMutation(api.dogs.remove);
  const generateUploadSignature = useAuthAction(api.uploads.generateUploadSignature);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load existing dog data when editing
  const existingDog = useAuthQuery(
    api.dogs.getMine,
    id ? { dogId: id as Id<'dogs'> } : 'skip'
  );

  // Populate form when editing
  useEffect(() => {
    if (existingDog) {
      setName(existingDog.name);
      setBreed(existingDog.breed ?? '');
      setAge(existingDog.age?.toString() ?? '');
      setWeight(existingDog.size ?? '');
      setNotes(existingDog.specialNotes ?? '');
      if (existingDog.photoUrl) {
        setPhoto(existingDog.photoUrl);
        setIsNewPhoto(false);
      }
    }
  }, [existingDog]);

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const message = 'We need camera roll permissions to add a photo for your dog.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Permission Required', message);
      }
      return;
    }

    // Launch image picker
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
      toast.show('Please enter your dog\'s name', 'error');
      return;
    }

    setSaving(true);
    try {
      // Upload photo to Cloudinary if it's a new local photo
      let photoUrl: string | undefined;
      if (photo && isNewPhoto) {
        setUploadingPhoto(true);
        try {
          const signatureData = await generateUploadSignature({ folder: 'dogs' });
          const result = await uploadImageWithSignature(photo, signatureData);
          photoUrl = result.url;
        } catch (uploadErr) {
          toast.show('Failed to upload photo, saving without it', 'warning');
        } finally {
          setUploadingPhoto(false);
        }
      } else if (photo && !isNewPhoto) {
        // Keep existing photo URL
        photoUrl = photo;
      }

      if (isEditing && id) {
        await updateDog({
          dogId: id as Id<'dogs'>,
          name: name.trim(),
          breed: breed.trim() || undefined,
          age: age ? parseInt(age, 10) : undefined,
          size: weight.trim() || undefined,
          specialNotes: notes.trim() || undefined,
          photoUrl,
        });
        toast.show('Dog updated!', 'success');
      } else {
        await createDog({
          name: name.trim(),
          breed: breed.trim() || undefined,
          age: age ? parseInt(age, 10) : undefined,
          size: weight.trim() || undefined,
          specialNotes: notes.trim() || undefined,
          photoUrl,
        });
        toast.show('Dog added!', 'success');
      }
      router.replace('/(owner)/profile');
    } catch (err: any) {
      toast.show('Failed to save dog', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      await removeDog({ dogId: id as Id<'dogs'> });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show('Dog removed', 'success');
      router.replace('/(owner)/profile');
    } catch (err) {
      toast.show('Failed to remove dog', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.replace('/(owner)/profile')} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Dog' : 'Add Dog'}</Text>
        {isEditing ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setShowDeleteConfirm(true);
            }}
            style={styles.deleteButton}
          >
            <Trash2 size={20} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Remove Dog"
        message={`Are you sure you want to remove ${name || 'this dog'}? This action cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        icon="delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photo */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.photoSection}>
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => {
                    setPhoto(null);
                    setIsNewPhoto(false);
                  }}
                >
                  <X size={16} color={colors.white} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Camera size={32} color={colors.inkMuted} />
                <Text style={styles.photoText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <Card style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="What's your pup's name?"
                placeholderTextColor={colors.inkMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Breed</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Golden Retriever"
                placeholderTextColor={colors.inkMuted}
                value={breed}
                onChangeText={setBreed}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Age (years)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.inkMuted}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Weight (lbs)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.inkMuted}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes for Walker</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any special instructions, habits, or health concerns..."
                placeholderTextColor={colors.inkMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </Card>
        </Animated.View>

        {/* Bottom padding for safe area */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Save Button at bottom */}
      <View style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <Button onPress={handleSave} fullWidth size="lg" loading={saving || uploadingPhoto}>
          {uploadingPhoto ? 'Uploading Photo...' : isEditing ? 'Save Changes' : 'Add Dog'}
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
    ...shadows.soft,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.paperDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.emberLight,
    borderStyle: 'dashed',
  },
  photoText: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  formCard: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.ink,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.paperDark,
  },
});
