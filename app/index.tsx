import { Redirect } from 'expo-router';
import { useAppStore } from '@/stores/appStore';

export default function Index() {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn);
  const userType = useAppStore((state) => state.userType);

  if (!isLoggedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href={userType === 'walker' ? "/(walker)" : "/(owner)"} />;
}
