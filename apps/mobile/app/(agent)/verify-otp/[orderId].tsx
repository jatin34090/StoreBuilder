import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { agentApi } from '../../../services/agent';
import { colors, spacing, radius } from '../../../constants/theme';

export default function VerifyOtpScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: () => agentApi.verifyOtp(String(orderId), otp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'delivery', orderId] });
      queryClient.invalidateQueries({ queryKey: ['agent', 'deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['agent', 'profile'] });
      setDone(true);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid OTP. Please ask the customer for the correct code.';
      setError(msg);
    },
  });

  const onVerify = () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code');
      return;
    }
    setError(undefined);
    verifyMutation.mutate();
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={56} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Delivery Completed!</Text>
          <Text style={styles.successSub}>The order has been marked as delivered.</Text>
          <Button label="Back to Deliveries" onPress={() => router.replace('/(agent)/deliveries')} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify Delivery</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.iconBadge}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Enter Customer OTP</Text>
          <Text style={styles.subtitle}>
            Ask the customer for the 6-digit code sent to their phone, then enter it to confirm the delivery.
          </Text>

          <View style={{ height: spacing.xl }} />

          <TextField
            label="Delivery OTP"
            value={otp}
            onChangeText={(t) => { setOtp(t.replace(/\D/g, '')); setError(undefined); }}
            placeholder="••••••"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            error={error}
          />

          <Button label="Confirm Delivery" variant="success" onPress={onVerify} loading={verifyMutation.isPending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  iconBadge: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  successTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  successSub: { fontSize: 15, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
});
