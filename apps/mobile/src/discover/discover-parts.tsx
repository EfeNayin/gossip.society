import type { DiscoverOfferSummary } from '@gossip/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui';
import { formatIstanbul } from '@/offers/istanbul-time';
import { formatKurusAsTl } from '@/offers/money';
import { colors } from '@/theme';
import { followerCondition } from './discover-format';

// The list card. Hierarchy as in the prototype's opportunity cards (venue
// first, then the venue's offer and the expected content in the accent colour,
// then the conditions), without photos, scores or badges: there is no data
// behind those yet.
export function DiscoverCard({
  offer,
  onPress,
}: {
  offer: DiscoverOfferSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${offer.venue.name}, ${offer.title}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Card style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.venue}>{offer.venue.name}</Text>
          <Text style={styles.muted}>
            {offer.branch.name} · {offer.branch.city}
          </Text>
          <Text style={styles.title}>{offer.title}</Text>
        </View>
        <View style={styles.box}>
          <View style={styles.boxRow}>
            <Text style={styles.label}>MEKANIN TEKLİFİ</Text>
            <Text style={styles.value}>{offer.serviceDescription}</Text>
            <Text style={styles.worth}>
              {formatKurusAsTl(offer.serviceValueKurus)} değerinde
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.boxRow}>
            <Text style={styles.label}>BEKLENEN İÇERİK</Text>
            <Text style={styles.expected}>{offer.expectedContent}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.muted}>
            {followerCondition(offer.minFollowers)}
          </Text>
          <Text style={styles.muted}>
            Son gün: {formatIstanbul(offer.validUntil)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  card: { gap: 14 },
  head: { gap: 4 },
  venue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  title: { color: '#d4d4d8', fontSize: 15, fontWeight: '600', marginTop: 4 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  box: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  boxRow: { gap: 4 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  value: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  worth: { color: colors.muted, fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border },
  expected: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  footer: { gap: 2 },
});
