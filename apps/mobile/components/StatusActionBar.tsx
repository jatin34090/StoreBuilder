import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, spacing, radius } from '../constants/theme';
import { nextStatus, type DeliveryStatus } from '../types/delivery';

const ADVANCE_LABEL: Partial<Record<DeliveryStatus, string>> = {
  ASSIGNED: 'Mark as Picked Up',
  PICKED_UP: 'Mark In Transit',
  IN_TRANSIT: 'Out for Delivery',
};

interface Props {
  status: DeliveryStatus;
  pending?: boolean;
  onAdvance: (next: DeliveryStatus) => void;
  onVerifyOtp: () => void;
  onFail: () => void;
}

/**
 * Renders only the actions the backend state machine permits for the current
 * status. DELIVERED is reached exclusively via OTP verification.
 */
export function StatusActionBar({ status, pending, onAdvance, onVerifyOtp, onFail }: Props) {
  if (status === 'DELIVERED') {
    return (
      <View style={[styles.banner, { backgroundColor: '#D1FAE5' }]}>
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        <Text style={[styles.bannerText, { color: '#047857' }]}>Delivered successfully</Text>
      </View>
    );
  }
  if (status === 'FAILED') {
    return (
      <View style={[styles.banner, { backgroundColor: '#FEE2E2' }]}>
        <Ionicons name="close-circle" size={22} color={colors.danger} />
        <Text style={[styles.bannerText, { color: '#B91C1C' }]}>Delivery failed</Text>
      </View>
    );
  }

  if (status === 'OUT_FOR_DELIVERY') {
    return (
      <View style={styles.bar}>
        <Button label="Verify OTP & Complete" variant="success" onPress={onVerifyOtp} disabled={pending} />
        <Button label="Mark as Failed" variant="outline" onPress={onFail} disabled={pending} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  const next = nextStatus(status);
  if (!next) return null;
  return (
    <View style={styles.bar}>
      <Button label={ADVANCE_LABEL[status] ?? 'Advance'} onPress={() => onAdvance(next)} loading={pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  bannerText: { fontSize: 15, fontWeight: '700' },
});
