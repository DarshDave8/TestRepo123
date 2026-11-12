// Backend timestamps (e.g. the trigger consent response's timeStamp) as epoch milliseconds, or null when there is
// none or it cannot be read. Date.parse alone is not used: it reads "2026-11-11 13:43:39" as local time in Chrome
// and not at all in Safari, and "11-11-2026" month-first. Accepted:
// - ISO with a zone: 2026-11-11T08:13:39Z, 2026-11-11T13:43:39+05:30
// - year first, no zone: 2026-11-11 13:43:39 / 2026-11-11T13:43:39.123
// - day first, no zone:  11-11-2026 13:43:39 / 11/11/2026 13:43
// A time without a zone is the backend's own time, IST.
const IST_OFFSET = '+05:30';

export function parseCkycTimestamp(value?: string | null): number | null {
  const text = value?.trim();
  if (!text) return null;
  const dayFirst = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  const iso = dayFirst
    ? `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}T${dayFirst[4] ?? '00'}:${dayFirst[5] ?? '00'}:${dayFirst[6] ?? '00'}`
    : text.replace(' ', 'T');
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const withTime = /T\d{2}:\d{2}/.test(iso) ? iso : `${iso}T00:00:00`;
  const time = Date.parse(hasZone ? withTime : `${withTime}${IST_OFFSET}`);
  return Number.isFinite(time) ? time : null;
}
