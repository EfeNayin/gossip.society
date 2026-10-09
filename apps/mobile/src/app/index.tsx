import { healthResponseSchema } from '@gossip/shared';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function fetchHealth() {
  const response = await fetch(`${API_URL}/health`);
  return healthResponseSchema.parse(await response.json());
}

export default function Index() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <View style={styles.container}>
      {health.isPending && <Text>API durumu kontrol ediliyor…</Text>}
      {health.isError && <Text style={styles.error}>API&apos;ye ulaşılamıyor.</Text>}
      {health.data && (
        <>
          <Text>API: {health.data.status === 'ok' ? 'çalışıyor' : 'hata'}</Text>
          <Text>Veritabanı: {health.data.db === 'up' ? 'bağlı' : 'bağlı değil'}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  error: {
    color: '#dc2626',
  },
});
