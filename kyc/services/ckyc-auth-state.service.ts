// Screenshot transcription (images 1 and 2), not a complete verified source file.
// SOURCE GAP markers indicate code not visible in the photographs.
import { Injectable, inject, signal, DestroyRef, InjectionToken } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, of } from 'rxjs';
import { tap, catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { CkycOnboardingService } from './ckyc-onboarding.service';
import {
  AuthenticationMode,
  CKYC_OTP_MAX_ATTEMPTS,
  CKYC_OTP_TTL_SECONDS,
  SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import {
  AuthDomainState,
  ITriggerConsentRequest,
  IValidateConsentRequest,
  OtpDomainState,
} from '../models/ckyc-onboarding.model';
import { CkycFlowStateService } from './ckyc-flow-state.service';
import { CkycSearchPhaseService } from './ckyc-search-phase.service';
import {
  DvConsentFactor,
  DvConsentFactorValues,
  DvConsentFlags,
  executeDvConsentSequence,
} from './ckyc-dv-consent-sequence';

/** Provide adapters to your existing runtime flag service and customer data source.
 * Defaults deliberately preserve today's behavior and never invent auth-factor data. */
export const CKYC_DV_CONSENT_FLAGS = new InjectionToken<() => DvConsentFlags>(
  'CKYC_DV_CONSENT_FLAGS',
  { providedIn: 'root', factory: () => () => ({ master: false, dob: true, relation: true, pincode: true }) },
);
export const CKYC_DV_CONSENT_FACTOR_VALUES = new InjectionToken<() => DvConsentFactorValues>(
  'CKYC_DV_CONSENT_FACTOR_VALUES',
  { providedIn: 'root', factory: () => () => ({}) },
);

@Injectable({ providedIn: 'root' })
export class CkycAuthStateService {
  private readonly ckycSearchPhaseService = inject(CkycSearchPhaseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ckycApi = inject(CkycOnboardingService);
  private readonly flow = inject(CkycFlowStateService);
  private readonly dvFlags = inject(CKYC_DV_CONSENT_FLAGS);
  private readonly dvFactorValues = inject(CKYC_DV_CONSENT_FACTOR_VALUES);
  private readonly dvSequenceReset$ = new Subject<void>();
  // readonly searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);

  readonly authState = signal<AuthDomainState>({
    loading: false,
    attemptId: null,
    error: null,
    applicableModes: [],
    activeMode: null,
  });

  readonly otpState = signal<OtpDomainState>({
    loading: false,
    error: null,
    generated: false,
    expiresAt: null,
    mobileNumber: null,
    otpAttemptCount: 0,
  });

  /**
   * Mode Discovery with Page/Phase Filtering Rules:
   * - PROFILE_CREATION: Filter strictly for OTP only.
   * - DIGITAL_VERIFICATION: Allow all backend-returned modes.
   */
  loadApplicableModes(
    enquiryId: string,
    enquiryResponseId: string,
    leadId: string | null,
    phase: SearchAttemptedPhase,
  ): Observable<boolean> {
    // Cancel any prior in-flight DV chain and reset its local sequence to DOB.
    this.dvSequenceReset$.next();
    this.authState.update((s) => ({ ...s, loading: true, error: null }));
    return this.ckycApi
      .getApplicableAuthenticationModes({
        enquiryId,
        enquiryResponseId,
        leadId,
        searchAttemptedPhase: phase,
      })
      .pipe(
        tap((res) => {
          if (!res?.success) {
            this.authState.update((s) => ({ ...s, error: 'Unable to load authentication modes.' }));
            return;
          }
          const { modes, activeMode } = this.determineAuthModes(
            res.body?.applicableConsentTypes || [],
            phase,
          );

          this.authState.update((s) => ({
            ...s,
            activeMode,
            attemptId: res.body.attemptId,
            applicableModes: modes,
          }));
        }),
        map((res) => Boolean(res?.success)),
        catchError(() => {
          this.authState.update((s) => ({ ...s, error: 'Network error loading auth modes.' }));
          return of(false);
        }),
        finalize(() => this.authState.update((s) => ({ ...s, loading: false })),
        takeUntilDestroyed(this.destroyRef),
      );
  }


  /** Only the DV branch with both backend modes AND master feature flag enabled. */
  isDvOtpFaceSequenceEnabled(modes: readonly AuthenticationMode[], phase: SearchAttemptedPhase): boolean {
    return phase === SearchAttemptedPhase.DIGITAL_VERIFICATION &&
      this.dvFlags().master &&
      modes.includes(AuthenticationMode.OTP) &&
      modes.includes(AuthenticationMode.FACEAUTH);
  }

  /** Sequence is independent of triggerConsent()/handleAuthFailure() legacy behavior. */
  startDvOtpFaceConsentSequence(): Observable<boolean> {
    const phase = this.ckycSearchPhaseService.searchAttemptedPhase();
    const modes = this.authState().applicableModes;
    if (phase !== SearchAttemptedPhase.DIGITAL_VERIFICATION ||
        !this.isDvOtpFaceSequenceEnabled(modes, phase)) {
      return of(false);
    }

    const attemptId = this.authState().attemptId;
    const leadId = this.ckycSearchPhaseService.leadId();
    if (!attemptId || !leadId) {
      this.authState.update((s) => ({ ...s, error: 'Missing consent attempt ID or lead ID.' }));
      return of(false);
    }

    const mobileNumber = this.otpState().mobileNumber;
    return executeDvConsentSequence({
      flags: this.dvFlags(),
      values: this.dvFactorValues(),
      base: {
        attemptId,
        leadId,
        searchAttemptedPhase: phase,
        ...(mobileNumber ? { mobileNumber } : {}),
      },
      send: (request) => this.ckycApi.triggerConsent(request),
      onMissingData: (message) => this.authState.update((s) => ({ ...s, error: message })),
      onSuccess: ({ factor }) => {
        if (factor === DvConsentFactor.OTP) {
          this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.OTP }));
          this.otpState.update((s) => ({
            ...s,
            generated: true,
            expiresAt: Date.now() + CKYC_OTP_TTL_SECONDS * 1000,
          }));
          this.flow.goToStep('otp');
          return;
        }
        // Existing face-authentication entry; no DOWNLOAD FACE AUTH/GET implementation here.
        this.flow.goToStep('face');
      },
    }).pipe(
      takeUntil(this.dvSequenceReset$),
      takeUntilDestroyed(this.destroyRef),
      tap((success) => {
        if (!success && !this.authState().error) {
          this.authState.update((s) => ({ ...s, error: 'All enabled consent attempts failed.' }));
        }
      }),
    );
  }

  /**
   * Resolves initial starting mode according to requirements:
   * - DIGITAL_VERIFICATION: FACE -> OTP -> MANUAL
   * - PROFILE_CREATION: Strictly OTP
   */
  resolveStartingMode(modes: AuthenticationMode[], phase: SearchAttemptedPhase): AuthenticationMode | null {
    if (phase === 'PROFILE_CREATION') {
      return modes.includes(AuthenticationMode.OTP) ? AuthenticationMode.OTP : null;
    }
    if (modes.includes(AuthenticationMode.FACEAUTH)) return AuthenticationMode.FACEAUTH;
    if (modes.includes(AuthenticationMode.OTP)) return AuthenticationMode.OTP;
    if (modes.includes(AuthenticationMode.MANUAL)) return AuthenticationMode.MANUAL;
    return null;
  }

  triggerConsent(): Observable<boolean> {
    let payload = {
      attemptId: this.authState().attemptId!,
      consentType: this.authState().activeMode!,
      leadId: this.ckycSearchPhaseService.leadId(),
      authFactors: [],
      searchAttemptedPhase: this.ckycSearchPhaseService.searchAttemptedPhase(),
    } as ITriggerConsentRequest;

    if (this.otpState().mobileNumber) {
      payload = { ...payload, mobileNumber: this.otpState().mobileNumber };
    }
    // this.authState.update((s) => ({ ...s, activeMode: payload.consentType }));
    this.otpState.update((s) => ({ ...s, loading: true, error: null }));
    return this.ckycApi.triggerConsent(payload).pipe(
      map((response) => {
        if (!response || !response.success) {
          this.handleAuthFailure().subscribe();
          return false;
        }
        if (payload.consentType === AuthenticationMode.OTP) {
          this.otpState.update((s) => ({
            ...s,
            generated: true,
            expiresAt: Date.now() + CKYC_OTP_TTL_SECONDS * 1000,
          }));
          // SOURCE GAP: the exact counter update and closing lines around 145-149
          // are partially cropped in the provided photographs.
        }
        return true;
      }),
      catchError(() => {
        this.handleAuthFailure().subscribe();
        return of(false);
      }),
      finalize(() => {
        this.otpState.update((s) => ({ ...s, loading: false }));
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /**
   * Fallback Manager Engine:
   * - Face fails -> Fallback to OTP (or Manual)
   * - OTP fails < 3 times -> Retry
   * - OTP fails 3rd time -> Fallback to Manual (if available in backend list)
   */
  handleAuthFailure(): Observable<boolean> {
    const currentMode = this.authState().activeMode;
    const available = this.authState().applicableModes;
    // Rule 1: Face Auth Failed -> Fallback to OTP or MANUAL
    if (currentMode === AuthenticationMode.FACEAUTH) {
      if (available.includes(AuthenticationMode.OTP)) {
        this.authState.update((s) => ({ ...s, error: 'Face authentication failed. Falling back to OTP.' }));
        this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.OTP }));
        return this.triggerConsent();
      } else if (available.includes(AuthenticationMode.MANUAL)) {
        this.authState.update((s) => ({ ...s, error: 'Face authentication failed. Falling back to Manual.' }));
        this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.MANUAL }));
        return this.triggerConsent();
      }
    }
    // Rule 2: OTP Auth Failed -> Check 3-Attempt Count
    if (currentMode === AuthenticationMode.OTP) {
      const nextCount = this.otpState().otpAttemptCount + 1;
      // The image appears to use authState rather than otpState here; preserved.
      this.authState.update((s) => ({ ...s, otpAttemptCount: nextCount }));
      if (nextCount < CKYC_OTP_MAX_ATTEMPTS) {
        this.otpState.update((s) => ({
          ...s,
          error: `Invalid OTP. Attempt ${nextCount} of ${CKYC_OTP_MAX_ATTEMPTS}.`,
        }));
        return of(false);
      } else {
        if (available.includes(AuthenticationMode.MANUAL)) {
          this.authState.update((s) => ({
            ...s,
            error: 'Maximum OTP attempts reached. Falling back to Manual verification.',
          }));
          this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.MANUAL }));
          return this.triggerConsent();
        } else {
          this.authState.update((s) => ({
            ...s,
            error: 'Maximum OTP attempts exceeded. Manual verification is not enabled.',
          }));
          return of(false);
        }
      }
    }
    // SOURCE GAP: image does not fully show remaining branches, if any.
    this.authState.update((s) => ({ ...s, error: 'Authentication request failed.' }));
    return of(false);
  }

  resendOtp(): Observable<boolean> {
    return this.triggerConsent();
  }

  validate(otp: string): Observable<boolean> {
    const request: IValidateConsentRequest = {
      attemptId: this.authState().attemptId!,
      consentType: this.authState().activeMode!,
      consentData: { otp: otp },
      searchAttemptedPhase: this.ckycSearchPhaseService.searchAttemptedPhase(),
    };
    return this.ckycApi.validateConsent(request).pipe(
      map((response) => {
        if (!response || !response.success) {
          return false;
        }
        this.flow.emitValidatedDetails(response.body);
        this.resetAuth();
        return true;
      }),
      catchError(() => {
        return of(false);
      }),
      finalize(() => {}),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  resetAuth(): void {
    this.authState.set({
      loading: false,
      attemptId: null,
      error: null,
      applicableModes: [],
      activeMode: null,
    });
    this.otpState.set({
      loading: false,
      error: null,
      generated: false,
      expiresAt: null,
      mobileNumber: null,
      otpAttemptCount: 0,
    });
  }
  /**
   * Helper method to process raw authentication modes and determine the active mode.
   * Image transcription: phase filtering followed by mode priority.
   */
  private determineAuthModes(
    rawModes: AuthenticationMode[],
    phase: SearchAttemptedPhase,
  ): { modes: AuthenticationMode[]; activeMode: AuthenticationMode | null } {
    // 1. Filter modes based on phase
    const modes = phase === 'PROFILE_CREATION'
      ? rawModes.filter((m) => m === AuthenticationMode.OTP)
      : rawModes;

    // 2. Evaluate priority conditions
    const hasFace = modes.includes(AuthenticationMode.FACEAUTH);
    const hasOtp = modes.includes(AuthenticationMode.OTP);
    const hasManual = modes.includes(AuthenticationMode.MANUAL);

    // Nullable, because the original fallback returns null for an empty array.
    let activeMode: AuthenticationMode | null;

    if (hasOtp && hasFace) {
      activeMode = AuthenticationMode.FACEAUTH;
    } else if (hasManual && hasFace) {
      activeMode = AuthenticationMode.MANUAL;
    } else {
      activeMode = modes[0] ?? null;
    }

    return { modes, activeMode };
  }

}
