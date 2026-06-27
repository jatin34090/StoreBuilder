import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '../../services/agent';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../constants/theme';
import { ACTIVE_STATUSES, type AgentDelivery } from '../../types/delivery';

function isToday(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const profileQuery = useQuery({
    queryKey: ['agent', 'profile'],
    queryFn: () => agentApi.getProfile(),
  });

  const deliveriesQuery = useQuery({
    queryKey: ['agent', 'deliveries', 'all'],
    queryFn: () => agentApi.listDeliveries({ limit: 50 }),
  });

  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => agentApi.setOnline(isOnline),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent', 'profile'] }),
  });

  const deliveries = deliveriesQuery.data?.items ?? [];
  const stats = useMemo(() => {
    const active = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status) || d.status === 'ASSIGNED');
    const completed = deliveries.filter((d) => d.status === 'DELIVERED');
    const todayDone = completed.filter((d) => isToday(d.deliveredAt));
    return {
      active: active.length,
      completed: completed.length,
      total: deliveriesQuery.data?.total ?? deliveries.length,
      todayDone: todayDone.length,
    };
  }, [deliveries, deliveriesQuery.data?.total]);

  const activeList = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status) || d.status === 'ASSIGNED');
  const isOnline = profileQuery.data?.isOnline ?? false;
  const refreshing = profileQuery.isRefetching || deliveriesQuery.isRefetching;

  const onRefresh = () => {
    profileQuery.refetch();
    deliveriesQuery.refetch();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.name}>{user?.name ?? 'Agent'} 👋</Text>
          </View>
          <View style={styles.onlinePill}>
            <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.textFaint }]} />
            <Text style={[styles.onlineText, { color: isOnline ? colors.success : colors.textMuted }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={(v) => onlineMutation.mutate(v)}
              disabled={onlineMutation.isPending || profileQuery.isLoading}
              trackColor={{ true: colors.success, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <KpiCard icon="time-outline" label="Active" value={stats.active} tint={colors.warning} />
          <KpiCard icon="checkmark-done-outline" label="Completed" value={stats.completed} tint={colors.success} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard icon="today-outline" label="Done Today" value={stats.todayDone} tint={colors.primary} />
          <KpiCard icon="cube-outline" label="Total" value={stats.total} tint={colors.info} />
        </View>

        {/* Active deliveries */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today&apos;s Deliveries</Text>
          <Pressable onPress={() => router.push('/(agent)/deliveries')}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        {deliveriesQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : activeList.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>No active deliveries right now</Text>
            <Text style={styles.emptySub}>
              {isOnline ? 'New assignments will appear here.' : 'Go online to receive deliveries.'}
            </Text>
          </View>
        ) : (
          activeList.map((d) => <DeliveryRow key={d.id} delivery={d} onPress={() => router.push(`/(agent)/delivery/${d.orderId}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ icon, label, value, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; tint: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + '22' }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function DeliveryRow({ delivery, onPress }: { delivery: AgentDelivery; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowOrder}>#{delivery.order.orderNumber}</Text>
        <Text style={styles.rowAddr} numberOfLines={1}>
          {delivery.order.address.name} · {delivery.order.address.city} {delivery.order.address.pincode}
        </Text>
        <View style={{ marginTop: 6 }}>
          <StatusBadge status={delivery.status} small />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.full, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  onlineText: { fontSize: 13, fontWeight: '700', marginRight: 6 },
  kpiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  kpiCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  kpiIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  kpiValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  kpiLabel: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  viewAll: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowOrder: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowAddr: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.textFaint, marginTop: 4, textAlign: 'center' },
});
