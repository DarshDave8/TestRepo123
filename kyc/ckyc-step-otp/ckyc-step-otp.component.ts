// Screenshot transcription of ckyc-step-otp.component.ts (photograph supplied 2026-11-03, branch ckyc2-approach-changed).
// Not a verified build. The .scss file was not photographed.
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, interval, Subscription, tap } from 'rxjs';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { AuthenticationMode, CKYC_ERROR_MESSAGES } from '../constants/ckyc-onboarding.constants';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatRadioModule } from '@angular/material/radio';
import { OtpIdentifier, OtpIdentifierEnum } from '../models/ckyc-consent-request.model';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { approveIcon, backArrowIcon, checkCircleIcon, envelopeIcon, faFieldErrorIcon, faLockIcon, infoIcon, phoneIcon, refreshIcon, warningIcon } from 'src/app/constants/icons.constants';
@Component({
  selector: 'app-ckyc-step-otp',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    CkycConsentStatusComponent,
    FontAwesomeModule,
  ],
  templateUrl: './ckyc-step-otp.component.html',
  styleUrl: './ckyc-step-otp.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycStepOtpComponent {
  // OTP messages from the constants file (the backend's own verify message comes first, see the template)
  readonly errorMessages = CKYC_ERROR_MESSAGES;
  // Font Awesome icons from the app's icons.constants
  readonly approveIcon = approveIcon;
  readonly backArrowIcon = backArrowIcon;
  readonly checkCircleIcon = checkCircleIcon;
  readonly envelopeIcon = envelopeIcon;
  readonly faFieldErrorIcon = faFieldErrorIcon;
  readonly faLockIcon = faLockIcon;
  readonly infoIcon = infoIcon;
  readonly phoneIcon = phoneIcon;
  readonly refreshIcon = refreshIcon;
  readonly warningIcon = warningIcon;
  readonly authMode = AuthenticationMode;
  readonly ckycAuthState = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly countdown = signal(0);
  readonly isSubmitting = signal<boolean>(false);
  readonly otpIdentifierEnum = OtpIdentifierEnum;
  // The OTP node of the auth queue: send status and resend count (limit from AUTH_CONFIG).
  readonly otpNode = computed(
    () => this.ckycAuthState.authNodes().find((node) => node.mode === AuthenticationMode.OTP) ?? null,
  );
  readonly isActive = computed(() => this.ckycAuthState.activeScreenMode() === AuthenticationMode.OTP);
  // Every resend is used: Resend OTP is disabled. The current OTP can still be verified until it expires.
  readonly noResendsLeft = computed(() => {
    const node = this.otpNode();
    return node !== null && node.maxResends !== null && node.resendCount >= node.maxResends;
  });
  // The last Verify did not succeed; cleared by the next Verify or a new OTP.
  readonly verifyFailed = signal(false);
  readonly otpControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[0-9]{6}$/)],
  });
  // Which OTP is being entered. With both channels it starts empty, so the user picks it: a preselected wrong
  // channel would silently fail the verification.
  readonly radioControl = new FormControl<OtpIdentifier | null>(this.resolveDefaultOtpChannel(), {
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
  // Mobile only -> MOBILE; both -> none (the user picks in the radio group); otherwise EMAIL.
  resolveDefaultOtpChannel(): OtpIdentifier | null {
    const { hasMobileNumber, hasEmailAddress } = this.ckycAuthState.otpState();
    if (hasMobileNumber && hasEmailAddress) return null;
    return hasMobileNumber ? OtpIdentifierEnum.MOBILE : OtpIdentifierEnum.EMAIL;
  }

  // Label of the OTP field, naming the channel once it is known: "6-digit OTP from mobile".
  otpFieldLabel(): string {
    switch (this.radioControl.value) {
      case OtpIdentifierEnum.MOBILE:
        return '6-digit OTP from mobile';
      case OtpIdentifierEnum.EMAIL:
        return '6-digit OTP from email';
      default:
        return '6-digit OTP';
    }
  }

  // "Choose mobile or email" shows once the code is typed (or the group was left) without a channel.
  showChannelHint(): boolean {
    return this.radioControl.invalid && (this.otpControl.valid || this.radioControl.touched);
  }

  submit(): void {
    if (
      this.otpControl.invalid ||
      this.radioControl.invalid ||
      this.countdown() === 0 ||
      this.isSubmitting()
    ) {
      this.otpControl.markAsTouched();
      this.radioControl.markAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.verifyFailed.set(false);
    this.ckycAuthState
      .validate(this.otpControl.value, this.radioControl.value ?? undefined)
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
    if (this.isSubmitting() || this.noResendsLeft()) return;
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
