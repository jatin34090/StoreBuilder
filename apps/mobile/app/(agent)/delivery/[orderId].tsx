import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../../constants/theme';

/** Placeholder — replaced by the delivery detail screen in stage 5. */
export default function DeliveryDetailPlaceholder() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textMuted }}>Delivery {orderId}</Text>
    </View>
  );
}
