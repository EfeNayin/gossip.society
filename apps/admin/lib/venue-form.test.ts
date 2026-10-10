import { describe, expect, it } from 'vitest';
import { parseVenueForm, refillValues, venueFieldMessages } from './venue-form';

const filled = {
  ownerName: 'Ayşe Yılmaz',
  ownerEmail: '  Ayse@Kafe.EXAMPLE ',
  ownerPassword: '  a long initial password  ',
  venueName: 'Örnek Kafe',
  venueDescription: '',
  branchName: 'Kadıköy',
  branchCity: 'İstanbul',
  branchAddress: 'Örnek Sokak No: 1',
};

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...filled, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

describe('parseVenueForm', () => {
  it('builds the API request: owner/venue/branch, e-mail normalized, password untouched', () => {
    const parsed = parseVenueForm(form());

    expect(parsed).toEqual({
      ok: true,
      request: {
        owner: {
          name: 'Ayşe Yılmaz',
          email: 'ayse@kafe.example',
          password: '  a long initial password  ',
        },
        venue: { name: 'Örnek Kafe', description: undefined },
        branch: {
          name: 'Kadıköy',
          city: 'İstanbul',
          address: 'Örnek Sokak No: 1',
        },
      },
    });
  });

  it('reports each problem on its own field, in Turkish', () => {
    const parsed = parseVenueForm(
      form({
        ownerName: '   ',
        ownerEmail: 'not-an-email',
        ownerPassword: 'short',
        venueName: '',
        branchCity: 'x'.repeat(81),
        branchAddress: '',
      }),
    );

    expect(parsed).toEqual({
      ok: false,
      fieldErrors: {
        ownerName: venueFieldMessages.required,
        ownerEmail: venueFieldMessages.email,
        ownerPassword: venueFieldMessages.passwordShort,
        venueName: venueFieldMessages.required,
        branchCity: venueFieldMessages.tooLong(80),
        branchAddress: venueFieldMessages.required,
      },
    });
  });

  it('asks for a missing e-mail and password instead of calling them invalid', () => {
    const parsed = parseVenueForm(form({ ownerEmail: '', ownerPassword: '' }));
    expect(parsed).toMatchObject({
      ok: false,
      fieldErrors: {
        ownerEmail: venueFieldMessages.required,
        ownerPassword: venueFieldMessages.required,
      },
    });
  });

  it('flags a too long password and a too long description', () => {
    const parsed = parseVenueForm(
      form({
        ownerPassword: 'x'.repeat(257),
        venueDescription: 'y'.repeat(1001),
      }),
    );
    expect(parsed).toMatchObject({
      ok: false,
      fieldErrors: {
        ownerPassword: venueFieldMessages.passwordLong,
        venueDescription: venueFieldMessages.tooLong(1000),
      },
    });
  });

  it('treats a missing field like an empty one', () => {
    const data = form();
    data.delete('branchName');
    expect(parseVenueForm(data)).toMatchObject({
      ok: false,
      fieldErrors: { branchName: venueFieldMessages.required },
    });
  });
});

describe('refillValues', () => {
  it('returns every field except the password', () => {
    const values = refillValues(form());
    expect(values).toMatchObject({
      ownerName: 'Ayşe Yılmaz',
      ownerEmail: '  Ayse@Kafe.EXAMPLE ',
      venueName: 'Örnek Kafe',
    });
    expect(Object.keys(values)).not.toContain('ownerPassword');
    expect(JSON.stringify(values)).not.toContain('initial password');
  });
});
