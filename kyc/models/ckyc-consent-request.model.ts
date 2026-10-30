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
  authFactors: AuthFactor | null;
  mobileNumber?: string; // Selected CKYC OTP destination; backend contract pending.
}

export interface IValidateConsentRequest {
  attemptId: string;
  consentType: AuthenticationMode;
  consentData: IConsentData;
  searchAttemptedPhase: SearchAttemptedPhase;
}

export interface IConsentData {
  otp?: string;
  otpIdentifier?: string;
  Photo?: string;
  file?: string;
}
