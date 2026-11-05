// Screenshot transcription of ckyc-step-otp.component.ts (photograph supplied 2026-11-03, branch ckyc2-approach-changed).
// Not a verified build. The .scss file was not photographed.
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, interval, Subscription, tap } from 'rxjs';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatRadioModule } from '@angular/material/radio';
import { OtpIdentifier, OtpIdentifierEnum } from '../models/ckyc-consent-request.model';
@Component({
  selector: 'app-ckyc-step-otp',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    CkycConsentStatusComponent,
  ],
  templateUrl: './ckyc-step-otp.component.html',
  styleUrl: './ckyc-step-otp.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycStepOtpComponent {
  readonly authMode = AuthenticationMode;
  readonly ckycAuthState = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly countdown = signal(0);
  readonly isSubmitting = signal<boolean>(false);
  readonly otpIdentifierEnum = OtpIdentifierEnum;
  // The OTP node of the auth queue: send status and failed-validation count (limit from AUTH_CONFIG).
  readonly otpNode = computed(
    () => this.ckycAuthState.authNodes().find((node) => node.mode === AuthenticationMode.OTP) ?? null,
  );
  readonly isActive = computed(() => this.ckycAuthState.activeScreenMode() === AuthenticationMode.OTP);
  readonly isMaxAttemptsReached = computed(() => {
    const node = this.otpNode();
    return node !== null && node.maxValidateAttempts !== null && node.validateAttemptCount >= node.maxValidateAttempts;
  });
  readonly remainingAttempts = computed(() => {
    const node = this.otpNode();
    return node?.maxValidateAttempts == null ? null : Math.max(0, node.maxValidateAttempts - node.validateAttemptCount);
  });
  // The last Verify did not succeed; cleared by the next Verify or a new OTP.
  readonly verifyFailed = signal(false);
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
      } else {
        // No OTP any more (reset or another mode): stop the countdown.
        this.clearTimer();
        this.countdown.set(0);
      }
    });
  }
  // Mobile only -> MOBILE; otherwise EMAIL. With both channels the user picks in the radio group.
  resolveDefaultOtpChannel(): OtpIdentifier {
    const { hasMobileNumber, hasEmailAddress } = this.ckycAuthState.otpState();
    return hasMobileNumber && !hasEmailAddress ? OtpIdentifierEnum.MOBILE : OtpIdentifierEnum.EMAIL;
  }

  submit(): void {
    if (this.otpControl.invalid || this.countdown() === 0 || this.isSubmitting() || this.isMaxAttemptsReached()) {
      this.otpControl.markAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.verifyFailed.set(false);
    this.ckycAuthState
      .validate(this.otpControl.value, this.radioControl.value)
      .pipe(
        tap((success) => {
          if (success) {
            this.otpControl.reset('', { emitEvent: false });
            this.otpControl.disable({ emitEvent: false });
          } else {
            this.verifyFailed.set(true);
          }
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
  // Back to the enquiry list; also stops consent calls still running for this match.
  goBack(): void {
    this.ckycAuthState.cancelConsentFlow();
  }
  resend(): void {
    if (this.isSubmitting() || this.isMaxAttemptsReached()) return;
    this.ckycAuthState
      .resendOtp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((success) => {
        if (success) {
          this.verifyFailed.set(false);
          this.otpControl.reset('', { emitEvent: false });
        }
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
    // takeUntilDestroyed stops it with the component; clearTimer() stops it on restart.
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
  private clearTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = undefined;
    }
  }
}
