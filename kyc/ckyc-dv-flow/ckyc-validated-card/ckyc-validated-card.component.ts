import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GENDER, GenderDesc } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import type { ICustomerBasicDetails } from 'src/app/nri/profile-creation/model/customer-basic-details.model';
import { buildCkycValidatedSections } from './ckyc-validated-card.util';

@Component({
  selector: 'app-ckyc-validated-card',
  standalone: true,
  templateUrl: './ckyc-validated-card.component.html',
  styleUrl: './ckyc-validated-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycValidatedCardComponent {
  // Validate-consent response body (ckyc-onboarding emits it with status SUCCESS).
  readonly details = input.required<ICustomerBasicDetails>();

  readonly sections = computed(() =>
    buildCkycValidatedSections(this.details(), (gender) => GenderDesc[gender as GENDER]),
  );
}
