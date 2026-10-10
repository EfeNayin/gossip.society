import type { Href } from 'expo-router';

// Expo Router's typed routes are generated into .expo/ by `expo start` and are
// not committed, so a fresh checkout (CI) has none. The hrefs are declared once
// here and cast; they must match the files in src/app.
export const routes = {
  login: '/login' as Href,
  unavailable: '/unavailable' as Href,
  influencer: '/influencer' as Href,
  venueOwner: '/venue-owner' as Href,
  staff: '/staff' as Href,
  offers: '/offers' as Href,
  newOffer: '/offers/new' as Href,
  offerDetail: (id: string) => `/offers/${encodeURIComponent(id)}` as Href,
};
