// Recovered from screenshot 147112 (left pane).
import { Component, computed, input, viewChild } from '@angular/core';
import { ILeadDetails } from 'src/app/nri/workflow/models/lead.model';
import { AuthenticationMode, AuthFactor, SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { CkycConsentOverviewComponent } from '../ckyc-consent-overview/ckyc-consent-overview.component';
import { CkycOnboardingComponent } from '../ckyc-onboarding.component';

@Component({
  selector: 'app-ckyc-dv-flow',
  imports: [CkycConsentOverviewComponent, CkycOnboardingComponent],
  templateUrl: './ckyc-dv-flow.component.html',
  styleUrl: './ckyc-dv-flow.component.scss',
})
export class CkycDvFlowComponent {
  private readonly onboarding = viewChild(CkycOnboardingComponent);
  readonly consentAttempts = computed(() => this.onboarding()?.ckycAuthState.consentAttempts() ?? []);
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;

  leadDetails = input<ILeadDetails>();
  searchAttemptedPhase = input<SearchAttemptedPhase>(SearchAttemptedPhase.DIGITAL_VERIFICATION);
}
