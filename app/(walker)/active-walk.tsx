import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Clock, Shield, CheckCircle2, Navigation, AlertTriangle, X, Settings, Signal, SignalLow, SignalZero, Loader } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { colors, spacing, radius, shadows, typography } from '@/constants/theme';
import { useAuthQuery, useAuthMutation } from '@/lib/useAuthQuery';
import { useAppStore } from '@/stores/appStore';
import { Avatar, Card, Button, PawIcon } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { authStorage } from '@/lib/authStorage';

// Location tracking error types
type LocationErrorType =
  | 'accuracy_low'        // GPS accuracy > 100m (approximate location)
  | 'timestamp_stale'     // Location timestamp too old
  | 'timestamp_future'    // Location timestamp in future
  | 'rate_limited'        // Too many requests
  | 'walk_not_active'     // Walk completed/cancelled
  | 'auth_expired'        // Token expired
  | 'permission_denied'   // Location permission denied
  | 'network'             // Network error (retryable)
  | 'unknown';            // Unknown error

// Errors that should stop retrying entirely
const PERMANENT_ERRORS: LocationErrorType[] = ['walk_not_active', 'auth_expired', 'permission_denied'];

// Max backoff delay (5 minutes)
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const INITIAL_BACKOFF_MS = 10 * 1000;

// Background location task name
const LOCATION_TASK_NAME = 'packwalk-background-location';

// Must match backend cap in `convex/http.ts`
const MAX_POINTS_PER_BATCH = 50;

// Module-level state for native modules
let Location: typeof import('expo-location') | null = null;
let TaskManager: typeof import('expo-task-manager') | null = null;
let nativeModulesAvailable = false;
let taskDefined = false;
let initializationPromise: Promise<boolean> | null = null;

// Buffer for background location points (must be at module level for task access)
const backgroundTaskContext: {
  walkId?: string;
  convexUrl?: string;
  authToken?: string;
  locationBuffer: Array<{
    lat: number;
    lng: number;
    timestamp: number;
    accuracy?: number;
  }>;
  failureCount: number;
  lastErrorType: LocationErrorType | null;
  isPermanentlyFailed: boolean;
} = {
  locationBuffer: [],
  failureCount: 0,
  lastErrorType: null,
  isPermanentlyFailed: false,
};

// Reset function to clear sensitive data on logout
export function resetBackgroundTaskContext() {
  backgroundTaskContext.walkId = undefined;
  backgroundTaskContext.convexUrl = undefined;
  backgroundTaskContext.authToken = undefined;
  backgroundTaskContext.locationBuffer = [];
  backgroundTaskContext.failureCount = 0;
  backgroundTaskContext.lastErrorType = null;
  backgroundTaskContext.isPermanentlyFailed = false;
}

// Parse error response to determine error type (must be before task definition)
function parseLocationError(error: any): LocationErrorType {
  const errorCode = error?.code || error?.data?.code;
  if (errorCode) {
    const codeMap: Record<string, LocationErrorType> = {
      'accuracy_low': 'accuracy_low',
      'timestamp_stale': 'timestamp_stale',
      'timestamp_future': 'timestamp_future',
      'rate_limited': 'rate_limited',
      'walk_not_active': 'walk_not_active',
      'unauthorized': 'auth_expired',
      'location_jump': 'accuracy_low',
    };
    if (codeMap[errorCode]) {
      return codeMap[errorCode];
    }
  }

  const message = error?.message || error?.data?.message || error?.error || String(error) || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('accuracy') || lowerMessage.includes('approximate')) {
    return 'accuracy_low';
  }
  if (lowerMessage.includes('too old') || lowerMessage.includes('stale')) {
    return 'timestamp_stale';
  }
  if (lowerMessage.includes('future')) {
    return 'timestamp_future';
  }
  if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) {
    return 'rate_limited';
  }
  if (lowerMessage.includes('not in progress') || lowerMessage.includes('walk not found') || lowerMessage.includes('completed') || lowerMessage.includes('cancelled')) {
    return 'walk_not_active';
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('401') || lowerMessage.includes('token') || lowerMessage.includes('auth')) {
    return 'auth_expired';
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('timeout')) {
    return 'network';
  }
  return 'unknown';
}

// Background task callback - defined at module level as required by Expo
const backgroundLocationTaskCallback = async ({ data, error }: any) => {
  if (error || !data || !Location) {
    console.log('[GPS-BG] Early return - error:', !!error, 'data:', !!data, 'Location:', !!Location);
    return;
  }

  // Don't process if permanently failed
  if (backgroundTaskContext.isPermanentlyFailed) {
    console.log('[GPS-BG] Skipping - permanently failed');
    return;
  }

  const { locations } = data as { locations: import('expo-location').LocationObject[] };
  console.log('[GPS-BG] Received', locations?.length || 0, 'locations');

  if (locations && locations.length > 0) {
    for (const location of locations) {
      // Pre-filter low accuracy points to avoid buffering bad data
      const accuracy = location.coords.accuracy;
      if (accuracy !== null && accuracy !== undefined && accuracy > 100) {
        console.log('[GPS-BG] Filtered out low accuracy point:', accuracy, 'm');
        backgroundTaskContext.lastErrorType = 'accuracy_low';
        continue;
      }

      backgroundTaskContext.locationBuffer.push({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: accuracy || undefined,
      });
      console.log('[GPS-BG] Buffered point. Buffer size:', backgroundTaskContext.locationBuffer.length, 'Accuracy:', accuracy, 'm');
    }

    // FIX #2: Changed from >= 3 to >= 1 for immediate sending
    if (
      backgroundTaskContext.locationBuffer.length >= 1 &&
      backgroundTaskContext.convexUrl &&
      backgroundTaskContext.walkId
    ) {
      // FIX #4: Refresh token before each batch (handles long walks + token expiry)
      const freshToken = await authStorage.getToken();
      if (!freshToken) {
        console.log('[GPS-BG] ERROR: No auth token available');
        backgroundTaskContext.lastErrorType = 'auth_expired';
        backgroundTaskContext.isPermanentlyFailed = true;
        return;
      }
      backgroundTaskContext.authToken = freshToken;

      try {
        const points = backgroundTaskContext.locationBuffer.slice(0, MAX_POINTS_PER_BATCH);
        console.log('[GPS-BG] Sending batch:', points.length, 'points to backend');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${backgroundTaskContext.convexUrl}/location/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${freshToken}`,
          },
          body: JSON.stringify({
            walkId: backgroundTaskContext.walkId,
            points,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          backgroundTaskContext.locationBuffer = backgroundTaskContext.locationBuffer.slice(points.length);
          backgroundTaskContext.failureCount = 0;
          backgroundTaskContext.lastErrorType = null;
          console.log('[GPS-BG] SUCCESS: Sent', points.length, 'points. Buffer remaining:', backgroundTaskContext.locationBuffer.length);
        } else {
          const errorBody = await response.json().catch(() => ({}));
          const errorType = parseLocationError({ message: errorBody.error, status: response.status });
          console.log('[GPS-BG] HTTP ERROR:', response.status, errorBody.error, '→', errorType);

          backgroundTaskContext.failureCount++;
          backgroundTaskContext.lastErrorType = errorType;

          if (PERMANENT_ERRORS.includes(errorType)) {
            console.log('[GPS-BG] PERMANENT ERROR - stopping tracking');
            backgroundTaskContext.isPermanentlyFailed = true;
          }
        }
      } catch (fetchError: any) {
        backgroundTaskContext.failureCount++;
        backgroundTaskContext.lastErrorType = fetchError?.name === 'AbortError' ? 'network' : parseLocationError(fetchError);
        console.log('[GPS-BG] FETCH ERROR:', fetchError?.name, fetchError?.message, '→', backgroundTaskContext.lastErrorType);
      }
    } else {
      console.log('[GPS-BG] Not sending - buffer:', backgroundTaskContext.locationBuffer.length, 'url:', !!backgroundTaskContext.convexUrl, 'walkId:', !!backgroundTaskContext.walkId);
    }
  }
};

// Initialize native modules and define task - called once at module load
async function initializeLocationModules(): Promise<boolean> {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      Location = await import('expo-location');
      TaskManager = await import('expo-task-manager');
      nativeModulesAvailable = true;

      // Define the background task ONCE - this is critical
      if (!taskDefined) {
        TaskManager.defineTask(LOCATION_TASK_NAME, backgroundLocationTaskCallback);
        taskDefined = true;
      }

      return true;
    } catch {
      nativeModulesAvailable = false;
      return false;
    }
  })();

  return initializationPromise;
}

// Initialize immediately at module load time (IIFE)
// This ensures the task is defined as early as possible
(async () => {
  await initializeLocationModules();
})();

// Check if modules are ready (for component use)
async function ensureModulesReady(): Promise<boolean> {
  if (nativeModulesAvailable && taskDefined) return true;
  return initializeLocationModules();
}

// Safe wrapper for isTaskRegisteredAsync - handles "task not found" errors gracefully
async function isTaskRegisteredSafe(): Promise<boolean> {
  if (!TaskManager || !taskDefined) return false;
  try {
    return await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  } catch (error: any) {
    // Task not found is expected if hot reload happened without re-running module code
    if (error?.message?.includes('not found')) {
      // Try to re-define the task
      if (!taskDefined) {
        TaskManager.defineTask(LOCATION_TASK_NAME, backgroundLocationTaskCallback);
        taskDefined = true;
      }
      return false;
    }
    return false;
  }
}

// Safe wrapper for stopLocationUpdatesAsync - handles errors gracefully
async function stopLocationUpdatesSafe(): Promise<void> {
  if (!Location || !TaskManager) return;
  try {
    const isRegistered = await isTaskRegisteredSafe();
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch {
    // Ignore errors when stopping - task may not be running
  }
}

// Check current permission status without prompting
async function checkLocationPermissions(): Promise<{
  foreground: 'granted' | 'denied' | 'undetermined';
  background: 'granted' | 'denied' | 'undetermined';
}> {
  if (!Location) {
    return { foreground: 'undetermined', background: 'undetermined' };
  }

  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foreground.status as 'granted' | 'denied' | 'undetermined',
    background: background.status as 'granted' | 'denied' | 'undetermined',
  };
}

// Open device settings for app permissions
function openAppSettings() {
  Linking.openSettings();
}

// Derive the HTTP site URL from the Convex cloud URL
// Convex client URL: *.convex.cloud, HTTP actions URL: *.convex.site
function getConvexSiteUrl(): string {
  const cloudUrl = process.env.EXPO_PUBLIC_CONVEX_URL || '';
  return cloudUrl.replace('.convex.cloud', '.convex.site');
}

// Get user-friendly error message
function getErrorMessage(errorType: LocationErrorType): string {
  switch (errorType) {
    case 'accuracy_low':
      return 'GPS signal too weak. Move to an open area for better accuracy.';
    case 'timestamp_stale':
      return 'Location data is stale. Check your device clock settings.';
    case 'timestamp_future':
      return 'Device clock is incorrect. Check your date/time settings.';
    case 'rate_limited':
      return 'Sending locations too fast. Will retry shortly.';
    case 'walk_not_active':
      return 'Walk is no longer active. Tracking stopped.';
    case 'auth_expired':
      return 'Session expired. Please restart the app.';
    case 'permission_denied':
      return 'Location permission denied. Tap to open Settings and enable location access.';
    case 'network':
      return 'Network error. Will retry when connection improves.';
    default:
      return 'Location tracking error. Will retry.';
  }
}

// Calculate exponential backoff delay
function calculateBackoff(failureCount: number): number {
  const delay = INITIAL_BACKOFF_MS * Math.pow(2, Math.min(failureCount, 5));
  return Math.min(delay, MAX_BACKOFF_MS);
}

export default function ActiveWalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams();

  // Get walkId from route params or find active walk
  const paramWalkId = params.walkId as string | undefined;
  const inProgressWalks = useAuthQuery(api.walks.listMineWalker, { status: 'in_progress' });

  // Determine which walk to use
  const walkId = paramWalkId || (inProgressWalks && inProgressWalks.length > 0 ? inProgressWalks[0]._id : undefined);

  // Fetch walk data - use a dummy ID when skipping to satisfy type checker
  const walk = useAuthQuery(
    api.walks.getById,
    { walkId: (walkId || 'skip') as Id<'walks'> },
    { skip: !walkId }
  );

  // Mutations - use auth-aware wrappers for dev mode authentication
  const startWalk = useAuthMutation(api.walks.start);
  const completeWalk = useAuthMutation(api.walks.complete);
  const appendLocation = useAuthMutation(api.walks.appendLocation);
  const appendLocationsBatch = useAuthMutation(api.walks.appendLocationsBatch);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFlushingRef = useRef(false);

  // Location tracking error state
  const [locationError, setLocationError] = useState<LocationErrorType | null>(null);
  const [locationErrorDismissed, setLocationErrorDismissed] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [isTrackingStopped, setIsTrackingStopped] = useState(false);
  const nextRetryTimeRef = useRef<number>(0);
  // Track which walk we've initialized location for (prevents re-running setup)
  const initializedWalkIdRef = useRef<string | null>(null);

  // Permission status state (for pre-check before starting walk)
  const [permissionStatus, setPermissionStatus] = useState<{
    foreground: 'granted' | 'denied' | 'undetermined';
    background: 'granted' | 'denied' | 'undetermined';
    checked: boolean;
  }>({ foreground: 'undetermined', background: 'undetermined', checked: false });

  // Check permissions on mount and when returning from settings
  useEffect(() => {
    const checkPermissions = async () => {
      await ensureModulesReady();
      const status = await checkLocationPermissions();
      setPermissionStatus({ ...status, checked: true });
    };
    checkPermissions();

    // Re-check when app comes to foreground (user may have changed settings)
    const { AppState } = require('react-native');
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });

    return () => subscription?.remove();
  }, []);

  // Flush buffered locations to backend with exponential backoff
  const flushLocationBuffer = useCallback(async () => {
    // Don't flush if permanently stopped
    if (isTrackingStopped || backgroundTaskContext.isPermanentlyFailed) {
      console.log('[GPS-FLUSH] Skipping - stopped:', isTrackingStopped, 'failed:', backgroundTaskContext.isPermanentlyFailed);
      return;
    }

    if (!walkId || backgroundTaskContext.locationBuffer.length === 0 || isFlushingRef.current) {
      // Only log if there's something interesting
      if (backgroundTaskContext.locationBuffer.length > 0) {
        console.log('[GPS-FLUSH] Skipping - walkId:', !!walkId, 'isFlushing:', isFlushingRef.current);
      }
      return;
    }

    // Check if we should wait due to backoff
    const now = Date.now();
    if (now < nextRetryTimeRef.current) {
      console.log('[GPS-FLUSH] Backoff active, waiting', Math.round((nextRetryTimeRef.current - now) / 1000), 's');
      return;
    }

    isFlushingRef.current = true;
    console.log('[GPS-FLUSH] Starting flush of', backgroundTaskContext.locationBuffer.length, 'points');

    let remaining = [...backgroundTaskContext.locationBuffer];
    backgroundTaskContext.locationBuffer = [];

    try {
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, MAX_POINTS_PER_BATCH);
        console.log('[GPS-FLUSH] Sending chunk:', chunk.length, 'points');
        await appendLocationsBatch({
          walkId: walkId as Id<'walks'>,
          points: chunk,
        });
        remaining = remaining.slice(chunk.length);
        console.log('[GPS-FLUSH] Chunk sent. Remaining:', remaining.length);
      }

      // Success - reset error state
      setFailureCount(0);
      setLocationError(null);
      backgroundTaskContext.failureCount = 0;
      backgroundTaskContext.lastErrorType = null;
      nextRetryTimeRef.current = 0;
      console.log('[GPS-FLUSH] SUCCESS - all points flushed');
    } catch (error: any) {
      // Put only unsent points back on failure (preserve any new points appended meanwhile)
      backgroundTaskContext.locationBuffer = [...remaining, ...backgroundTaskContext.locationBuffer];
      console.log('[GPS-FLUSH] ERROR:', error?.message, 'Restored', remaining.length, 'points to buffer');

      // Parse the error
      const errorType = parseLocationError(error);
      const newFailureCount = failureCount + 1;

      setFailureCount(newFailureCount);
      setLocationError(errorType);
      setLocationErrorDismissed(false);

      backgroundTaskContext.failureCount = newFailureCount;
      backgroundTaskContext.lastErrorType = errorType;

      // Check for permanent errors
      if (PERMANENT_ERRORS.includes(errorType)) {
        console.log('[GPS-FLUSH] PERMANENT ERROR:', errorType, '- stopping tracking');
        setIsTrackingStopped(true);
        backgroundTaskContext.isPermanentlyFailed = true;
        toast.show(getErrorMessage(errorType), 'error');
      } else {
        // Calculate next retry time with exponential backoff
        const backoffDelay = calculateBackoff(newFailureCount);
        nextRetryTimeRef.current = Date.now() + backoffDelay;
        console.log('[GPS-FLUSH] Will retry in', Math.round(backoffDelay / 1000), 's. Failure count:', newFailureCount);

        // Show toast on first few failures, then only periodically
        if (newFailureCount <= 3 || newFailureCount % 10 === 0) {
          toast.show(getErrorMessage(errorType), 'warning');
        }
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [walkId, failureCount, isTrackingStopped, appendLocationsBatch, toast]);

  // Periodic sync of buffered locations (adaptive interval based on backoff)
  useEffect(() => {
    if (walk?.status === 'in_progress' && !isPaused && !isTrackingStopped) {
      // Use shorter interval to check backoff timer, actual flush will respect backoff
      syncIntervalRef.current = setInterval(flushLocationBuffer, 5000);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [walk?.status, isPaused, walkId, isTrackingStopped, flushLocationBuffer]);

  // Sync error state from background task context
  useEffect(() => {
    const checkBackgroundErrors = setInterval(() => {
      if (backgroundTaskContext.lastErrorType && backgroundTaskContext.lastErrorType !== locationError) {
        setLocationError(backgroundTaskContext.lastErrorType);
        setFailureCount(backgroundTaskContext.failureCount);
        setLocationErrorDismissed(false);
      }
      if (backgroundTaskContext.isPermanentlyFailed && !isTrackingStopped) {
        setIsTrackingStopped(true);
      }
    }, 2000);

    return () => clearInterval(checkBackgroundErrors);
  }, [locationError, isTrackingStopped]);

  // Update elapsed time based on walk's startedAt timestamp
  useEffect(() => {
    if (!walk || walk.status !== 'in_progress' || !walk.startedAt || isPaused) {
      return;
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - walk.startedAt!) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [walk, isPaused]);

  // Background location tracking - starts when walk begins, stops when paused/completed
  useEffect(() => {
    const setupBackgroundLocation = async () => {
      console.log('[GPS-SETUP] Starting setup. walkId:', walkId, 'status:', walk?.status, 'isPaused:', isPaused);

      // Ensure native modules are ready (defined at module load, but wait for initialization)
      const modulesAvailable = await ensureModulesReady();
      console.log('[GPS-SETUP] Modules available:', modulesAvailable);

      if (!walkId || walk?.status !== 'in_progress' || isPaused) {
        // Stop background tracking if modules available
        if (modulesAvailable) {
          console.log('[GPS-SETUP] Stopping tracking - conditions not met');
          await stopLocationUpdatesSafe();
        }
        // Clear initialized ref when walk stops
        if (walk?.status !== 'in_progress') {
          initializedWalkIdRef.current = null;
        }
        return;
      }

      // Skip if we've already initialized for this walk
      if (initializedWalkIdRef.current === walkId) {
        console.log('[GPS-SETUP] Already initialized for this walk');
        return;
      }

      if (!modulesAvailable || !Location || !TaskManager) {
        console.log('[GPS-SETUP] ERROR: Native modules not available');
        toast.show('Location tracking unavailable in this build', 'warning');
        return;
      }

      // Mark as initialized for this walk BEFORE async operations
      initializedWalkIdRef.current = walkId as string;
      console.log('[GPS-SETUP] Initializing for walk:', walkId);

      try {
        // Request foreground location permission (required)
        const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
        console.log('[GPS-SETUP] Foreground permission:', foregroundStatus);
        if (foregroundStatus !== 'granted') {
          console.log('[GPS-SETUP] ERROR: Foreground permission denied');
          toast.show('Location permission required for tracking. Tap the banner to open Settings.', 'error');
          setLocationError('permission_denied');
          setIsTrackingStopped(true);
          backgroundTaskContext.isPermanentlyFailed = true;
          // Update permission status
          setPermissionStatus(prev => ({ ...prev, foreground: 'denied' }));
          return;
        }
        setPermissionStatus(prev => ({ ...prev, foreground: 'granted' }));

        // Request background location permission (optional but recommended)
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        console.log('[GPS-SETUP] Background permission:', backgroundStatus);
        if (backgroundStatus !== 'granted') {
          toast.show('Enable "Always" location for best tracking when app is in background', 'warning');
          setPermissionStatus(prev => ({ ...prev, background: 'denied' }));
          // Continue with foreground-only tracking
        } else {
          setPermissionStatus(prev => ({ ...prev, background: 'granted' }));
        }

        // Reset tracking state for new walk
        backgroundTaskContext.walkId = walkId as string;
        backgroundTaskContext.locationBuffer = [];
        backgroundTaskContext.convexUrl = getConvexSiteUrl();
        backgroundTaskContext.failureCount = 0;
        backgroundTaskContext.lastErrorType = null;
        backgroundTaskContext.isPermanentlyFailed = false;
        console.log('[GPS-SETUP] Context reset. ConvexUrl:', backgroundTaskContext.convexUrl);

        // Reset component state
        setFailureCount(0);
        setLocationError(null);
        setLocationErrorDismissed(false);
        setIsTrackingStopped(false);
        nextRetryTimeRef.current = 0;

        const token = await authStorage.getToken();
        backgroundTaskContext.authToken = token || undefined;
        console.log('[GPS-SETUP] Auth token:', token ? 'present' : 'MISSING');

        // Stop any existing task before starting fresh
        await stopLocationUpdatesSafe();

        // Get initial location and check accuracy BEFORE starting walk tracking
        console.log('[GPS-SETUP] Getting initial location...');
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const accuracy = initialLocation.coords.accuracy;
        console.log('[GPS-SETUP] Initial location - lat:', initialLocation.coords.latitude.toFixed(4),
          'lng:', initialLocation.coords.longitude.toFixed(4), 'accuracy:', accuracy, 'm');

        if (accuracy !== null && accuracy !== undefined && accuracy > 100) {
          // Warn about low accuracy but don't block - user may be indoors temporarily
          console.log('[GPS-SETUP] WARNING: Low accuracy GPS signal');
          toast.show('GPS signal weak. Move outdoors for better tracking accuracy.', 'warning');
          setLocationError('accuracy_low');
        }

        // Ensure task is defined before starting (handles hot reload edge cases)
        if (!taskDefined && TaskManager) {
          console.log('[GPS-SETUP] Re-defining task (hot reload recovery)');
          TaskManager.defineTask(LOCATION_TASK_NAME, backgroundLocationTaskCallback);
          taskDefined = true;
        }

        // Start background location updates
        console.log('[GPS-SETUP] Starting background location updates...');
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
          deferredUpdatesInterval: 5000, // Send updates every 5 seconds when moving
          showsBackgroundLocationIndicator: true,
          foregroundService: Platform.OS === 'android' ? {
            notificationTitle: 'Packwalk Active Walk',
            notificationBody: 'Tracking your walk location',
            notificationColor: colors.sage,
          } : undefined,
        });
        console.log('[GPS-SETUP] Background location task registered');

        // Send initial location if accuracy is acceptable
        if (accuracy === null || accuracy === undefined || accuracy <= 100) {
          try {
            console.log('[GPS-SETUP] Sending initial location to backend...');
            await appendLocation({
              walkId: walkId as Id<'walks'>,
              point: {
                lat: initialLocation.coords.latitude,
                lng: initialLocation.coords.longitude,
                timestamp: Date.now(),
                accuracy: accuracy || undefined,
              },
            });
            console.log('[GPS-SETUP] Initial location sent successfully');
          } catch (error: any) {
            console.log('[GPS-SETUP] ERROR sending initial location:', error?.message);
            const errorType = parseLocationError(error);
            setLocationError(errorType);
            setFailureCount(1);
            if (PERMANENT_ERRORS.includes(errorType)) {
              setIsTrackingStopped(true);
              backgroundTaskContext.isPermanentlyFailed = true;
            }
          }
        } else {
          console.log('[GPS-SETUP] Skipping initial location send due to low accuracy');
        }

        console.log('[GPS-SETUP] Setup complete!');
      } catch (error: any) {
        console.log('[GPS-SETUP] FATAL ERROR:', error?.message);
        toast.show('Failed to start location tracking', 'error');
        setLocationError('unknown');
      }
    };

    setupBackgroundLocation();

    return () => {
      // Cleanup on unmount
      stopLocationUpdatesSafe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkId, walk?.status, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Compute GPS status for the indicator
  const getGpsStatus = (): { status: 'waiting' | 'active' | 'weak' | 'inactive'; label: string } => {
    if (isTrackingStopped || backgroundTaskContext.isPermanentlyFailed) {
      return { status: 'inactive', label: 'GPS Stopped' };
    }
    if (locationError === 'accuracy_low') {
      return { status: 'weak', label: 'GPS Weak' };
    }
    if (locationError === 'permission_denied') {
      return { status: 'inactive', label: 'No Permission' };
    }
    if (locationError && locationError !== 'network') {
      return { status: 'weak', label: 'GPS Issue' };
    }
    // Check if we have successfully sent any locations (distance > 0 means backend received data)
    if (walk?.distanceMeters && walk.distanceMeters > 0) {
      return { status: 'active', label: 'GPS Active' };
    }
    // Buffer has points waiting = collecting but not yet sent
    if (backgroundTaskContext.locationBuffer.length > 0) {
      return { status: 'active', label: 'Tracking...' };
    }
    // Default: waiting for first GPS fix
    return { status: 'waiting', label: 'Acquiring GPS...' };
  };

  const gpsStatus = getGpsStatus();

  const handleStartWalk = async () => {
    if (!walkId) {
      toast.show('No walk found', 'error');
      return;
    }

    try {
      setIsStarting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Pre-check location permissions before starting
      await ensureModulesReady();
      if (Location) {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'denied') {
          // Permission was previously denied - show alert with option to open settings
          Alert.alert(
            'Location Permission Required',
            'Location tracking is required to start a walk. Please enable location access in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: openAppSettings },
            ]
          );
          setIsStarting(false);
          return;
        }

        if (status !== 'granted') {
          // Permission not yet requested - request it now
          const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
          if (newStatus !== 'granted') {
            toast.show('Location permission is required to track walks', 'error');
            setLocationError('permission_denied');
            setIsStarting(false);
            return;
          }
        }
      }

      await startWalk({ walkId: walkId as Id<'walks'> });
      toast.show('Walk started!', 'success');
    } catch (error: any) {
      toast.show(error?.message || 'Failed to start walk', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCompleteWalk = () => {
    if (!walkId) {
      toast.show('No walk found', 'error');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Complete Walk?',
      'Are you sure you want to complete this walk? This will finalize your earnings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Walk',
          style: 'default',
          onPress: async () => {
            try {
              setIsCompleting(true);
              // Flush any remaining buffered locations before completing
              await flushLocationBuffer();
              await completeWalk({ walkId: walkId as Id<'walks'> });
              toast.show('Walk completed! Payment processing.', 'success');
              router.replace('/(walker)/earnings');
            } catch (error: any) {
              toast.show(error?.message || 'Failed to complete walk', 'error');
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleEmergency = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      Alert.alert('Emergency', 'Please call 911 for emergencies.', [{ text: 'OK' }]);
    } else {
      Linking.openURL('tel:911');
    }
  };

  // Show loading state
  if (!walk) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Walk</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading walk...</Text>
        </View>
      </View>
    );
  }

  const isScheduled = walk.status === 'scheduled';
  const isInProgress = walk.status === 'in_progress';
  const walkDate = new Date(walk.scheduledTime);
  const address = walk.pickupLocationSnapshot?.addressLine1 || 'Address not set';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isScheduled ? 'Scheduled Walk' : 'Active Walk'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Location Error Banner */}
      {isInProgress && locationError && !locationErrorDismissed && (
        <TouchableOpacity
          activeOpacity={locationError === 'permission_denied' ? 0.7 : 1}
          onPress={locationError === 'permission_denied' ? openAppSettings : undefined}
          style={[
            styles.errorBanner,
            isTrackingStopped ? styles.errorBannerCritical : styles.errorBannerWarning
          ]}
        >
          <AlertTriangle
            size={20}
            color={isTrackingStopped ? colors.error : '#92400E'}
          />
          <View style={styles.errorBannerContent}>
            <Text style={[
              styles.errorBannerText,
              isTrackingStopped && styles.errorBannerTextCritical
            ]}>
              {getErrorMessage(locationError)}
            </Text>
            {locationError === 'permission_denied' && (
              <View style={styles.settingsButtonRow}>
                <Settings size={14} color={colors.error} />
                <Text style={styles.settingsButtonText}>Tap to open Settings</Text>
              </View>
            )}
            {failureCount > 1 && !isTrackingStopped && locationError !== 'permission_denied' && (
              <Text style={styles.errorBannerSubtext}>
                {failureCount} failed attempts. Retrying with backoff...
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setLocationErrorDismissed(true)}
            style={styles.errorBannerClose}
            accessibilityLabel="Dismiss error"
          >
            <X size={18} color={isTrackingStopped ? colors.error : '#92400E'} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Permission Warning Banner (shown on scheduled screen if permission denied) */}
      {isScheduled && permissionStatus.checked && permissionStatus.foreground === 'denied' && (
        <TouchableOpacity
          onPress={openAppSettings}
          style={[styles.errorBanner, styles.errorBannerCritical]}
        >
          <AlertTriangle size={20} color={colors.error} />
          <View style={styles.errorBannerContent}>
            <Text style={[styles.errorBannerText, styles.errorBannerTextCritical]}>
              Location permission required to start walk
            </Text>
            <View style={styles.settingsButtonRow}>
              <Settings size={14} color={colors.error} />
              <Text style={styles.settingsButtonText}>Tap to open Settings</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {isInProgress && (
          <>
            {/* Timer / Status Focus */}
            <View style={styles.timerContainer}>
              <View style={styles.timerIcon}>
                <Clock size={48} color={colors.white} strokeWidth={2} />
              </View>
              <Text style={styles.timerValue}>{formatTime(elapsedSeconds)}</Text>
              <Text style={styles.timerLabel}>ELAPSED TIME</Text>

              {/* GPS Status Indicator */}
              <View style={[
                styles.gpsStatusContainer,
                gpsStatus.status === 'active' && styles.gpsStatusActive,
                gpsStatus.status === 'weak' && styles.gpsStatusWeak,
                gpsStatus.status === 'inactive' && styles.gpsStatusInactive,
                gpsStatus.status === 'waiting' && styles.gpsStatusWaiting,
              ]}>
                {gpsStatus.status === 'active' && (
                  <Signal size={14} color={colors.sage} />
                )}
                {gpsStatus.status === 'weak' && (
                  <SignalLow size={14} color="#B45309" />
                )}
                {gpsStatus.status === 'inactive' && (
                  <SignalZero size={14} color={colors.error} />
                )}
                {gpsStatus.status === 'waiting' && (
                  <Loader size={14} color={colors.inkMuted} />
                )}
                <Text style={[
                  styles.gpsStatusText,
                  gpsStatus.status === 'active' && styles.gpsStatusTextActive,
                  gpsStatus.status === 'weak' && styles.gpsStatusTextWeak,
                  gpsStatus.status === 'inactive' && styles.gpsStatusTextInactive,
                ]}>
                  {gpsStatus.label}
                </Text>
              </View>
            </View>
          </>
        )}

        {isScheduled && (
          <View style={styles.scheduledInfo}>
            <Text style={styles.scheduledTitle}>Ready to start?</Text>
            <Text style={styles.scheduledSubtitle}>
              Scheduled for {walkDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} at{' '}
              {walkDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Walk Info */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoText}>
              <Text style={styles.ownerName}>Walk Details</Text>
              <Text style={styles.dogNames}>
                Duration: 30 min
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.locationRow}>
            <MapPin size={20} color={colors.inkMuted} />
            <Text style={styles.addressText}>{address}</Text>
          </View>

          {walk.distanceMeters !== undefined && walk.distanceMeters > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.locationRow}>
                <Navigation size={20} color={colors.inkMuted} />
                <Text style={styles.addressText}>
                  Distance: {(walk.distanceMeters / 1000).toFixed(2)} km
                </Text>
              </View>
            </>
          )}
        </Card>

        {/* Controls */}
        <View style={styles.controls}>
          {isScheduled && (
            <Button
              variant="primary"
              onPress={handleStartWalk}
              style={styles.controlButton}
              loading={isStarting}
              disabled={isStarting}
            >
              Start Walk
            </Button>
          )}

          {isInProgress && (
            <>
              <Button
                variant={isPaused ? 'primary' : 'secondary'}
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsPaused(!isPaused);
                }}
                style={styles.controlButton}
                icon={
                  isPaused ? (
                    <Navigation size={20} color={colors.white} />
                  ) : (
                    <Clock size={20} color={colors.white} />
                  )
                }
              >
                {isPaused ? 'Resume Tracking' : 'Pause Tracking'}
              </Button>

              <Button
                variant="outline"
                onPress={handleCompleteWalk}
                style={[styles.controlButton, styles.endButton]}
                textStyle={{ color: colors.sage }}
                loading={isCompleting}
                disabled={isCompleting}
              >
                Complete Walk
              </Button>
            </>
          )}
        </View>

        {/* Emergency */}
        <TouchableOpacity style={styles.emergencyLink} onPress={handleEmergency}>
          <Shield size={16} color={colors.inkMuted} />
          <Text style={styles.emergencyText}>Emergency Center</Text>
        </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.paper,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.white,
    ...shadows.subtle,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  scheduledInfo: {
    alignItems: 'center',
    marginVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  scheduledTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  scheduledSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  timerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.glow,
  },
  timerValue: {
    fontSize: typography.sizes['5xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  timerLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  infoCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
  },
  ownerName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  dogNames: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.stone,
    marginVertical: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressText: {
    fontSize: typography.sizes.base,
    color: colors.ink,
  },
  controls: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  controlButton: {
    height: 56,
  },
  endButton: {
    borderColor: colors.error,
    backgroundColor: '#FFF5F5',
  },
  emergencyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  emergencyText: {
    fontSize: typography.sizes.sm,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  // Error banner styles
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  errorBannerWarning: {
    backgroundColor: '#FEF3C7', // amber-100
  },
  errorBannerCritical: {
    backgroundColor: '#FEE2E2', // red-100
  },
  errorBannerContent: {
    flex: 1,
  },
  errorBannerText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: '#92400E', // amber-800
  },
  errorBannerTextCritical: {
    color: colors.error,
  },
  errorBannerSubtext: {
    fontSize: typography.sizes.xs,
    color: '#B45309', // amber-700
    marginTop: 2,
  },
  errorBannerClose: {
    padding: spacing.xs,
  },
  settingsButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  settingsButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
  // GPS Status Indicator styles
  gpsStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  gpsStatusActive: {
    backgroundColor: '#ECFDF5', // green-50
  },
  gpsStatusWeak: {
    backgroundColor: '#FEF3C7', // amber-100
  },
  gpsStatusInactive: {
    backgroundColor: '#FEE2E2', // red-100
  },
  gpsStatusWaiting: {
    backgroundColor: colors.stone,
  },
  gpsStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
  gpsStatusTextActive: {
    color: colors.sage,
  },
  gpsStatusTextWeak: {
    color: '#B45309', // amber-700
  },
  gpsStatusTextInactive: {
    color: colors.error,
  },
});
