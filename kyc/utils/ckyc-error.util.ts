// Error text for the CKYC flow: the backend's own message first, ours (CKYC_ERROR_MESSAGES) only when it sent none.
//
// The backend's text is read from `messages` on the response (IResponse), on its body (e.g. the submit body),
// or on the body of an HTTP error (HttpErrorResponse.error). Angular's own HttpErrorResponse.message
// ("Http failure response for …") is never shown: it is technical and says nothing to the user.

function toMessages(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** The backend's message(s) as one sentence-cased line, or null when it sent none. */
export function backendErrorMessage(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const { messages, body, error } = source as { messages?: unknown; body?: unknown; error?: unknown };
  const bodyMessages = body && typeof body === 'object' ? (body as { messages?: unknown }).messages : undefined;
  const errorMessages = error && typeof error === 'object' ? (error as { messages?: unknown }).messages : undefined;
  const all = [...toMessages(messages), ...toMessages(bodyMessages), ...toMessages(errorMessages)]
    .map((message) => message.trim())
    .filter(Boolean);
  const unique = [...new Set(all)];
  if (!unique.length) return null;
  // "Invalid OTP", "Record locked" -> "Invalid OTP. Record locked."
  return unique.map((message) => (/[.!?]$/.test(message) ? message : `${message}.`)).join(' ');
}

/** Backend message when there is one, otherwise `fallback` (one of CKYC_ERROR_MESSAGES). */
export function ckycErrorMessage(source: unknown, fallback: string): string {
  return backendErrorMessage(source) ?? fallback;
}
