// RECOVERED FROM IMAGE 10, 2026-10-29.
// SOURCE GAPS: the photo does not show the whole original model.
// Keep this as an archival transcription, not a complete production module.
import type { GENDER, ORIGIN_RELATION_BASED } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import type { TriggerConsentAuthFactor } from './ckyc-consent-request.model';
import type { ICkycEnquiryListResponseBody, ICkycSearchResult } from './ckyc-search-response.model';
import {
  AuthenticationMode,
  CkycBusinessErrorPhase,
  CkycSearchOption,
  CkycWorkflowStatus,
  SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import { CkycSearchRequest } from './ckyc-search-request.model';
// The response body type is re-exported below; local use is type-only.
import type { IGetApplicableConsentTypesResponseBody } from './ckyc-consent-response.model';
import { IResponse } from 'src/app/models/base-response.model';

export type CkycFlowStep = 'search' | 'enquiryReceived' | 'otp' | 'face' | 'manual';
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

export interface NonOtpAuthenticationPayload {
  readonly authFactors: readonly TriggerConsentAuthFactor[];
  readonly file: File | null;
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

// UI interface
export interface CkycFlowState {
  status: CkycWorkflowStatus | null;
  businessError: CkycBusinessError | null;
  // Search and enquiry data
  searchQuery: CkycSearchRequest | null;
  enquiries: ICkycEnquiryListResponseBody[] | [];
  // selected enquiry representing the transaction
  selectedEnquiry: ICkycEnquiryListResponseBody | null;
  // which result is selected for authentication
  selectedSearchResult: ICkycSearchResult | null;
  // applicable authentication type on the above selected search result
  applicableConsentTypes: IGetApplicableConsentTypesResponseBody | null;
  // which authentication type is chosen
  selectedAuthenticationMode: AuthenticationMode | null;
  // otp related data
  otpGenerated: boolean | null;
  otpAttemptsMade: number | null;
  otpExpiresAt: number | null;
}

export interface CkycBusinessError {
  phase: CkycBusinessErrorPhase;
  messages: string;
}

// auth related UI model
export interface AuthDomainState {
  loading: boolean;
  error: string | null;
  attemptId: string | null; // may be it will be replaced with attemptid
  applicableModes: AuthenticationMode[];
  activeMode: AuthenticationMode | null;
}

export interface OtpDomainState {
  loading: boolean;
  error: string | null;
  generated: boolean;
  expiresAt: number | null;
  mobileNumber: string | null;
  otpAttemptCount: number;
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
