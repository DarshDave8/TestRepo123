// Recovered from the photographed constants (lines 1-61).
// SOURCE GAP: the original constants file continues beyond the photograph.
// These are the enum members explicitly visible in that photograph.
import { GENDER, GenderDesc, ORIGIN_RELATION_BASED } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';

export enum SearchAttemptedPhase {
  PROFILE_CREATION = 'PROFILE_CREATION',
  DIGITAL_VERIFICATION = 'DIGITAL_VERIFICATION',
}
export enum CkycType {
  INDIVIDUAL = 'INDIVIDUAL',
}
export enum CkycSearchOption {
  CKYC = 'CKYC',
  OVD = 'OVD',
  PHOTO = 'PHOTO',
  VC = 'VC',
  DEMOGRAPHIC = 'DEMOGRAPHIC',
  MOBILE = 'MOBILE',
}
export enum OvdType {
  UID = 'UID',
  DRIVING_LICENCE = 'DRIVING_LICENCE',
  PASSPORT = 'PASSPORT',
  VOTER_ID = 'VOTER_ID',
  NREGA_JOBCARD = 'NREGA_JOBCARD',
  PAN = 'PAN',
}
export enum CkycStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}
export enum AuthenticationMode {
  OTP = 'OTP',
  MANUAL = 'PHYSICAL',
  FACEAUTH = 'FACEAUTH',
}
export enum AuthFactor {
  DOB = 'DOB',
  RELATION = 'RELATION',
  BIRTHYEARPINCODE = 'BIRTHYEARPINCODE',
}
export const CKYC_OTP_MAX_ATTEMPTS = 3;
export const CKYC_OTP_TTL_SECONDS = 60;

// ---- CKYC auth queue configuration ----

export type ModeConfiguration = {
  mode: AuthenticationMode;
  enabled: boolean;
  // Leave out for a mode with no factors (OTP): the mode gets one node.
  // If present: one node per factor set to true, in AuthFactor order (DOB -> RELATION -> BIRTHYEARPINCODE).
  // If every factor is false, the mode is skipped.
  factors?: Partial<Record<AuthFactor, boolean>>;
  // true  = the consent call goes out as soon as the queue reaches this node.
  // false = the node waits for the user (the "Trigger OTP" button).
  autoTrigger: boolean;
  // Failed trigger calls allowed on one node before moving to the next node. null = unlimited (user re-triggers).
  maxTriggerAttempts: number | null;
  // Failed validate calls allowed on one node. null = unlimited.
  maxValidateAttempts: number | null;
};

const ALL_FACTORS: Partial<Record<AuthFactor, boolean>> = {
  [AuthFactor.DOB]: true,
  [AuthFactor.RELATION]: true,
  [AuthFactor.BIRTHYEARPINCODE]: true,
};

// Per phase, the modes in fallback order. Only modes the backend returns AND enabled here are used.
// A new mode = one more entry, placed where it belongs in the order.
export const AUTH_CONFIG: Record<SearchAttemptedPhase, readonly ModeConfiguration[]> = {
  [SearchAttemptedPhase.DIGITAL_VERIFICATION]: [
    {
      mode: AuthenticationMode.MANUAL,
      enabled: true,
      factors: { ...ALL_FACTORS },
      autoTrigger: true,
      maxTriggerAttempts: 1,
      maxValidateAttempts: null,
    },
    {
      mode: AuthenticationMode.FACEAUTH,
      enabled: true,
      factors: { ...ALL_FACTORS },
      autoTrigger: true,
      maxTriggerAttempts: 1,
      maxValidateAttempts: null,
    },
    {
      mode: AuthenticationMode.OTP,
      enabled: true,
      autoTrigger: false,
      maxTriggerAttempts: null,
      maxValidateAttempts: CKYC_OTP_MAX_ATTEMPTS,
    },
  ],
  [SearchAttemptedPhase.PROFILE_CREATION]: [
    {
      mode: AuthenticationMode.OTP,
      enabled: true,
      autoTrigger: true,
      maxTriggerAttempts: 1,
      maxValidateAttempts: CKYC_OTP_MAX_ATTEMPTS,
    },
  ],
};

// Consent status table text: "<mode label> <factor label>", e.g. "Face auth with DOB".
export const AUTH_MODE_LABELS: Record<AuthenticationMode, string> = {
  [AuthenticationMode.FACEAUTH]: 'Face auth',
  [AuthenticationMode.OTP]: 'OTP consent',
  [AuthenticationMode.MANUAL]: 'Manual auth',
};
export const AUTH_FACTOR_LABELS: Record<AuthFactor, string> = {
  [AuthFactor.DOB]: 'with DOB',
  [AuthFactor.RELATION]: 'with relation',
  [AuthFactor.BIRTHYEARPINCODE]: 'with year of birth and pincode',
};

export const CKYC_CONSENT_TEXT = 'Placeholder CKYC consent text. The final approved consent declaration will replace this configuration without changing the flow.';

export const CKYC_GENDER_OPTIONS = Object.values(GENDER).map((value) => ({
  value,
  label: GenderDesc[value],
}));
export const RELATED_PERSON_RELATION_OPTIONS = [
  { value: ORIGIN_RELATION_BASED.SPOUSE, label: 'Spouse' },
  { value: ORIGIN_RELATION_BASED.FATHER, label: 'Father' },
  { value: ORIGIN_RELATION_BASED.MOTHER, label: 'Mother' },
] as const;

// SOURCE GAP: CKYC_SEARCH_METHODS and further original definitions are not
// completely visible, and have not been invented here.

// ---- Errors ----
// Where an error is shown: each part of the flow has its own alert, placed next to that part.
//   enquiry: under the search form · history: in the enquiry list · auth: in the active consent table
//   (or under the match card before a table is on screen) · submit: above Submit CKYC.
export type CkycErrorScope = 'enquiry' | 'history' | 'auth' | 'submit';

// Heading of the alert: names the part of the flow; the message under it says what happened.
export const CKYC_ERROR_TITLES: Record<CkycErrorScope, string> = {
  enquiry: 'CKYC search',
  history: 'Enquiry history',
  auth: 'Authentication',
  submit: 'CKYC submission',
};

// Our messages, used only when the backend sends no message of its own (see utils/ckyc-error.util.ts).
export const CKYC_ERROR_MESSAGES = {
  TRIGGER_ENQUIRIES_FAILED: 'We could not run the CKYC enquiries. Please retrigger them.',
  SEARCH_FAILED: 'We could not complete the CKYC search. Please try again.',
  NO_RECORD_FOUND: 'No CKYC record was found for this search.',
  HISTORY_LOAD_FAILED: 'We could not load the CKYC enquiry history. Please try again.',
  AUTH_MODES_LOAD_FAILED: 'We could not load the authentication methods for this record. Please try again.',
  NO_AUTH_METHODS: 'No authentication method is available for this record.',
  CONSENT_TRIGGER_FAILED: (label: string) => `${label} could not be sent. Please try again.`,
  CONSENT_VALIDATE_FAILED: 'We could not verify the consent. Please try again.',
  AUTH_METHODS_EXHAUSTED: (label: string) => `${label} failed. No other authentication method is available.`,
  OTP_VERIFY_FAILED: 'The OTP could not be verified. Check the code and try again.',
  OTP_MAX_ATTEMPTS: 'Maximum OTP attempts reached. This OTP can no longer be verified.',
  OTP_EXPIRED: 'The OTP has expired. Resend it to continue.',
  UPDATE_ENQUIRY_FAILED: 'We could not update the CKYC enquiries. Please try again.',
  SUBMIT_FAILED: 'We could not submit the CKYC details. Please try again.',
} as const;

// Why Submit CKYC is disabled (hint under the button in DV), one text per state of the flow.
export const CKYC_SUBMIT_HINTS = {
  ENQUIRIES_NOT_RUN: 'Trigger the CKYC enquiries above to continue.',
  ENQUIRIES_LOADING: 'Loading the CKYC enquiries…',
  CONFIRM_VALIDATED: 'Confirm the validated CKYC details above to submit.',
  AUTHENTICATE_OR_CONFIRM_NONE: 'Authenticate a matching record, or confirm above that none of them belongs to the customer.',
  AUTHENTICATE: 'Authenticate a matching record to submit.',
} as const;
