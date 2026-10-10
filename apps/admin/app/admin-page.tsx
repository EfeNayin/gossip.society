import { Suspense, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getAdminContext } from '@/lib/admin-context';
import { PanelShell } from './panel-shell';
import { UnavailableNotice } from './unavailable-notice';

interface Context {
  accessToken: string;
}

// The frame of every admin page. The admin is verified with the API for this
// request, on the server, before anything is read or rendered: an unusable
// session goes to the end-session step, an unreachable API gets a retry notice.
async function AdminFrame({
  children,
}: {
  children: (context: Context) => Promise<ReactNode> | ReactNode;
}) {
  const context = await getAdminContext();
  if (context.kind === 'end') redirect('/session/end');
  if (context.kind === 'unavailable') return <UnavailableNotice />;
  return (
    <PanelShell user={context.user}>
      {await children({ accessToken: context.accessToken })}
    </PanelShell>
  );
}

// Reading the session is request-time data, so it sits behind Suspense.
export function AdminPage({
  children,
}: {
  children: (context: Context) => Promise<ReactNode> | ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Yükleniyor…
        </main>
      }
    >
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
