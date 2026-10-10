import { useRouter } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card, Wordmark } from '@/components/ui';
import { routes } from '@/routes';
import { sessionManager } from '@/session';
import { roleLabels } from '@/session/messages';
import { useSession } from '@/session/use-session';
import { colors } from '@/theme';
import { discoverMessages } from './discover-messages';
import { DiscoverCard } from './discover-parts';
import { useDiscoverList } from './use-discover';

// The influencer's home is the discovery of open offers. Read only: there is
// no application model yet, so nothing here applies to an offer.
export function InfluencerHome() {
  const router = useRouter();
  const { user } = useSession();
  const { query, failure, offers } = useDiscoverList();
  const [signingOut, setSigningOut] = useState(false);

  // Back from the background: look at the offers again.
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

  const message =
    failure === 'unreachable'
      ? discoverMessages.unreachable
      : failure === 'forbidden'
        ? discoverMessages.forbidden
        : failure && failure !== 'ended' && failure !== 'stale'
          ? discoverMessages.loadFailed
          : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View>
          <Wordmark />
          <Text style={styles.caption}>INFLUENCER PANELİ</Text>
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

        <Text style={styles.title}>Güncel Fırsatlar</Text>

        {message ? <Banner tone="error">{message}</Banner> : null}

        {query.isPending && !failure ? (
          <View style={styles.loading} accessibilityRole="progressbar">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>İlanlar yükleniyor…</Text>
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
            <Text style={styles.emptyTitle}>{discoverMessages.emptyTitle}</Text>
            <Text style={styles.muted}>{discoverMessages.empty}</Text>
          </Card>
        ) : null}

        {offers?.map((offer) => (
          <DiscoverCard
            key={offer.id}
            offer={offer}
            onPress={() => router.push(routes.discoverDetail(offer.id))}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 16, paddingHorizontal: 20, paddingVertical: 24 },
  caption: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userText: { flex: 1, gap: 4 },
  userName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  role: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 8 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
