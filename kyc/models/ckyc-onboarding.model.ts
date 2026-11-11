// RECOVERED FROM IMAGE 10, 2026-10-29.
// SOURCE GAPS: the photo does not show the whole original model.
// Keep this as an archival transcription, not a complete production module.
import type { GENDER, ORIGIN_RELATION_BASED } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import type { ICkycEnquiryListResponseBody, ICkycSearchResult } from './ckyc-search-response.model';
import {
  AuthenticationMode,
  AuthFactor,
  CkycBusinessErrorPhase,
  CkycSearchOption,
  SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import { IResponse } from 'src/app/models/base-response.model';

export type CkycFlowStep = 'search' | 'enquiryReceived' | 'auth';
export type CkycSearchRenderer = 'FORM' | 'OVD';
export type CkycFieldType = 'text' | 'tel' | 'date' | 'select' | 'file';
export type CkycSearchValue = string | Date | File | null;
export type CkycFieldValues = Readonly<Record<string, CkycSearchValue>>;

export type CkycValidationType =
  | 'CKYC_NUMBER'
  | 'MOBILE'
  | 'NAME'
  | 'PHOTO'
  | 'VERIFIABLE_CREDENTIAL'
  | 'DOB'
  | 'AADHAAR_LAST_4'
  | 'DRIVING_LICENSE'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'MNREGA_JOB_CARD'
  | 'PAN';

export interface CkycFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface CkycFieldDefinition {
  readonly key: string;
  readonly apiKey: string;
  readonly label: string;
  readonly type: CkycFieldType;
  readonly placeholder?: string;
  readonly required: boolean;
  readonly maxLength?: number;
  readonly validationType?: CkycValidationType;
  readonly options?: readonly CkycFieldOption[];
}

export interface CkycOvdDefinition {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly CkycFieldDefinition[];
}

// SOURCE GAP: original lines ~57-60 and earlier/later model declarations omitted in photo.
// The following are visible tail fields of another interface but its name is not legible:
//   readonly order: number;
//   readonly renderer: CkycSearchRenderer;
//   readonly fields: readonly CkycFieldDefinition[];
//   readonly documents?: readonly CkycOvdDefinition[];
//   readonly isEnabled: boolean;

export interface CkycSavedOvd {
  readonly documentType: string;
  readonly documentLabel: string;
  readonly values: CkycFieldValues;
}

export interface IActiveMatchSelection {
  matchId?: string; // not require mostly to just maintain a unique id FE
  matchIndex: number;
  enquiryId: string; // search result's enquiry id
  enquiryResponseId: string | null; // search result's response id

  parentEnquiry: ICkycEnquiryListResponseBody;
  selectedResult: ICkycSearchResult;

  // Easily accessible Top-Level & Transaction Reference IDs
  otpLevelEnquiryId?: string;
  attemptId?: string | null; // need to know about it
  ckycRefNo: string | null; // perhaps not required
}

// export interface CkycEnquiryGroup {
//   readonly searchKey: string;
//   readonly latestTimestamp: string;
//   readonly enquiries: readonly ICkycEnquiryListResponseBody[];
// }

export interface CkycTransaction {
  readonly transaction: ICkycEnquiryListResponseBody;
}
export type CkycEnquiryGroups = Record<string, CkycTransaction[]>;

export type CkycRelatedPersonRelation = (typeof ORIGIN_RELATION_BASED)['SPOUSE' | 'FATHER' | 'MOTHER'];
export interface CkycRelatedPersonName {
  readonly firstName?: string;
  readonly middleName?: string;
  readonly lastName?: string;
}

export type CkycGender = GENDER;

// Continuation recovered from new screenshot 147110 (lines 121-195).
export type {
  IGetApplicableConsentTypesRequest,
  IRelationAuthFactor,
  IRelationAuthFactorValue,
  ITriggerConsentRequest,
  IValidateConsentRequest,
  TriggerConsentAuthFactor,
} from './ckyc-consent-request.model';

export type {
  IGetApplicableConsentTypesResponse,
  IGetApplicableConsentTypesResponseBody,
  ITriggerConsentResponse,
  ITriggerConsentResponseBody,
  IValidateConsentResponse,
} from './ckyc-consent-response.model';

export interface CkycBusinessError {
  phase: CkycBusinessErrorPhase;
  messages: string;
}

// auth related UI model
export interface AuthDomainState {
  loading: boolean; // modes loading or a validate call running
  error: string | null; // shown on the active auth screen
  attemptId: string | null; // may be it will be replaced with attemptid
}

// OTP send state and the channels the OTP can go to. Attempt counts live on the OTP node of the auth queue.
export interface OtpDomainState {
  generated: boolean;
  expiresAt: number | null;
  hasMobileNumber?: boolean; // INFERRED from screenshot usage
  hasEmailAddress?: boolean; // INFERRED from screenshot usage
  successMessage: string | null; // trigger-consent messages of the last OTP send, shown as a banner on the OTP screen
}

// ---- CKYC auth queue ----
// One node per consent call the flow may make (mode + factor), in fallback order.
// Which nodes exist, their order and their limits come from AUTH_CONFIG; a node only records what happened.

export type AuthNodeStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';

export interface ICkycAuthNodeConfig {
  id: string; // `${mode}` or `${mode}_${factor}`, e.g. 'FACEAUTH_DOB', 'OTP'
  mode: AuthenticationMode;
  subType: AuthFactor | null; // null = mode without factors (OTP)
  label: string; // shown in the consent status table
  order: number; // position in the queue, 0-based
  status: AuthNodeStatus;
  requiresTrigger: boolean; // from AUTH_CONFIG: false = no consent call, validate directly (CONSENT_AVAILABLE)
  autoTrigger: boolean; // from AUTH_CONFIG: call goes out on reaching the node, or waits for the user
  triggerSuccess: boolean | null; // null = not triggered yet (stays null when requiresTrigger is false)
  validateSuccess: boolean | null; // null = not validated yet
  triggerAttemptCount: number; // failed trigger calls
  maxTriggerAttempts: number | null; // from AUTH_CONFIG; null = unlimited
  validateAttemptCount: number; // failed validate calls
  maxValidateAttempts: number | null; // from AUTH_CONFIG; null = unlimited
  resendCount: number; // successful resends after the first send (OTP)
  maxResends: number | null; // from AUTH_CONFIG; null = no limit
  lastError: string | null;
}

// Trigger-Enquiries
export interface ITriggerEnquiriesRequest {
  leadId: string | null;
  searchAttemptedPhase: SearchAttemptedPhase;
}

export interface ITriggerEnquiriesResponse extends IResponse {
  body: ITriggerEnquiriesResponseBody;
}
export interface ITriggerEnquiriesResponseBody {
  messages: string[];
  recordsFound: number;
  searchOption?: CkycSearchOption;
  success: boolean;
}
