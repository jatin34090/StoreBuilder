import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/** Entry route — the auth gate in _layout handles unauthenticated redirects. */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? '/(agent)/dashboard' : '/auth/login'} />;
}
