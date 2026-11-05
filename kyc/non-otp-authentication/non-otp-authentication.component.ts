import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { CkycIconComponent } from '../ckyc-icon/ckyc-icon.component';

// Physical (manual) auth screen: its consent call history. The calls themselves are sent by the auth queue.
@Component({
  selector: 'app-non-otp-authentication',
  standalone: true,
  imports: [MatButtonModule, CkycConsentStatusComponent, CkycIconComponent],
  templateUrl: './non-otp-authentication.component.html',
  styleUrl: './non-otp-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonOtpAuthenticationComponent {
  private readonly authStore = inject(CkycAuthStateService);
  readonly mode = AuthenticationMode.MANUAL;
  readonly isActive = computed(() => this.authStore.activeScreenMode() === this.mode);

  // Back to the enquiry list; also stops consent calls still running for this match.
  goBack(): void {
    this.authStore.cancelConsentFlow();
  }
}
