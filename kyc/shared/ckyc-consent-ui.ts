// Display text for the consent-verification chain shown by the face-auth and non-OTP components.
// Pure functions only: no state, no service calls.
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import type { CkycConsentAttempt } from '../models/ckyc-consent-request.model';

export type CkycConsentTone = 'progress' | 'success' | 'action' | 'failed';

export interface CkycConsentSummary {
  readonly tone: CkycConsentTone;
  readonly label: string;
}

const METHOD_LABELS: Readonly<Record<AuthenticationMode, string>> = {
  [AuthenticationMode.FACEAUTH]: 'Face authentication',
  [AuthenticationMode.MANUAL]: 'Physical verification',
  [AuthenticationMode.OTP]: 'OTP',
};

const FACTOR_DETAILS: Readonly<Record<AuthFactor, string>> = {
  [AuthFactor.DOB]: 'Checked with date of birth',
  [AuthFactor.RELATION]: "Checked with father's, mother's or spouse's name",
  [AuthFactor.BIRTHYEARPINCODE]: 'Checked with year of birth and PIN code',
};

const OTP_DETAILS: Readonly<Record<CkycConsentAttempt['status'], string>> = {
  Calling: 'Sending the OTP',
  Success: 'OTP sent to the customer',
  Failed: 'The OTP could not be sent',
  Cancelled: 'Stopped before the OTP was sent',
};

const STATUS_LABELS: Readonly<Record<CkycConsentAttempt['status'], string>> = {
  Calling: 'In progress',
  Success: 'Successful',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
};

export function consentMethodLabel(mode: AuthenticationMode): string {
  return METHOD_LABELS[mode] ?? mode;
}

export function consentAttemptDetail(attempt: CkycConsentAttempt): string | null {
  if (attempt.consentType === AuthenticationMode.OTP) return OTP_DETAILS[attempt.status];
  return attempt.authFactor ? (FACTOR_DETAILS[attempt.authFactor] ?? null) : null;
}

export function consentStatusLabel(status: CkycConsentAttempt['status']): string {
  return STATUS_LABELS[status] ?? status;
}

// One line for the panel header: what the chain is doing right now.
export function summarizeConsent(state: {
  readonly attempts: readonly CkycConsentAttempt[];
  readonly canValidate: boolean;
  readonly otpPending: boolean;
  readonly hasError: boolean;
}): CkycConsentSummary | null {
  if (state.attempts.some((attempt) => attempt.status === 'Calling')) return { tone: 'progress', label: 'In progress' };
  if (state.canValidate) return { tone: 'success', label: 'Ready to validate' };
  if (state.otpPending) return { tone: 'action', label: 'OTP needed' };
  if (state.hasError && state.attempts.length > 0) return { tone: 'failed', label: 'Not verified' };
  return null;
}
