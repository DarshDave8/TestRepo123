// Builds the rows of the validated-details card from the validate-consent response (ICustomerBasicDetails).
// Kept free of Angular and app imports so it can be unit-tested on its own.

export interface CkycDetailRow {
  readonly label: string;
  readonly value: string;
}

export interface CkycDetailSection {
  readonly title: string;
  readonly rows: readonly CkycDetailRow[];
}

// Structural view of ICustomerBasicDetails; the real interface is assignable to it.
export interface CkycValidatedDetailsInput {
  readonly profileProvider?: string | null;
  readonly applicantName?: {
    readonly salutation?: string | null;
    readonly firstName?: string | null;
    readonly middleName?: string | null;
    readonly lastName?: string | null;
  } | null;
  readonly gender?: string | null;
  readonly dateOfBirth?: string | null;
  readonly customerDetails?: {
    readonly citizenship?: unknown;
    readonly residency?: unknown;
    readonly currentAddressProofBasedOn?: string | null;
    readonly indianOrigin?: string | null;
    readonly designation?: string | null;
  } | null;
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// yyyy-MM-dd (optionally followed by a time) -> dd/MM/yyyy, same format as the enquiry card.
// Anything else is shown as received. No Date object, so no timezone shift on a birth date.
export function formatCkycDate(value: unknown): string | null {
  const text = clean(value);
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(text);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text;
}

// ICountry's fields are not known here, so take the first readable name-like field.
export function formatCkycCountry(value: unknown): string | null {
  if (typeof value === 'string') return clean(value);
  if (!value || typeof value !== 'object') return null;
  const country = value as Record<string, unknown>;
  for (const key of ['name', 'countryName', 'description', 'label', 'value', 'code', 'countryCode', 'isoCode']) {
    const text = clean(country[key]);
    if (text) return text;
  }
  return null;
}

function toRows(entries: ReadonlyArray<readonly [string, string | null | undefined]>): CkycDetailRow[] {
  return entries
    .filter((entry): entry is readonly [string, string] => !!entry[1])
    .map(([label, value]) => ({ label, value }));
}

export function buildCkycValidatedSections(
  details: CkycValidatedDetailsInput | null | undefined,
  genderLabel: (gender: string) => string | null | undefined = () => null,
): CkycDetailSection[] {
  if (!details) return [];
  const name = details.applicantName;
  const fullName = [name?.salutation, name?.firstName, name?.middleName, name?.lastName]
    .map(clean)
    .filter((part): part is string => part !== null)
    .join(' ');
  const gender = clean(details.gender);
  const customer = details.customerDetails;
  const sections: CkycDetailSection[] = [
    {
      title: 'Applicant',
      rows: toRows([
        ['Full name', fullName],
        ['Gender', gender ? (genderLabel(gender) ?? gender) : null],
        ['Date of birth', formatCkycDate(details.dateOfBirth)],
        ['Profile source', clean(details.profileProvider)],
      ]),
    },
    {
      title: 'Customer details',
      rows: toRows([
        ['Citizenship', formatCkycCountry(customer?.citizenship)],
        ['Residency', formatCkycCountry(customer?.residency)],
        ['Indian origin', clean(customer?.indianOrigin)],
        ['Address proof based on', clean(customer?.currentAddressProofBasedOn)],
        ['Designation', clean(customer?.designation)],
      ]),
    },
  ];
  return sections.filter((section) => section.rows.length > 0);
}
