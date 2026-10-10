import type { AdminVenue, AdminVenueList, SafeUser } from '@gossip/shared';

export const venue = (
  n: number,
  overrides: Partial<AdminVenue> = {},
): AdminVenue => ({
  id: `00000000-0000-4000-8000-00000000${String(n).padStart(4, '0')}`,
  name: `Mekan ${n}`,
  description: n % 2 ? `Açıklama ${n}` : null,
  createdAt: '2026-10-10T12:00:00.000Z',
  owner: {
    id: `00000000-0000-4000-8000-00000001${String(n).padStart(4, '0')}`,
    name: `Sahip ${n}`,
    email: `sahip${n}@kafe.example`,
    status: 'ACTIVE',
  },
  branches: [
    {
      id: `00000000-0000-4000-8000-00000002${String(n).padStart(4, '0')}`,
      name: `Şube ${n}`,
      city: 'İstanbul',
      address: `Adres ${n}`,
    },
  ],
  ...overrides,
});

export const venueList = (
  items: AdminVenue[],
  overrides: Partial<AdminVenueList> = {},
): AdminVenueList => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  totalPages: Math.max(1, Math.ceil(items.length / 10)),
  ...overrides,
});

export const adminUser: SafeUser = {
  id: '5b0b8e58-3a37-4f43-9a0b-0d6a8f4f9a11',
  email: 'admin@gossip-society.example',
  name: 'Dev Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
};
