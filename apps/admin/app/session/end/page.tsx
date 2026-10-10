import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SessionEnd } from './session-end';

export const metadata: Metadata = { title: 'Oturum sona erdi' };

export default function SessionEndPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Yönlendiriliyor…
        </main>
      }
    >
      <SessionEnd />
    </Suspense>
  );
}
