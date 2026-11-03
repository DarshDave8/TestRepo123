import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NRI_FLOW } from 'src/app/constants/api.constants';
import type {
  IGetApplicableConsentTypesRequest,
  ISubmitCkycRequest,
  ITriggerConsentRequest,
  IUpdateEnquiryRequest,
  IValidateConsentRequest,
} from '../models/ckyc-consent-request.model';
import type {
  IGetApplicableConsentTypesResponse,
  ISubmitCkycResponse,
  ITriggerConsentResponse,
  IUpdateEnquiryResponse,
  IValidateConsentResponse,
} from '../models/ckyc-consent-response.model';
import type { CkycEnquiriesRequest, CkycSearchRequest } from '../models/ckyc-search-request.model';
import type { ICkycEnquiryListResponse, ICkycSearchResponse } from '../models/ckyc-search-response.model';
import { ITriggerEnquiriesRequest, ITriggerEnquiriesResponse } from '../models/ckyc-onboarding.model';

@Injectable({ providedIn: 'root' })
export class CkycOnboardingService {
  constructor(private readonly httpClient: HttpClient) {}

  enquireCkyc(req: CkycSearchRequest): Observable<ICkycSearchResponse> {
    return this.httpClient.post<ICkycSearchResponse>(NRI_FLOW.CKYC_FLOW_V2.ENQUIRY, req);
  }
  getEnquiries(req: CkycEnquiriesRequest): Observable<ICkycEnquiryListResponse> {
    return this.httpClient.post<ICkycEnquiryListResponse>(NRI_FLOW.CKYC_FLOW_V2.ENQUIRIES, req);
  }
  getApplicableAuthenticationModes(
    req: IGetApplicableConsentTypesRequest,
  ): Observable<IGetApplicableConsentTypesResponse> {
    return this.httpClient.post<IGetApplicableConsentTypesResponse>(
      NRI_FLOW.CKYC_FLOW_V2.GET_AUTHENTICATION_MODES,
      req,
    );
  }
  triggerConsent(req: ITriggerConsentRequest): Observable<ITriggerConsentResponse> {
    return this.httpClient.post<ITriggerConsentResponse>(NRI_FLOW.CKYC_FLOW_V2.TRIGGER_CONSENT, req);
  }
  reSendOtp(req: ITriggerConsentRequest): Observable<ITriggerConsentResponse> {
    return this.httpClient.post<ITriggerConsentResponse>(NRI_FLOW.CKYC_FLOW_V2.RESEND_OTP, req);
  }
  validateConsent(req: IValidateConsentRequest): Observable<IValidateConsentResponse> {
    return this.httpClient.post<IValidateConsentResponse>(NRI_FLOW.CKYC_FLOW_V2.VALIDATE_CONSENT, req);
  }
  triggerEnquiries(req: ITriggerEnquiriesRequest): Observable<ITriggerEnquiriesResponse> {
    return this.httpClient.post<ITriggerEnquiriesResponse>(NRI_FLOW.CKYC_FLOW_V2.TRIGGER_ENQUIRIES_URL, req);
  }
  updateEnquiries(req: IUpdateEnquiryRequest): Observable<IUpdateEnquiryResponse> {
    return this.httpClient.post<IUpdateEnquiryResponse>(NRI_FLOW.CKYC_FLOW_V2.UPDATE_ENQUIRY_URL, req);
  }
  submit(req: ISubmitCkycRequest): Observable<ISubmitCkycResponse> {
    return this.httpClient.post<ISubmitCkycResponse>(NRI_FLOW.CKYC_FLOW_V2.SUBMIT_URL, req);
  }
}
