// Screenshot transcription of ckyc-step-otp.component.ts (photograph supplied 2026-11-03, branch ckyc2-approach-changed).
// Not a verified build. The .scss file was not photographed.
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, interval, Subscription, tap, timer } from 'rxjs';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { CKYC_OTP_MAX_ATTEMPTS } from '../constants/ckyc-onboarding.constants';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatRadioModule } from '@angular/material/radio';
import { OtpIdentifier, OtpIdentifierEnum } from '../models/ckyc-consent-request.model';
@Component({
  selector: 'app-ckyc-step-otp',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatRadioModule],
  templateUrl: './ckyc-step-otp.component.html',
  styleUrl: './ckyc-step-otp.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycStepOtpComponent implements OnDestroy {
  isDisabledEmail: boolean = false;
  isDisabledMobile: boolean = false;
  readonly maxAttempts = CKYC_OTP_MAX_ATTEMPTS;
  readonly flow = inject(CkycFlowStateService);
  readonly ckycAuthState = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly countdown = signal(0);
  readonly isSubmitting = signal<boolean>(false);
  readonly otpIdentifierEnum = OtpIdentifierEnum;
  readonly isMaxAttemptsReached = computed(() => {
    return this.ckycAuthState.otpState().otpAttemptCount >= CKYC_OTP_MAX_ATTEMPTS;
  });
  readonly otpControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[0-9]{6}$/)],
  });
  readonly radioControl = new FormControl<OtpIdentifier>(this.resolveDefaultOtpChannel(), {
    nonNullable: true,
    validators: [Validators.required],
  });
  private timerSubscription?: Subscription;
  constructor() {
    effect(() => {
      const expiresAt = this.ckycAuthState.otpState().expiresAt;
      if (expiresAt) {
        const remainingSecs = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        this.startTimer(remainingSecs);
      }
    });
  }
  resolveDefaultOtpChannel(): OtpIdentifier {
    if (this.ckycAuthState.otpState().hasEmailAddress && !this.ckycAuthState.otpState().hasMobileNumber) {
      this.isDisabledEmail = true;
      return this.otpIdentifierEnum.EMAIL;
    } else if (this.ckycAuthState.otpState().hasMobileNumber && !this.ckycAuthState.otpState().hasEmailAddress) {
      this.isDisabledMobile = true;
      return this.otpIdentifierEnum.MOBILE;
    }
    return this.otpIdentifierEnum.EMAIL;
  }

  submit(): void {
    if (this.otpControl.invalid || this.countdown() === 0 || this.isSubmitting() || this.isMaxAttemptsReached()) {
      this.otpControl.markAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.ckycAuthState
      .validate(this.otpControl.value, this.radioControl.value)
      .pipe(
        tap((success) => {
          if (success) {
            this.otpControl.reset('', { emitEvent: false });
            this.otpControl.disable({ emitEvent: false });
          }
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
  resend(): void {
    if (this.isSubmitting() || this.isMaxAttemptsReached()) return;
    this.ckycAuthState.resendOtp().subscribe({
      next: (success) => {
        if (success) {
          this.otpControl.reset('', { emitEvent: false });
        }
      },
    });
  }
  formatDisplayTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }
  private startTimer(seconds: number): void {
    this.clearTimer();
    this.countdown.set(seconds);
    if (seconds <= 0) return;
    this.timerSubscription = interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const current = this.countdown();
        if (current > 1) {
          this.countdown.set(current - 1);
        } else {
          this.countdown.set(0);
          this.clearTimer();
        }
      });
  }
  ngOnDestroy(): void {
    this.clearTimer();
  }
  private clearTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
  }
}
