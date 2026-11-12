// Screenshot transcription, compared with five additional photographs supplied on 2026-11-03; not a verified application build.
// Refactored to a queue-driven flow: every consent call is a node in authNodes, built from AUTH_CONFIG.
import { Injectable, inject, signal, computed } from '@angular/core';
import { defer, Observable, of, Subject } from 'rxjs';
import { tap, catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { CkycOnboardingService } from './ckyc-onboarding.service';
import {
  CKYC_ERROR_MESSAGES,
  AUTH_CONFIG,
  AUTH_FACTOR_LABELS,
  AUTH_MODE_LABELS,
  AuthenticationMode,
  AuthFactor,
  CKYC_OTP_TTL_SECONDS,
  ModeConfiguration,
  SearchAttemptedPhase,
} from '../constants/ckyc-onboarding.constants';
import { ckycErrorMessage } from '../utils/ckyc-error.util';
import { parseCkycTimestamp } from '../utils/ckyc-date.util';
import {
  AuthDomainState,
  ICkycAuthNodeConfig,
  ITriggerConsentRequest,
  IValidateConsentRequest,
  OtpDomainState,
} from '../models/ckyc-onboarding.model';
import { CkycFlowStateService } from './ckyc-flow-state.service';
import { CkycSharedStateService } from './ckyc-shared-state.service';
import { OtpIdentifier } from '../models/ckyc-consent-request.model';

const INITIAL_AUTH_STATE: AuthDomainState = { loading: false, attemptId: null, error: null };
const INITIAL_OTP_STATE: OtpDomainState = {
  generated: false,
  expiresAt: null,
  lastAttemptedAt: null,
  hasMobileNumber: false,
  hasEmailAddress: false,
  successMessage: null,
};

@Injectable({ providedIn: 'root' })
export class CkycAuthStateService {
  private readonly ckycSharedStateService = inject(CkycSharedStateService);
  private readonly ckycApi = inject(CkycOnboardingService);
  private readonly flow = inject(CkycFlowStateService);

  // Fired by resetAuth(): stops every running modes / consent / validate call, including the follow-up calls the
  // queue starts by itself (those outlive the component that started the first one). This is the teardown for
  // the service's own calls: takeUntilDestroyed would never fire, an app-wide service is never destroyed.
  private readonly cancelConsent$ = new Subject<void>();

  readonly authState = signal<AuthDomainState>(INITIAL_AUTH_STATE);
  readonly otpState = signal<OtpDomainState>(INITIAL_OTP_STATE);

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
  // Modes the flow has reached, in queue order. Each gets its screen, and earlier screens stay visible.
  readonly reachedModes = computed<readonly AuthenticationMode[]>(() => {
    const current = this._currentNodeIndex();
    const reached = this._authNodes().filter((node) => node.status !== 'PENDING' || node.order === current);
    return [...new Set(reached.map((node) => node.mode))];
  });
  // The last reached mode's screen is the active one: it shows the error message and the Back button.
  readonly activeScreenMode = computed<AuthenticationMode | null>(() => this.reachedModes().at(-1) ?? null);
  // A consent or validate call is running.
  readonly isBusy = computed(
    () => this.authState().loading || this._authNodes().some((node) => node.status === 'IN_PROGRESS'),
  );
  // The match card whose Authenticate did not start (modes did not load, or none is usable). The enquiry list
  // has no auth screen, so that card shows authState.error. Cleared when modes load again and on reset.
  private readonly _startFailedMatchKey = signal<string | null>(null);
  readonly startFailedMatchKey = this._startFailedMatchKey.asReadonly();

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
    this.resetAuth();
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
            const error = ckycErrorMessage(res, CKYC_ERROR_MESSAGES.AUTH_MODES_LOAD_FAILED);
            this.authState.update((s) => ({ ...s, error }));
            this.ckycSharedStateService.setManualVerificationEnabled(true);
            return;
          }
          this.otpState.update((s) => ({
            ...s,
            hasMobileNumber: res.body?.hasMobileNumber,
            hasEmailAddress: res.body?.hasEmailAddress,
          }));
          this.buildLinearQueue(phase, res.body?.applicableConsentTypes || []);
          this.authState.update((s) => ({ ...s, attemptId: res.body.attemptId }));
        }),
        map((res) => Boolean(res?.success)),
        catchError((err) => {
          const error = ckycErrorMessage(err, CKYC_ERROR_MESSAGES.AUTH_MODES_LOAD_FAILED);
          this.authState.update((s) => ({ ...s, error }));
          return of(false);
        }),
        finalize(() => this.authState.update((s) => ({ ...s, loading: false }))),
        takeUntil(this.cancelConsent$),
      );
  }

  /**
   * Starts this match's queue (after loadApplicableModes): sends the first node when it is autoTrigger,
   * otherwise it waits for the user. Returns false when no node is usable; manual verification is flagged.
   * CONSENT_AVAILABLE (consent already given) is first when the backend returns it: validate is called at once.
   */
  startQueue(): boolean {
    const first = this.currentNode();
    if (!first) {
      this.authState.update((s) => ({ ...s, error: CKYC_ERROR_MESSAGES.NO_AUTH_METHODS }));
      this.ckycSharedStateService.setManualVerificationEnabled(true);
      return false;
    }
    if (first.autoTrigger) {
      this.sendCurrentNode().subscribe();
    }
    return true;
  }

  /**
   * The current node's first call: the consent call, or, for a node without one (CONSENT_AVAILABLE), validate
   * straight away. That validate shows the node as "Calling"; afterwards the node stays ready, so a failed
   * download is retried with "Download Data".
   */
  private sendCurrentNode(): Observable<boolean> {
    const node = this.currentNode();
    if (!node) return of(false);
    if (node.requiresTrigger) return this.triggerConsent();
    return defer(() => {
      // IN_PROGRESS keeps isBusy true for the whole call: loadApplicableModes clears authState.loading while
      // this first validate is still running.
      this.updateNode(node.id, { status: 'IN_PROGRESS', lastError: null });
      return this.validate();
    }).pipe(
      finalize(() => {
        if (this.findNode(node.id)?.status === 'IN_PROGRESS') this.updateNode(node.id, { status: 'SUCCESS' });
      }),
    );
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
    const payload = {
      attemptId: this.authState().attemptId!,
      consentType: node.mode,
      leadId: this.ckycSharedStateService.leadId(),
      authFactor: node.subType,
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase(),
    } as ITriggerConsentRequest;
    return defer(() => {
      this.updateNode(node.id, { status: 'IN_PROGRESS', lastError: null });
      return this.ckycApi.triggerConsent(payload);
    }).pipe(
      map((response) => {
        this.setOtpAttemptTime(node.mode, response?.body?.timeStamp);
        if (!response?.success) {
          this.onTriggerFailure(node.id, ckycErrorMessage(response, CKYC_ERROR_MESSAGES.CONSENT_TRIGGER_FAILED(node.label)));
          return false;
        }
        this.onTriggerSuccess(node.id, response.messages);
        return true;
      }),
      catchError((error) => {
        this.setOtpAttemptTime(node.mode, error?.error?.body?.timeStamp);
        this.onTriggerFailure(node.id, ckycErrorMessage(error, CKYC_ERROR_MESSAGES.CONSENT_TRIGGER_FAILED(node.label)));
        return of(false);
      }),
      finalize(() => {
        // Unsubscribed before a response (Back, or the screen closed): the call never finished.
        if (this.findNode(node.id)?.status === 'IN_PROGRESS') this.updateNode(node.id, { status: 'PENDING' });
      }),
      takeUntil(this.cancelConsent$),
    );
  }

  /**
   * Sends the OTP again. Resends are the OTP's counted attempts (maxResends): only a resend the backend accepted
   * counts, and none is sent once they are used up. Wrong OTPs are not counted.
   */
  resendOtp(): Observable<boolean> {
    const node = this.currentNode();
    if (!node || !this.hasAttemptsLeft(node.resendCount, node.maxResends)) return of(false);
    return this.triggerConsent().pipe(
      tap((sent) => {
        const current = this.findNode(node.id);
        if (sent && current) this.updateNode(node.id, { resendCount: current.resendCount + 1 });
      }),
    );
  }

  // User-started send of a node that waits for the user ("Trigger OTP" / "Re-trigger OTP").
  triggerAwaitingNode(): Observable<boolean> {
    if (!this.awaitingUserTrigger()) return of(false);
    this.authState.update((s) => ({ ...s, error: null }));
    return this.sendCurrentNode();
  }

  /**
   * Validates the current node. A failure counts against the node's maxValidateAttempts (null = unlimited, as for
   * OTP, whose attempts are its resends); once used up, the queue moves on. FACEAUTH / PHYSICAL show the error
   * and stay, so "Download Data" can be retried.
   */
  validate(otp?: string, otpIdentifier?: OtpIdentifier): Observable<boolean> {
    const node = this.currentNode();
    if (!node) return of(false);
    // Our message when the backend sends none; the OTP card shows it under the code field.
    const validateFallback =
      node.mode === AuthenticationMode.OTP
        ? CKYC_ERROR_MESSAGES.OTP_VERIFY_FAILED
        : CKYC_ERROR_MESSAGES.CONSENT_VALIDATE_FAILED;
    const request: IValidateConsentRequest = {
      attemptId: this.authState().attemptId!,
      consentType: node.mode,
      leadId: this.ckycSharedStateService.leadId(),
      consentData: otp ? { otp, otpIdentifier } : {},
      searchAttemptedPhase: this.ckycSharedStateService.searchAttemptedPhase()!,
    };
    // Loading starts when the call does (on subscribe), like triggerConsent.
    return defer(() => {
      this.authState.update((s) => ({ ...s, loading: true, error: null }));
      return this.ckycApi.validateConsent(request);
    }).pipe(
      map((response) => {
        if (!response?.success) {
          return this.onValidateFailure(node.id, ckycErrorMessage(response, validateFallback));
        }
        // Keep the queue and screens as they are: the flow is done. The host resets when it leaves the page.
        this.updateNode(node.id, { validateSuccess: true, lastError: null });
        // Submit CKYC sends the validated attempt.
        this.flow.activeMatchSelection.update((selection) =>
          selection ? { ...selection, attemptId: response.body.attemptId } : selection,
        );
        this.flow.emitValidatedDetails(response.body);
        return true;
      }),
      catchError((error) => of(this.onValidateFailure(node.id, ckycErrorMessage(error, validateFallback)))),
      finalize(() => this.authState.update((s) => ({ ...s, loading: false }))),
      takeUntil(this.cancelConsent$),
    );
  }

  // A node that consent was sent for, still current, and not validated yet: "Download Data" may validate it.
  canValidate(node: ICkycAuthNodeConfig): boolean {
    return node.id === this.currentNode()?.id && node.status === 'SUCCESS' && node.validateSuccess !== true;
  }

  // Back from the auth screens: reset everything for this match and return to the enquiry list.
  cancelConsentFlow(): void {
    this.resetAuth();
    this.flow.returnToEnquiryReceived();
  }

  /**
   * Full reset: stop every running consent / validate call (including calls the queue started by itself),
   * clear the queue and the auth / OTP state. The service is app-wide, so the onboarding and DV flow screens
   * call this when they are destroyed; otherwise a late response could act on the next session.
   */
  resetAuth(): void {
    this.cancelConsent$.next();
    this.clearQueue();
    this._startFailedMatchKey.set(null);
    this.authState.set(INITIAL_AUTH_STATE);
    this.otpState.set(INITIAL_OTP_STATE);
  }

  /**
   * The backend's time of the last OTP send (sent or failed), shown on the OTP screen. Kept while the next send
   * runs, so it does not flicker; replaced by that send's time, or cleared when its response has none.
   */
  private setOtpAttemptTime(mode: AuthenticationMode, timeStamp?: string | null): void {
    if (mode !== AuthenticationMode.OTP) return;
    this.otpState.update((s) => ({ ...s, lastAttemptedAt: parseCkycTimestamp(timeStamp) }));
  }

  // Authenticate did not start for this match card: the card shows the auth error (see startFailedMatchKey).
  markStartFailed(matchKey: string): void {
    this._startFailedMatchKey.set(matchKey);
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
      requiresTrigger: config.requiresTrigger ?? true,
      autoTrigger: config.autoTrigger,
      triggerSuccess: null,
      validateSuccess: null,
      triggerAttemptCount: 0,
      maxTriggerAttempts: config.maxTriggerAttempts,
      validateAttemptCount: 0,
      maxValidateAttempts: config.maxValidateAttempts,
      resendCount: 0,
      maxResends: config.maxResends ?? null,
      lastError: null,
    };
  }

  private clearQueue(): void {
    this._authNodes.set([]);
    this._currentNodeIndex.set(null);
  }

  // ---- Auth queue: progress ----

  private onTriggerSuccess(nodeId: string, messages?: string[]): void {
    const node = this.updateNode(nodeId, { status: 'SUCCESS', triggerSuccess: true, lastError: null });
    // Success after an error (failed send, re-trigger, resend, fallback): the earlier error no longer applies.
    this.authState.update((s) => ({ ...s, error: null }));
    if (node?.mode === AuthenticationMode.OTP) {
      this.otpState.update((s) => ({
        ...s,
        generated: true,
        expiresAt: Date.now() + CKYC_OTP_TTL_SECONDS * 1000,
        successMessage: messages?.join(', ') || null,
      }));
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
    // The last send failed: drop the "OTP sent" banner of an earlier send.
    if (node.mode === AuthenticationMode.OTP) this.otpState.update((s) => ({ ...s, successMessage: null }));
    if (this.hasAttemptsLeft(node.triggerAttemptCount, node.maxTriggerAttempts)) {
      // Stay on this node; the user sends it again (e.g. "Re-trigger OTP"). Backend message first (it used to be
      // replaced by "<label> failed. Please try again.").
      this.authState.update((s) => ({ ...s, error: message }));
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
    // The OTP screen shows its own attempt count; FACEAUTH / PHYSICAL show the error message.
    if (node.mode !== AuthenticationMode.OTP) {
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
      this.authState.update((s) => ({ ...s, error: CKYC_ERROR_MESSAGES.AUTH_METHODS_EXHAUSTED(usedUp.label) }));
      this.ckycSharedStateService.setManualVerificationEnabled(true);
      return;
    }
    this._currentNodeIndex.set(next.order);
    if (next.mode !== usedUp.mode) {
      this.authState.update((s) => ({
        ...s,
        error: `${AUTH_MODE_LABELS[usedUp.mode]} failed. Falling back to ${AUTH_MODE_LABELS[next.mode]}.`,
      }));
      this.otpState.update((s) => ({
        ...s,
        generated: false,
        expiresAt: null,
        lastAttemptedAt: null,
        successMessage: null,
      }));
    }
    if (next.autoTrigger) {
      this.sendCurrentNode().subscribe();
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
