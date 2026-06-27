import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../constants/theme';

/** Placeholder — replaced by the OTP verification screen in stage 7. */
export default function VerifyOtpPlaceholder() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textMuted }}>Verify OTP — {orderId}</Text>
    </View>
  );
}
