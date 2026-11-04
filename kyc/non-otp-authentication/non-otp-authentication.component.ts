import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';

// Physical (manual) auth screen: its consent call history. The calls themselves are sent by the auth queue.
// Back to the enquiry list is in the onboarding screen's auth header.
@Component({
  selector: 'app-non-otp-authentication',
  standalone: true,
  imports: [CkycConsentStatusComponent],
  templateUrl: './non-otp-authentication.component.html',
  styleUrl: './non-otp-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonOtpAuthenticationComponent {
  readonly mode = AuthenticationMode.MANUAL;
}
