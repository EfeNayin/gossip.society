import type { MyVenue } from '@gossip/shared';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card, Wordmark } from '@/components/ui';
import { routes } from '@/routes';
import { sessionManager } from '@/session';
import { roleLabels } from '@/session/messages';
import { useSession } from '@/session/use-session';
import { colors } from '@/theme';
import { useMyVenues } from './use-my-venues';
import type { VenueLoadFailure } from './venues-query';

const failureMessages: Partial<Record<VenueLoadFailure, string>> = {
  unreachable:
    'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.',
  unexpected: 'Mekanlarınız şu anda alınamadı. Lütfen tekrar deneyin.',
  forbidden:
    'Bu bilgilere erişiminiz değişmiş olabilir. Hesap bilgileriniz kontrol ediliyor…',
};

function VenueCard({ venue }: { venue: MyVenue }) {
  return (
    <Card style={styles.venueCard}>
      <Text style={styles.venueName}>{venue.name}</Text>
      {venue.description ? (
        <Text style={styles.description}>{venue.description}</Text>
      ) : null}

      <Text style={styles.sectionLabel}>
        {(venue.branches.length === 1
          ? 'Şube'
          : `Şubeler (${venue.branches.length})`
        ).toLocaleUpperCase('tr-TR')}
      </Text>
      <View style={styles.branches}>
        {venue.branches.map((branch) => (
          <View key={branch.id} style={styles.branch}>
            <View style={styles.branchHeader}>
              <Text style={styles.branchName}>{branch.name}</Text>
              <Text style={styles.city}>
                {branch.city.toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
            <Text style={styles.address}>{branch.address}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// The owner's own venues, from GET /venues/mine. Plain on purpose: no
// listings, applications, staff or QR until those exist.
export function VenueOwnerHome() {
  const router = useRouter();
  const { user } = useSession();
  const { query, failure } = useMyVenues();
  const [signingOut, setSigningOut] = useState(false);

  // Back from the background: look at the venues again.
  const refetch = query.refetch;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await sessionManager.logout();
    } finally {
      setSigningOut(false);
    }
  }

  const venues = query.data?.items;
  const message = failure ? failureMessages[failure] : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Wordmark />
            <Text style={styles.caption}>MEKAN PANELİ</Text>
          </View>
        </View>

        <Card>
          <View style={styles.userRow}>
            <View style={styles.userText}>
              <Text style={styles.userName}>{user?.name}</Text>
              {user ? (
                <Text style={styles.role}>
                  {roleLabels[user.role].toLocaleUpperCase('tr-TR')}
                </Text>
              ) : null}
            </View>
            <Button
              label="Çıkış Yap"
              busyLabel="Çıkış yapılıyor…"
              busy={signingOut}
              variant="secondary"
              onPress={signOut}
            />
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            label="İlan Oluştur"
            onPress={() => router.push(routes.newOffer)}
          />
          <Button
            label="İlanlarım"
            variant="secondary"
            onPress={() => router.push(routes.offers)}
          />
        </View>

        <Text style={styles.title}>Mekanlarım</Text>

        {message ? <Banner tone="error">{message}</Banner> : null}

        {query.isPending && !failure ? (
          <View style={styles.loading} accessibilityRole="progressbar">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>Mekanlarınız yükleniyor…</Text>
          </View>
        ) : null}

        {failure && failure !== 'forbidden' && !venues ? (
          <Button
            label="Tekrar Dene"
            busyLabel="Deneniyor…"
            busy={query.isFetching}
            onPress={() => void query.refetch()}
          />
        ) : null}

        {venues && venues.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Henüz mekan yok</Text>
            <Text style={styles.muted}>
              Hesabınıza bağlı bir mekan görünmüyor. Mekanlar şimdilik yönetim
              ekibi tarafından tanımlanır.
            </Text>
          </Card>
        ) : null}

        {venues?.map((venue) => (
          <VenueCard key={venue.id} venue={venue} />
        ))}

        {venues && failure && failure !== 'forbidden' ? (
          <Button
            label="Yeniden Dene"
            busyLabel="Deneniyor…"
            busy={query.isFetching}
            variant="secondary"
            onPress={() => void query.refetch()}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 16, paddingHorizontal: 20, paddingVertical: 24 },
  header: { flexDirection: 'row', alignItems: 'center' },
  caption: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  actions: { gap: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userText: { flex: 1, gap: 4 },
  userName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  role: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  venueCard: { gap: 12 },
  venueName: { color: colors.text, fontSize: 22, fontWeight: '900' },
  description: {
    color: '#d4d4d8',
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  branches: { gap: 10 },
  branch: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  branchName: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  city: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  address: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
