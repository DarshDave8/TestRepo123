// Recovered from screenshot 147111 (left pane).
import type { GENDER, Relationship } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import { CkycSearchOption, CkycType, OvdType, SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';

export type CkycEnquiriesRequest = {
  searchAttemptedPhase: SearchAttemptedPhase;
  leadId: string;
};

export type CkycSearchRequest =
  | ICkycNumberSearchRequest
  | IOvdSearchRequest
  | IVerifiableCredentialsSearchRequest
  | IMobileSearchRequest
  | IPhotoSearchRequest // not in use
  | IDemographicSearchRequest; // not in use

export interface IBaseCkycSearchRequest {
  ckycType: CkycType;
  searchOption: CkycSearchOption;
  searchAttemptedPhase: SearchAttemptedPhase;
}

export interface ICkycNumberSearchRequest extends IBaseCkycSearchRequest {
  searchOption: CkycSearchOption.CKYC;
  idList: {
    ckycNo: string;
  };
}

export interface IOvdDetail {
  ovdType: OvdType;
  ovdNo: string;
  fullNameForAadhaar?: string;
  dob?: string;
  gender?: GENDER;
}

export interface IOvdSearchRequest extends IBaseCkycSearchRequest {
  searchOption: CkycSearchOption.OVD;
  idList: {
    ovdDetails: IOvdDetail[];
  };
}

export interface IVerifiableCredentialsSearchRequest extends IBaseCkycSearchRequest {
  searchOption: CkycSearchOption.VC;
  idList: {
    ckycAlias: string;
  };
}

export interface IMobileSearchRequest extends IBaseCkycSearchRequest {
  searchOption: CkycSearchOption.MOBILE;
  idList: {
    mobile: string;
  };
}

export interface IDemographicSearchRequest extends IBaseCkycSearchRequest {
  searchOption: CkycSearchOption.DEMOGRAPHIC;
  idList: {
    firstName: string;
    middleName?: string;
    lastName?: string;
    gender: GENDER;
    dob: string;
    relation: Relationship;
    relativeFirstName?: string;
    relativeMiddleName?: string;
    relativeLastName?: string;
  };
}

export interface IPhotoSearchRequest extends IBaseCkycSearchRequest {
  searchOption: CkycSearchOption.PHOTO;
  idList: {
    photo: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
}
