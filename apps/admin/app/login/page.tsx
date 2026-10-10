import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Wordmark } from '../brand';
import { loginReasons, parseLoginReason } from '@/lib/messages';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Giriş · Gossip Society Yönetim Paneli',
};

// searchParams is request data, so it is read behind a Suspense boundary and
// the rest of the page stays in the static shell.
async function ReasonNotice({
  searchParams,
}: Pick<PageProps<'/login'>, 'searchParams'>) {
  const { reason: raw } = await searchParams;
  const reason = parseLoginReason(typeof raw === 'string' ? raw : undefined);
  if (!reason) return null;
  const isInfo = reason === 'logout';
  return (
    <p
      role="status"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        isInfo
          ? 'border-zinc-700 bg-zinc-900 text-zinc-300'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      {loginReasons[reason]}
    </p>
  );
}

export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-accent/20 via-background to-background"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/30 blur-[120px]"
      />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-4xl leading-tight text-white">
            <Wordmark />
          </h1>
          <p className="mt-2 text-sm font-medium text-zinc-400">
            Yönetim Paneli
          </p>
        </div>
        <Suspense>
          <ReasonNotice searchParams={props.searchParams} />
        </Suspense>
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 shadow-xl">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
