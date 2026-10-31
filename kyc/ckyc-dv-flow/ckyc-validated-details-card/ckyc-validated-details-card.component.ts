import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthService } from 'src/app/auth/auth.service';
import { UserType } from 'src/app/models/account.model';
import type { ICustomerBasicDetailsFetch } from 'src/app/nri/profile-creation/ckyc-flow/ckyc-flow.model';
import { buildCkycDetailSections, toCkycPhotoSource } from './ckyc-validated-details.util';

// The validate-consent response body, exactly as ckyc-onboarding emits it on SUCCESS.
export type CkycValidatedDetails = NonNullable<ICustomerBasicDetailsFetch['profileData']>;

@Component({
  selector: 'app-ckyc-validated-details-card',
  standalone: true,
  templateUrl: './ckyc-validated-details-card.component.html',
  styleUrl: './ckyc-validated-details-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycValidatedDetailsCardComponent {
  private readonly authService = inject(AuthService);
  readonly details = input.required<CkycValidatedDetails>();

  // Same rule as the enquiry match card: the CKYC photo is only shown to staff users.
  readonly isStaff = this.authService.userIdentity?.userType === UserType.STAFF;
  readonly sections = computed(() => buildCkycDetailSections(this.details()));
  readonly photoSource = computed(() => (this.isStaff ? toCkycPhotoSource(this.details()) : null));
}
