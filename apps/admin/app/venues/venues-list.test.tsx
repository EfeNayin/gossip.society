import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiMocks } from '../../test-support/api-mock';
import { RedirectError } from '../../test-support/next-mocks';
import { venue, venueList } from '../../test-support/venue-fixtures';
import { VenuesList } from './venues-list';

vi.mock('@/lib/api', async (importOriginal) => {
  const { apiMocks } = await import('../../test-support/api-mock');
  return { ...(await importOriginal<object>()), ...apiMocks };
});

async function render(props: { page?: number; created?: boolean } = {}) {
  const element = await VenuesList({
    accessToken: 'tok',
    page: props.page ?? 1,
    created: props.created ?? false,
  });
  return renderToStaticMarkup(element);
}

describe('VenuesList', () => {
  beforeEach(() => {
    for (const mock of Object.values(apiMocks)) mock.mockReset();
  });

  it('asks the API for the requested page with the admin token', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([venue(1)]),
    });
    await render({ page: 3 });
    expect(apiMocks.apiListVenues).toHaveBeenCalledWith('tok', {
      page: 3,
      pageSize: 10,
    });
  });

  it('shows an empty-state with a way to create the first venue', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([], { total: 0, totalPages: 0 }),
    });
    const html = await render();
    expect(html).toContain('Henüz mekan yok');
    expect(html).toContain('href="/venues/new"');
  });

  it('says so when a later page is empty', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([], { page: 4, total: 5, totalPages: 1 }),
    });
    const html = await render({ page: 4 });
    expect(html).toContain('Bu sayfada mekan yok');
    expect(html).toContain('href="/venues"');
  });

  it('lists venue, owner and branch basics', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([venue(1), venue(2)]),
    });
    const html = await render();
    for (const text of [
      'Mekan 1',
      'Sahip 1',
      'sahip1@kafe.example',
      'Şube 1',
      'Adres 1',
      'Mekan 2',
      'Açıklama 1',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/passwordHash|argon2|parola/i);
  });

  it('shows the time in Istanbul time', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([venue(1, { createdAt: '2026-10-10T21:30:00.000Z' })]),
    });
    expect(await render()).toMatch(/00[.:]30/);
  });

  it('links to the neighbouring pages and shows where we are', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([venue(1)], { page: 2, total: 25, totalPages: 3 }),
    });
    const html = await render({ page: 2 });
    expect(html).toContain('href="/venues"'); // previous: the clean first-page URL
    expect(html).toContain('href="/venues?page=3"');
    expect(html).toContain('Sayfa 2 / 3');
    expect(html).toContain('25 mekan');
  });

  it('has no previous link on the first page and no next link on the last', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([venue(1)], { total: 1, totalPages: 1 }),
    });
    const html = await render();
    expect(html).not.toContain('Önceki');
    expect(html).not.toContain('Sonraki');
  });

  it('shows the success note after creating, without any password', async () => {
    apiMocks.apiListVenues.mockResolvedValue({
      kind: 'ok',
      data: venueList([venue(1)]),
    });
    const html = await render({ created: true });
    expect(html).toContain('oluşturuldu');
    expect(html).toContain('uygulama dışında iletin');
    expect(await render({ created: false })).not.toContain('oluşturuldu');
  });

  it('shows a Turkish error with a retry link when the API cannot be reached', async () => {
    apiMocks.apiListVenues.mockResolvedValue({ kind: 'unreachable' });
    const html = await render({ page: 2 });
    expect(html).toContain('Sunucuya ulaşılamıyor');
    expect(html).toContain('Yeniden dene');
    expect(html).toContain('href="/venues?page=2"');
  });

  it('shows a generic error for a server failure', async () => {
    apiMocks.apiListVenues.mockResolvedValue({ kind: 'error', status: 500 });
    expect(await render()).toContain('Mekan listesi alınamadı');
  });

  it.each([401, 403])(
    'sends the visitor to the end-session step when the API answers %i',
    async (status) => {
      apiMocks.apiListVenues.mockResolvedValue({ kind: 'error', status });
      await expect(render()).rejects.toBeInstanceOf(RedirectError);
      await expect(render()).rejects.toMatchObject({ url: '/session/end' });
    },
  );
});
