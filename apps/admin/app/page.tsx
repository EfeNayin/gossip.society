import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { apiHealth } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { Wordmark } from './brand';
import { LogoutButton } from './logout-button';

async function ApiStatus() {
  const health = await apiHealth();
  if (health.kind !== 'ok') {
    return <p className="text-sm text-red-400">API&apos;ye ulaşılamıyor.</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-zinc-300">
      <li>API: {health.data.status === 'ok' ? 'çalışıyor' : 'hata'}</li>
      <li>Veritabanı: {health.data.db === 'up' ? 'bağlı' : 'bağlı değil'}</li>
    </ul>
  );
}

// Every render asks the API who the cookie's token belongs to; a stale
// cookie, a changed role or a suspended account is caught here on the server,
// not by client-side redirects.
async function Panel() {
  const session = await getAdminSession();

  if (session.kind === 'unauthenticated')
    redirect('/session/end?reason=expired');
  if (session.kind === 'forbidden') redirect('/session/end?reason=forbidden');
  if (session.kind === 'inactive') redirect('/session/end?reason=inactive');

  if (session.kind === 'unavailable') {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <h1 className="mb-2 text-lg font-bold text-white">
            Sunucuya ulaşılamıyor
          </h1>
          <p className="mb-5 text-sm text-zinc-400">
            Oturumunuz korunuyor. Bağlantı gelince sayfayı yenileyerek devam
            edebilirsiniz.
          </p>
          {/* A full reload, so the proxy gets another chance to renew the session. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white"
          >
            Tekrar Dene
          </a>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-zinc-800 px-6 py-4">
        <span className="text-lg text-white">
          <Wordmark />
        </span>
        <div className="flex items-center gap-4">
          <span className="text-right text-sm">
            <span className="block font-bold text-white">
              {session.user.name}
            </span>
            <span className="block text-xs text-zinc-400">
              {session.user.email}
            </span>
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold text-white">Yönetim Paneli</h1>
        <section className="max-w-sm rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
          <h2 className="mb-3 text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Sistem durumu
          </h2>
          <Suspense
            fallback={
              <p className="text-sm text-zinc-500">Kontrol ediliyor…</p>
            }
          >
            <ApiStatus />
          </Suspense>
        </section>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Yükleniyor…
        </main>
      }
    >
      <Panel />
    </Suspense>
  );
}
