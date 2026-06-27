import { View, Text } from 'react-native';
import { colors } from '../../constants/theme';

/** Placeholder — replaced by the notifications list in stage 9. */
export default function NotificationsPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textMuted }}>Notifications</Text>
    </View>
  );
}
