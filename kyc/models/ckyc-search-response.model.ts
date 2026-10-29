// Recovered from screenshot 147111 (right pane).
import type { IResponse } from 'src/app/models/base-response.model';
import type { GENDER } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import { CkycSearchRequest } from './ckyc-search-request.model';

export interface ICkycSearchResponse extends IResponse {
  body: ICkycSearchResponseBody;
}
export interface ICkycSearchResponseBody {
  searchKey: string;
  results: ICkycSearchResult[];
}
export interface ICkycEnquiryListResponse extends IResponse {
  body: ICkycEnquiryListResponseBody[];
}
export interface ICkycEnquiryListResponseBody {
  attemptId?: string;
  results: ICkycSearchResult[];
  searchKey: string;
  enquiryRequest: CkycSearchRequest;
  enquiryTimestamp?: string;
  lastUpdatedDate?: string;
}
export interface ICkycSearchResult {
  enquiryId?: string;
  enquiryResponseId?: string;
  enquiryTimestamp?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  gender?: GENDER;
  photo?: string;
  photoExt?: string;
  docSubmitted?: ISubmittedDocument[];
  lastUpdatedDate?: string;
  mobile?: string;
  email?: string;
  ckycRefNo?: string;
  status?: string;
}
export interface ISubmittedDocument {
  documentName: string;
  isMatchedOvd: boolean;
  matchedOvdNumber?: string;
}
