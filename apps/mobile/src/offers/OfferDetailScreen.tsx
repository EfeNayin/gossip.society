import type { OwnerOffer } from '@gossip/shared';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card } from '@/components/ui';
import { colors } from '@/theme';
import { offersService } from './index';
import { formatIstanbul } from './istanbul-time';
import { formatKurusAsTl } from './money';
import { offerDisplay } from './offer-state';
import { offerMessages, writeFailureMessage } from './offer-messages';
import { Fact, StatusBadge } from './offer-parts';
import { OfferForm } from './OfferForm';
import { ScreenShell, useGoBack } from './ScreenShell';
import { useOffer, useOfferWrite } from './use-offers';

function ReadOnlyOffer({ offer }: { offer: OwnerOffer }) {
  const display = offerDisplay(offer);
  return (
    <Card>
      {offer.suspension ? (
        <Banner tone="error">
          Bu ilan yönetim tarafından askıya alındı (
          {formatIstanbul(offer.suspension.suspendedAt)}). Sebep:{' '}
          {offer.suspension.reason}
        </Banner>
      ) : null}
      {display.key === 'expired' ? (
        <Banner tone="notice">
          Bu ilanın geçerlilik süresi doldu. İlan artık düzenlenemez.
        </Banner>
      ) : null}
      {display.key === 'published' || display.key === 'not-started' ? (
        <Banner tone="notice">Yayındaki ilanlar düzenlenemez.</Banner>
      ) : null}
      <Fact label="Mekan" value={offer.venue.name} />
      <Fact
        label="Şube"
        value={`${offer.branch.name} (${offer.branch.city})`}
      />
      <Fact label="Açıklama" value={offer.description} />
      <Fact label="Sunulan hizmet" value={offer.serviceDescription} />
      <Fact
        label="Hizmet değeri"
        value={formatKurusAsTl(offer.serviceValueKurus)}
      />
      <Fact label="Beklenen içerik" value={offer.expectedContent} />
      <Fact label="Minimum takipçi" value={String(offer.minFollowers)} />
      <Fact label="Kontenjan" value={String(offer.capacity)} />
      <Fact
        label="Geçerlilik (Türkiye saati)"
        value={`${formatIstanbul(offer.validFrom)} – ${formatIstanbul(offer.validUntil)}`}
      />
      {offer.publishedAt ? (
        <Fact label="Yayın zamanı" value={formatIstanbul(offer.publishedAt)} />
      ) : null}
    </Card>
  );
}

// The separate publish step of a draft: it asks first, and a result that is
// not certain is never shown as a failure.
function PublishPanel({
  offer,
  blocked,
  write,
  onCheckStatus,
}: {
  offer: OwnerOffer;
  blocked: boolean;
  write: ReturnType<typeof useOfferWrite>;
  onCheckStatus: () => void;
}) {
  // Saving and publishing share one write guard: never two at once.
  const { busy, run } = write;
  const [publishing, setPublishing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [unknown, setUnknown] = useState(false);

  async function publish() {
    setMessage(undefined);
    setUnknown(false);
    setPublishing(true);
    const outcome = await run((userId) =>
      offersService.publish(userId, offer.id),
    );
    setPublishing(false);
    if (!outcome) return;
    setConfirming(false);
    if (outcome.kind === 'ok') return; // the page turns read-only by itself
    setMessage(writeFailureMessage(outcome));
    setUnknown(outcome.kind === 'unknown');
  }

  return (
    <Card>
      <Text style={styles.sectionTitle}>Yayınla</Text>
      <Text style={styles.muted}>
        Yayınladığınızda ilan aboneliğinizin aktif ilan kotasına sayılır ve
        artık düzenlenemez.
      </Text>

      {message ? <Banner tone="error">{message}</Banner> : null}
      {unknown ? (
        <Button
          label="Durumu Kontrol Et"
          variant="secondary"
          onPress={onCheckStatus}
        />
      ) : null}

      {blocked ? (
        <Banner tone="notice">
          Kaydedilmemiş değişiklikleriniz var. Yayınlamadan önce kaydedin.
        </Banner>
      ) : confirming ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            “{offer.title}” yayınlansın mı?
          </Text>
          <Button
            label="Evet, Yayınla"
            busyLabel="Yayınlanıyor…"
            busy={publishing}
            onPress={() => void publish()}
          />
          {!busy ? (
            <Button
              label="Vazgeç"
              variant="secondary"
              onPress={() => setConfirming(false)}
            />
          ) : null}
        </View>
      ) : (
        <Button
          label="Yayınla"
          onPress={() => {
            setMessage(undefined);
            setUnknown(false);
            setConfirming(true);
          }}
        />
      )}
    </Card>
  );
}

export function OfferDetailScreen({ id }: { id: string }) {
  const goBack = useGoBack();
  const { query, failure } = useOffer(id);
  const write = useOfferWrite();
  const { busy, run } = write;
  const [dirty, setDirty] = useState(false);
  const offer = query.data;

  const checkStatus = () => void query.refetch();

  return (
    <ScreenShell
      title="İlan"
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
          <Text style={styles.sectionTitle}>İlan bulunamadı</Text>
          <Text style={styles.muted}>{offerMessages.notFound}</Text>
          <Button label="Geri Dön" variant="secondary" onPress={goBack} />
        </Card>
      ) : null}

      {failure === 'forbidden' ? (
        <Banner tone="error">{offerMessages.forbidden}</Banner>
      ) : null}

      {failure &&
      failure !== 'not-found' &&
      failure !== 'forbidden' &&
      failure !== 'ended' &&
      failure !== 'stale' ? (
        <>
          <Banner tone="error">
            {failure === 'unreachable'
              ? offerMessages.unreachable
              : offerMessages.loadFailed}
          </Banner>
          {!offer ? (
            <Button
              label="Tekrar Dene"
              busyLabel="Deneniyor…"
              busy={query.isFetching}
              onPress={checkStatus}
            />
          ) : null}
        </>
      ) : null}

      {offer ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            <StatusBadge offer={offer} />
          </View>

          {offer.status === 'DRAFT' ? (
            <>
              <OfferForm
                key={offer.id}
                mode="edit"
                offer={offer}
                busy={busy}
                onCheckStatus={checkStatus}
                onDirtyChange={setDirty}
                onSubmit={(request) =>
                  run((userId) =>
                    offersService.update(userId, offer.id, request),
                  )
                }
              />
              <PublishPanel
                offer={offer}
                blocked={dirty}
                write={write}
                onCheckStatus={checkStatus}
              />
            </>
          ) : (
            <ReadOnlyOffer offer={offer} />
          )}
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  offerTitle: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
  confirm: { gap: 10 },
  confirmText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
