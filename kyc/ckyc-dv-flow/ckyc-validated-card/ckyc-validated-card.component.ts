import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthService } from 'src/app/auth/auth.service';
import { UserType } from 'src/app/models/account.model';
import { GENDER, GenderDesc } from 'src/app/nri/profile-categorisation/constant/work-profile.constants';
import type { ICustomerBasicDetails } from 'src/app/nri/profile-creation/model/customer-basic-details.model';
import { toCkycPhotoSrc } from '../../utils/ckyc-photo.util';
import { CkycIconComponent } from '../../ckyc-icon/ckyc-icon.component';

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
  // UNVERIFIED field names: the photo is read from the response if it carries one under either spelling
  // (IConsentData uses "Photo"); otherwise the card falls back to the authenticated record's photo.
  photo?: string | null;
  Photo?: string | null;
  photoExt?: string | null;
}

// Photo of the CKYC record that was authenticated (the search result), used when the response has none.
export interface CkycValidatedPhoto {
  photo?: string | null;
  photoExt?: string | null;
}

@Component({
  selector: 'app-ckyc-validated-card',
  standalone: true,
  imports: [DatePipe, CkycIconComponent],
  templateUrl: './ckyc-validated-card.component.html',
  styleUrl: './ckyc-validated-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycValidatedCardComponent {
  private readonly authService = inject(AuthService);

  // Validate-consent response body (ckyc-onboarding emits it with status SUCCESS).
  readonly details = input.required<ICustomerBasicDetails>();
  readonly recordPhoto = input<CkycValidatedPhoto | null | undefined>(null);

  // Same rule as the match card: the CKYC photo is shown to staff only.
  protected readonly isStaff = this.authService.userIdentity?.userType === UserType.STAFF;

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
  // Response photo first, then the authenticated record's photo; null = show nothing (no empty box).
  protected readonly photoSource = computed(() => {
    if (!this.isStaff) return null;
    const view = this.view();
    const record = this.recordPhoto();
    return (
      toCkycPhotoSrc(view.photo ?? view.Photo, view.photoExt) ?? toCkycPhotoSrc(record?.photo, record?.photoExt)
    );
  });
}
