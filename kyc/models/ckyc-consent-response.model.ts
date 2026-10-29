// Transcribed from the user-provided consent response model screenshot (2026-10-29).
import type { IResponse } from 'src/app/models/base-response.model';
import type { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import type { ICustomerBasicDetails } from '../model/customer-basic-details.model';

export interface IGetApplicableConsentTypesResponse extends IResponse {
  body: IGetApplicableConsentTypesResponseBody;
}
export interface IGetApplicableConsentTypesResponseBody {
  attemptId: string;
  isConsentGiven: boolean;
  applicableConsentTypes: Array<AuthenticationMode>;
  hasEmailAddress: boolean;
  hasMobileNumber: boolean;
  timeStamp: string;
  mobile?: string;
  success: boolean;
}

export interface ITriggerConsentResponse extends IResponse {
  body: ITriggerConsentResponseBody;
}
export interface ITriggerConsentResponseBody {
  attemptId: string;
  consentType: AuthenticationMode;
  timeStamp: string;
}
export interface IValidateConsentResponse extends IResponse {
  body: ICustomerBasicDetails;
}
