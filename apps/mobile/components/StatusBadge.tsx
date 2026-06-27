import { View, Text, StyleSheet } from 'react-native';
import { statusColors, statusLabel, radius } from '../constants/theme';

export function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const c = statusColors[status] ?? { bg: '#E2E8F0', fg: '#475569' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, small && styles.small]}>
      <Text style={[styles.text, { color: c.fg }, small && styles.textSmall]}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  small: { paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '700' },
  textSmall: { fontSize: 11 },
});
