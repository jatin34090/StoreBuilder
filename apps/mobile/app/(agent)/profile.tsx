import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '../../services/agent';
import { authApi } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, radius } from '../../constants/theme';

const VEHICLE_LABEL: Record<string, string> = { bike: 'Bike', cycle: 'Cycle', foot: 'On Foot' };
const VEHICLE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  bike: 'bicycle-outline',
  cycle: 'bicycle-outline',
  foot: 'walk-outline',
};

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  const { data: profile, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['agent', 'profile'],
    queryFn: () => agentApi.getProfile(),
  });

  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => agentApi.setOnline(isOnline),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent', 'profile'] }),
    onError: () => Alert.alert('Error', 'Could not update your status.'),
  });

  const onLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await authApi.logout();
          await logout();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const vehicle = profile?.vehicleType ?? '';
  const zones = profile?.zones ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {/* Profile header */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile?.user.name?.[0] ?? 'A').toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{profile?.user.name ?? 'Agent'}</Text>
          {profile?.user.phone ? <Text style={styles.phone}>+91 {profile.user.phone}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?._count?.deliveries ?? 0}</Text>
              <Text style={styles.statLabel}>Deliveries</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile?.rating?.toFixed(1) ?? '—'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Online toggle */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.rowIcon, { backgroundColor: (profile?.isOnline ? colors.success : colors.textFaint) + '22' }]}>
              <Ionicons name="radio-outline" size={20} color={profile?.isOnline ? colors.success : colors.textFaint} />
            </View>
            <View>
              <Text style={styles.rowTitle}>Availability</Text>
              <Text style={styles.rowSub}>{profile?.isOnline ? 'You are online' : 'You are offline'}</Text>
            </View>
          </View>
          <Switch
            value={profile?.isOnline ?? false}
            onValueChange={(v) => onlineMutation.mutate(v)}
            disabled={onlineMutation.isPending}
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        {/* Vehicle */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.rowIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name={VEHICLE_ICON[vehicle] ?? 'car-outline'} size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.rowTitle}>Vehicle</Text>
              <Text style={styles.rowSub}>{VEHICLE_LABEL[vehicle] ?? vehicle ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Zones */}
        <View style={styles.zonesCard}>
          <Text style={styles.zonesTitle}>Service Zones</Text>
          {zones.length === 0 ? (
            <Text style={styles.rowSub}>No zones assigned</Text>
          ) : (
            <View style={styles.chipsWrap}>
              {zones.map((z) => (
                <View key={z} style={styles.chip}>
                  <Ionicons name="location-outline" size={13} color={colors.primary} />
                  <Text style={styles.chipText}>{z}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  headerCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatarText: { color: colors.gold, fontSize: 32, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  phone: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  stat: { alignItems: 'center', paddingHorizontal: spacing.xl },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  zonesCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  zonesTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '12', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1.5, borderColor: '#FECACA' },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.danger },
});
