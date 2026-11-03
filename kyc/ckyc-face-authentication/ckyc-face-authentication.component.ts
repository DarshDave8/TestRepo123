import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

// Face auth screen: its consent call history. The calls themselves are sent by the auth queue.
@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  imports: [MatButtonModule, CkycConsentStatusComponent],
  templateUrl: './ckyc-face-authentication.component.html',
  styleUrl: './ckyc-face-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent {
  private readonly authStore = inject(CkycAuthStateService);
  readonly mode = AuthenticationMode.FACEAUTH;
  readonly isActive = computed(() => this.authStore.activeScreenMode() === this.mode);

  // Back to the enquiry list; also stops consent calls still running for this match.
  goBack(): void {
    this.authStore.cancelConsentFlow();
  }
}
