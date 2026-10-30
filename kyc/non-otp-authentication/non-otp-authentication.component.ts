import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycAuthStateService, CkycConsentAttempt } from '../services/ckyc-auth-state.service';

@Component({
  selector: 'app-non-otp-authentication',
  standalone: true,
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

  ngOnInit(): void {
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  canDownload(attempt: CkycConsentAttempt): boolean {
    const attempts = this.consentAttempts();
    return attempt.status === 'Success' &&
      attempt.consentType === AuthenticationMode.MANUAL &&
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
}
