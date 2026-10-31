import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycRelatedPersonFieldsComponent } from '../ckyc-related-person-fields/ckyc-related-person-fields.component';
import { CkycConsentAttempt } from '../models/ckyc-consent-request.model';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import {
  consentAttemptDetail,
  consentMethodLabel,
  consentStatusLabel,
  summarizeConsent,
} from '../shared/ckyc-consent-ui';

@Component({
  selector: 'app-non-otp-authentication',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    CkycRelatedPersonFieldsComponent,
  ],
  templateUrl: './non-otp-authentication.component.html',
  styleUrl: './non-otp-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonOtpAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consentAttempts = this.authStore.consentAttempts;
  readonly authState = this.authStore.authState;
  readonly otpState = this.authStore.otpState;
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;

  // ---- display only ----
  readonly methodLabel = consentMethodLabel;
  readonly attemptDetail = consentAttemptDetail;
  readonly statusLabel = consentStatusLabel;
  readonly isValidating = computed(() => this.authState().loading);
  readonly summary = computed(() =>
    summarizeConsent({
      attempts: this.consentAttempts(),
      canValidate: this.consentAttempts().some((attempt) => this.canDownload(attempt)),
      otpPending: false,
      hasError: !!this.authState().error,
    }),
  );

  ngOnInit(): void {
    if (
      this.authState().activeMode !== AuthenticationMode.MANUAL ||
      (this.authState().applicableModes.includes(AuthenticationMode.FACEAUTH) &&
        this.consentAttempts().some((attempt) => attempt.consentType === AuthenticationMode.MANUAL))
    )
      return;
    this.authStore.triggerConsent().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  canDownload(attempt: CkycConsentAttempt): boolean {
    const attempts = this.consentAttempts();
    return (
      attempt.status === 'Success' &&
      attempt.consentType === AuthenticationMode.MANUAL &&
      attempt.consentType === this.authState().activeMode &&
      attempt.id === attempts[attempts.length - 1]?.id
    );
  }

  isBusy(): boolean {
    return (
      this.authState().loading ||
      this.otpState().loading ||
      this.consentAttempts().some((attempt) => attempt.status === 'Calling')
    );
  }

  // "Validate consent": on success ckyc-onboarding emits the details and ckyc-dv-flow shows the verified card.
  downloadData(attempt: CkycConsentAttempt): void {
    if (!this.canDownload(attempt) || this.isBusy()) return;
    this.authStore.validate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
