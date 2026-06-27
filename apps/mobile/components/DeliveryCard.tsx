import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { colors, spacing, radius } from '../constants/theme';
import type { AgentDelivery } from '../types/delivery';

export function DeliveryCard({ delivery, onPress }: { delivery: AgentDelivery; onPress: () => void }) {
  const { order } = delivery;
  const itemCount = order.items?.reduce((n, i) => n + (i.quantity ?? 0), 0) ?? 0;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.order}>#{order.orderNumber}</Text>
        <StatusBadge status={delivery.status} small />
      </View>

      <View style={styles.addrRow}>
        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        <Text style={styles.addr} numberOfLines={2}>
          {order.address.line1}
          {order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city} {order.address.pincode}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.meta}>
          <Ionicons name="person-outline" size={14} color={colors.textFaint} />
          <Text style={styles.metaText}>{order.address.name}</Text>
        </View>
        <View style={styles.meta}>
          <Ionicons name="bag-handle-outline" size={14} color={colors.textFaint} />
          <Text style={styles.metaText}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
        </View>
        <Text style={styles.total}>₹{Number(order.total ?? 0).toLocaleString('en-IN')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  order: { fontSize: 15, fontWeight: '800', color: colors.text },
  addrRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  addr: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textFaint },
  total: { marginLeft: 'auto', fontSize: 15, fontWeight: '800', color: colors.primary },
});
