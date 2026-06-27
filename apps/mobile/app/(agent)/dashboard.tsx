import { View, Text } from 'react-native';
import { colors } from '../../constants/theme';

/** Placeholder — replaced by the agent dashboard in stage 3. */
export default function DashboardPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>Agent Dashboard</Text>
      <Text style={{ color: colors.textMuted, marginTop: 6 }}>Coming up next…</Text>
    </View>
  );
}
