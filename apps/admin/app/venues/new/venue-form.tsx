'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  MAX_ADDRESS_LENGTH,
  MAX_BRANCH_NAME_LENGTH,
  MAX_CITY_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  MAX_VENUE_DESCRIPTION_LENGTH,
  MAX_VENUE_NAME_LENGTH,
  MIN_INITIAL_PASSWORD_LENGTH,
} from '@gossip/shared';
import { createVenueAction, type CreateVenueState } from '../../actions/venues';

const initialState: CreateVenueState = { status: 'idle' };

const inputClass =
  'w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 aria-[invalid=true]:border-red-500/60';

function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-bold tracking-wider text-zinc-400 uppercase"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${name}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function VenueForm() {
  const [state, formAction, pending] = useActionState(
    createVenueAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  // Closes the gap between the first submit and the disabled state rendering.
  const submitting = useRef(false);
  useEffect(() => {
    submitting.current = pending;
  }, [pending]);

  const values = state.status === 'idle' ? undefined : state.values;
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};

  const text = (name: keyof NonNullable<typeof values>) => ({
    name,
    id: name,
    defaultValue: values?.[name] ?? '',
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form
      action={formAction}
      aria-busy={pending}
      noValidate
      onSubmit={(event) => {
        if (submitting.current) event.preventDefault();
        else submitting.current = true;
      }}
      className="space-y-6"
    >
      {state.status === 'error' && state.message ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === 'unknown' ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <p>{state.message}</p>
          <Link href="/venues" prefetch={false} className="underline">
            Mekan listesini kontrol et
          </Link>
        </div>
      ) : null}

      <fieldset disabled={pending} className="space-y-6">
        <section className="space-y-4 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
          <h2 className="text-lg font-bold text-white">Mekan sahibi</h2>
          <Field name="ownerName" label="Ad soyad" error={errors.ownerName}>
            <input
              {...text('ownerName')}
              maxLength={MAX_PERSON_NAME_LENGTH}
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <Field name="ownerEmail" label="E-posta" error={errors.ownerEmail}>
            <input
              {...text('ownerEmail')}
              type="email"
              autoComplete="off"
              placeholder="ornek@alanadi.com"
              className={inputClass}
            />
          </Field>
          <Field
            name="ownerPassword"
            label="Başlangıç parolası"
            error={errors.ownerPassword}
            hint={`En az ${MIN_INITIAL_PASSWORD_LENGTH} karakter. Parolayı siz belirlersiniz ve mekan sahibine uygulama dışında iletirsiniz. Kaydedildikten sonra bir daha görüntülenemez.`}
          >
            <div className="flex gap-2">
              <input
                name="ownerPassword"
                id="ownerPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="none"
                maxLength={MAX_PASSWORD_LENGTH}
                aria-invalid={errors.ownerPassword ? true : undefined}
                aria-describedby={
                  errors.ownerPassword
                    ? 'ownerPassword-error'
                    : 'ownerPassword-hint'
                }
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-pressed={showPassword}
                className="shrink-0 rounded-xl border border-zinc-700 px-3 text-sm text-zinc-300 hover:border-accent"
              >
                {showPassword ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </Field>
        </section>

        <section className="space-y-4 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
          <h2 className="text-lg font-bold text-white">Mekan</h2>
          <Field name="venueName" label="Mekan adı" error={errors.venueName}>
            <input
              {...text('venueName')}
              maxLength={MAX_VENUE_NAME_LENGTH}
              className={inputClass}
            />
          </Field>
          <Field
            name="venueDescription"
            label="Açıklama (isteğe bağlı)"
            error={errors.venueDescription}
          >
            <textarea
              {...text('venueDescription')}
              rows={3}
              maxLength={MAX_VENUE_DESCRIPTION_LENGTH}
              className={inputClass}
            />
          </Field>
        </section>

        <section className="space-y-4 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
          <h2 className="text-lg font-bold text-white">İlk şube</h2>
          <Field name="branchName" label="Şube adı" error={errors.branchName}>
            <input
              {...text('branchName')}
              maxLength={MAX_BRANCH_NAME_LENGTH}
              className={inputClass}
            />
          </Field>
          <Field name="branchCity" label="Şehir" error={errors.branchCity}>
            <input
              {...text('branchCity')}
              maxLength={MAX_CITY_LENGTH}
              className={inputClass}
            />
          </Field>
          <Field
            name="branchAddress"
            label="Adres"
            error={errors.branchAddress}
          >
            <textarea
              {...text('branchAddress')}
              rows={2}
              maxLength={MAX_ADDRESS_LENGTH}
              className={inputClass}
            />
          </Field>
        </section>

        <button
          type="submit"
          className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Oluşturuluyor…' : 'Mekanı Oluştur'}
        </button>
      </fieldset>
    </form>
  );
}
