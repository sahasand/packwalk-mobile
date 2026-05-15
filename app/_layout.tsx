import { useEffect, useState, useCallback } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { ConvexProviderWithAuth } from 'convex/react';
import { StripeProvider } from '@stripe/stripe-react-native';

import { colors } from '@/constants/theme';
import { useAppStore } from '@/stores/appStore';
import { ToastContainer } from '@/components/ui/Toast';
import { convex } from '@/lib/convexClient';
import { useConvexAuth } from '@/lib/useConvexAuth';
import AuthErrorBoundary from '@/components/AuthErrorBoundary';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { isLoggedIn, userType } = useAppStore();

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        await Font.loadAsync({
          'PlayfairDisplay': require('@/assets/fonts/PlayfairDisplay-Regular.ttf'),
          'PlayfairDisplay-Bold': require('@/assets/fonts/PlayfairDisplay-Bold.ttf'),
          'DMSans': require('@/assets/fonts/DMSans-Regular.ttf'),
          'DMSans-Medium': require('@/assets/fonts/DMSans-Medium.ttf'),
          'DMSans-Bold': require('@/assets/fonts/DMSans-Bold.ttf'),
        });
      } catch (e) {
        // Font loading failed, continue with system fonts
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately! If we do this sooner,
      // the initial screen will flash an unstyled view
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  useEffect(() => {
    if (!appIsReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isLoggedIn && !inAuthGroup) {
      // Not logged in - go to unified login screen
      router.replace('/(auth)/login');
    } else if (isLoggedIn && inAuthGroup) {
      // Logged in but still in auth - route to correct flow based on user type
      router.replace(userType === 'walker' ? '/(walker)' : '/(owner)');
    }
  }, [appIsReady, isLoggedIn, userType, segments]);

  // Handle deep links for Stripe Connect return
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      // Handle stripe-connect-return and stripe-connect-refresh URLs
      if (url.includes('stripe-connect-return') || url.includes('stripe-connect-refresh')) {
        // Navigate to earnings screen to show updated status
        if (isLoggedIn && userType === 'walker') {
          router.replace('/(walker)/earnings');
        }
      }
    };

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, userType, router]);

  if (!appIsReady) {
    return null;
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.packwalk.app"
    >
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
        <AuthErrorBoundary>
          <SafeAreaProvider>
            <View style={{ flex: 1, backgroundColor: colors.paper }} onLayout={onLayoutRootView}>
              <StatusBar style="dark" />
              <Slot />
              <ToastContainer />
            </View>
          </SafeAreaProvider>
        </AuthErrorBoundary>
      </ConvexProviderWithAuth>
    </StripeProvider>
  );
}
