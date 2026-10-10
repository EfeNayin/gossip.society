import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card } from '@/components/ui';
import { routes } from '@/routes';
import { colors } from '@/theme';
import { useMyVenues } from '@/venues/use-my-venues';
import { offersService } from './index';
import { offerMessages } from './offer-messages';
import { OfferForm } from './OfferForm';
import { ScreenShell, useGoBack } from './ScreenShell';
import { useOfferWrite } from './use-offers';

// Creates a DRAFT only. Publishing is a separate step on the offer's page.
export function OfferCreateScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const { query, failure } = useMyVenues();
  const { busy, run } = useOfferWrite();
  // A result that arrives after the user left this screen must not navigate.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const venues = query.data?.items.filter((venue) => venue.branches.length > 0);

  return (
    <ScreenShell title="İlan Oluştur">
      {query.isPending && !failure ? (
        <View style={styles.loading} accessibilityRole="progressbar">
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>Mekanlarınız yükleniyor…</Text>
        </View>
      ) : null}

      {failure && !venues ? (
        <>
          <Banner tone="error">
            {failure === 'unreachable'
              ? offerMessages.unreachable
              : 'Mekanlarınız şu anda alınamadı. Lütfen tekrar deneyin.'}
          </Banner>
          <Button
            label="Tekrar Dene"
            busyLabel="Deneniyor…"
            busy={query.isFetching}
            onPress={() => void query.refetch()}
          />
        </>
      ) : null}

      {venues && venues.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>İlan açabileceğiniz mekan yok</Text>
          <Text style={styles.muted}>
            Hesabınıza bağlı şubeli bir mekan görünmüyor. Mekanlar şimdilik
            yönetim ekibi tarafından tanımlanır.
          </Text>
          <Button label="Geri Dön" variant="secondary" onPress={goBack} />
        </Card>
      ) : null}

      {venues && venues.length > 0 ? (
        <OfferForm
          mode="create"
          venues={venues}
          busy={busy}
          onCheckStatus={() => router.push(routes.offers)}
          onSubmit={async (request) => {
            const outcome = await run((userId) =>
              offersService.create(userId, request),
            );
            // The draft exists now: go to its page.
            if (outcome?.kind === 'ok' && mounted.current)
              router.replace(routes.offerDetail(outcome.offer.id));
            return outcome;
          }}
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
