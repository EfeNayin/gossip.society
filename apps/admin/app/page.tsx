import { Suspense } from 'react';
import Link from 'next/link';
import { apiHealth } from '@/lib/api';
import { AdminPage } from './admin-page';

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

export default function Home() {
  return (
    <AdminPage>
      {() => (
        <main className="flex flex-1 flex-col gap-6 p-6">
          <h1 className="text-2xl font-semibold text-white">Yönetim Paneli</h1>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Link
              href="/venues"
              prefetch={false}
              className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 transition hover:border-accent"
            >
              <h2 className="text-lg font-bold text-white">Mekanlar</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Mekanları, sahiplerini ve şubelerini görün.
              </p>
            </Link>
            <Link
              href="/venues/new"
              prefetch={false}
              className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 transition hover:border-accent"
            >
              <h2 className="text-lg font-bold text-white">Yeni Mekan</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Mekan sahibi hesabı, mekan ve ilk şubeyi oluşturun.
              </p>
            </Link>
          </div>
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
      )}
    </AdminPage>
  );
}
