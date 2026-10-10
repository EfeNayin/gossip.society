import type { OwnerOffer } from '@gossip/shared';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Card } from '@/components/ui';
import { colors } from '@/theme';
import { formatIstanbul } from './istanbul-time';
import { formatKurusAsTl } from './money';
import { offerDisplay, type OfferDisplay } from './offer-state';

const badgeColors: Record<OfferDisplay['key'], { text: string; bg: string }> = {
  draft: { text: colors.muted, bg: colors.border },
  published: { text: '#4ade80', bg: '#12261a' },
  'not-started': { text: '#4ade80', bg: '#12261a' },
  expired: { text: colors.notice, bg: colors.noticeBackground },
  suspended: { text: colors.danger, bg: colors.dangerBackground },
};

export function StatusBadge({ offer }: { offer: OwnerOffer }) {
  const display = offerDisplay(offer);
  const palette = badgeColors[display.key];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>
        {display.label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

export function OfferCard({
  offer,
  onPress,
}: {
  offer: OwnerOffer;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}, ${offerDisplay(offer).label}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {offer.title}
          </Text>
          <StatusBadge offer={offer} />
        </View>
        <Text style={styles.muted}>
          {offer.venue.name} · {offer.branch.name} ({offer.branch.city})
        </Text>
        <View style={styles.facts}>
          <Text style={styles.value}>
            {formatKurusAsTl(offer.serviceValueKurus)}
          </Text>
          <Text style={styles.muted}>Kontenjan {offer.capacity}</Text>
        </View>
        <Text style={styles.muted}>
          {formatIstanbul(offer.validFrom)} – {formatIstanbul(offer.validUntil)}
        </Text>
      </Card>
    </Pressable>
  );
}

/** Label + value rows of a read-only offer. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label.toLocaleUpperCase('tr-TR')}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#52525b"
        {...input}
        style={[
          styles.input,
          input.multiline && styles.inputMultiline,
          error ? styles.inputError : null,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  pressed: { opacity: 0.75 },
  card: { gap: 8 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1 },
  facts: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  value: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  fact: { gap: 4 },
  factLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  factValue: { color: colors.text, fontSize: 15, lineHeight: 22 },
  field: { gap: 6 },
  fieldLabel: { color: '#d4d4d8', fontSize: 13, fontWeight: '700' },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  inputError: { borderColor: '#7f1d1d' },
  fieldError: { color: colors.danger, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12 },
});
