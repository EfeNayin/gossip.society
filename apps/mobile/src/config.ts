// On a physical phone this must be the computer's LAN IP, not localhost
// (see the README).
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
