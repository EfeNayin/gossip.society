'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '../actions/auth';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      <div
        role="alert"
        aria-live="polite"
        className={
          state.error
            ? 'rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300'
            : 'sr-only'
        }
      >
        {state.error}
      </div>

      <fieldset disabled={pending} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold tracking-wider text-zinc-400 uppercase">
            E-posta
          </span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state.email}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
            placeholder="ornek@alanadi.com"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Parola
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </fieldset>
    </form>
  );
}
