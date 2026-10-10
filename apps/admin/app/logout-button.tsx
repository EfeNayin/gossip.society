'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from './actions/auth';

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Çıkış yapılıyor…' : 'Çıkış Yap'}
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button />
    </form>
  );
}
