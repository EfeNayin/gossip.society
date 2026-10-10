import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Banner({
  tone,
  children,
}: {
  tone: 'error' | 'notice';
  children: ReactNode;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        tone === 'error' ? styles.bannerError : styles.bannerNotice,
      ]}
    >
      <Text
        style={
          tone === 'error' ? styles.bannerErrorText : styles.bannerNoticeText
        }
      >
        {children}
      </Text>
    </View>
  );
}

export function Button({
  label,
  busyLabel,
  busy = false,
  variant = 'primary',
  onPress,
}: {
  label: string;
  busyLabel?: string;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || busy) && styles.buttonDim,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.text} /> : null}
      <Text style={styles.buttonText}>
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </Pressable>
  );
}

export function Wordmark() {
  return (
    <Text style={styles.wordmark}>
      GOSSIP<Text style={{ color: colors.accent }}>.</Text>SOCIETY
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerError: {
    backgroundColor: colors.dangerBackground,
    borderColor: '#7f1d1d',
  },
  bannerNotice: {
    backgroundColor: colors.noticeBackground,
    borderColor: '#78571a',
  },
  bannerErrorText: { color: colors.danger, fontSize: 14 },
  bannerNoticeText: { color: colors.notice, fontSize: 14 },
  button: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.border },
  buttonDim: { opacity: 0.65 },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  wordmark: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
  },
});
