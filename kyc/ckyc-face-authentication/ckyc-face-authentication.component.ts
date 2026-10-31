import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycConsentAttempt } from '../models/ckyc-consent-request.model';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';
@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './ckyc-face-authentication.component.html',
  styleUrl: './ckyc-face-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly flow = inject(CkycFlowStateService);
  readonly authState = this.authStore.authState;
  readonly otpState = this.authStore.otpState;
  readonly consentAttempts = this.authStore.consentAttempts;
  readonly otpFallbackPending = this.authStore.otpFallbackPending;
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;
  ngOnInit(): void {
    if (
      this.authState().activeMode !== AuthenticationMode.FACEAUTH ||
      this.consentAttempts().some((attempt) => attempt.consentType === AuthenticationMode.FACEAUTH)
    )
      return;
    this.authStore.triggerConsent().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
  // Used by both "Trigger OTP" and "Re-trigger OTP". OTP sent -> go straight to the OTP step.
  triggerOtp(): void {
    if (!this.otpFallbackPending() || this.isCalling()) return;
    this.authStore
      .triggerOtpFallback()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sent) => {
        if (sent) this.flow.goToStep('otp');
      });
  }
  // True only while a consent request is actually in flight.
  isCalling(): boolean {
    return this.consentAttempts().some((attempt) => attempt.status === 'Calling');
  }
  // "Awaiting action" row: only before the first OTP call. After that the OTP row itself carries the button.
  showTriggerOtpRow(): boolean {
    return (
      this.otpFallbackPending() &&
      !this.consentAttempts().some((attempt) => attempt.consentType === AuthenticationMode.OTP)
    );
  }
  canRetriggerOtp(attempt: CkycConsentAttempt): boolean {
    return (
      this.otpFallbackPending() && attempt.consentType === AuthenticationMode.OTP && attempt.status === 'Failed'
    );
  }
  canDownload(attempt: CkycConsentAttempt): boolean {
    const attempts = this.consentAttempts();
    return (
      attempt.status === 'Success' &&
      attempt.consentType === AuthenticationMode.FACEAUTH &&
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

  downloadData(attempt: CkycConsentAttempt): void {
    if (!this.canDownload(attempt) || this.isBusy()) return;
    this.authStore.validate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
