import {
  createVenueRequestSchema,
  MAX_ADDRESS_LENGTH,
  MAX_BRANCH_NAME_LENGTH,
  MAX_CITY_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_PERSON_NAME_LENGTH,
  MAX_VENUE_DESCRIPTION_LENGTH,
  MAX_VENUE_NAME_LENGTH,
  MIN_INITIAL_PASSWORD_LENGTH,
  type CreateVenueRequest,
} from '@gossip/shared';

// Form field names, flat. The API wants them grouped as owner / venue / branch.
export const venueFormFields = [
  'ownerName',
  'ownerEmail',
  'ownerPassword',
  'venueName',
  'venueDescription',
  'branchName',
  'branchCity',
  'branchAddress',
] as const;

export type VenueFormField = (typeof venueFormFields)[number];
export type VenueFieldErrors = Partial<Record<VenueFormField, string>>;
// What may be sent back to the browser to refill the form: everything EXCEPT
// the password.
export type VenueFormValues = Partial<
  Record<Exclude<VenueFormField, 'ownerPassword'>, string>
>;

export const venueFieldMessages = {
  required: 'Bu alan zorunludur.',
  email: 'Geçerli bir e-posta adresi girin.',
  passwordShort: `Parola en az ${MIN_INITIAL_PASSWORD_LENGTH} karakter olmalıdır.`,
  passwordLong: `Parola en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`,
  tooLong: (max: number) => `En fazla ${max} karakter olabilir.`,
  emailTaken: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.',
} as const;

const maxLength: Record<VenueFormField, number> = {
  ownerName: MAX_PERSON_NAME_LENGTH,
  ownerEmail: 320,
  ownerPassword: MAX_PASSWORD_LENGTH,
  venueName: MAX_VENUE_NAME_LENGTH,
  venueDescription: MAX_VENUE_DESCRIPTION_LENGTH,
  branchName: MAX_BRANCH_NAME_LENGTH,
  branchCity: MAX_CITY_LENGTH,
  branchAddress: MAX_ADDRESS_LENGTH,
};

const fieldOfPath: Record<string, VenueFormField> = {
  'owner.name': 'ownerName',
  'owner.email': 'ownerEmail',
  'owner.password': 'ownerPassword',
  'venue.name': 'venueName',
  'venue.description': 'venueDescription',
  'branch.name': 'branchName',
  'branch.city': 'branchCity',
  'branch.address': 'branchAddress',
};

function text(formData: FormData, name: VenueFormField): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** The submitted values that may be shown again after an error: no password. */
export function refillValues(formData: FormData): VenueFormValues {
  const values: VenueFormValues = {};
  for (const name of venueFormFields) {
    if (name !== 'ownerPassword') values[name] = text(formData, name);
  }
  return values;
}

export type ParsedVenueForm =
  | { ok: true; request: CreateVenueRequest }
  | { ok: false; fieldErrors: VenueFieldErrors };

/** Validates the form with the same schema the API uses; messages are Turkish. */
export function parseVenueForm(formData: FormData): ParsedVenueForm {
  const parsed = createVenueRequestSchema.safeParse({
    owner: {
      name: text(formData, 'ownerName'),
      email: text(formData, 'ownerEmail'),
      password: text(formData, 'ownerPassword'),
    },
    venue: {
      name: text(formData, 'venueName'),
      description: text(formData, 'venueDescription'),
    },
    branch: {
      name: text(formData, 'branchName'),
      city: text(formData, 'branchCity'),
      address: text(formData, 'branchAddress'),
    },
  });
  if (parsed.success) return { ok: true, request: parsed.data };

  const fieldErrors: VenueFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = fieldOfPath[issue.path.join('.')];
    if (!field || fieldErrors[field]) continue;
    fieldErrors[field] = messageFor(field, issue.code, text(formData, field));
  }
  return { ok: false, fieldErrors };
}

function messageFor(field: VenueFormField, code: string, raw: string): string {
  if (field === 'ownerEmail') {
    return raw.trim() === ''
      ? venueFieldMessages.required
      : venueFieldMessages.email;
  }
  if (field === 'ownerPassword') {
    if (raw === '') return venueFieldMessages.required;
    return code === 'too_big'
      ? venueFieldMessages.passwordLong
      : venueFieldMessages.passwordShort;
  }
  if (code === 'too_big') return venueFieldMessages.tooLong(maxLength[field]);
  return venueFieldMessages.required;
}
