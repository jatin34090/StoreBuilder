import { View, Text } from 'react-native';
import { colors } from '../../constants/theme';

/** Placeholder — replaced by the delivery list in stage 4. */
export default function DeliveriesPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textMuted }}>Deliveries</Text>
    </View>
  );
}
