import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';

// Face auth screen: its consent call history. The calls themselves are sent by the auth queue.
// Back to the enquiry list is in the onboarding screen's auth header.
@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  imports: [CkycConsentStatusComponent],
  templateUrl: './ckyc-face-authentication.component.html',
  styleUrl: './ckyc-face-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent {
  readonly mode = AuthenticationMode.FACEAUTH;
}
