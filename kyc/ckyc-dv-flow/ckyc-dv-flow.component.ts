// Recovered from screenshot 147112 (left pane).
import { Component, input, signal } from '@angular/core';
import { ProviderFetchStatus } from 'src/app/models/account.model';
import type { ICustomerBasicDetailsFetch } from 'src/app/nri/profile-creation/ckyc-flow/ckyc-flow.model';
import type { ICustomerBasicDetails } from 'src/app/nri/profile-creation/model/customer-basic-details.model';
import { ILeadDetails } from 'src/app/nri/workflow/models/lead.model';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { CkycConsentOverviewComponent } from '../ckyc-consent-overview/ckyc-consent-overview.component';
import { CkycOnboardingComponent } from '../ckyc-onboarding.component';
import { CkycValidatedCardComponent } from './ckyc-validated-card/ckyc-validated-card.component';

@Component({
  selector: 'app-ckyc-dv-flow',
  imports: [CkycConsentOverviewComponent, CkycOnboardingComponent, CkycValidatedCardComponent],
  templateUrl: './ckyc-dv-flow.component.html',
  styleUrl: './ckyc-dv-flow.component.scss',
})
export class CkycDvFlowComponent {
  leadDetails = input<ILeadDetails>();
  searchAttemptedPhase = input<SearchAttemptedPhase>(SearchAttemptedPhase.DIGITAL_VERIFICATION);

  // Set when validate consent succeeds; the template then swaps the onboarding widget for the card.
  readonly validatedDetails = signal<ICustomerBasicDetails | null>(null);

  onCustomerBasicDetailsFetch(event: ICustomerBasicDetailsFetch): void {
    if (event.status === ProviderFetchStatus.SUCCESS && event.profileData) {
      this.validatedDetails.set(event.profileData);
    }
  }
}
