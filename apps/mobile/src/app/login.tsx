import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@gossip/shared';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card, Wordmark } from '@/components/ui';
import { API_URL } from '@/config';
import { sessionManager } from '@/session';
import { noticeMessages } from '@/session/messages';
import { useSession } from '@/session/use-session';
import { colors } from '@/theme';

async function fetchHealth() {
  const response = await fetch(`${API_URL}/health`);
  return healthResponseSchema.parse(await response.json());
}

function ApiStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });
  if (health.isPending)
    return <Text style={styles.status}>API durumu kontrol ediliyor…</Text>;
  if (health.isError)
    return (
      <Text style={[styles.status, { color: colors.danger }]}>
        API&apos;ye ulaşılamıyor.
      </Text>
    );
  return (
    <Text style={styles.status}>
      API: {health.data.status === 'ok' ? 'çalışıyor' : 'hata'} · Veritabanı:{' '}
      {health.data.db === 'up' ? 'bağlı' : 'bağlı değil'}
    </Text>
  );
}

export default function Login() {
  const { notice } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    // The ref closes the gap before the disabled state has been rendered.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await sessionManager.login({ email, password });
      if (result.kind === 'error') setError(result.message);
      // 'ok': the navigation guards move to the role's home screen.
      // 'admin-web': the manager set a notice that is shown above the form.
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const dismissNotice = () => sessionManager.dismissNotice();

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Wordmark />
            <Text style={styles.tagline}>Giriş yapın</Text>
          </View>

          {notice ? (
            <Banner tone="notice">{noticeMessages[notice]}</Banner>
          ) : null}
          {error ? <Banner tone="error">{error}</Banner> : null}

          <Card>
            <View style={styles.field}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  dismissNotice();
                }}
                editable={!submitting}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="ornek@alanadi.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Parola</Text>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  dismissNotice();
                }}
                editable={!submitting}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                maxLength={256}
                returnKeyType="go"
                onSubmitEditing={submit}
                style={styles.input}
              />
            </View>
            <Button
              label="Giriş Yap"
              busyLabel="Giriş yapılıyor…"
              busy={submitting}
              onPress={submit}
            />
          </Card>

          <ApiStatus />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brand: { alignItems: 'center', gap: 6, marginBottom: 8 },
  tagline: { color: colors.muted, fontSize: 14 },
  field: { gap: 6 },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  status: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
