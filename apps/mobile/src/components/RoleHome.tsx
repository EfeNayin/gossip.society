import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { roleLabels } from '@/session/messages';
import { sessionManager } from '@/session';
import { useSession } from '@/session/use-session';
import { colors } from '@/theme';
import { Button, Card, Wordmark } from './ui';

// Role home screens are deliberately plain: name, role and sign-out. Which
// screen a user sees is decided from the API's user record; this is
// presentation only, the API authorizes every request itself.
export function RoleHome({ description }: { description: string }) {
  const { user } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await sessionManager.logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Wordmark />
      </View>
      <View style={styles.body}>
        <Card>
          <Text style={styles.greeting}>Merhaba, {user?.name}</Text>
          {user ? (
            <Text style={styles.role}>{roleLabels[user.role]}</Text>
          ) : null}
          <Text style={styles.description}>{description}</Text>
        </Card>
        <Button
          label="Çıkış Yap"
          busyLabel="Çıkış yapılıyor…"
          busy={signingOut}
          variant="secondary"
          onPress={signOut}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  body: { flex: 1, paddingHorizontal: 24, gap: 16 },
  greeting: { color: colors.text, fontSize: 22, fontWeight: '700' },
  role: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
