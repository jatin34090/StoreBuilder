import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../constants/theme';

/** Minimal profile — expanded in stage 10. Logout kept available from here now. */
export default function ProfilePlaceholder() {
  const logout = useAuthStore((s) => s.logout);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textMuted, marginBottom: 16 }}>Profile</Text>
      <Pressable onPress={() => logout()}>
        <Text style={{ color: colors.danger, fontWeight: '700' }}>Log out</Text>
      </Pressable>
    </View>
  );
}
