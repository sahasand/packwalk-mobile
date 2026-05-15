import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { Dog, Footprints, Shield, MapPin, Heart } from 'lucide-react-native';
import { AntDesign } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PawIcon } from '@/components/ui';
import { colors, spacing, radius, shadows, typography, animation } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/convex/_generated/api';
import { authStorage } from '@/lib/authStorage';
import { notifyTokenStored } from '@/lib/useConvexAuth';

const { width, height } = Dimensions.get('window');

// Complete auth session for web
WebBrowser.maybeCompleteAuthSession();

// Value propositions with their visual identities
const valueProps = [
  {
    id: 0,
    icon: Shield,
    accent: colors.ember,
    headline: 'Trusted Walkers',
    subtext: 'Every walker vetted & verified',
  },
  {
    id: 1,
    icon: MapPin,
    accent: colors.sage,
    headline: 'Live Tracking',
    subtext: 'Real-time GPS on every walk',
  },
  {
    id: 2,
    icon: Heart,
    accent: colors.gold,
    headline: 'Save Rescues',
    subtext: '20% goes to Toronto shelters',
  },
];

const CYCLE_DURATION = 5000; // 5 seconds per value prop

export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'walker'>('owner');
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [currentPropIndex, setCurrentPropIndex] = useState(0);
  const [hasEntryAnimated, setHasEntryAnimated] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setLoggedIn, setUser, setUserType, setHasOnboarded } = useAppStore();
  const toast = useToast();
  const convex = useConvex();
  const bootstrapUser = useMutation(api.users.bootstrap);

  // Animation values
  const pawStampScale = useSharedValue(0);
  const pawStampOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const propTransition = useSharedValue(0);
  const floatY = useSharedValue(0);
  const roleTogglePulse = useSharedValue(1);
  const gradientPosition = useSharedValue(0);

  // Floating paw positions (constellation effect)
  const paw1Y = useSharedValue(0);
  const paw2Y = useSharedValue(0);
  const paw3Y = useSharedValue(0);

  const getResolvedUserType = async (
    fallback: 'owner' | 'walker',
  ): Promise<'owner' | 'walker'> => {
    try {
      const current = await convex.query(api.users.getCurrent, {});
      if (current?.userType === 'owner' || current?.userType === 'walker') {
        return current.userType;
      }
    } catch {
      // Ignore and fallback to selected role
    }
    return fallback;
  };

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });

  // Check Apple Sign-In availability (iOS only)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then(setIsAppleAvailable)
        .catch(() => setIsAppleAvailable(false));
    }
  }, []);

  // Entry animation sequence
  useEffect(() => {
    if (!hasEntryAnimated) {
      // Paw stamp animation
      pawStampScale.value = withSequence(
        withTiming(1.3, { duration: 300, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.ease) })
      );

      // Fade out paw stamp after a moment
      pawStampOpacity.value = withDelay(
        600,
        withTiming(0, { duration: 400 })
      );

      // Fade in content
      contentOpacity.value = withDelay(
        400,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
      );

      setHasEntryAnimated(true);
      setHasOnboarded(true); // Mark onboarded since we're showing unified screen
    }
  }, [hasEntryAnimated]);

  // Value prop cycling
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPropIndex((prev) => (prev + 1) % valueProps.length);
    }, CYCLE_DURATION);

    return () => clearInterval(interval);
  }, []);

  // Animate transition when prop changes
  useEffect(() => {
    propTransition.value = withTiming(currentPropIndex, {
      duration: 800,
      easing: Easing.inOut(Easing.ease),
    });
    gradientPosition.value = withTiming(currentPropIndex, {
      duration: 1200,
      easing: Easing.inOut(Easing.ease),
    });
  }, [currentPropIndex]);

  // Floating animations
  useEffect(() => {
    // Main float
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Constellation paws with offset timing
    paw1Y.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    paw2Y.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
          withTiming(5, { duration: 2800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    paw3Y.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-7, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
          withTiming(7, { duration: 3200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Role toggle subtle pulse
    roleTogglePulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  // Handle Google OAuth response.
  // `success` keeps the spinner running — handleGoogleSuccess owns clearing it in its own finally.
  // Every other response type (error, cancel, dismiss, locked, opened, or anything expo-auth-session
  // adds in the future) must clear the spinner here, otherwise the button hangs forever.
  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      handleGoogleSuccess(idToken);
      return;
    }

    if (response.type === 'error') {
      toast.show('Google sign-in failed', 'error');
    }
    setGoogleLoading(false);
  }, [response]);

  const handleGoogleSuccess = async (idToken: string | undefined) => {
    if (!idToken) {
      toast.show('No ID token received from Google', 'error');
      setGoogleLoading(false);
      return;
    }

    try {
      let userName: string | undefined;
      let userEmail: string | undefined;
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
          );
          userName = payload.name ||
            (payload.given_name && payload.family_name
              ? `${payload.given_name} ${payload.family_name}`.trim()
              : payload.given_name || payload.email?.split('@')[0]);
          userEmail = payload.email;
        }
      } catch {
        // JWT decode failed, continue without name
      }

      await authStorage.setToken(idToken);
      await notifyTokenStored();

      const userId = await bootstrapUser({
        userType: selectedRole,
        name: userName,
      });

      const resolvedUserType = await getResolvedUserType(selectedRole);

      setUser({
        id: userId,
        name: userName || '',
        email: userEmail || '',
        avatar: '',
        type: resolvedUserType,
        dogs: [],
      });
      setUserType(resolvedUserType);
      setLoggedIn(true);

      toast.show('Welcome to Packwalk!', 'success');
      router.replace(resolvedUserType === 'owner' ? '/(owner)' : '/(walker)');
    } catch (err) {
      setLoggedIn(false);
      await authStorage.clearToken();
      toast.show('Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (err) {
      toast.show('Failed to start Google sign-in', 'error');
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        let fullName = credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : undefined;

        let userEmail = credential.email;

        if (!fullName || !userEmail) {
          try {
            const parts = credential.identityToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(
                atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
              );
              userEmail = userEmail || payload.email;
              if (!fullName && userEmail) {
                fullName = userEmail.split('@')[0];
              }
            }
          } catch {
            // JWT decode failed, continue
          }
        }

        await authStorage.setToken(credential.identityToken);
        await notifyTokenStored();

        const hasRealName = credential.fullName?.givenName || credential.fullName?.familyName;
        const userId = await bootstrapUser({
          userType: selectedRole,
          name: hasRealName ? fullName : undefined,
        });

        const resolvedUserType = await getResolvedUserType(selectedRole);

        setUser({
          id: userId,
          name: fullName || '',
          email: userEmail || '',
          avatar: '',
          type: resolvedUserType,
          dogs: [],
        });
        setUserType(resolvedUserType);
        setLoggedIn(true);

        toast.show('Welcome to Packwalk!', 'success');
        router.replace(resolvedUserType === 'owner' ? '/(owner)' : '/(walker)');
      }
    } catch (err: any) {
      if (err.code === 'ERR_CANCELED') {
        // User cancelled, don't show error
      } else {
        setLoggedIn(false);
        await authStorage.clearToken();
        toast.show('Apple sign-in failed', 'error');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // Animated styles
  const pawStampStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pawStampScale.value }],
    opacity: pawStampOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const paw1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: paw1Y.value }, { rotate: '-15deg' }],
  }));

  const paw2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: paw2Y.value }, { rotate: '25deg' }],
  }));

  const paw3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: paw3Y.value }, { rotate: '-8deg' }],
  }));

  const roleToggleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: roleTogglePulse.value }],
  }));

  const currentProp = valueProps[currentPropIndex];
  const CurrentIcon = currentProp.icon;

  return (
    <View style={styles.container}>
      {/* Gradient mesh background layers */}
      <View style={styles.gradientLayer}>
        {valueProps.map((prop, index) => (
          <Animated.View
            key={prop.id}
            style={[
              styles.gradientOrb,
              {
                backgroundColor: prop.accent,
                opacity: currentPropIndex === index ? 0.12 : 0.03,
                top: index === 0 ? -100 : index === 1 ? height * 0.2 : height * 0.5,
                right: index === 0 ? -80 : index === 1 ? -120 : 50,
                left: index === 2 ? -100 : undefined,
              },
            ]}
          />
        ))}
      </View>

      {/* Floating paw constellation */}
      <Animated.View style={[styles.floatingPaw1, paw1Style]}>
        <PawIcon size={80} color={colors.ember} filled />
      </Animated.View>
      <Animated.View style={[styles.floatingPaw2, paw2Style]}>
        <PawIcon size={50} color={colors.sage} filled />
      </Animated.View>
      <Animated.View style={[styles.floatingPaw3, paw3Style]}>
        <PawIcon size={65} color={colors.gold} filled />
      </Animated.View>

      {/* Entry paw stamp animation */}
      <Animated.View style={[styles.pawStampContainer, pawStampStyle]}>
        <PawIcon size={120} color={colors.ember} filled />
      </Animated.View>

      {/* Main content */}
      <Animated.View style={[styles.content, contentStyle, { paddingTop: insets.top + 20 }]}>

        {/* Value prop scene */}
        <View style={styles.sceneContainer}>
          <Animated.View style={[styles.sceneContent, floatingStyle]}>
            {/* Icon circle */}
            <View style={[styles.iconCircle, { backgroundColor: currentProp.accent + '20' }]}>
              <CurrentIcon size={32} color={currentProp.accent} strokeWidth={2} />
            </View>

            {/* Headline */}
            <Animated.Text
              key={`headline-${currentPropIndex}`}
              entering={FadeInUp.duration(400)}
              exiting={FadeOut.duration(300)}
              style={[styles.propHeadline, { color: currentProp.accent }]}
            >
              {currentProp.headline}
            </Animated.Text>

            {/* Subtext */}
            <Animated.Text
              key={`subtext-${currentPropIndex}`}
              entering={FadeInUp.delay(100).duration(400)}
              exiting={FadeOut.duration(300)}
              style={styles.propSubtext}
            >
              {currentProp.subtext}
            </Animated.Text>
          </Animated.View>

          {/* Dot indicators */}
          <View style={styles.dotsContainer}>
            {valueProps.map((prop, index) => (
              <Pressable
                key={prop.id}
                onPress={() => setCurrentPropIndex(index)}
                style={styles.dotPressable}
              >
                <View
                  style={[
                    styles.dot,
                    index === currentPropIndex && [
                      styles.dotActive,
                      { backgroundColor: currentProp.accent },
                    ],
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Brand lockup */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>Packwalk</Text>
          <Text style={styles.tagline}>Every walk saves a rescue</Text>
        </View>

        {/* Login form */}
        <View style={styles.formContainer}>
          {/* Role selector with personality */}
          <Animated.View style={[styles.roleSelector, roleToggleStyle]}>
            <Pressable
              style={[
                styles.roleOption,
                selectedRole === 'owner' && styles.roleOptionSelected,
              ]}
              onPress={() => setSelectedRole('owner')}
              accessibilityRole="button"
              accessibilityLabel="Select owner role"
            >
              <Animated.View
                style={[
                  styles.roleIcon,
                  selectedRole === 'owner' && styles.roleIconSelected,
                ]}
              >
                <Dog size={18} color={selectedRole === 'owner' ? colors.white : colors.ember} />
              </Animated.View>
              <Text
                style={[
                  styles.roleLabel,
                  selectedRole === 'owner' && styles.roleLabelSelected,
                ]}
              >
                Owner
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.roleOption,
                selectedRole === 'walker' && styles.roleOptionSelectedWalker,
              ]}
              onPress={() => setSelectedRole('walker')}
              accessibilityRole="button"
              accessibilityLabel="Select walker role"
            >
              <Animated.View
                style={[
                  styles.roleIcon,
                  styles.roleIconWalker,
                  selectedRole === 'walker' && styles.roleIconSelectedWalker,
                ]}
              >
                <Footprints size={18} color={selectedRole === 'walker' ? colors.white : colors.sage} />
              </Animated.View>
              <Text
                style={[
                  styles.roleLabel,
                  selectedRole === 'walker' && styles.roleLabelSelectedWalker,
                ]}
              >
                Walker
              </Text>
            </Pressable>
          </Animated.View>

          {/* OAuth buttons */}
          <View style={styles.oauthButtons}>
            <Pressable
              style={[
                styles.oauthButton,
                styles.googleButton,
                (googleLoading || appleLoading) && styles.oauthButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={!request || googleLoading || appleLoading}
            >
              <AntDesign name="google" size={20} color="#4285F4" />
              <Text style={styles.oauthButtonText}>
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </Pressable>

            {Platform.OS === 'ios' && isAppleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            ) : (
              <Pressable
                style={[styles.oauthButton, styles.appleButtonFallback]}
                disabled
              >
                <AntDesign name="apple" size={20} color={colors.inkMuted} />
                <Text style={[styles.oauthButtonText, { color: colors.inkMuted }]}>
                  Continue with Apple
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  // Gradient background
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  gradientOrb: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
  },

  // Floating paws
  floatingPaw1: {
    position: 'absolute',
    top: height * 0.12,
    right: -20,
    opacity: 0.06,
  },

  floatingPaw2: {
    position: 'absolute',
    top: height * 0.25,
    left: -15,
    opacity: 0.05,
  },

  floatingPaw3: {
    position: 'absolute',
    top: height * 0.08,
    left: width * 0.3,
    opacity: 0.04,
  },

  // Entry animation
  pawStampContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    backgroundColor: colors.paper,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Value prop scene
  sceneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxHeight: height * 0.32,
  },

  sceneContent: {
    alignItems: 'center',
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  propHeadline: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    letterSpacing: typography.tracking.tight,
    marginBottom: spacing.xs,
  },

  propSubtext: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
    letterSpacing: typography.tracking.normal,
  },

  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },

  dotPressable: {
    padding: spacing.xs,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.stone,
  },

  dotActive: {
    width: 24,
    borderRadius: 4,
  },

  // Brand
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  brandName: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: typography.tracking.tight,
  },

  tagline: {
    fontSize: typography.sizes.base,
    color: colors.inkMuted,
    marginTop: spacing.xs,
    letterSpacing: typography.tracking.wide,
  },

  // Form
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    ...shadows.elevated,
  },

  roleSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.paper,
  },

  roleOptionSelected: {
    backgroundColor: colors.emberGlow,
    borderColor: colors.ember,
  },

  roleOptionSelectedWalker: {
    backgroundColor: colors.sageLight,
    borderColor: colors.sage,
  },

  roleIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.emberGlow,
  },

  roleIconWalker: {
    backgroundColor: colors.sageLight,
  },

  roleIconSelected: {
    backgroundColor: colors.ember,
  },

  roleIconSelectedWalker: {
    backgroundColor: colors.sage,
  },

  roleLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
  },

  roleLabelSelected: {
    color: colors.ember,
  },

  roleLabelSelectedWalker: {
    color: colors.sage,
  },

  // OAuth buttons
  oauthButtons: {
    gap: spacing.sm,
  },

  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },

  googleButton: {
    backgroundColor: colors.white,
    borderColor: colors.stone,
  },

  oauthButtonDisabled: {
    opacity: 0.6,
  },

  oauthButtonText: {
    fontSize: 19,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },

  appleButton: {
    height: 52,
  },

  appleButtonFallback: {
    backgroundColor: colors.paper,
    borderColor: colors.stone,
    opacity: 0.5,
  },

  // Footer
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },

  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
