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

@Component({
  selector: 'app-ckyc-enquiry-details',
  standalone: true,
  imports: [DatePipe, MatButtonModule],
  templateUrl: './ckyc-enquiry-details.component.html',
  styleUrl: './ckyc-enquiry-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycEnquiryDetailsComponent implements OnInit {
  // Phase and lead id are set by the onboarding component; the consent calls use the same values.
  private readonly ckycSharedStateService = inject(CkycSharedStateService);
  readonly enquiry = input.required<ICkycEnquiryListResponseBody>();
  readonly match = input.required<ICkycSearchResult>();
  readonly matchIndex = input.required<number>();
  readonly flow = inject(CkycFlowStateService);
  readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  isStaff = false;
  authService = inject(AuthService);

  readonly photoSource = computed(() => {
    const photo = this.match().photo?.trim() ?? '';
    const photoExt = this.match().photoExt?.trim().toLowerCase() ?? '';
    if (!photo) {
      return null;
    }
    const mimeSubtype = photoExt === 'jpg' ? 'jpeg' : photoExt;
    return `data:image/${mimeSubtype};base64,${photo}`;
  });
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
      .subscribe({
        next: (isSuccess) => {
          if (isSuccess && this.authStore.startQueue()) {
            this.flow.goToStep('auth');
          }
        },
        error: (err) => {
          console.error('Failed to load authentication modes:', err);
        },
      });
  }
}
