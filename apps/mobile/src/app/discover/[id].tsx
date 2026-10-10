import { useLocalSearchParams } from 'expo-router';
import { DiscoverDetailScreen } from '@/discover/DiscoverDetailScreen';

export default function DiscoverDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DiscoverDetailScreen id={String(id)} />;
}
