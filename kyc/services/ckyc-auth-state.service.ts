// Screenshot transcription (2026-10-31 photographs of the working tree), not a verified source file.
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, Observable, of } from 'rxjs';
import { tap, catchError, finalize, map } from 'rxjs/operators';
import { CkycOnboardingService } from './ckyc-onboarding.service';
import {
  AuthenticationMode,
  AuthFactor,
  CKYC_DV_FACTOR_FLAGS,
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
import { CkycSharedStateService } from './ckyc-shared-state.service';
import { CkycConsentAttempt, OtpIdentifier } from '../models/ckyc-consent-request.model';

@Injectable({ providedIn: 'root' })
export class CkycAuthStateService {
  private readonly ckycSharedStateService = inject(CkycSharedStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ckycApi = inject(CkycOnboardingService);
  private readonly flow = inject(CkycFlowStateService);
  private currentFactor: AuthFactor | null = null;
  // readonly searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);

  private nextConsentAttemptId = 0;
  private readonly _consentAttempts = signal<readonly CkycConsentAttempt[]>([]);
  readonly consentAttempts = this._consentAttempts.asReadonly();

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
    hasMobileNumber: false,
    hasEmailAddress: false,
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
    this.currentFactor = null;
    this._consentAttempts.set([]);
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
            this.ckycSharedStateService.setManualVerificationEnabled(true);
            return;
          }
          const rawModes = res.body?.applicableConsentTypes || [];
          this.otpState.update((s) => ({
            ...s,
            hasMobileNumber: res.body?.hasMobileNumber,
            hasEmailAddress: res.body?.hasEmailAddress,
          }));
          const { modes, activeMode } = this.determineAuthModes(rawModes, phase);
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
        finalize(() => this.authState.update((s) => ({ ...s, loading: false }))),
        takeUntilDestroyed(this.destroyRef),
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

    if (phase === SearchAttemptedPhase.DIGITAL_VERIFICATION) {
      if (modes.includes(AuthenticationMode.OTP) && modes.includes(AuthenticationMode.FACEAUTH)) {
        return AuthenticationMode.FACEAUTH;
      } else if (modes.includes(AuthenticationMode.MANUAL)) {
        return AuthenticationMode.MANUAL;
      }
    }
    if (modes.includes(AuthenticationMode.FACEAUTH)) return AuthenticationMode.FACEAUTH;
    if (modes.includes(AuthenticationMode.OTP)) return AuthenticationMode.OTP;
    if (modes.includes(AuthenticationMode.MANUAL)) return AuthenticationMode.MANUAL;

    return null;
  }

  triggerConsent(): Observable<boolean> {
    // First consent call of a DV factor chain (FACE in OTP + FACE; PHYSICAL or FACE in PHYSICAL + FACE):
    // start with the first enabled factor.
    if (
      this.currentFactor === null &&
      ((this.authState().activeMode === AuthenticationMode.FACEAUTH && this.isOtpWithFaceMode()) ||
        ([AuthenticationMode.MANUAL, AuthenticationMode.FACEAUTH].includes(this.authState().activeMode!) &&
          this.isManualWithFaceMode()))
    ) {
      this.currentFactor = this.nextFactor(null);
    }
    if (
      this.authState().activeMode === AuthenticationMode.FACEAUTH &&
      this.isOtpWithFaceMode() &&
      CKYC_DV_FACTOR_FLAGS.masterEnabled &&
      this.currentFactor === null
    ) {
      // Master ON with no enabled factors goes directly to the Trigger OTP step.
      return defer(() => this.handleAuthFailure()).pipe(takeUntilDestroyed(this.destroyRef));
    }
    let payload = {
      attemptId: this.authState().attemptId!,
      consentType: this.authState().activeMode!,
      leadId: this.ckycSharedStateService.leadId(),
      authFactor: this.currentFactor,
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase(),
    } as ITriggerConsentRequest;
    if (this.otpState().mobileNumber) {
      payload = { ...payload, mobileNumber: this.otpState().mobileNumber };
    }
    // this.authState.update((s) => ({ ...s, activeMode: payload.consentType }));
    return defer(() => {
      this.otpState.update((s) => ({ ...s, loading: true, error: null }));
      const attemptId =
        payload.searchAttemptedPhase === SearchAttemptedPhase.DIGITAL_VERIFICATION ? ++this.nextConsentAttemptId : null;
      if (attemptId !== null) {
        this._consentAttempts.update((attempts) => [
          ...attempts,
          {
            id: attemptId,
            consentType: payload.consentType,
            authFactor: payload.authFactor,
            status: 'Calling',
          },
        ]);
      }
      return this.ckycApi.triggerConsent(payload).pipe(
        // Record this request's result before handleAuthFailure starts the next one.
        tap({
          next: (response) => this.setConsentAttemptStatus(attemptId, response?.success ? 'Success' : 'Failed'),
          error: () => this.setConsentAttemptStatus(attemptId, 'Failed'),
        }),
        finalize(() => this.setConsentAttemptStatus(attemptId, 'Cancelled')),
      );
    }).pipe(
      map((response) => {
        if (!response || !response.success) {
          this.handleAuthFailure().subscribe();
          this.ckycSharedStateService.setManualVerificationEnabled(true); //error occured so set manual true
          return false;
        }
        if (payload.consentType === AuthenticationMode.OTP) {
          this.otpState.update((s) => ({
            ...s,
            generated: true,
            expiresAt: Date.now() + CKYC_OTP_TTL_SECONDS * 1000,
          }));
          const currentOtpAttemptedCount = this.otpState().otpAttemptCount;
          this.otpState.update((s) => ({ ...s, otpAttemptCount: currentOtpAttemptedCount + 1 }));
        }
        return true;
      }),
      catchError(() => {
        this.handleAuthFailure().subscribe();
        return of(false);
      }),
      finalize(() => {
        // A failed call may have already started the next DV factor request.
        if (
          (this.isOtpWithFaceMode() || this.isManualWithFaceMode()) &&
          this.consentAttempts().some((attempt) => attempt.status === 'Calling')
        )
          return;
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

  //TODO: logic to be redefined and call to be move from triggerConsent to validate consent
  handleAuthFailure(): Observable<boolean> {
    const currentMode = this.authState().activeMode;
    const available = this.authState().applicableModes;
    // DV without OTP: finish MANUAL factors, then FACE factors, and stop.
    if (
      this.isManualWithFaceMode() &&
      (currentMode === AuthenticationMode.MANUAL || currentMode === AuthenticationMode.FACEAUTH)
    ) {
      if (this.currentFactor !== null) {
        const next = this.nextFactor(this.currentFactor);
        if (next !== null) {
          this.currentFactor = next;
          return this.triggerConsent();
        }
      }
      this.currentFactor = null;
      if (currentMode === AuthenticationMode.MANUAL) {
        this.startFaceConsent();
        return of(false);
      }
      this.authState.update((s) => ({ ...s, error: 'Face authentication failed. No authentication factors remain.' }));
      return of(false);
    }
    // Rule 1: Face Auth Failed -> Fallback to OTP or MANUAL
    if (currentMode === AuthenticationMode.FACEAUTH) {
      if (this.isOtpWithFaceMode()) {
        const next = this.nextFactor(this.currentFactor);
        if (next !== null) {
          this.currentFactor = next;
          return this.triggerConsent();
        }
        // No factor left -> clear it and use the OTP fallback below.
        this.currentFactor = null;
      }
      if (available.includes(AuthenticationMode.OTP)) {
        this.authState.update((s) => ({ ...s, error: 'Face authentication failed. Falling back to OTP.' }));
        this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.OTP }));
        this.otpState.update((s) => ({ ...s, generated: false, expiresAt: null }));
        // DV OTP + FACE: wait for the Trigger OTP button when switching to OTP.
        return this.isOtpWithFaceMode() ? of(false) : this.triggerConsent();
      } else if (available.includes(AuthenticationMode.MANUAL)) {
        this.authState.update((s) => ({ ...s, error: 'Face authentication failed. Falling back to Manual.' }));
        this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.MANUAL }));
        return this.triggerConsent();
      }
    }
    // Rule 2: OTP Auth Failed -> Check 3-Attempt Count
    if (currentMode === AuthenticationMode.OTP) {
      const nextCount = this.otpState().otpAttemptCount + 1;
      this.authState.update((s) => ({ ...s, otpAttemptCount: nextCount }));
      if (nextCount < CKYC_OTP_MAX_ATTEMPTS) {
        this.otpState.update((s) => ({
          ...s,
          error: `Invalid OTP. Attempt ${nextCount} of ${CKYC_OTP_MAX_ATTEMPTS}.`,
        }));
        return of(false);
      } else {
        this.ckycSharedStateService.setManualVerificationEnabled(true); //set manual true as max otp attempt exausted
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
    this.authState.update((s) => ({ ...s, error: 'Authentication request failed.' }));
    return of(false);
  }

  resendOtp(): Observable<boolean> {
    return this.triggerConsent();
  }

  validate(otp?: string, otpIdentifier?: OtpIdentifier): Observable<boolean> {
    const request: IValidateConsentRequest = {
      attemptId: this.authState().attemptId!,
      consentType: this.authState().activeMode!,
      leadId: this.ckycSharedStateService.leadId(),
      // consentData: { otp: otp, otpIdentifier: otpIdentifier },
      consentData: otp ? { otp, otpIdentifier } : {},
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase()!,
    };
    this.authState.update((s) => ({ ...s, loading: true, error: null }));
    const validationFailed = (message: string): boolean => {
      if (request.consentType === AuthenticationMode.FACEAUTH && this.isOtpWithFaceMode()) {
        // OTP + FACE: only switch to OTP so the Trigger OTP button shows.
        this.currentFactor = null;
        this.authState.update((s) => ({
          ...s,
          activeMode: AuthenticationMode.OTP,
          error: 'Face authentication failed. Falling back to OTP.',
        }));
        this.otpState.update((s) => ({ ...s, generated: false, expiresAt: null }));
      } else if (request.consentType !== AuthenticationMode.OTP) {
        this.authState.update((s) => ({ ...s, error: message }));
      }
      return false;
    };
    return this.ckycApi.validateConsent(request).pipe(
      map((response) => {
        if (!response || !response.success) {
          return validationFailed(response?.messages?.join(', ') || 'Unable to validate consent. Please try again.');
        }
        this.flow.emitValidatedDetails(response.body);
        this.resetAuth();
        return true;
      }),
      catchError(() => {
        return of(validationFailed('Unable to validate consent. Please try again.'));
      }),
      finalize(() => this.authState.update((s) => ({ ...s, loading: false }))),
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
      hasMobileNumber: false,
      hasEmailAddress: false,
    });
  }

  /**
   * Helper method to process raw authentication modes and determine the active mode.
   */
  private determineAuthModes(
    rawModes: AuthenticationMode[],
    phase: SearchAttemptedPhase,
  ): { modes: AuthenticationMode[]; activeMode: AuthenticationMode | null } {
    // 1. Filter modes based on phase
    const modes = phase === 'PROFILE_CREATION' ? rawModes.filter((m) => m === AuthenticationMode.OTP) : rawModes;

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

  // ---- DV factor consent helpers ----

  private startFaceConsent(): void {
    this.currentFactor = null;
    this.authState.update((s) => ({ ...s, activeMode: AuthenticationMode.FACEAUTH, error: null }));
    // The face component's ngOnInit owns the first call after this handoff.
    this.flow.goToStep('face');
  }

  private isManualWithFaceMode(): boolean {
    const modes = this.authState().applicableModes;
    return (
      this.ckycSharedStateService.searchAttemptedPhase() === SearchAttemptedPhase.DIGITAL_VERIFICATION &&
      modes.includes(AuthenticationMode.MANUAL) &&
      modes.includes(AuthenticationMode.FACEAUTH) &&
      !modes.includes(AuthenticationMode.OTP)
    );
  }

  // True only in Digital Verification when the backend allows both OTP and FACE.
  private isOtpWithFaceMode(): boolean {
    const modes = this.authState().applicableModes;
    return (
      this.ckycSharedStateService.searchAttemptedPhase() === SearchAttemptedPhase.DIGITAL_VERIFICATION &&
      modes.includes(AuthenticationMode.OTP) &&
      modes.includes(AuthenticationMode.FACEAUTH)
    );
  }

  // Is this factor switched on? Master OFF means every factor is off.
  private isEnabled(factor: AuthFactor): boolean {
    if (!this.isManualWithFaceMode() && !CKYC_DV_FACTOR_FLAGS.masterEnabled) return false;
    switch (factor) {
      case AuthFactor.DOB:
        return CKYC_DV_FACTOR_FLAGS.dob;
      case AuthFactor.RELATION:
        return CKYC_DV_FACTOR_FLAGS.relation;
      case AuthFactor.BIRTHYEARPINCODE:
        return CKYC_DV_FACTOR_FLAGS.birthYearPincode;
      default:
        return false;
    }
  }

  // Fixed order: DOB -> RELATION -> BIRTHYEARPINCODE.
  // Pass null to get the first enabled factor. Returns null when no factor is left (-> OTP).
  private nextFactor(current: AuthFactor | null): AuthFactor | null {
    switch (current) {
      case null:
        if (this.isEnabled(AuthFactor.DOB)) return AuthFactor.DOB;
        if (this.isEnabled(AuthFactor.RELATION)) return AuthFactor.RELATION;
        if (this.isEnabled(AuthFactor.BIRTHYEARPINCODE)) return AuthFactor.BIRTHYEARPINCODE;
        return null;
      case AuthFactor.DOB:
        if (this.isEnabled(AuthFactor.RELATION)) return AuthFactor.RELATION;
        if (this.isEnabled(AuthFactor.BIRTHYEARPINCODE)) return AuthFactor.BIRTHYEARPINCODE;
        return null;
      case AuthFactor.RELATION:
        if (this.isEnabled(AuthFactor.BIRTHYEARPINCODE)) return AuthFactor.BIRTHYEARPINCODE;
        return null;
      default:
        return null;
    }
  }

  private setConsentAttemptStatus(id: number | null, status: CkycConsentAttempt['status']): void {
    if (id === null) return;
    this._consentAttempts.update((attempts) =>
      attempts.map((attempt) => (attempt.id === id && attempt.status === 'Calling' ? { ...attempt, status } : attempt)),
    );
  }
}
