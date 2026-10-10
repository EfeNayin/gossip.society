'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiCreateVenue } from '@/lib/api';
import { getAdminContext } from '@/lib/admin-context';
import { messages } from '@/lib/messages';
import { checkSameOrigin } from '@/lib/origin';
import {
  parseVenueForm,
  refillValues,
  venueFieldMessages,
  type VenueFieldErrors,
  type VenueFormValues,
} from '@/lib/venue-form';

// This state goes back to the browser, so it must never hold the password:
// `values` is the form WITHOUT the password field.
export type CreateVenueState =
  | { status: 'idle' }
  | {
      // Nothing was created.
      status: 'error';
      message?: string;
      fieldErrors?: VenueFieldErrors;
      values?: VenueFormValues;
    }
  | {
      // The answer was lost or the server failed: we can't tell whether the
      // venue exists. The form says so and asks the admin to check the list.
      status: 'unknown';
      message: string;
      values: VenueFormValues;
    };

export async function createVenueAction(
  _previous: CreateVenueState,
  formData: FormData,
): Promise<CreateVenueState> {
  // CSRF: refuse anything that doesn't come from this site's own pages.
  if (!checkSameOrigin(await headers()).ok) {
    return { status: 'error', message: messages.badRequest };
  }

  // Authorize on the server for this very request, before doing anything.
  const admin = await getAdminContext();
  if (admin.kind === 'end') redirect('/session/end');
  if (admin.kind === 'unavailable') {
    return {
      status: 'error',
      message: messages.unreachable,
      values: refillValues(formData),
    };
  }

  const values = refillValues(formData);
  const parsed = parseVenueForm(formData);
  if (!parsed.ok) {
    return { status: 'error', fieldErrors: parsed.fieldErrors, values };
  }

  // One attempt, never retried: the request creates an account, and if the
  // answer is lost a second attempt could not be told apart from a duplicate.
  const result = await apiCreateVenue(admin.accessToken, parsed.request);

  if (result.kind === 'ok') {
    // Back to the list: the form (and the password in it) is gone, and
    // nothing about the password is in the URL or the page.
    redirect('/venues?created=1');
  }

  if (result.kind === 'unreachable') {
    return {
      status: 'unknown',
      message:
        'Sunucuya ulaşılamadı. Mekanın oluşturulup oluşturulmadığı bilinmiyor. Aynı bilgilerle tekrar göndermeden önce mekan listesini kontrol edin.',
      values,
    };
  }

  if (result.status === 401 || result.status === 403) {
    redirect('/session/end');
  }
  if (result.status === 409 && result.venueCode === 'EMAIL_ALREADY_EXISTS') {
    return {
      status: 'error',
      fieldErrors: { ownerEmail: venueFieldMessages.emailTaken },
      values,
    };
  }
  if (result.status === 400) {
    return {
      status: 'error',
      message: 'Girilen bilgiler doğrulanamadı. Alanları kontrol edin.',
      values,
    };
  }
  // 5xx and anything else: the API may or may not have finished.
  return {
    status: 'unknown',
    message:
      'Beklenmeyen bir hata oluştu. Mekanın oluşturulup oluşturulmadığını mekan listesinden kontrol edin.',
    values,
  };
}
