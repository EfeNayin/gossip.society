import { redirect } from 'next/navigation';
import { loginReasons } from '@/lib/messages';
import { getAdminSession } from '@/lib/session';
import { endReasonFor } from '@/lib/session-state';
import { EndSessionForm } from './end-session-form';

// A GET to /session/end only READS the session: it sets no cookies and doesn't
// call the API's logout. Ending the session happens in a POST Server Action
// (with its same-origin check) submitted by the form below.
export async function SessionEnd() {
  const reason = endReasonFor(await getAdminSession());
  // Nothing to end (valid session, or the API is down): back to the panel.
  if (!reason) redirect('/');

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <h1 className="mb-2 text-lg font-bold text-white">Oturum sona erdi</h1>
        <p className="mb-5 text-sm text-zinc-400">{loginReasons[reason]}</p>
        <EndSessionForm />
      </div>
    </main>
  );
}
