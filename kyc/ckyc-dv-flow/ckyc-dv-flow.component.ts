// Rebuilt from commit 9689250e (diff photographs, 2026-11-03) over screenshot 147112.
// SOURCE GAP: lines the diff did not show are marked below; take this file from that branch, not from here.
import { Component, DestroyRef, OnChanges, SimpleChanges, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ProviderFetchStatus } from 'src/app/models/account.model';
import type { ICustomerBasicDetailsFetch } from 'src/app/nri/profile-creation/ckyc-flow/ckyc-flow.model';
import type { ICustomerBasicDetails } from 'src/app/nri/profile-creation/model/customer-basic-details.model';
import { ILeadDetails } from 'src/app/nri/workflow/models/lead.model';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { CkycConsentOverviewComponent } from '../ckyc-consent-overview/ckyc-consent-overview.component';
import { CkycOnboardingComponent } from '../ckyc-onboarding.component';
import { CkycValidatedCardComponent } from './ckyc-validated-card/ckyc-validated-card.component';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';
import { CkycSharedStateService } from '../services/ckyc-shared-state.service';

@Component({
  selector: 'app-ckyc-dv-flow',
  // INFERRED: MatButtonModule for the new "Submit CKYC" button; the real imports array was not photographed.
  imports: [CkycConsentOverviewComponent, CkycOnboardingComponent, CkycValidatedCardComponent, MatButtonModule],
  templateUrl: './ckyc-dv-flow.component.html',
  styleUrl: './ckyc-dv-flow.component.scss',
})
export class CkycDvFlowComponent implements OnChanges {
  leadDetails = input<ILeadDetails>();
  searchAttemptedPhase = input<SearchAttemptedPhase>();
  finalSubmitted = output<boolean>();
  isShowCkycFlow = signal<boolean>(false);
  readonly flowState = inject(CkycFlowStateService);
  isShowEnquiries = false;
  readonly sharedService = inject(CkycSharedStateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(CkycAuthStateService);

  // Set when validate consent succeeds; the template then swaps the onboarding widget for the card.
  readonly validatedDetails = signal<ICustomerBasicDetails | null>(null);

  constructor() {
    effect(() => {
      if (this.flowState.isTriggerEnquiriesSuccess()) {
        // SOURCE GAP: effect body not shown in the diff (real lines 29-46).
      }
    });
    // The flow and auth services are app-wide: reset them when this screen goes away.
    this.destroyRef.onDestroy(() => {
      this.sharedService.setLeadId(null);
      this.isShowCkycFlow.set(false);
      this.flowState.activeMatchSelection.set(null);
      this.authService.resetAuth();
      this.flowState.goToStep('search');
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leadDetails'] && changes['leadDetails'].currentValue) {
      // SOURCE GAP: body not shown in the diff (real lines 60-62).
    }
  }

  resolveCkycTrigger() {
    if (this.leadDetails()) {
      this.sharedService.setLeadId(this.leadDetails()!.leadId);
      this.sharedService.setLeadDetails(this.leadDetails()!);
      // only enable ckyc flow in dv if isCkyc2Attempted is false and isCkycNumberAvailable is false
      if (
        !this.leadDetails()!.customerProfile.ckycDetails?.isCkyc2Attempted
        // SOURCE GAP: rest of the condition not shown in the diff (real lines 70-72).
      ) {
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
      this.sharedService.setIsDvCkycSubmitEnabled(true);
    }
  }

  // "None of these records pertains to the customer" checkbox: enables Submit and records the confirmation.
  toggleEnableSubmit() {
    this.sharedService.isDvCkycSubmitEnabled()
      ? this.sharedService.setIsDvCkycSubmitEnabled(false)
      : this.sharedService.setIsDvCkycSubmitEnabled(true);
    this.sharedService.isCkycConsentChecked()
      ? this.sharedService.setIsCkycConsentChecked(false)
      : this.sharedService.setIsCkycConsentChecked(true);
  }

  onSubmit() {
    this.flowState.ckycDvSubmit().subscribe((res) => {
      if (res) {
        this.finalSubmitted.emit(true);
      }
    });
  }
}
