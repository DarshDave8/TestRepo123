// Recovered from screenshots 147114 (both panes) and 147115 (left pane).
// Some pre-existing type/flow inconsistencies are intentionally preserved.
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { CkycFlowStateService } from '../../services/ckyc-flow-state.service';
import { ICkycEnquiryListResponseBody, ICkycSearchResult } from '../../models/ckyc-search-response.model';
import { UserType } from 'src/app/models/account.model';
import { AuthService } from 'src/app/auth/auth.service';
import { CkycAuthStateService } from '../../services/ckyc-auth-state.service';
import { finalize } from 'rxjs';
import { CkycSharedStateService } from '../../services/ckyc-shared-state.service';
import { toCkycPhotoSrc } from '../../utils/ckyc-photo.util';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { approveIcon, faLockIcon, userIcon } from 'src/app/constants/icons.constants';
import { CkycSearchOption } from '../../constants/ckyc-onboarding.constants';

@Component({
  selector: 'app-ckyc-enquiry-details',
  standalone: true,
  imports: [DatePipe, MatButtonModule, FontAwesomeModule],
  templateUrl: './ckyc-enquiry-details.component.html',
  styleUrl: './ckyc-enquiry-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycEnquiryDetailsComponent implements OnInit {
  readonly approveIcon = approveIcon;
  readonly faLockIcon = faLockIcon;
  readonly userIcon = userIcon;
  // Phase and lead id are set by the onboarding component; the consent calls use the same values.
  private readonly ckycSharedStateService = inject(CkycSharedStateService);
  readonly enquiry = input.required<ICkycEnquiryListResponseBody>();
  readonly match = input.required<ICkycSearchResult>();
  readonly matchIndex = input.required<number>();
  readonly flow = inject(CkycFlowStateService);
  readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  CkycSearchOption = CkycSearchOption;
  isStaff = false;
  authService = inject(AuthService);

  readonly photoSource = computed(() => toCkycPhotoSrc(this.match().photo, this.match().photoExt));
  readonly isProcessing = signal<boolean>(false);

  ngOnInit(): void {
    this.isStaff = this.authService.userIdentity?.userType === UserType.STAFF;
  }

  startAuthentication(): void {
    if (this.isProcessing()) return;
    const enquiryData = this.enquiry();
    const matchData = this.match();
    const currentPhase = this.ckycSharedStateService.searchAttemptedPhase();
    this.isProcessing.set(true);

    // 1. Register active match selection in store
    this.flow.setActiveMatch(enquiryData, this.matchIndex());
    // 2. Load the allowed modes, build this match's auth queue and start it (both phases, no mobile dialog)
    this.authStore
      .loadApplicableModes(
        matchData.enquiryId!,
        matchData.enquiryResponseId ?? '',
        this.ckycSharedStateService.leadId(),
        currentPhase!,
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isProcessing.set(false)),
      )
      .subscribe((isSuccess) => {
        // (loadApplicableModes catches its own errors and returns false.)
        if (isSuccess && this.authStore.startQueue()) {
          this.flow.goToStep('auth');
        } else {
          // Authentication did not start: drop the match, so Submit CKYC cannot send an unauthenticated match.
          this.flow.activeMatchSelection.set(null);
        }
      });
  }
}
