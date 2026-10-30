import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycAuthStateService, CkycConsentAttempt } from '../services/ckyc-auth-state.service';

@Component({
  selector: 'app-ckyc-consent-status',
  standalone: true,
  templateUrl: './ckyc-consent-status.component.html',
  styleUrl: './ckyc-consent-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycConsentStatusComponent {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consentAttempts = this.authStore.consentAttempts;
  readonly authState = this.authStore.authState;
  readonly otpState = this.authStore.otpState;
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;

  canDownload(attempt: CkycConsentAttempt): boolean {
    const attempts = this.consentAttempts();
    return attempt.status === 'Success' &&
      (attempt.consentType === AuthenticationMode.MANUAL || attempt.consentType === AuthenticationMode.FACEAUTH) &&
      attempt.consentType === this.authState().activeMode &&
      attempt.id === attempts[attempts.length - 1]?.id;
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

  triggerOtp(): void {
    if (
      this.authState().activeMode !== AuthenticationMode.OTP ||
      this.isBusy() || this.otpState().generated
    ) return;
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
