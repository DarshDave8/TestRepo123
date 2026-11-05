import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { GENDER, GenderDesc } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import type { ICustomerBasicDetails } from 'src/app/nri/profile-creation/model/customer-basic-details.model';

// The validate-consent response fields this card shows (customerDetails, attemptId and the flags are not shown).
// ICustomerBasicDetails is assignable to it.
interface CkycValidatedView {
  applicantName?: {
    salutation?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
  } | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  mobileNumber?: string | null;
  email?: string | null;
}

@Component({
  selector: 'app-ckyc-validated-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './ckyc-validated-card.component.html',
  styleUrl: './ckyc-validated-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycValidatedCardComponent {
  // Validate-consent response body (ckyc-onboarding emits it with status SUCCESS).
  readonly details = input.required<ICustomerBasicDetails>();

  protected readonly view = computed<CkycValidatedView>(() => this.details());
  // "MR Ramesh Kumar": salutation and name parts, skipping empty ones.
  protected readonly fullName = computed(() => {
    const name = this.view().applicantName;
    return [name?.salutation, name?.firstName, name?.middleName, name?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
  });
  protected readonly gender = computed(() => {
    const gender = this.view().gender?.trim();
    return gender ? (GenderDesc[gender as GENDER] ?? gender) : '';
  });
}
