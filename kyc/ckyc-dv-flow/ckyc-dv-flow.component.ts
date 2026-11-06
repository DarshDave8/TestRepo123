// Rebuilt from commit 9689250e (diff photographs, 2026-11-03) over screenshot 147112.
// SOURCE GAP: lines the diff did not show are marked below; take this file from that branch, not from here.
// ngOnChanges and resolveCkycTrigger synced with the real file (photo 2026-11-04 17:27).
// isEditable, auto-submit emit and effect body from the other developer's diff (photos 2026-11-06).
import {
  Component,
  DestroyRef,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { finalize } from 'rxjs';
import { ProviderFetchStatus } from 'src/app/models/account.model';
import type { ICustomerBasicDetailsFetch } from 'src/app/nri/profile-creation/ckyc-flow/ckyc-flow.model';
import type { ICustomerBasicDetails } from 'src/app/nri/profile-creation/model/customer-basic-details.model';
import { ILeadDetails } from 'src/app/nri/workflow/models/lead.model';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { CkycConsentOverviewComponent } from '../ckyc-consent-overview/ckyc-consent-overview.component';
import { CkycOnboardingComponent } from '../ckyc-onboarding.component';
import { CkycValidatedCardComponent } from './ckyc-validated-card/ckyc-validated-card.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { infoIcon, sendIcon } from 'src/app/constants/icons.constants';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';
import { CkycSharedStateService } from '../services/ckyc-shared-state.service';
import { faL } from '@fortawesome/free-solid-svg-icons';
import { ICkycEnquiryListResponseBody } from '../models/ckyc-search-response.model';

@Component({
  selector: 'app-ckyc-dv-flow',
  // INFERRED: MatButtonModule for the new "Submit CKYC" button; the real imports array was not photographed.
  imports: [
    CkycConsentOverviewComponent,
    CkycOnboardingComponent,
    CkycValidatedCardComponent,
    FontAwesomeModule,
    MatButtonModule,
  ],
  templateUrl: './ckyc-dv-flow.component.html',
  styleUrl: './ckyc-dv-flow.component.scss',
})
export class CkycDvFlowComponent implements OnChanges {
  readonly infoIcon = infoIcon;
  readonly sendIcon = sendIcon;
  leadDetails = input<ILeadDetails>();
  searchAttemptedPhase = input<SearchAttemptedPhase>();
  isEditable = input<boolean>();
  finalSubmitted = output<boolean>();
  isShowCkycFlow = signal<boolean>(false);
  readonly flowState = inject(CkycFlowStateService);
  isShowEnquiries = false;
  readonly sharedService = inject(CkycSharedStateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(CkycAuthStateService);

  // Set when validate consent succeeds; the template then swaps the onboarding widget for the card.
  readonly validatedDetails = signal<ICustomerBasicDetails | null>(null);
  // Update-enquiry / submit running: Submit CKYC is disabled, so a second click cannot send it twice.
  readonly isSubmitting = signal(false);

  constructor() {
    effect(() => {
      if (this.flowState.isTriggerEnquiriesSuccess()) {
        // INFERRED: real line 50 (untracked) is hidden in the diff photo; lines 51-53 are visible.
        untracked(() => {
          this.isShowEnquiries = this.flowState.isTriggerEnquiriesSuccess();
        });
      }
      if (this.flowState.isDefaultSubmitTriggerSuccessful()) {
        untracked(() => {
          this.finalSubmitted.emit(true);
        });
      }
    });
    // This screen owns the CKYC flow in DV. The services are app-wide, so their state does not die with the
    // screen: reset all of it (and stop running calls) so the next lead starts clean.
    this.destroyRef.onDestroy(() => {
      this.authService.resetAuth();
      this.flowState.reset();
      this.sharedService.reset();
      this.flowState.isEditable.set(false);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leadDetails'] && changes['leadDetails'].currentValue) {
      this.resolveCkycTrigger();
    }
    if (changes['isEditable'] && changes['isEditable'].currentValue) {
      this.flowState.isEditable.set(this.isEditable()!);
    }
  }

  resolveCkycTrigger() {
    if (this.leadDetails()) {
      this.sharedService.setLeadId(this.leadDetails()!.leadId);
      this.sharedService.setLeadDetails(this.leadDetails()!);
      //only enable ckyc flow in dv if isCkyc2Attempted is false and isCkycNumberAvailable is false
      if (
        !this.leadDetails()!.customerProfile.ckycDetails?.isCkyc2Attempted &&
        !this.leadDetails()!.customerProfile.ckycDetails?.isCKycNumberAvailable
      ) {
        //show ckyc section in DV screen
        this.isShowCkycFlow.set(true);
        // trigger logic
        // update lead
      } else {
        this.isShowCkycFlow.set(false);
      }
    }
  }

  onCustomerBasicDetailsFetch(event: ICustomerBasicDetailsFetch): void {
    if (event.status === ProviderFetchStatus.SUCCESS && event.profileData) {
      this.validatedDetails.set(event.profileData);
      // A record was authenticated, so "none of these records pertains to the customer" no longer holds.
      this.sharedService.setIsCkycConsentChecked(false);
      this.sharedService.setIsDvCkycSubmitEnabled(true);
    }
  }

  // "None of these records pertains to the customer" checkbox: Submit and the confirmation follow the box.
  setNoMatchConfirmed(checked: boolean) {
    this.sharedService.setIsCkycConsentChecked(checked);
    this.sharedService.setIsDvCkycSubmitEnabled(checked);
  }

  onSubmit() {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.flowState
      .ckycDvSubmit()
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        // Leaving the screen mid-submit: no emit on a destroyed output.
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        if (res) {
          this.finalSubmitted.emit(true);
        }
      });
  }
  resolveEmptyEnquiryList() {}
}
