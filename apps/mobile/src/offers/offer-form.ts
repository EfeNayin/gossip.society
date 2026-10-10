import {
  createOfferRequestSchema,
  MAX_OFFER_CAPACITY,
  MAX_OFFER_DESCRIPTION_LENGTH,
  MAX_OFFER_EXPECTED_CONTENT_LENGTH,
  MAX_OFFER_SERVICE_LENGTH,
  MAX_OFFER_TITLE_LENGTH,
  MAX_MIN_FOLLOWERS,
  type CreateOfferRequest,
  type OwnerOffer,
  type UpdateOfferRequest,
} from '@gossip/shared';
import {
  DATE_INPUT_FORMAT,
  formatIstanbul,
  parseIstanbulInput,
} from './istanbul-time';
import { kurusToInput, parseTlToKurus } from './money';

// Everything the form holds is text, exactly as typed.
export interface OfferFormValues {
  title: string;
  description: string;
  serviceDescription: string;
  serviceValueTl: string;
  expectedContent: string;
  minFollowers: string;
  capacity: string;
  validFrom: string;
  validUntil: string;
}

export type OfferFormField = keyof OfferFormValues | 'branchId';
export type OfferFormErrors = Partial<Record<OfferFormField, string>>;

export const emptyOfferForm: OfferFormValues = {
  title: '',
  description: '',
  serviceDescription: '',
  serviceValueTl: '',
  expectedContent: '',
  minFollowers: '0',
  capacity: '1',
  validFrom: '',
  validUntil: '',
};

export const offerFormLimits = {
  title: MAX_OFFER_TITLE_LENGTH,
  description: MAX_OFFER_DESCRIPTION_LENGTH,
  serviceDescription: MAX_OFFER_SERVICE_LENGTH,
  expectedContent: MAX_OFFER_EXPECTED_CONTENT_LENGTH,
};

export const offerFieldMessages = {
  required: 'Bu alan zorunludur.',
  tooLong: (max: number) => `En fazla ${max} karakter olabilir.`,
  moneyFormat: 'Geçerli bir tutar girin (örn. 1250 veya 1250,50).',
  moneyDecimals: 'En fazla iki ondalık basamak girebilirsiniz.',
  moneyZero: 'Tutar sıfırdan büyük olmalıdır.',
  moneyTooLarge: 'Tutar çok büyük.',
  wholeNumber: 'Tam sayı girin.',
  capacity: `Kontenjan 1 ile ${MAX_OFFER_CAPACITY} arasında olmalıdır.`,
  followers: `Minimum takipçi 0 ile ${MAX_MIN_FOLLOWERS} arasında olmalıdır.`,
  dateFormat: `Tarihi ${DATE_INPUT_FORMAT} biçiminde girin (örn. 01.11.2026 09:00).`,
  dateInvalid: 'Bu tarih geçerli değil.',
  range: 'Bitiş, başlangıçtan sonra olmalıdır.',
  branch: 'Bir şube seçin.',
} as const;

function wholeNumber(text: string): number | undefined {
  const trimmed = text.trim();
  return /^\d{1,12}$/.test(trimmed) ? Number(trimmed) : undefined;
}

export type ParsedOfferForm<T> =
  { ok: true; request: T } | { ok: false; errors: OfferFormErrors };

/**
 * Validates the form with the shared create schema (the same limits as the
 * API) and turns the typed text into the request: lira text -> integer kuruş,
 * Istanbul time -> UTC. Messages are Turkish and belong to a field.
 */
export function parseOfferForm(
  values: OfferFormValues,
  branchId: string | undefined,
): ParsedOfferForm<CreateOfferRequest> {
  const errors: OfferFormErrors = {};

  if (!branchId) errors.branchId = offerFieldMessages.branch;

  const money = parseTlToKurus(values.serviceValueTl);
  let serviceValueKurus = 1;
  if (money.ok) serviceValueKurus = money.kurus;
  else {
    errors.serviceValueTl = {
      empty: offerFieldMessages.required,
      format: offerFieldMessages.moneyFormat,
      decimals: offerFieldMessages.moneyDecimals,
      zero: offerFieldMessages.moneyZero,
      'too-large': offerFieldMessages.moneyTooLarge,
    }[money.reason];
  }

  const followers = wholeNumber(values.minFollowers);
  if (followers === undefined)
    errors.minFollowers = offerFieldMessages.wholeNumber;
  const capacity = wholeNumber(values.capacity);
  if (capacity === undefined) errors.capacity = offerFieldMessages.wholeNumber;

  const dateError = (reason: 'empty' | 'format' | 'invalid') =>
    reason === 'empty'
      ? offerFieldMessages.required
      : reason === 'format'
        ? offerFieldMessages.dateFormat
        : offerFieldMessages.dateInvalid;
  const from = parseIstanbulInput(values.validFrom);
  const until = parseIstanbulInput(values.validUntil);
  if (!from.ok) errors.validFrom = dateError(from.reason);
  if (!until.ok) errors.validUntil = dateError(until.reason);

  // The shared schema validates the rest (lengths, ranges, the date order).
  // A value that failed to parse above is replaced by a harmless placeholder so
  // the other fields are still checked in the same pass.
  const placeholder = '2026-01-01T00:00:00.000Z';
  const candidate = {
    branchId: branchId ?? '00000000-0000-4000-8000-000000000000',
    title: values.title,
    description: values.description,
    serviceDescription: values.serviceDescription,
    serviceValueKurus,
    expectedContent: values.expectedContent,
    minFollowers: followers ?? 0,
    capacity: capacity ?? 1,
    validFrom: from.ok ? from.iso : placeholder,
    validUntil: until.ok ? until.iso : '2026-01-02T00:00:00.000Z',
  };
  const parsed = createOfferRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0]);
      const field: OfferFormField | undefined = (
        {
          title: 'title',
          description: 'description',
          serviceDescription: 'serviceDescription',
          expectedContent: 'expectedContent',
          minFollowers: 'minFollowers',
          capacity: 'capacity',
          validFrom: 'validFrom',
          validUntil: 'validUntil',
        } as Record<string, OfferFormField>
      )[path];
      if (!field || errors[field]) continue;
      if (field === 'validUntil') {
        // Only a real order problem: parse errors were reported above.
        if (from.ok && until.ok) errors.validUntil = offerFieldMessages.range;
      } else if (field === 'minFollowers')
        errors.minFollowers = offerFieldMessages.followers;
      else if (field === 'capacity')
        errors.capacity = offerFieldMessages.capacity;
      else if (issue.code === 'too_big') {
        errors[field] = offerFieldMessages.tooLong(
          offerFormLimits[field as keyof typeof offerFormLimits],
        );
      } else errors[field] = offerFieldMessages.required;
    }
  }

  if (Object.keys(errors).length > 0 || !parsed.success)
    return { ok: false, errors };
  return { ok: true, request: parsed.data };
}

/** The edit request: the same fields, without the branch (it can't change). */
export function toUpdateRequest(
  request: CreateOfferRequest,
): UpdateOfferRequest {
  const { branchId: _branchId, ...fields } = request;
  void _branchId;
  return fields;
}

/** The form values of an existing offer, as the user would have typed them. */
export function offerToFormValues(offer: OwnerOffer): OfferFormValues {
  return {
    title: offer.title,
    description: offer.description,
    serviceDescription: offer.serviceDescription,
    serviceValueTl: kurusToInput(offer.serviceValueKurus),
    expectedContent: offer.expectedContent,
    minFollowers: String(offer.minFollowers),
    capacity: String(offer.capacity),
    validFrom: formatIstanbul(offer.validFrom),
    validUntil: formatIstanbul(offer.validUntil),
  };
}

export function sameFormValues(
  a: OfferFormValues,
  b: OfferFormValues,
): boolean {
  return (Object.keys(a) as (keyof OfferFormValues)[]).every(
    (key) => a[key].trim() === b[key].trim(),
  );
}
