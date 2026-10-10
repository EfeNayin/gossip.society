'use client';

import { useEffect, useRef } from 'react';
import { endInvalidSessionAction } from '../../actions/auth';

// Submits once on its own so the visitor just lands on the login page; the
// button is there in case scripts are blocked.
export function EndSessionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form ref={formRef} action={endInvalidSessionAction}>
      <button
        type="submit"
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white"
      >
        Giriş Sayfasına Dön
      </button>
    </form>
  );
}
