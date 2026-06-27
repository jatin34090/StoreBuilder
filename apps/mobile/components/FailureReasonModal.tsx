import { useState } from 'react';
import { Modal, View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextField } from './TextField';
import { Button } from './Button';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  visible: boolean;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export function FailureReasonModal({ visible, pending, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    if (reason.trim().length < 3) {
      setError('Please provide a brief reason (min 3 characters)');
      return;
    }
    onSubmit(reason.trim());
    setReason('');
    setError(undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Mark Delivery as Failed</Text>
          <Text style={styles.subtitle}>Tell us what went wrong. This is shared with the team.</Text>
          <View style={{ height: spacing.lg }} />
          <TextField
            label="Reason"
            value={reason}
            onChangeText={(t) => setReason(t)}
            placeholder="e.g. Customer unavailable, wrong address…"
            error={error}
            autoFocus
          />
          <Button label="Confirm Failed" variant="danger" onPress={submit} loading={pending} />
          <Button label="Cancel" variant="outline" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, paddingBottom: spacing.xxl },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
