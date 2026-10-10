import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card } from '@/components/ui';
import { routes } from '@/routes';
import { colors } from '@/theme';
import { offerMessages } from './offer-messages';
import { OfferCard } from './offer-parts';
import { ScreenShell } from './ScreenShell';
import { useOffersList } from './use-offers';

export function OfferListScreen() {
  const router = useRouter();
  const { query, failure, offers } = useOffersList();

  const message =
    failure === 'unreachable'
      ? offerMessages.unreachable
      : failure === 'forbidden'
        ? offerMessages.forbidden
        : failure && failure !== 'ended' && failure !== 'stale'
          ? offerMessages.loadFailed
          : undefined;

  return (
    <ScreenShell
      title="İlanlarım"
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
    >
      <Button
        label="İlan Oluştur"
        onPress={() => router.push(routes.newOffer)}
      />

      {message ? <Banner tone="error">{message}</Banner> : null}

      {query.isPending && !failure ? (
        <View style={styles.loading} accessibilityRole="progressbar">
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>İlanlarınız yükleniyor…</Text>
        </View>
      ) : null}

      {failure && failure !== 'forbidden' && !offers ? (
        <Button
          label="Tekrar Dene"
          busyLabel="Deneniyor…"
          busy={query.isFetching}
          onPress={() => void query.refetch()}
        />
      ) : null}

      {offers && offers.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Henüz ilanınız yok</Text>
          <Text style={styles.muted}>
            İlk ilanınızı taslak olarak oluşturun; hazır olduğunda ayrıca
            yayınlayabilirsiniz.
          </Text>
        </Card>
      ) : null}

      {offers?.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          onPress={() => router.push(routes.offerDetail(offer.id))}
        />
      ))}

      {query.hasNextPage ? (
        <Button
          label="Daha Fazla Göster"
          busyLabel="Yükleniyor…"
          busy={query.isFetchingNextPage}
          variant="secondary"
          onPress={() => void query.fetchNextPage()}
        />
      ) : null}

      {offers && failure && failure !== 'forbidden' ? (
        <Button
          label="Yeniden Dene"
          busyLabel="Deneniyor…"
          busy={query.isFetching}
          variant="secondary"
          onPress={() => void query.refetch()}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
