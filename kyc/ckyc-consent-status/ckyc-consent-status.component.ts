import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { approveIcon, closeIcon, dotIcon, downloadIcon, refreshIcon, sendIcon } from 'src/app/constants/icons.constants';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { ICkycAuthNodeConfig } from '../models/ckyc-onboarding.model';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

// Heading of each mode's table; the stacked screens read as steps.
const MODE_TITLES: Record<AuthenticationMode, string> = {
  [AuthenticationMode.MANUAL]: 'Manual authentication',
  [AuthenticationMode.FACEAUTH]: 'Face authentication',
  [AuthenticationMode.OTP]: 'OTP verification',
  [AuthenticationMode.CONSENT_AVAILABLE]: 'Existing consent',
};

// State of one call of a row: Trigger status = the consent call, Download / Verify status = the validate call.
type CallStatus = 'AWAITING' | 'CALLING' | 'SUCCESS' | 'FAILED';

// Icon beside the text, so the state does not rely on colour alone. CALLING keeps its pulsing dot.
const CALL_STATUS_ICON: Record<CallStatus, IconDefinition | null> = {
  AWAITING: dotIcon,
  CALLING: null,
  SUCCESS: approveIcon,
  FAILED: closeIcon,
};

// Each text names its call: on narrow screens the column headers are hidden.
const TRIGGER_STATUS_TEXT: Record<CallStatus, string> = {
  AWAITING: 'Awaiting action',
  CALLING: 'Calling',
  SUCCESS: 'Sent',
  FAILED: 'Send failed',
};
const DOWNLOAD_STATUS_TEXT: Record<CallStatus, string> = {
  AWAITING: 'Awaiting action',
  CALLING: 'Downloading',
  SUCCESS: 'Downloaded',
  FAILED: 'Download failed',
};
const VERIFY_STATUS_TEXT: Record<CallStatus, string> = {
  AWAITING: 'Awaiting action',
  CALLING: 'Verifying',
  SUCCESS: 'Verified',
  FAILED: 'Verification failed',
};

/**
 * Consent call history for one auth mode: a row per node of that mode that has been sent, plus the node that
 * waits for the user to send it (its row carries Trigger / Re-trigger). Each row shows its two calls apart:
 * Trigger status (consent) and Download status (validate; Verify status for OTP).
 * Shown at the top of the Face, Physical and OTP screens.
 */
@Component({
  selector: 'app-ckyc-consent-status',
  standalone: true,
  imports: [MatButtonModule, FontAwesomeModule],
  templateUrl: './ckyc-consent-status.component.html',
  styleUrl: './ckyc-consent-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycConsentStatusComponent {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input.required<AuthenticationMode>();
  // false for OTP: it is validated through the OTP form, not "Download Data".
  readonly downloadable = input(true);

  readonly captionId = computed(() => `consent-status-caption-${this.mode()}`);
  readonly caption = computed(() => MODE_TITLES[this.mode()]);
  // The node waiting for the user's send (e.g. OTP after Face), if it belongs to this table.
  private readonly awaitingNodeId = computed(() =>
    this.authStore.awaitingUserTrigger() ? (this.authStore.currentNode()?.id ?? null) : null,
  );
  readonly rows = computed(() =>
    this.authStore
      .authNodes()
      .filter((node) => node.mode === this.mode() && (node.status !== 'PENDING' || node.id === this.awaitingNodeId())),
  );
  readonly isBusy = this.authStore.isBusy;
  readonly callStatusIcon = CALL_STATUS_ICON;
  readonly triggerStatusText = TRIGGER_STATUS_TEXT;
  // OTP is validated through the OTP form: Verify status
  readonly validateStatusText = computed(() => (this.downloadable() ? DOWNLOAD_STATUS_TEXT : VERIFY_STATUS_TEXT));
  readonly validateStatusTitle = computed(() => (this.downloadable() ? 'Download status' : 'Verify status'));
  // Font Awesome icons from the app's icons.constants
  readonly downloadIcon = downloadIcon;
  readonly refreshIcon = refreshIcon;
  readonly sendIcon = sendIcon;

  // The consent call. From triggerSuccess, not node.status, which also turns FAILED when the downloads are used up.
  // null: the mode has no consent call (Existing consent).
  triggerStatus(node: ICkycAuthNodeConfig): CallStatus | null {
    if (!node.requiresTrigger) return null;
    if (node.status === 'IN_PROGRESS') return 'CALLING';
    if (node.triggerSuccess === null) return 'AWAITING';
    return node.triggerSuccess ? 'SUCCESS' : 'FAILED';
  }

  // The validate call. null: not tried yet. Existing consent has no consent call, so its running call is this one.
  validateStatus(node: ICkycAuthNodeConfig): CallStatus | null {
    if (!node.requiresTrigger && node.status === 'IN_PROGRESS') return 'CALLING';
    if (node.validateSuccess === null) return null;
    return node.validateSuccess ? 'SUCCESS' : 'FAILED';
  }

  canDownload(node: ICkycAuthNodeConfig): boolean {
    return this.downloadable() && this.authStore.canValidate(node);
  }

  downloadData(node: ICkycAuthNodeConfig): void {
    if (!this.canDownload(node) || this.isBusy()) return;
    this.authStore.validate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  // Trigger (not sent yet) / Re-trigger (last send failed) for the waiting node.
  canTrigger(node: ICkycAuthNodeConfig): boolean {
    return node.id === this.awaitingNodeId();
  }

  triggerNode(node: ICkycAuthNodeConfig): void {
    if (!this.canTrigger(node) || this.isBusy()) return;
    this.authStore.triggerAwaitingNode().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
