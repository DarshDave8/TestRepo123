import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProviderFetchStatus } from 'src/app/models/account.model';
import type { ICustomerBasicDetailsFetch } from 'src/app/nri/profile-creation/ckyc-flow/ckyc-flow.model';
import { CkycEnquiryListComponent } from './ckyc-enquiry-list/ckyc-enquiry-list.component';
import { CkycFaceAuthenticationComponent } from './ckyc-face-authentication/ckyc-face-authentication.component';
import { CkycStepOtpComponent } from './ckyc-step-otp/ckyc-step-otp.component';
import { NonOtpAuthenticationComponent } from './non-otp-authentication/non-otp-authentication.component';
import { CkycFlowStateService } from './services/ckyc-flow-state.service';
import { CkycSearchV2Component } from './ckyc-search-v2/ckyc-search-v2.component';
import { SearchAttemptedPhase } from './constants/ckyc-onboarding.constants';
import { CkycAuthStateService } from './services/ckyc-auth-state.service';
import { CkycErrorAlertComponent } from './ckyc-error-alert/ckyc-error-alert.component';
import { CkycSharedStateService } from './services/ckyc-shared-state.service';
import { CkycEnquiryDetailsComponent } from './ckyc-enquiry-list/ckyc-enquiry-details/ckyc-enquiry-details.component';

@Component({
  selector: 'app-ckyc-onboarding',
  standalone: true,
  imports: [
    CkycEnquiryListComponent,
    CkycStepOtpComponent,
    NonOtpAuthenticationComponent,
    CkycFaceAuthenticationComponent,
    CkycSearchV2Component,
    CkycErrorAlertComponent,
    CkycEnquiryDetailsComponent,
  ],
  providers: [CkycFlowStateService, CkycAuthStateService],
  templateUrl: './ckyc-onboarding.component.html',
  styleUrl: './ckyc-onboarding.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycOnboardingComponent implements OnInit {
  readonly flow = inject(CkycFlowStateService);
  readonly ckycAuthState = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly registeredMobileNumber = input<string | undefined>();
  readonly searchAttemptedPhase = input<SearchAttemptedPhase>(SearchAttemptedPhase.PROFILE_CREATION);
  readonly leadId = input<string | null>();
  readonly customerBasicDetailsFetch = output<ICustomerBasicDetailsFetch>();
  readonly ckycSharedStateService = inject(CkycSharedStateService);
  phase = SearchAttemptedPhase;
  // 2. Combine your signals into a single computed signal
  readonly hasAnyError = computed(() => {
    const enquiryListError = this.flow.historyError();
    const enquiryError = this.flow.enquiryError();
    // const otpError = this.flow.otpError();
    return enquiryListError || enquiryError;
  });
  constructor() {
    effect(() => {
      const hasError = this.hasAnyError();
      if (hasError)
        untracked(() => {
          this.customerBasicDetailsFetch.emit({ status: ProviderFetchStatus.FAILURE });
        });
    });
    effect(() => {
      if (this.ckycSharedStateService.isManualVerificationEnabled()) {
        console.log('fired');
        untracked(() => {
          this.customerBasicDetailsFetch.emit({ status: ProviderFetchStatus.FAILURE });
        });
      }
    });
    this.destroyRef.onDestroy(() => {
      this.ckycSharedStateService.setManualVerificationEnabled(false);
    });
  }
  ngOnInit(): void {
    this.ckycSharedStateService.setManualVerificationEnabled(false);
    this.flow.registeredMobileNumber.set(this.registeredMobileNumber() ?? null);
    this.ckycSharedStateService.setSearchAttemptedPhase(this.searchAttemptedPhase());
    this.ckycSharedStateService.setLeadId(this.leadId()!);
    this.flow.validatedDetails$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((profileData) => {
      this.customerBasicDetailsFetch.emit({ status: ProviderFetchStatus.SUCCESS, profileData });
    });
    this.flow.loadEnquiries();
  }
}
