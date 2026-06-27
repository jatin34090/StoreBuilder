import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { authApi } from '../../services/auth';
import { colors, spacing } from '../../constants/theme';

const schema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  });

  const onSubmit = async ({ phone }: FormData) => {
    setLoading(true);
    try {
      await authApi.sendOtp(phone);
      router.push({ pathname: '/auth/verify', params: { phone } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not send OTP. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>YB</Text>
            </View>
            <Text style={styles.title}>Delivery Partner</Text>
            <Text style={styles.subtitle}>Sign in with your registered mobile number</Text>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <TextField
                label="Mobile Number"
                prefix="+91"
                value={value}
                onChangeText={(t) => onChange(t.replace(/\D/g, ''))}
                placeholder="9876543210"
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
                error={errors.phone?.message}
              />
            )}
          />

          <Button label="Send OTP" onPress={handleSubmit(onSubmit)} loading={loading} />

          <Text style={styles.hint}>
            We&apos;ll send a 6-digit verification code to your number.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoText: { color: colors.gold, fontSize: 28, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg },
});
