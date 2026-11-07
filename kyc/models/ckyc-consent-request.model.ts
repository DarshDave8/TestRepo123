// Transcribed from the user-provided consent request model screenshot (2026-10-29).
import { AuthFactor, AuthenticationMode, SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';

export interface IGetApplicableConsentTypesRequest {
  enquiryId: string;
  enquiryResponseId: string;
  leadId: string | null;
  searchAttemptedPhase: SearchAttemptedPhase;
}

export interface IDobAuthFactor {
  authFactor: AuthFactor.DOB;
  authValue: string;
}
export interface IRelationAuthFactor {
  authFactor: AuthFactor.RELATION;
  authFactorValueObj: IRelationAuthFactorValue;
}
export interface IRelationAuthFactorValue {
  firstName: string;
  middleName?: string;
  lastName: string;
  relationName: string;
}
export interface IBirthYearPincodeAuthFactor {
  authFactor: AuthFactor.BIRTHYEARPINCODE;
  authFactorValueObj: IBirthYearPincodeAuthFactorValue;
}
export interface IBirthYearPincodeAuthFactorValue {
  year: string;
  pincode: string;
}
export type TriggerConsentAuthFactor =
  | IDobAuthFactor
  | IRelationAuthFactor
  | IBirthYearPincodeAuthFactor;

export interface ITriggerConsentRequest {
  attemptId: string;
  consentType: AuthenticationMode;
  searchAttemptedPhase: SearchAttemptedPhase;
  leadId?: string;
  authFactor: AuthFactor | null;
}

export interface IValidateConsentRequest {
  attemptId: string;
  consentType: AuthenticationMode | null; // null: consent already given (isConsentGiven), no auth mode used
  leadId: string | null;
  consentData: IConsentData;
  searchAttemptedPhase: SearchAttemptedPhase;
}

export interface IConsentData {
  otp?: string;
  otpIdentifier?: OtpIdentifier;
  Photo?: string;
  file?: string;
}

// Confirmed from the model photograph supplied 2026-11-03.
export enum OtpIdentifierEnum {
  EMAIL = 'EMAIL',
  MOBILE = 'MOBILE',
}
export type OtpIdentifier = OtpIdentifierEnum; // right-hand side cut off in the photograph; INFERRED as the enum
// DV submit (commit 9689250e): mark enquiries as not the customer's, then submit.
export interface IUpdateEnquiry {
  enquiryId: string;
  enquiryResponseId: string;
  isEnquiryBelongsCustomer: boolean;
}
export interface IUpdateEnquiryRequest {
  enquiries: IUpdateEnquiry[];
  searchAttemptedPhase: SearchAttemptedPhase;
  leadId: string;
}
export interface ISubmitCkycRequest {
  enquiryId: string;
  enquiryResponseId: string | null;
  attemptId: string | null;
  leadId: string;
}
