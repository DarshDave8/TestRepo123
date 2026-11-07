import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { backArrowIcon } from 'src/app/constants/icons.constants';

// Physical (manual) auth screen: its consent call history. The calls themselves are sent by the auth queue.
// Also the CONSENT_AVAILABLE screen (mode input): the same table with "Download Data", and Back.
@Component({
  selector: 'app-non-otp-authentication',
  standalone: true,
  imports: [MatButtonModule, CkycConsentStatusComponent, FontAwesomeModule],
  templateUrl: './non-otp-authentication.component.html',
  styleUrl: './non-otp-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonOtpAuthenticationComponent {
  readonly backArrowIcon = backArrowIcon;
  private readonly authStore = inject(CkycAuthStateService);
  readonly mode = input<AuthenticationMode>(AuthenticationMode.MANUAL);
  readonly isActive = computed(() => this.authStore.activeScreenMode() === this.mode());

  // Back to the enquiry list; also stops consent calls still running for this match.
  goBack(): void {
    this.authStore.cancelConsentFlow();
  }
}
