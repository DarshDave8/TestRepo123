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

// Simple on/off switches for Digital Verification (OTP + FACE) factor consent.
// masterEnabled = false -> old behaviour, the factor flags below are ignored.
// masterEnabled = true  -> try DOB, then RELATION, then BIRTHYEARPINCODE (only the ones set to true),
//                          then fall back to OTP.
export const CKYC_DV_FACTOR_FLAGS = {
  masterEnabled: false,
  dob: true,
  relation: true,
  birthYearPincode: true,
};

export const CKYC_CONSENT_TEXT = 'Placeholder CKYC consent text. The final approved consent declaration will replace this configuration without changing the flow.';

export const NON_OTP_FACTORS = [
  { value: AuthFactor.DOB, label: 'DOB' },
  { value: AuthFactor.BIRTHYEARPINCODE, label: 'Year of birth and pincode' },
  { value: AuthFactor.RELATION, label: 'Father / Mother / Spouse name' },
] as const;

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
