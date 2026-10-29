// Screenshot transcription: images 3 and 4 (2026-10-29).
// SOURCE GAP: not every original line is visible. Do not treat this as build-ready.
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, finalize, type Observable } from 'rxjs';
import { CkycOnboardingService } from './ckyc-onboarding.service';
import {
  AuthenticationMode,
  CKYC_OTP_MAX_ATTEMPTS,
  CkycSearchAction,
  CkycSearchOption,
  // SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import { CkycStepManager } from '../ckyc-step-manager';
import {
  CkycEnquiryGroups,
  CkycFieldValues,
  CkycRelatedPersonName,
  CkycSavedOvd,
  IActiveMatchSelection,
  IGetApplicableConsentTypesResponseBody,
  ITriggerConsentResponse,
  IValidateConsentResponse,
  NonOtpAuthenticationPayload,
} from '../models/ckyc-onboarding.model';
import { ICkycEnquiryListResponseBody, ICkycSearchResponse } from '../models/ckyc-search-response.model';
import { CkycEnquiriesRequest, CkycSearchRequest } from '../models/ckyc-search-request.model';
import { ICustomerBasicDetails } from '../../../model/customer-basic-details.model';
import { CkycSearchPhaseService } from './ckyc-search-phase.service';

type ServiceSearchRequest = Parameters<CkycOnboardingService['enquireCkyc']>[0];

@Injectable()
export class CkycFlowStateService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ckycApi = inject(CkycOnboardingService);
  private readonly stepManager = new CkycStepManager();
  private readonly ckycSearchPhaseService = inject(CkycSearchPhaseService);

  // navigation
  readonly step = this.stepManager.step;
  readonly selectedSearchOption = signal<CkycSearchOption | null>(CkycSearchOption.CKYC);

  // base signals
  readonly enquiries = signal<readonly ICkycEnquiryListResponseBody[]>([]);
  readonly activeMatchSelection = signal<IActiveMatchSelection | null>(null);

  // status signal
  readonly historyLoading = signal<boolean>(false);
  readonly historyError = signal<string | null>(null);
  readonly enquiryLoading = signal<boolean>(false);
  readonly enquiryError = signal<string | null>(null);

  private readonly validatedDetailsSubject = new Subject<ICustomerBasicDetails>();
  readonly validatedDetails: Observable<ICustomerBasicDetails> = this.validatedDetailsSubject.asObservable();

  readonly savedOvds = signal<readonly CkycSavedOvd[]>([]);
  readonly searchValues = signal<CkycFieldValues>({});
  readonly relatedPersonValues = signal<CkycRelatedPersonName>({});
  readonly searchFileNames = signal<Readonly<Record<string, string>>>({});
  readonly registeredMobileNumber = signal<string | null>(null);
  readonly selectedOtpMobileNumber = signal<string | null>(null);
  readonly authenticationModesError = signal<string | null>(null);

  // search attempt phase
  // readonly searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);

  explicitNonOtpSelection = false;
  readonly otpChannel = computed<'MOBILE' | 'EMAIL'>(() =>
    this.selectedOtpMobileNumber() || this.applicableConsentTypes()?.hasMobileNumber ? 'MOBILE' : 'EMAIL',
  );
  readonly applicableConsentTypes = signal<IGetApplicableConsentTypesResponseBody | null>(null);
  readonly applicableConsentTypesLoading = signal(false);
  readonly applicableConsentTypesError = signal<string | null>(null);
  readonly consentAccepted = signal(false);
  readonly selectedAuthenticationType = signal<AuthenticationMode | null>(null);
  readonly otpAttemptsMade = signal(0);
  readonly otpMaxAttempts = CKYC_OTP_MAX_ATTEMPTS;
  readonly otpGenerated = signal(false);
  readonly otpTriggerResponse = signal<ITriggerConsentResponse | null>(null);
  readonly otpError = signal<string | null>(null);
  readonly otpExpiresAt = signal<number | null>(null);
  readonly validatedCustomerDetails = signal<IValidateConsentResponse['body'] | null>(null);
  readonly otpValidationSucceeded = computed(() => this.validatedCustomerDetails() !== null);
  readonly manualPayload = signal<NonOtpAuthenticationPayload | null>(null);
  private clearFormSubject = new Subject<CkycSearchAction>();
  clearForm$ = this.clearFormSubject.asObservable();

  readonly displayedEnquiries = computed(() =>
    [...(this.enquiries() ?? [])].sort((a, b) => {
      const timestampA = this.getTimestamp(a);
      const timestampB = this.getTimestamp(b);
      // Enquiries without a valid timestamp go to the bottom
      if (timestampA === null && timestampB === null) return 0;
      if (timestampA === null) return 1;
      if (timestampB === null) return -1;
      // Newest first
      return timestampB - timestampA;
    }),
  );

  readonly enquiryGroups = computed<CkycEnquiryGroups>(() => {
    const grouped: CkycEnquiryGroups = {};
    for (const enquiry of this.displayedEnquiries()) {
      const searchOption = enquiry.enquiryRequest?.searchOption ?? '';
      if (!grouped[searchOption]) {
        grouped[searchOption] = [];
      }
      grouped[searchOption].push({
        transaction: enquiry,
      });
    }
    return grouped;
  });

  readonly otpExhausted = computed(() => this.otpAttemptsMade() >= this.otpMaxAttempts);
  readonly remainingOtpAttempts = computed(() => Math.max(0, this.otpMaxAttempts - this.otpAttemptsMade()));
  readonly availableAuthOptions = computed<readonly AuthenticationMode[]>(() => {
    const response = this.applicableConsentTypes();
    if (!response?.success || !Array.isArray(response.applicableConsentTypes)) return [];
    const hasOtpChannel =
      response.hasMobileNumber || response.hasEmailAddress || Boolean(this.selectedOtpMobileNumber());
    return response.applicableConsentTypes.filter(
      (mode) => mode !== AuthenticationMode.OTP || (hasOtpChannel && !this.otpExhausted()),
    );
  });

  loadEnquiries(): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    const request: CkycEnquiriesRequest = {
      searchAttemptedPhase: this.ckycSearchPhaseService.searchAttemptedPhase(),
      leadId: this.ckycSearchPhaseService.leadId() ?? '',
    };
    this.ckycApi
      .getEnquiries(request)
      .pipe(
        finalize(() => this.historyLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (response?.success) {
            this.enquiries.set(response.body);
          } else {
            this.historyError.set(response?.messages ? response?.messages.join(',') : 'Unable to load CKYC enquiries.');
          }
        },
        error: () => {
          this.historyError.set('Unable to load CKYC enquiries.');
        },
      });
  }

  enquire(request: CkycSearchRequest): void {
    this.enquiryLoading.set(true);
    this.enquiryError.set(null);
    this.ckycApi
      .enquireCkyc(request as ServiceSearchRequest)
      .pipe(
        finalize(() => this.enquiryLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response: ICkycSearchResponse) => {
          if (response.success) {
            this.stepManager.goTo('enquiryReceived');
            this.loadEnquiries();
          } else {
            this.enquiryError.set(
              response?.messages ? response?.messages.join(',') : 'Unable to execute CKYC search enquiry',
            );
          }
        },
        error: () => {
          this.enquiryError.set('Unable to execute CKYC search enquiry');
        },
      });
  }

  // SOURCE GAP: screenshot 4 does not show the entire comment near lines 178-183.
  // The mobile dialog / mode-selection explanation is partially clipped.

  matchId(enquiry: ICkycEnquiryListResponseBody, matchIndex: number): string {
    const match = enquiry.results[matchIndex];
    return [enquiry.searchKey ?? '', match?.enquiryId ?? '', match?.ckycRefNo ?? '', matchIndex].join(':');
  }

  private getTimestamp(enquiry: ICkycEnquiryListResponseBody): number | null {
    const timestamp = enquiry.enquiryTimestamp || enquiry.lastUpdatedDate;
    if (!timestamp) return null;
    const parsedTimestamp = Date.parse(timestamp);
    return Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
  }

  triggerSearchAction(action: CkycSearchAction) {
    this.clearFormSubject.next(action);
  }
  goToStep(stepName: 'search' | 'enquiryReceived' | 'otp' | 'face' | 'manual'): void {
    this.stepManager.goTo(stepName);
  }
  /**
   * Sets the currently selected enquiry transaction body and specific search result match
   */
  setActiveMatch(enquiry: ICkycEnquiryListResponseBody, matchIndex: number): void {
    const selectedResult = enquiry.results?.[matchIndex];
    if (!selectedResult) {
      return;
    }
    const selection: IActiveMatchSelection = {
      matchIndex,
      enquiryId: selectedResult.enquiryId,
      parentEnquiry: enquiry,
      selectedResult,
      attemptId: enquiry.attemptId ?? null,
      enquiryResponseId: selectedResult.enquiryResponseId ?? null,
      ckycRefNo: selectedResult.ckycRefNo ?? null,
    };
    this.activeMatchSelection.set(selection);
  }
  emitValidatedDetails(details: ICustomerBasicDetails): void {
    this.validatedDetailsSubject.next(details);
  }
  returnToEnquiryReceived(): void {
    this.selectedAuthenticationType.set(null);
    this.stepManager.goTo('enquiryReceived');
  }
}
