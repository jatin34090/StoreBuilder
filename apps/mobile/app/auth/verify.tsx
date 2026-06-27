import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { authApi } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing } from '../../constants/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const login = useAuthStore((s) => s.login);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const { accessToken, user } = await authApi.verifyOtp(String(phone), otp);
      if (user.role !== 'DELIVERY_AGENT') {
        Alert.alert('Access denied', 'This app is for delivery partners only.');
        return;
      }
      await login(accessToken, user);
      router.replace('/(agent)/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid or expired OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await authApi.sendOtp(String(phone));
      Alert.alert('OTP sent', 'A new code has been sent to your number.');
    } catch {
      Alert.alert('Error', 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to +91 {phone}</Text>

          <View style={{ height: spacing.xl }} />

          <TextField
            label="Verification Code"
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
            placeholder="••••••"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            error={error}
          />

          <Button label="Verify & Continue" onPress={onVerify} loading={loading} />

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn&apos;t get the code? </Text>
            <Pressable onPress={onResend} disabled={resending}>
              <Text style={styles.resendLink}>{resending ? 'Sending…' : 'Resend'}</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Change number</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  resendText: { color: colors.textMuted, fontSize: 14 },
  resendLink: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  backBtn: { alignItems: 'center', marginTop: spacing.md },
  backText: { color: colors.textFaint, fontSize: 13 },
});
