// Recovered from screenshots 147114 (both panes) and 147115 (left pane).
// Some pre-existing type/flow inconsistencies are intentionally preserved.
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { CkycFlowStateService } from '../../services/ckyc-flow-state.service';
import { ConfirmMobileForCkycDialogComponent } from '../../../ckyc-flow/confirm-mobile-for-ckyc-dialog/confirm-mobile-for-ckyc-dialog.component';
import { ICkycEnquiryListResponseBody, ICkycSearchResult } from '../../models/ckyc-search-response.model';
import { UserType } from 'src/app/models/account.model';
import { AuthService } from 'src/app/auth/auth.service';
import { AuthenticationMode, CkycSearchOption, OvdType } from '../../constants/ckyc-onboarding.constants';
import { CkycGetDedupInfoDialogComponent } from '../../../ckyc-flow/ckyc-get-dedup-info-dialog/ckyc-get-dedup-info-dialog.component';
import { CkycSearchRequest } from '../../models/ckyc-search-request.model';
import { DocumentTypeEnum } from '../../../ckyc-flow/ckyc-flow.constants';
import { CkycAuthStateService } from '../../services/ckyc-auth-state.service';
import { filter, finalize, switchMap } from 'rxjs';
import { CkycSearchPhaseService } from '../../services/ckyc-search-phase.service';
import { SearchAttemptedPhase } from '../../constants/ckyc-onboarding.constants';

interface ConfirmMobileDialogResult {
  useExistingMobile: boolean;
  newMobileNumber: string;
}

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
  readonly enquiry = input.required<ICkycEnquiryListResponseBody>();
  readonly match = input.required<ICkycSearchResult>();
  readonly matchIndex = input.required<number>();
  readonly flow = inject(CkycFlowStateService);
  readonly authStore = inject(CkycAuthStateService);
  CkycSearchOption = CkycSearchOption;
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private mobileDialogRef?: MatDialogRef<ConfirmMobileForCkycDialogComponent, ConfirmMobileDialogResult | undefined>;
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
    const currentPhase = this.ckycSearchPhaseService.searchAttemptedPhase();
    this.isProcessing.set(true);

    // 1. Register active match selection in store
    this.flow.setActiveMatch(enquiryData, this.matchIndex());
    // 2. Discover modes with current phase rule
    this.authStore
      .loadApplicableModes(
        matchData.enquiryId!,
        matchData.enquiryResponseId ?? '',
        this.ckycSearchPhaseService.leadId(),
        currentPhase!,
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isProcessing.set(false)),
      )
      .subscribe({
        next: (isSuccess) => {
          if (!isSuccess) return;
          const modes = this.authStore.authState().applicableModes;
          const startingMode = this.authStore.resolveStartingMode(modes, currentPhase!);
          if (currentPhase === SearchAttemptedPhase.DIGITAL_VERIFICATION) {
            if (startingMode === AuthenticationMode.OTP) {
              this.flow.goToStep('otp');
            } else if (startingMode === AuthenticationMode.FACEAUTH) {
              this.flow.goToStep('face');
            } else if (startingMode === AuthenticationMode.MANUAL) {
              this.flow.goToStep('manual');
            }
            return;
          }
          if (startingMode === AuthenticationMode.OTP) {
            this.promptMobileAndTrigger();
          }
        },
        error: (err) => {
          console.error('Failed to load authentication modes:', err);
        },
      });
  }

  private confirmMobile(result: ConfirmMobileDialogResult): void {
    if (result.newMobileNumber) {
      this.authStore.otpState.update((s) => ({ ...s, mobileNumber: result.newMobileNumber }));
    }
    this.authStore
      .triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (isSuccess) => {
          if (isSuccess) this.flow.goToStep('otp');
        },
      });
  }

  cancelMobile(): void {
    this.mobileDialogRef?.close();
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

  private promptMobileAndTrigger() {
    const dialogRef = this.dialog.open(ConfirmMobileForCkycDialogComponent, {
      width: 'min(100% - 2rem, 30rem)',
      disableClose: true,
    });
    return dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.mobileDialogRef = undefined;
        if (result) this.confirmMobile(result);
      });
  }
}
