// Screenshot transcription: images 3 and 4 (2026-10-29), plus the DV submit logic of commit 9689250e.
// SOURCE GAP: not every original line is visible. Do not treat this as build-ready.
// SOURCE GAP: the real file also has triggerEnquiries() and triggerEnquiriesResponse (seen only in part in
// 9689250e); they are not transcribed here.
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, catchError, finalize, map, of, switchMap, takeUntil, type Observable } from 'rxjs';
import { CkycOnboardingService } from './ckyc-onboarding.service';
import {
  CkycSearchAction,
  CkycSearchOption,
  // SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import { CkycStepManager } from '../ckyc-step-manager';
import {
  CkycEnquiryGroups,
  CkycFieldValues,
  CkycFlowStep,
  CkycRelatedPersonName,
  CkycSavedOvd,
  IActiveMatchSelection,
} from '../models/ckyc-onboarding.model';
import { ICkycEnquiryListResponseBody, ICkycSearchResponse } from '../models/ckyc-search-response.model';
import { CkycEnquiriesRequest, CkycSearchRequest } from '../models/ckyc-search-request.model';
import { ICustomerBasicDetails } from '../../model/customer-basic-details.model';
import { CkycSharedStateService } from './ckyc-shared-state.service';
import { ISubmitCkycRequest, IUpdateEnquiry, IUpdateEnquiryRequest } from '../models/ckyc-consent-request.model';

type ServiceSearchRequest = Parameters<CkycOnboardingService['enquireCkyc']>[0];

// App-wide since 9689250e removed the onboarding component's providers (the DV flow screen injects it too).
// INFERRED: the real decorator was not photographed.
@Injectable({ providedIn: 'root' })
export class CkycFlowStateService {
  private readonly ckycApi = inject(CkycOnboardingService);
  private readonly stepManager = new CkycStepManager();
  private readonly ckycSharedStateService = inject(CkycSharedStateService);

  // navigation
  readonly step = this.stepManager.step;
  readonly selectedSearchOption = signal<CkycSearchOption | null>(CkycSearchOption.CKYC);

  // base signals
  readonly enquiries = signal<readonly ICkycEnquiryListResponseBody[]>([]);
  readonly activeMatchSelection = signal<IActiveMatchSelection | null>(null);
  readonly isTriggerEnquiriesSuccess = signal<boolean>(false); // set by triggerEnquiries() (not transcribed)

  // status signal
  readonly historyLoading = signal<boolean>(false);
  readonly historyError = signal<string | null>(null);
  readonly enquiryLoading = signal<boolean>(false);
  readonly enquiryError = signal<string | null>(null);

  private readonly validatedDetailsSubject = new Subject<ICustomerBasicDetails>();
  readonly validatedDetails$: Observable<ICustomerBasicDetails> = this.validatedDetailsSubject.asObservable();

  readonly savedOvds = signal<readonly CkycSavedOvd[]>([]);
  readonly searchValues = signal<CkycFieldValues>({});
  readonly relatedPersonValues = signal<CkycRelatedPersonName>({});
  readonly searchFileNames = signal<Readonly<Record<string, string>>>({});

  private clearFormSubject = new Subject<CkycSearchAction>();
  clearForm$ = this.clearFormSubject.asObservable();

  // Fired by reset(): drops responses still on the way, so they cannot fill the next lead's screen.
  // (takeUntilDestroyed would never fire here: an app-wide service is never destroyed.)
  private readonly reset$ = new Subject<void>();

  // Only enquiries that found at least one record, newest first.
  readonly displayedEnquiries = computed(() =>
    [...(this.enquiries() ?? [])]
      .filter((enquiry) => (enquiry.results?.length ?? 0) > 0)
      .sort((a, b) => {
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

  // An OVD search that found at least one record.
  readonly isAtleastOneOVDRecordPresent = computed<boolean>(() =>
    this.enquiries().some(
      (eachEnquiry) =>
        eachEnquiry.enquiryRequest.searchOption === CkycSearchOption.OVD && (eachEnquiry.results?.length ?? 0) > 0,
    ),
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

  // Submit action for the CKYC flow in DV.
  // If the user confirmed that none of the enquiries pertains to the customer, mark them so with update-enquiry
  // first, then submit; otherwise (or when there is nothing to mark) submit directly.
  ckycDvSubmit(): Observable<boolean> {
    if (!this.ckycSharedStateService.isCkycConsentChecked() || this.enquiries().length === 0) {
      return this.submitCkyc();
    }
    const updateEnquiryArray: IUpdateEnquiry[] = [];
    this.enquiries().forEach((eachResult) => {
      (eachResult.results ?? []).forEach((eachEnquiry) => {
        if (eachEnquiry) {
          updateEnquiryArray.push({
            enquiryId: eachEnquiry.enquiryId!,
            enquiryResponseId: eachEnquiry.enquiryResponseId!,
            isEnquiryBelongsCustomer: !this.ckycSharedStateService.isCkycConsentChecked(),
          });
        }
      });
    });
    const updateEnquiryRequest: IUpdateEnquiryRequest = {
      enquiries: updateEnquiryArray,
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase()!,
      leadId: this.ckycSharedStateService.leadDetails()?.leadId!,
    };
    return this.ckycApi.updateEnquiries(updateEnquiryRequest).pipe(
      // Submit only after the update succeeded.
      switchMap((res) => (res && res.success ? this.submitCkyc() : of(false))),
      catchError(() => {
        this.enquiryError.set('Unable to complete the request');
        return of(false);
      }),
      takeUntil(this.reset$),
    );
  }

  submitCkyc(): Observable<boolean> {
    const submitRequest: ISubmitCkycRequest = {
      enquiryId: '',
      enquiryResponseId: null,
      attemptId: null,
      leadId: this.ckycSharedStateService.leadDetails()?.leadId!, // both paths (9689250e set it only for a match)
    };
    if (this.activeMatchSelection()) {
      submitRequest.enquiryId = this.activeMatchSelection()?.enquiryId!;
      submitRequest.enquiryResponseId = this.activeMatchSelection()?.enquiryResponseId!;
      submitRequest.attemptId = this.activeMatchSelection()?.attemptId!;
    } else {
      // No active match selection (non-OVD): take the enquiry id of the first OVD search.
      const ovdEnquiry = this.enquiries().find(
        (enquiry) => enquiry.enquiryRequest.searchOption === CkycSearchOption.OVD,
      );
      if (ovdEnquiry) submitRequest.enquiryId = ovdEnquiry.enquiryId;
    }
    return this.ckycApi.submit(submitRequest).pipe(
      map((res) => {
        if (res?.success && res.body?.success) return true;
        // Request accepted but the submit refused: show why.
        if (res?.success) this.enquiryError.set(res.body?.messages?.join(', ') || 'Unable to submit CKYC.');
        return false;
      }),
      catchError(() => {
        this.enquiryError.set('Unable to complete the request');
        return of(false);
      }),
      takeUntil(this.reset$),
    );
  }

  loadEnquiries(): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    const request: CkycEnquiriesRequest = {
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase()!,
      leadId: this.ckycSharedStateService.leadId() ?? '',
    };
    this.enquiries.set([]);
    this.ckycApi
      .getEnquiries(request)
      .pipe(
        finalize(() => this.historyLoading.set(false)),
        takeUntil(this.reset$),
      )
      .subscribe({
        next: (response) => {
          if (response?.success) {
            if (response.body) {
              this.enquiries.set(response.body);
              // Nothing to authenticate (no enquiry found a record, so the list and the "none of these" box are
              // hidden): enable the DV Submit CKYC button.
              const anyRecord = response.body.some(
                (enquiry: ICkycEnquiryListResponseBody) => (enquiry.results?.length ?? 0) > 0,
              );
              if (!anyRecord) {
                this.ckycSharedStateService.setIsDvCkycSubmitEnabled(true);
              }
            }
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
        takeUntil(this.reset$),
      )
      .subscribe({
        next: (response: ICkycSearchResponse) => {
          if (response.success) {
            // No record for this search: say so and allow manual verification
            // (the list shows only enquiries with records).
            if (!response.body?.results?.length) {
              this.ckycSharedStateService.setManualVerificationEnabled(true);
              this.enquiryError.set('No result for the current enquiry');
            }
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
  goToStep(stepName: CkycFlowStep): void {
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
  // Back from the auth screens: also drop the match, so a later "Submit CKYC" never sends an abandoned match.
  returnToEnquiryReceived(): void {
    this.activeMatchSelection.set(null);
    this.stepManager.goTo('enquiryReceived');
  }

  /**
   * Back to the start: stops running requests and clears every signal, including the search form values.
   * Before 9689250e this service lived and died with the onboarding screen; it is app-wide now, so the screen
   * that owns the flow (DV flow, or onboarding in Profile Creation) calls this when it closes.
   * SOURCE GAP: the real file also has triggerEnquiriesResponse; reset it here too.
   */
  reset(): void {
    this.reset$.next();
    this.stepManager.goTo('search');
    this.selectedSearchOption.set(CkycSearchOption.CKYC);
    this.enquiries.set([]);
    this.activeMatchSelection.set(null);
    this.isTriggerEnquiriesSuccess.set(false);
    this.historyLoading.set(false);
    this.historyError.set(null);
    this.enquiryLoading.set(false);
    this.enquiryError.set(null);
    this.savedOvds.set([]);
    this.searchValues.set({});
    this.relatedPersonValues.set({});
    this.searchFileNames.set({});
  }
}
