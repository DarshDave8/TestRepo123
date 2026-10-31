// Turns the validate-consent response into labelled rows for the details card.
// The response model is not hard-coded here: top-level values become the main rows,
// nested objects (e.g. an address) become their own section. Add a key to LABEL_OVERRIDES
// to rename it, or to HIDDEN_KEYS to keep it off the card.

export interface CkycDetailRow {
  readonly label: string;
  readonly value: string;
}

export interface CkycDetailSection {
  readonly title: string | null;
  readonly rows: readonly CkycDetailRow[];
}

const LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  ckycNo: 'CKYC number',
  ckycNumber: 'CKYC number',
  ckycRefNo: 'CKYC reference no',
  dob: 'Date of birth',
  pan: 'PAN',
  panNo: 'PAN',
  pincode: 'PIN code',
  pinCode: 'PIN code',
};

// Shown as an image (photo) or not at all (raw files).
const HIDDEN_KEYS = new Set(['photo', 'photoExt', 'image', 'imageExt', 'signature', 'file', 'document']);

// Words printed in capitals when a label is built from a key (e.g. idList -> "ID list").
const ACRONYMS = new Set(['id', 'pan', 'dob', 'ckyc', 'kyc', 'otp', 'ovd', 'uid', 'nri', 'pin']);

export function toCkycDetailLabel(key: string): string {
  const override = LABEL_OVERRIDES[key];
  if (override) return override;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word));
  const label = words.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Long base64-like strings are file contents, not something to print.
function looksLikeFileData(value: string): boolean {
  return value.length > 256 && /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string') {
    const text = value.trim();
    return text && !looksLikeFileData(text) ? text : null;
  }
  if (Array.isArray(value) && value.every((item) => item === null || typeof item !== 'object')) {
    const parts = value.map(toText).filter((part): part is string => part !== null);
    return parts.length ? parts.join(', ') : null;
  }
  return null; // objects and arrays of objects become sections
}

function toRows(source: object): CkycDetailRow[] {
  const rows: CkycDetailRow[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (HIDDEN_KEYS.has(key)) continue;
    const text = toText(value);
    if (text !== null) rows.push({ label: toCkycDetailLabel(key), value: text });
  }
  return rows;
}

export function buildCkycDetailSections(details: object | null | undefined): CkycDetailSection[] {
  if (!details) return [];
  const sections: CkycDetailSection[] = [{ title: null, rows: toRows(details) }];
  for (const [key, value] of Object.entries(details)) {
    if (HIDDEN_KEYS.has(key) || !value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      const objects = value.filter((item): item is object => !!item && typeof item === 'object');
      objects.forEach((item, index) =>
        sections.push({
          title: objects.length > 1 ? `${toCkycDetailLabel(key)} ${index + 1}` : toCkycDetailLabel(key),
          rows: toRows(item),
        }),
      );
    } else {
      sections.push({ title: toCkycDetailLabel(key), rows: toRows(value) });
    }
  }
  return sections.filter((section) => section.rows.length > 0);
}

// Same data-URL rule as the enquiry match card.
export function toCkycPhotoSource(details: object | null | undefined): string | null {
  if (!details) return null;
  const data = details as Record<string, unknown>;
  const photo = typeof data['photo'] === 'string' ? data['photo'].trim() : '';
  if (!photo) return null;
  const ext = typeof data['photoExt'] === 'string' ? data['photoExt'].trim().toLowerCase() : '';
  const mimeSubtype = !ext || ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mimeSubtype};base64,${photo}`;
}
