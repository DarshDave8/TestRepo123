// Recovered from screenshot 147112 (left pane).
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
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
  private readonly injector = inject(Injector);
  leadDetails = input<ILeadDetails>();
  searchAttemptedPhase = input<SearchAttemptedPhase>(SearchAttemptedPhase.DIGITAL_VERIFICATION);

  // Set when validate consent succeeds; the template then switches to the verified (CKYC) view.
  readonly validatedDetails = signal<ICustomerBasicDetails | null>(null);
  readonly ckycNumber = computed(() => this.leadDetails()?.customerProfile?.ckycDetails?.ckycNumber || null);
  private readonly verifiedHeading = viewChild<ElementRef<HTMLElement>>('verifiedHeading');

  onCustomerBasicDetailsFetch(event: ICustomerBasicDetailsFetch): void {
    if (event.status === ProviderFetchStatus.SUCCESS && event.profileData) {
      this.validatedDetails.set(event.profileData);
      this.showVerifiedView();
    }
  }

  // The consent flow above is removed, so take the user (and screen readers) to the result.
  private showVerifiedView(): void {
    afterNextRender(
      () => {
        const heading = this.verifiedHeading()?.nativeElement;
        if (!heading) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        heading.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        heading.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
}
