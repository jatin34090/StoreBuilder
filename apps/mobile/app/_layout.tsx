import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotificationsAsync } from '../services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const { isAuthenticated, role } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    const inAuthGroup = segments[0] === 'auth';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Route to correct tabs based on role
      if (role === 'DELIVERY_AGENT') {
        router.replace('/(agent)/dashboard');
      } else {
        router.replace('/(tabs)/');
      }
    }
  }, [isAuthenticated, segments, role]);

  useEffect(() => {
    registerForPushNotificationsAsync().catch(console.error);
    SplashScreen.hideAsync().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Slot />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
