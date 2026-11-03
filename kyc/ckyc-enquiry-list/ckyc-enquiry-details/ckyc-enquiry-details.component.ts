// Recovered from screenshots 147114 (both panes) and 147115 (left pane).
// Some pre-existing type/flow inconsistencies are intentionally preserved.
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { CkycFlowStateService } from '../../services/ckyc-flow-state.service';
import { ICkycEnquiryListResponseBody, ICkycSearchResult } from '../../models/ckyc-search-response.model';
import { UserType } from 'src/app/models/account.model';
import { AuthService } from 'src/app/auth/auth.service';
import { CkycSearchOption, OvdType } from '../../constants/ckyc-onboarding.constants';
import { CkycGetDedupInfoDialogComponent } from '../../../ckyc-flow/ckyc-get-dedup-info-dialog/ckyc-get-dedup-info-dialog.component';
import { CkycSearchRequest } from '../../models/ckyc-search-request.model';
import { DocumentTypeEnum } from '../../../ckyc-flow/ckyc-flow.constants';
import { CkycAuthStateService } from '../../services/ckyc-auth-state.service';
import { filter, finalize, switchMap } from 'rxjs';
import { CkycSearchPhaseService } from '../../services/ckyc-search-phase.service';
import { CkycSharedStateService } from '../../services/ckyc-shared-state.service';
import { SearchAttemptedPhase } from '../../constants/ckyc-onboarding.constants';

@Component({
  selector: 'app-ckyc-enquiry-details',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    ReactiveFormsModule,
  ],
  templateUrl: './ckyc-enquiry-details.component.html',
  styleUrl: './ckyc-enquiry-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycEnquiryDetailsComponent implements OnInit {
  readonly ckycSearchPhaseService = inject(CkycSearchPhaseService);
  // Phase and lead id set by the onboarding component; the consent calls use the same values.
  private readonly ckycSharedStateService = inject(CkycSharedStateService);
  readonly enquiry = input.required<ICkycEnquiryListResponseBody>();
  readonly match = input.required<ICkycSearchResult>();
  readonly matchIndex = input.required<number>();
  readonly flow = inject(CkycFlowStateService);
  readonly authStore = inject(CkycAuthStateService);
  CkycSearchOption = CkycSearchOption;
  readonly phase = SearchAttemptedPhase;
  private readonly dialog = inject(MatDialog);
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

  openDedupDialog() {
    const uid = this.getUid(this.enquiry().enquiryRequest);
    let enquiry: { enquiryId: string | undefined; idType?: DocumentTypeEnum; idNumber?: string } = {
      enquiryId: this.match().enquiryId,
    };
    if (uid) {
      enquiry = { ...enquiry, idType: DocumentTypeEnum.UID, idNumber: uid };
    }
    this.dialog.open(CkycGetDedupInfoDialogComponent, {
      data: { ...enquiry },
      disableClose: true,
    });
  }

  private getUid(request: CkycSearchRequest): string | undefined {
    if (request.searchOption !== CkycSearchOption.OVD) {
      return undefined;
    }
    return request.idList.ovdDetails.find((ovd) => ovd.ovdType === OvdType.UID)?.ovdNo;
  }
}
