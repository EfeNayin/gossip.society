import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiListVenues } from '@/lib/api';
import { formatIstanbul, venuesHref, VENUES_PAGE_SIZE } from '@/lib/venue-list';

const card =
  'rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5';

export async function VenuesList({
  accessToken,
  page,
  created,
}: {
  accessToken: string;
  page: number;
  created: boolean;
}) {
  const result = await apiListVenues(accessToken, {
    page,
    pageSize: VENUES_PAGE_SIZE,
  });

  // The API checks the admin again; if it refuses, the session is unusable.
  if (
    result.kind === 'error' &&
    (result.status === 401 || result.status === 403)
  ) {
    redirect('/session/end');
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Mekanlar</h1>
        <Link
          href="/venues/new"
          prefetch={false}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
        >
          Yeni Mekan
        </Link>
      </div>

      {created ? (
        <p
          role="status"
          className="max-w-3xl rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
        >
          Mekan sahibi hesabı, mekan ve ilk şube oluşturuldu. Başlangıç
          parolasını mekan sahibine uygulama dışında iletin; parola daha sonra
          görüntülenemez.
        </p>
      ) : null}

      {result.kind !== 'ok' ? (
        <p
          role="alert"
          className="max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {result.kind === 'unreachable'
            ? 'Sunucuya ulaşılamıyor. Mekan listesi alınamadı.'
            : 'Mekan listesi alınamadı. Lütfen tekrar deneyin.'}{' '}
          <Link href={venuesHref(page)} prefetch={false} className="underline">
            Yeniden dene
          </Link>
        </p>
      ) : result.data.items.length === 0 ? (
        <div className={`${card} max-w-xl`}>
          {page > 1 ? (
            <>
              <p className="text-sm text-zinc-300">Bu sayfada mekan yok.</p>
              <Link
                href="/venues"
                prefetch={false}
                className="mt-3 inline-block text-sm text-accent underline"
              >
                İlk sayfaya dön
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white">Henüz mekan yok</h2>
              <p className="mt-1 text-sm text-zinc-400">
                İlk mekan sahibini, mekanı ve şubeyi oluşturarak başlayın.
              </p>
              <Link
                href="/venues/new"
                prefetch={false}
                className="mt-4 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
              >
                Yeni Mekan
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="grid max-w-5xl gap-4">
            {result.data.items.map((venue) => (
              <li key={venue.id} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-white">{venue.name}</h2>
                  <span className="text-xs text-zinc-500">
                    {formatIstanbul(venue.createdAt)}
                  </span>
                </div>
                {venue.description ? (
                  <p className="mt-1 text-sm text-zinc-400">
                    {venue.description}
                  </p>
                ) : null}
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Sahip
                    </dt>
                    <dd className="mt-1 text-zinc-200">{venue.owner.name}</dd>
                    <dd className="text-zinc-400">{venue.owner.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                      Şubeler
                    </dt>
                    {venue.branches.map((branch) => (
                      <dd key={branch.id} className="mt-1 text-zinc-200">
                        {branch.name}{' '}
                        <span className="text-zinc-400">
                          · {branch.city} · {branch.address}
                        </span>
                      </dd>
                    ))}
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <nav
            aria-label="Sayfalama"
            className="flex max-w-5xl items-center justify-between gap-4 text-sm text-zinc-300"
          >
            {result.data.page > 1 ? (
              <Link
                href={venuesHref(result.data.page - 1)}
                prefetch={false}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:border-accent"
              >
                ← Önceki
              </Link>
            ) : (
              <span />
            )}
            <span>
              Sayfa {result.data.page} / {result.data.totalPages} ·{' '}
              {result.data.total} mekan
            </span>
            {result.data.page < result.data.totalPages ? (
              <Link
                href={venuesHref(result.data.page + 1)}
                prefetch={false}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:border-accent"
              >
                Sonraki →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </main>
  );
}
