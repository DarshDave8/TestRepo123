import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycAuthStateService, CkycConsentAttempt } from '../services/ckyc-auth-state.service';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';

@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  templateUrl: './ckyc-face-authentication.component.html',
  styleUrl: './ckyc-face-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly flow = inject(CkycFlowStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consentAttempts = this.authStore.consentAttempts;
  readonly authState = this.authStore.authState;
  readonly otpState = this.authStore.otpState;
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;

  ngOnInit(): void {
    // Recreating this screen must not send OTP or restart a previous face attempt.
    if (
      this.authState().activeMode !== AuthenticationMode.FACEAUTH ||
      this.consentAttempts().some((attempt) => attempt.consentType === AuthenticationMode.FACEAUTH)
    ) return;
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  triggerOtp(): void {
    if (
      this.authState().activeMode !== AuthenticationMode.OTP ||
      this.otpState().loading || this.otpState().generated
    ) return;
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  canDownload(attempt: CkycConsentAttempt): boolean {
    const attempts = this.consentAttempts();
    return attempt.status === 'Success' &&
      attempt.consentType === AuthenticationMode.FACEAUTH &&
      attempt.consentType === this.authState().activeMode &&
      attempt.id === attempts[attempts.length - 1]?.id;
  }

  canValidateOtp(attempt: CkycConsentAttempt): boolean {
    const attempts = this.consentAttempts();
    return attempt.status === 'Success' &&
      attempt.consentType === AuthenticationMode.OTP &&
      this.authState().activeMode === AuthenticationMode.OTP &&
      this.otpState().generated &&
      attempt.id === attempts[attempts.length - 1]?.id;
  }

  validateOtp(attempt: CkycConsentAttempt): void {
    if (!this.canValidateOtp(attempt) || this.isBusy()) return;
    this.flow.goToStep('otp');
  }

  isBusy(): boolean {
    return this.authState().loading || this.otpState().loading ||
      this.consentAttempts().some((attempt) => attempt.status === 'Calling');
  }

  downloadData(attempt: CkycConsentAttempt): void {
    if (!this.canDownload(attempt) || this.isBusy()) return;
    this.authStore.validate()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
