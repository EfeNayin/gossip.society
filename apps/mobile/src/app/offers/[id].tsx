import { useLocalSearchParams } from 'expo-router';
import { OfferDetailScreen } from '@/offers/OfferDetailScreen';

export default function OfferDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OfferDetailScreen id={String(id)} />;
}
