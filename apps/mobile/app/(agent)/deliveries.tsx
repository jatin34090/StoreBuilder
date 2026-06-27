import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { agentApi } from '../../services/agent';
import { DeliveryCard } from '../../components/DeliveryCard';
import { colors, spacing, radius } from '../../constants/theme';
import type { DeliveryStatus } from '../../types/delivery';

const FILTERS: { label: string; value: DeliveryStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'Picked Up', value: 'PICKED_UP' },
  { label: 'In Transit', value: 'IN_TRANSIT' },
  { label: 'Out for Delivery', value: 'OUT_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Failed', value: 'FAILED' },
];

const PAGE_SIZE = 20;

export default function DeliveriesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<DeliveryStatus | 'ALL'>('ALL');

  const query = useInfiniteQuery({
    queryKey: ['agent', 'deliveries', 'list', filter],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      agentApi.listDeliveries({
        ...(filter !== 'ALL' ? { status: filter } : {}),
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.limit;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Deliveries</Text>
      </View>

      {/* Status filter chips */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const active = filter === item.value;
            return (
              <Pressable
                onPress={() => setFilter(item.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {query.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : query.isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={42} color={colors.textFaint} />
          <Text style={styles.emptyText}>Couldn&apos;t load deliveries</Text>
          <Pressable onPress={() => query.refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <DeliveryCard delivery={item} onPress={() => router.push(`/(agent)/delivery/${item.orderId}`)} />
          )}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.primary} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          ListFooterComponent={
            query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={42} color={colors.textFaint} />
              <Text style={styles.emptyText}>No deliveries{filter !== 'ALL' ? ' in this status' : ''}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  filterWrap: { paddingBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginTop: 12 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  retryText: { color: colors.primary, fontWeight: '700' },
});
