import type { DiscoverOffer } from '@gossip/shared';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card } from '@/components/ui';
import { formatIstanbul } from '@/offers/istanbul-time';
import { formatKurusAsTl } from '@/offers/money';
import { Fact } from '@/offers/offer-parts';
import { ScreenShell, useGoBack } from '@/offers/ScreenShell';
import { routes } from '@/routes';
import { colors } from '@/theme';
import { discoverMessages } from './discover-messages';
import { followerCondition } from './discover-format';
import { useDiscoverOffer } from './use-discover';

function OfferDetail({ offer }: { offer: DiscoverOffer }) {
  return (
    <>
      <View style={styles.head}>
        <Text style={styles.venue}>{offer.venue.name}</Text>
        <Text style={styles.offerTitle}>{offer.title}</Text>
      </View>

      <Card>
        <Text style={styles.section}>Mekan</Text>
        <Fact
          label="Şube"
          value={`${offer.branch.name} (${offer.branch.city})`}
        />
        <Fact label="Adres" value={offer.branch.address} />
      </Card>

      <Card>
        <Text style={styles.section}>İlan</Text>
        <Fact label="Açıklama" value={offer.description} />
        <Fact label="Mekanın teklifi" value={offer.serviceDescription} />
        <Fact
          label="Hizmet değeri"
          value={formatKurusAsTl(offer.serviceValueKurus)}
        />
        <View style={styles.expected}>
          <Text style={styles.expectedLabel}>BEKLENEN İÇERİK</Text>
          <Text style={styles.expectedValue}>{offer.expectedContent}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.section}>Koşullar</Text>
        <Fact
          label="Takipçi şartı"
          value={followerCondition(offer.minFollowers)}
        />
        {offer.minFollowers > 0 ? (
          <Text style={styles.muted}>{discoverMessages.followerNote}</Text>
        ) : null}
        <Fact label="Toplam kontenjan" value={String(offer.capacity)} />
        <Fact
          label="Geçerlilik (Türkiye saati)"
          value={`${formatIstanbul(offer.validFrom)} – ${formatIstanbul(offer.validUntil)}`}
        />
      </Card>

      <Text style={styles.muted}>{discoverMessages.noApplication}</Text>
    </>
  );
}

export function DiscoverDetailScreen({ id }: { id: string }) {
  const goBack = useGoBack(routes.influencer);
  const { query, failure } = useDiscoverOffer(id);
  // A refresh that says "not visible" (or "forbidden") wins over data that was
  // loaded earlier: it is never shown as current.
  const offer =
    failure === 'not-found' || failure === 'forbidden' ? undefined : query.data;

  const message =
    failure === 'unreachable'
      ? discoverMessages.unreachable
      : failure === 'forbidden'
        ? discoverMessages.forbidden
        : failure &&
            failure !== 'not-found' &&
            failure !== 'ended' &&
            failure !== 'stale'
          ? discoverMessages.loadFailed
          : undefined;

  return (
    <ScreenShell
      title="İlan Detayı"
      fallback={routes.influencer}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      {query.isPending && !failure ? (
        <View style={styles.loading} accessibilityRole="progressbar">
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>İlan yükleniyor…</Text>
        </View>
      ) : null}

      {failure === 'not-found' ? (
        <Card>
          <Text style={styles.section}>{discoverMessages.notVisibleTitle}</Text>
          <Text style={styles.muted}>{discoverMessages.notVisible}</Text>
          <Button label="Listeye Dön" variant="secondary" onPress={goBack} />
        </Card>
      ) : null}

      {message ? <Banner tone="error">{message}</Banner> : null}

      {message && failure !== 'forbidden' && !offer ? (
        <Button
          label="Tekrar Dene"
          busyLabel="Deneniyor…"
          busy={query.isFetching}
          onPress={() => void query.refetch()}
        />
      ) : null}

      {offer ? <OfferDetail offer={offer} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  head: { gap: 4 },
  venue: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  offerTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  section: { color: colors.text, fontSize: 18, fontWeight: '700' },
  expected: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  expectedLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  expectedValue: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
});
