// Screenshot transcription, compared with five additional photographs supplied on 2026-11-03; not a verified application build.
// Refactored to a queue-driven flow: every consent call is a node in authNodes, built from AUTH_CONFIG.
import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, Observable, of, Subject } from 'rxjs';
import { tap, catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { CkycOnboardingService } from './ckyc-onboarding.service';
import {
  AUTH_CONFIG,
  AUTH_FACTOR_LABELS,
  AUTH_MODE_LABELS,
  AuthenticationMode,
  AuthFactor,
  CKYC_OTP_TTL_SECONDS,
  ModeConfiguration,
  SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import {
  AuthDomainState,
  AuthNodeStatus,
  ICkycAuthNodeConfig,
  ITriggerConsentRequest,
  IValidateConsentRequest,
  OtpDomainState,
} from '../models/ckyc-onboarding.model';
import { CkycFlowStateService } from './ckyc-flow-state.service';
import { CkycSharedStateService } from './ckyc-shared-state.service';
import { CkycConsentAttempt, OtpIdentifier } from '../models/ckyc-consent-request.model';

// Step 3a compatibility: today's screens still render consentAttempts. Removed in 3b.
const ATTEMPT_STATUS: Record<Exclude<AuthNodeStatus, 'PENDING'>, CkycConsentAttempt['status']> = {
  IN_PROGRESS: 'Calling',
  SUCCESS: 'Success',
  FAILED: 'Failed',
};

@Injectable({ providedIn: 'root' })
export class CkycAuthStateService {
  private readonly ckycSharedStateService = inject(CkycSharedStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ckycApi = inject(CkycOnboardingService);
  private readonly flow = inject(CkycFlowStateService);

  // Fired by cancelConsentFlow(): stops every running consent / validate call, including the follow-up
  // calls the queue starts by itself (those outlive the component that started the first one).
  private readonly cancelConsent$ = new Subject<void>();

  // Auth queue for the current match: one node per consent call, in fallback order (built from AUTH_CONFIG).
  private readonly _authNodes = signal<readonly ICkycAuthNodeConfig[]>([]);
  readonly authNodes = this._authNodes.asReadonly();
  // Index of the node the flow is on; null = no queue, or every node is used up.
  private readonly _currentNodeIndex = signal<number | null>(null);
  readonly currentNode = computed<ICkycAuthNodeConfig | null>(() => {
    const index = this._currentNodeIndex();
    return index === null ? null : (this._authNodes()[index] ?? null);
  });
  // The current node waits for the user to send it (autoTrigger false), e.g. the "Trigger OTP" button.
  readonly awaitingUserTrigger = computed(() => {
    const node = this.currentNode();
    return node !== null && !node.autoTrigger && (node.status === 'PENDING' || node.status === 'FAILED');
  });

  // ---- Step 3a compatibility for today's screens (removed in 3b, when the screens read the nodes) ----
  readonly consentAttempts = computed<readonly CkycConsentAttempt[]>(() =>
    this._authNodes()
      .filter((node) => node.status !== 'PENDING')
      .map((node) => ({
        id: node.order,
        consentType: node.mode,
        authFactor: node.subType,
        status: ATTEMPT_STATUS[node.status as Exclude<AuthNodeStatus, 'PENDING'>],
      })),
  );
  readonly otpFallbackPending = this.awaitingUserTrigger;

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
   * Loads the modes the backend allows for this match and builds the auth queue from them.
   * AUTH_CONFIG decides which of those modes are used per phase (Profile Creation: OTP only).
   */
  loadApplicableModes(
    enquiryId: string,
    enquiryResponseId: string,
    leadId: string | null,
    phase: SearchAttemptedPhase,
  ): Observable<boolean> {
    this.clearQueue();
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
          this.otpState.update((s) => ({
            ...s,
            hasMobileNumber: res.body?.hasMobileNumber,
            hasEmailAddress: res.body?.hasEmailAddress,
          }));
          this.buildLinearQueue(phase, res.body?.applicableConsentTypes || []);
          const queuedModes = [...new Set(this._authNodes().map((node) => node.mode))];
          this.authState.update((s) => ({
            ...s,
            activeMode: this.currentNode()?.mode ?? null,
            attemptId: res.body.attemptId,
            applicableModes: queuedModes,
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

  // Step 3a compatibility: the enquiry details screen still asks for the starting mode. Removed in 3b.
  resolveStartingMode(_modes: AuthenticationMode[], _phase: SearchAttemptedPhase): AuthenticationMode | null {
    return this.currentNode()?.mode ?? null;
  }

  /**
   * Sends the consent call for the current node.
   * - Success: the node waits for validation ("Download Data" / OTP entry).
   * - Failure: retried by the user while the node has trigger attempts left, otherwise the queue moves on
   *   (and sends the next node itself when that node is autoTrigger).
   */
  triggerConsent(): Observable<boolean> {
    const node = this.currentNode();
    if (!node) return of(false);
    let payload = {
      attemptId: this.authState().attemptId!,
      consentType: node.mode,
      leadId: this.ckycSharedStateService.leadId(),
      authFactor: node.subType,
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase(),
    } as ITriggerConsentRequest;
    if (this.otpState().mobileNumber) {
      payload = { ...payload, mobileNumber: this.otpState().mobileNumber };
    }
    return defer(() => {
      this.updateNode(node.id, { status: 'IN_PROGRESS', lastError: null });
      this.otpState.update((s) => ({ ...s, loading: true, error: null }));
      return this.ckycApi.triggerConsent(payload);
    }).pipe(
      map((response) => {
        if (!response?.success) {
          this.onTriggerFailure(node.id, response?.messages?.join(', ') || `${node.label} failed.`);
          return false;
        }
        this.onTriggerSuccess(node.id);
        return true;
      }),
      catchError(() => {
        this.onTriggerFailure(node.id, `${node.label} failed.`);
        return of(false);
      }),
      finalize(() => {
        // Unsubscribed before a response (Back, or the screen closed): the call never finished.
        if (this.findNode(node.id)?.status === 'IN_PROGRESS') this.updateNode(node.id, { status: 'PENDING' });
        // A failed call may already have started the next node's call.
        if (!this._authNodes().some((n) => n.status === 'IN_PROGRESS')) {
          this.otpState.update((s) => ({ ...s, loading: false }));
        }
      }),
      takeUntil(this.cancelConsent$),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  // Sends the OTP again. Sends never count as OTP attempts; only failed validations do.
  resendOtp(): Observable<boolean> {
    return this.triggerConsent();
  }

  // Step 3a compatibility: the Face screen's "Trigger OTP" / "Re-trigger OTP" buttons. Removed in 3b.
  triggerOtpFallback(): Observable<boolean> {
    if (!this.awaitingUserTrigger()) return of(false);
    this.authState.update((s) => ({ ...s, error: null }));
    return this.triggerConsent();
  }

  /**
   * Validates the current node. A failure counts against the node's maxValidateAttempts (null = unlimited);
   * once used up, the queue moves on. FACEAUTH / PHYSICAL show the error and stay, so "Download Data" can be retried.
   */
  validate(otp?: string, otpIdentifier?: OtpIdentifier): Observable<boolean> {
    const node = this.currentNode();
    if (!node) return of(false);
    const request: IValidateConsentRequest = {
      attemptId: this.authState().attemptId!,
      consentType: node.mode,
      leadId: this.ckycSharedStateService.leadId(),
      consentData: otp ? { otp, otpIdentifier } : {},
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase()!,
    };
    this.authState.update((s) => ({ ...s, loading: true, error: null }));
    return this.ckycApi.validateConsent(request).pipe(
      map((response) => {
        if (!response?.success) {
          return this.onValidateFailure(
            node.id,
            response?.messages?.join(', ') || 'Unable to validate consent. Please try again.',
          );
        }
        this.updateNode(node.id, { validateSuccess: true, lastError: null });
        this.flow.emitValidatedDetails(response.body);
        this.resetAuth();
        return true;
      }),
      catchError(() => of(this.onValidateFailure(node.id, 'Unable to validate consent. Please try again.'))),
      finalize(() => this.authState.update((s) => ({ ...s, loading: false }))),
      takeUntil(this.cancelConsent$),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /**
   * Back from an auth step: stop every running call for this match (no further queued calls, no late
   * navigation) and clear its state, so the next "Download Data" starts clean.
   */
  cancelConsentFlow(): void {
    this.cancelConsent$.next();
    this.clearQueue();
    this.resetAuth();
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

  // ---- Auth queue: building ----

  /**
   * Builds this match's queue from AUTH_CONFIG[phase], in the configured fallback order:
   * - a mode is used only if the backend returned it and it is enabled;
   * - a mode with factors gets one node per enabled factor (DOB -> RELATION -> BIRTHYEARPINCODE),
   *   and is skipped when every factor is off;
   * - a mode without factors (OTP) gets one node.
   * The flow starts on the first node.
   */
  private buildLinearQueue(phase: SearchAttemptedPhase, applicableModes: readonly AuthenticationMode[]): void {
    const nodes: ICkycAuthNodeConfig[] = [];
    for (const config of AUTH_CONFIG[phase]) {
      if (!config.enabled || !applicableModes.includes(config.mode)) continue;
      if (!config.factors) {
        nodes.push(this.buildAuthNode(config, null, nodes.length));
        continue;
      }
      for (const factor of Object.values(AuthFactor)) {
        if (config.factors[factor]) {
          nodes.push(this.buildAuthNode(config, factor, nodes.length));
        }
      }
    }
    this._authNodes.set(nodes);
    this._currentNodeIndex.set(nodes.length > 0 ? 0 : null);
  }

  private buildAuthNode(config: ModeConfiguration, subType: AuthFactor | null, order: number): ICkycAuthNodeConfig {
    return {
      id: subType ? `${config.mode}_${subType}` : config.mode,
      mode: config.mode,
      subType,
      label: subType ? `${AUTH_MODE_LABELS[config.mode]} ${AUTH_FACTOR_LABELS[subType]}` : AUTH_MODE_LABELS[config.mode],
      order,
      status: 'PENDING',
      autoTrigger: config.autoTrigger,
      triggerSuccess: null,
      validateSuccess: null,
      triggerAttemptCount: 0,
      maxTriggerAttempts: config.maxTriggerAttempts,
      validateAttemptCount: 0,
      maxValidateAttempts: config.maxValidateAttempts,
      lastError: null,
    };
  }

  private clearQueue(): void {
    this._authNodes.set([]);
    this._currentNodeIndex.set(null);
  }

  // ---- Auth queue: progress ----

  private onTriggerSuccess(nodeId: string): void {
    const node = this.updateNode(nodeId, { status: 'SUCCESS', triggerSuccess: true, lastError: null });
    if (node?.mode === AuthenticationMode.OTP) {
      this.otpState.update((s) => ({ ...s, generated: true, expiresAt: Date.now() + CKYC_OTP_TTL_SECONDS * 1000 }));
    }
  }

  private onTriggerFailure(nodeId: string, message: string): void {
    const previous = this.findNode(nodeId);
    if (!previous) return;
    const node = this.updateNode(nodeId, {
      status: 'FAILED',
      triggerSuccess: false,
      triggerAttemptCount: previous.triggerAttemptCount + 1,
      lastError: message,
    })!;
    if (this.hasAttemptsLeft(node.triggerAttemptCount, node.maxTriggerAttempts)) {
      // Stay on this node; the user sends it again (e.g. "Re-trigger OTP").
      this.authState.update((s) => ({ ...s, error: `${node.label} failed. Please try again.` }));
      return;
    }
    this.moveToNextNode(node);
  }

  // Returns false, so validate() can return it directly.
  private onValidateFailure(nodeId: string, message: string): false {
    const previous = this.findNode(nodeId);
    if (!previous) return false;
    const node = this.updateNode(nodeId, {
      validateSuccess: false,
      validateAttemptCount: previous.validateAttemptCount + 1,
      lastError: message,
    })!;
    if (node.mode === AuthenticationMode.OTP) {
      // Step 3a compatibility: the OTP screen still reads otpState.otpAttemptCount. Removed in 3b.
      this.otpState.update((s) => ({ ...s, otpAttemptCount: node.validateAttemptCount }));
    } else {
      this.authState.update((s) => ({ ...s, error: message }));
    }
    if (!this.hasAttemptsLeft(node.validateAttemptCount, node.maxValidateAttempts)) {
      this.updateNode(nodeId, { status: 'FAILED' });
      this.moveToNextNode(node);
    }
    return false;
  }

  /**
   * Moves past a used-up node. No node left -> manual verification. Otherwise the next node becomes current,
   * and is sent right away when it is autoTrigger (else it waits for the user).
   */
  private moveToNextNode(usedUp: ICkycAuthNodeConfig): void {
    const next = this._authNodes()[usedUp.order + 1];
    if (!next) {
      this._currentNodeIndex.set(null);
      this.authState.update((s) => ({ ...s, error: `${usedUp.label} failed. No authentication methods remain.` }));
      this.ckycSharedStateService.setManualVerificationEnabled(true);
      return;
    }
    this._currentNodeIndex.set(next.order);
    if (next.mode !== usedUp.mode) {
      this.authState.update((s) => ({
        ...s,
        activeMode: next.mode,
        error: `${AUTH_MODE_LABELS[usedUp.mode]} failed. Falling back to ${AUTH_MODE_LABELS[next.mode]}.`,
      }));
      this.otpState.update((s) => ({ ...s, generated: false, expiresAt: null }));
    }
    if (next.autoTrigger) {
      this.triggerConsent().subscribe();
    }
    // Step 3a compatibility: today only one auth screen shows at a time. Removed in 3b (stacked screens).
    if (next.mode !== usedUp.mode && next.autoTrigger && next.mode === AuthenticationMode.FACEAUTH) {
      this.flow.goToStep('face');
    }
  }

  private hasAttemptsLeft(used: number, max: number | null): boolean {
    return max === null || used < max;
  }

  private findNode(nodeId: string): ICkycAuthNodeConfig | undefined {
    return this._authNodes().find((node) => node.id === nodeId);
  }

  // Returns the updated node (undefined if the queue was cleared meanwhile).
  private updateNode(nodeId: string, patch: Partial<ICkycAuthNodeConfig>): ICkycAuthNodeConfig | undefined {
    this._authNodes.update((nodes) => nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)));
    return this.findNode(nodeId);
  }
}
