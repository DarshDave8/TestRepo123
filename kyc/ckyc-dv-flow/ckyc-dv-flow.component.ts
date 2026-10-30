// Recovered from screenshot 147112 (left pane).
import { Component, input } from '@angular/core';
import { ILeadDetails } from 'src/app/nri/workflow/models/lead.model';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { CkycConsentOverviewComponent } from '../ckyc-consent-overview/ckyc-consent-overview.component';
import { CkycOnboardingComponent } from '../ckyc-onboarding.component';

@Component({
  selector: 'app-ckyc-dv-flow',
  imports: [CkycConsentOverviewComponent, CkycOnboardingComponent],
  templateUrl: './ckyc-dv-flow.component.html',
  styleUrl: './ckyc-dv-flow.component.scss',
})
export class CkycDvFlowComponent {
  leadDetails = input<ILeadDetails>();
  searchAttemptedPhase = input<SearchAttemptedPhase>(SearchAttemptedPhase.DIGITAL_VERIFICATION);
}
