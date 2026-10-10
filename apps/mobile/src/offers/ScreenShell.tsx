import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { routes } from '@/routes';
import { colors } from '@/theme';

/** Back to the previous screen, or to `fallback` (the owner home) when there is none (a reload). */
export function useGoBack(fallback: Href = routes.venueOwner) {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace(fallback));
}

export function ScreenShell({
  title,
  children,
  refreshing,
  onRefresh,
  fallback,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  fallback?: Href;
}) {
  const goBack = useGoBack(fallback);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={goBack}
            hitSlop={10}
          >
            <Text style={styles.back}>‹ Geri</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 16, paddingHorizontal: 20, paddingVertical: 24 },
  header: { flexDirection: 'row', alignItems: 'center' },
  back: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
});
