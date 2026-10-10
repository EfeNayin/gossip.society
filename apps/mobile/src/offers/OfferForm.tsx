import type {
  CreateOfferRequest,
  MyVenue,
  OwnerOffer,
  UpdateOfferRequest,
} from '@gossip/shared';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card } from '@/components/ui';
import { colors } from '@/theme';
import { createAttemptTracker } from './idempotency-key';
import { DATE_INPUT_FORMAT } from './istanbul-time';
import {
  emptyOfferForm,
  matchesOffer,
  offerToFormValues,
  parseOfferForm,
  toUpdateRequest,
  type OfferFormErrors,
  type OfferFormValues,
} from './offer-form';
import { writeFailureMessage } from './offer-messages';
import { Field } from './offer-parts';
import type { WriteOutcome } from './offers-query';

type Props =
  | {
      mode: 'create';
      venues: MyVenue[];
      busy: boolean;
      onSubmit: (
        request: CreateOfferRequest,
        idempotencyKey: string,
      ) => Promise<WriteOutcome | null>;
      onCheckStatus: () => void;
    }
  | {
      mode: 'edit';
      offer: OwnerOffer;
      busy: boolean;
      onSubmit: (request: UpdateOfferRequest) => Promise<WriteOutcome | null>;
      onCheckStatus: () => void;
      onDirtyChange: (dirty: boolean) => void;
    };

function BranchPicker({
  venues,
  value,
  error,
  onChange,
}: {
  venues: MyVenue[];
  value: string | undefined;
  error?: string;
  onChange: (branchId: string) => void;
}) {
  return (
    <View style={styles.picker}>
      <Text style={styles.pickerLabel}>Şube</Text>
      {venues.map((venue) => (
        <View key={venue.id} style={styles.pickerGroup}>
          <Text style={styles.venueName}>{venue.name}</Text>
          {venue.branches.map((branch) => {
            const selected = branch.id === value;
            return (
              <Pressable
                key={branch.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${venue.name} – ${branch.name}`}
                onPress={() => onChange(branch.id)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <View style={[styles.radio, selected && styles.radioOn]} />
                <View style={styles.optionText}>
                  <Text style={styles.optionName}>{branch.name}</Text>
                  <Text style={styles.optionCity}>{branch.city}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// One form for a new draft and for editing a draft. Everything is typed text;
// the shared schema checks it before anything is sent.
export function OfferForm(props: Props) {
  const edit = props.mode === 'edit' ? props.offer : undefined;
  const [values, setValues] = useState<OfferFormValues>(() =>
    edit ? offerToFormValues(edit) : emptyOfferForm,
  );
  const onlyBranch =
    props.mode === 'create' && props.venues.length === 1
      ? props.venues[0]?.branches
      : undefined;
  const [branchId, setBranchId] = useState<string | undefined>(
    onlyBranch?.length === 1 ? onlyBranch[0]?.id : undefined,
  );
  const [errors, setErrors] = useState<OfferFormErrors>({});
  const [failure, setFailure] = useState<string | undefined>();
  const [unknown, setUnknown] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  // The Idempotency-Key of the current create attempt (see createAttemptTracker).
  const [attempt] = useState(() => createAttemptTracker());

  const dirty = useMemo(
    () => (edit ? !matchesOffer(values, edit) : false),
    [edit, values],
  );

  const onDirtyChange = props.mode === 'edit' ? props.onDirtyChange : undefined;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // After a lost answer the offer is read again. If the server now holds what
  // is typed, the edit did reach it.
  const recovered = unknown && edit !== undefined && !dirty;

  function change(field: keyof OfferFormValues, text: string) {
    setValues((current) => ({ ...current, [field]: text }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(undefined);
  }

  async function submit() {
    if (props.busy) return;
    setNotice(undefined);
    const parsed = parseOfferForm(values, edit ? edit.branch.id : branchId);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFailure(undefined);
      return;
    }
    setErrors({});
    setFailure(undefined);
    setUnknown(false);

    const outcome =
      props.mode === 'create'
        ? await props.onSubmit(parsed.request, attempt.keyFor(parsed.request))
        : await props.onSubmit(toUpdateRequest(parsed.request));
    if (!outcome) return;
    if (outcome.kind === 'ok') {
      attempt.finish();
      if (props.mode === 'edit') {
        setValues(offerToFormValues(outcome.offer));
        setNotice('Taslak kaydedildi.');
      }
      return;
    }
    setFailure(
      writeFailureMessage(
        outcome,
        props.mode === 'create' ? 'create' : 'other',
      ),
    );
    setUnknown(outcome.kind === 'unknown');
  }

  const f = (field: keyof OfferFormValues) => ({
    value: values[field],
    onChangeText: (text: string) => change(field, text),
    error: errors[field],
  });

  return (
    <Card style={styles.form}>
      {props.mode === 'create' ? (
        <BranchPicker
          venues={props.venues}
          value={branchId}
          error={errors.branchId}
          onChange={(id) => {
            setBranchId(id);
            setErrors((current) => ({ ...current, branchId: undefined }));
          }}
        />
      ) : null}

      <Field label="Başlık" {...f('title')} />
      <Field label="Açıklama" multiline {...f('description')} />
      <Field label="Sunulan hizmet" multiline {...f('serviceDescription')} />
      <Field
        label="Hizmet değeri (₺)"
        hint="Örn. 1250 veya 1250,50"
        keyboardType="decimal-pad"
        {...f('serviceValueTl')}
      />
      <Field label="Beklenen içerik" multiline {...f('expectedContent')} />
      <Field
        label="Minimum takipçi"
        keyboardType="number-pad"
        {...f('minFollowers')}
      />
      <Field label="Kontenjan" keyboardType="number-pad" {...f('capacity')} />
      <Field
        label="Başlangıç (Türkiye saati)"
        hint={DATE_INPUT_FORMAT}
        placeholder="01.11.2026 09:00"
        autoCapitalize="none"
        autoCorrect={false}
        {...f('validFrom')}
      />
      <Field
        label="Bitiş (Türkiye saati)"
        hint={DATE_INPUT_FORMAT}
        placeholder="01.12.2026 09:00"
        autoCapitalize="none"
        autoCorrect={false}
        {...f('validUntil')}
      />

      {recovered ? (
        <Banner tone="notice">Değişiklikler sunucuda kayıtlı görünüyor.</Banner>
      ) : null}
      {notice ? <Banner tone="notice">{notice}</Banner> : null}
      {failure && !recovered ? <Banner tone="error">{failure}</Banner> : null}
      {unknown && !recovered ? (
        <Button
          label="Durumu Kontrol Et"
          variant="secondary"
          onPress={props.onCheckStatus}
        />
      ) : null}

      <Button
        label={
          props.mode === 'create'
            ? 'Taslak Olarak Kaydet'
            : 'Değişiklikleri Kaydet'
        }
        busyLabel="Kaydediliyor…"
        busy={props.busy}
        onPress={() => void submit()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  picker: { gap: 10 },
  pickerLabel: { color: '#d4d4d8', fontSize: 13, fontWeight: '700' },
  pickerGroup: { gap: 8 },
  venueName: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  optionSelected: { borderColor: colors.accent },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionText: { flex: 1 },
  optionName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  optionCity: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
});
