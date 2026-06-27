import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator, Image, RefreshControl, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '../../../services/agent';
import { StatusBadge } from '../../../components/StatusBadge';
import { StatusActionBar } from '../../../components/StatusActionBar';
import { FailureReasonModal } from '../../../components/FailureReasonModal';
import { colors, spacing, radius } from '../../../constants/theme';
import { ACTIVE_STATUSES, type DeliveryStatus } from '../../../types/delivery';
import { useLocationTracking } from '../../../hooks/useLocationTracking';

export default function DeliveryDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [failOpen, setFailOpen] = useState(false);

  const { data: delivery, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['agent', 'delivery', orderId],
    queryFn: () => agentApi.getDelivery(String(orderId)),
    enabled: !!orderId,
  });

  // GPS tracking runs only while the delivery is in progress and stops on
  // completion (DELIVERED/FAILED) or when leaving the screen.
  const isActive = !!delivery && ACTIVE_STATUSES.includes(delivery.status);
  const tracking = useLocationTracking(isActive);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['agent', 'delivery', orderId] });
    queryClient.invalidateQueries({ queryKey: ['agent', 'deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['agent', 'profile'] });
  };

  const advanceMutation = useMutation({
    mutationFn: (next: DeliveryStatus) => agentApi.updateStatus(String(orderId), next),
    onSuccess: (_res, next) => {
      invalidate();
      if (next === 'OUT_FOR_DELIVERY') {
        Alert.alert('Out for delivery', 'A 6-digit OTP has been sent to the customer. Ask them for it on arrival to complete the delivery.');
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not update status.';
      Alert.alert('Update failed', msg);
    },
  });

  const failMutation = useMutation({
    mutationFn: (reason: string) => agentApi.updateStatus(String(orderId), 'FAILED', reason),
    onSuccess: () => {
      setFailOpen(false);
      invalidate();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not mark as failed.';
      Alert.alert('Error', msg);
    },
  });

  const callCustomer = () => {
    const phone = delivery?.order.address.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const navigateToAddress = () => {
    const a = delivery?.order.address;
    if (!a) return;
    const q = encodeURIComponent(`${a.line1}, ${a.line2 ?? ''}, ${a.city}, ${a.state ?? ''} ${a.pincode}`);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    });
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Delivery Details</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : isError || !delivery ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color={colors.textFaint} />
          <Text style={styles.errText}>Couldn&apos;t load this delivery</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        >
          {/* Order summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <Text style={styles.orderNo}>#{delivery.order.orderNumber}</Text>
              <StatusBadge status={delivery.status} />
            </View>
            <Text style={styles.amount}>₹{Number(delivery.order.total ?? 0).toLocaleString('en-IN')}</Text>
            {delivery.estimatedAt ? (
              <Text style={styles.eta}>ETA: {new Date(delivery.estimatedAt).toLocaleString()}</Text>
            ) : null}
          </View>

          {/* GPS tracking banner */}
          {isActive ? (
            tracking.permission === 'denied' ? (
              <View style={[styles.trackBanner, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="location-outline" size={18} color={colors.danger} />
                <Text style={[styles.trackText, { color: '#B91C1C' }]}>
                  Location permission denied — enable it to share your live position.
                </Text>
              </View>
            ) : tracking.permission === 'disabled' ? (
              <View style={[styles.trackBanner, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="warning-outline" size={18} color={colors.warning} />
                <Text style={[styles.trackText, { color: '#B45309' }]}>
                  Location services are off. Turn on GPS to share your position.
                </Text>
              </View>
            ) : (
              <View style={[styles.trackBanner, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="navigate-circle" size={18} color={colors.success} />
                <Text style={[styles.trackText, { color: '#047857' }]}>
                  Live location sharing on · updates every 30s
                </Text>
              </View>
            )
          ) : null}

          {/* Quick actions */}
          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn} onPress={callCustomer}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Call</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={navigateToAddress}>
              <Ionicons name="navigate" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Navigate</Text>
            </Pressable>
          </View>

          {/* Customer */}
          <Section title="Customer">
            <Row icon="person-outline" text={delivery.order.address.name} />
            <Pressable onPress={callCustomer}>
              <Row icon="call-outline" text={delivery.order.address.phone} link />
            </Pressable>
          </Section>

          {/* Address */}
          <Section title="Delivery Address">
            <Text style={styles.addrText}>
              {delivery.order.address.line1}
              {delivery.order.address.line2 ? `\n${delivery.order.address.line2}` : ''}
              {`\n${delivery.order.address.city}, ${delivery.order.address.state ?? ''} ${delivery.order.address.pincode}`}
            </Text>
          </Section>

          {/* Items */}
          <Section title={`Items (${delivery.order.items.length})`}>
            {delivery.order.items.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                {it.image ? (
                  <Image source={{ uri: it.image }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                    <Ionicons name="cube-outline" size={18} color={colors.textFaint} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  {it.sku ? <Text style={styles.itemSku}>SKU: {it.sku}</Text> : null}
                </View>
                <Text style={styles.itemQty}>× {it.quantity}</Text>
              </View>
            ))}
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <Row icon="card-outline" text={`Method: ${delivery.order.payment?.method ?? '—'}`} />
            <Row icon="checkmark-circle-outline" text={`Status: ${delivery.order.payment?.status ?? '—'}`} />
          </Section>

          {/* Notes */}
          {delivery.order.notes ? (
            <Section title="Delivery Notes">
              <Text style={styles.notes}>{delivery.order.notes}</Text>
            </Section>
          ) : null}

          {delivery.failureReason ? (
            <Section title="Failure Reason">
              <Text style={[styles.notes, { color: colors.danger }]}>{delivery.failureReason}</Text>
            </Section>
          ) : null}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {delivery ? (
        <StatusActionBar
          status={delivery.status}
          pending={advanceMutation.isPending}
          onAdvance={(next) => advanceMutation.mutate(next)}
          onVerifyOtp={() => router.push(`/(agent)/verify-otp/${delivery.orderId}`)}
          onFail={() => setFailOpen(true)}
        />
      ) : null}

      <FailureReasonModal
        visible={failOpen}
        pending={failMutation.isPending}
        onClose={() => setFailOpen(false)}
        onSubmit={(reason) => failMutation.mutate(reason)}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, text, link }: { icon: keyof typeof Ionicons.glyphMap; text: string; link?: boolean }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={link ? colors.primary : colors.textMuted} />
      <Text style={[styles.rowText, link && { color: colors.primary, fontWeight: '700' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  content: { padding: spacing.lg },
  summaryCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  orderNo: { color: colors.white, fontSize: 16, fontWeight: '800' },
  amount: { color: colors.gold, fontSize: 28, fontWeight: '800' },
  eta: { color: '#E9D5FF', fontSize: 13, marginTop: 6 },
  trackBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  trackText: { flex: 1, fontSize: 13, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1.5, borderColor: colors.primary },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.md, letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowText: { fontSize: 15, color: colors.text },
  addrText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  itemImg: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.bg },
  itemImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemSku: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  itemQty: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  notes: { fontSize: 14, color: colors.text, lineHeight: 20 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  errText: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginTop: 12 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary },
  retryText: { color: colors.primary, fontWeight: '700' },
});
