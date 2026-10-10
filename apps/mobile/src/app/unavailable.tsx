import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Wordmark } from '@/components/ui';
import { sessionManager } from '@/session';
import { colors } from '@/theme';

// Shown when the stored session could not be checked (offline, server error).
// The session is kept; nothing was deleted.
export default function Unavailable() {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await sessionManager.validate({ force: true });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Wordmark />
        <Card>
          <Text style={styles.title}>Sunucuya ulaşılamıyor</Text>
          <Text style={styles.text}>
            Oturumunuz korunuyor. Bağlantı gelince tekrar deneyebilirsiniz.
          </Text>
          <Button
            label="Tekrar Dene"
            busyLabel="Deneniyor…"
            busy={retrying}
            onPress={retry}
          />
          <Button
            label="Bu cihazdan çıkış yap"
            variant="secondary"
            onPress={() => void sessionManager.logout()}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 24 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  text: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
