import { View, Text, ActivityIndicator } from 'react-native';
import { colors } from '../../constants/theme';

/** Placeholder — replaced by the phone-OTP login flow in stage 2. */
export default function LoginPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ marginTop: 12, color: colors.textMuted }}>Loading…</Text>
    </View>
  );
}
