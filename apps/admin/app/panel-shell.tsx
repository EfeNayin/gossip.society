import type { ReactNode } from 'react';
import Link from 'next/link';
import type { SafeUser } from '@gossip/shared';
import { Wordmark } from './brand';
import { LogoutButton } from './logout-button';

const navLink =
  'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white';

export function PanelShell({
  user,
  children,
}: {
  user: SafeUser;
  children: ReactNode;
}) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-800 px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" prefetch={false} className="text-lg text-white">
            <Wordmark />
          </Link>
          <nav aria-label="Ana gezinti" className="flex items-center gap-1">
            <Link href="/venues" prefetch={false} className={navLink}>
              Mekanlar
            </Link>
            <Link href="/venues/new" prefetch={false} className={navLink}>
              Yeni Mekan
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-right text-sm">
            <span className="block font-bold text-white">{user.name}</span>
            <span className="block text-xs text-zinc-400">{user.email}</span>
          </span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </>
  );
}
