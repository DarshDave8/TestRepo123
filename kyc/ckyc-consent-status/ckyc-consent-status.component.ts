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

// What the Status column shows for a row: the row's state across both of its calls (send, then download / verify),
// not only the send. A sent consent is not green until its data is in. The icon keeps the meaning from relying on
// colour alone; "calling" has the pulsing dot instead.
export interface ConsentStatusView {
  text: string;
  icon: IconDefinition | null;
  tone: 'neutral' | 'calling' | 'success' | 'failed';
}

/**
 * Consent call history for one auth mode: a row per node of that mode that has been sent, plus the node that
 * waits for the user to send it (its row carries Trigger / Re-trigger).
 * Shown at the top of the Face, Physical and OTP screens. Auth errors show once, above all the tables.
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
  // Font Awesome icons from the app's icons.constants
  readonly downloadIcon = downloadIcon;
  readonly refreshIcon = refreshIcon;
  readonly sendIcon = sendIcon;

  /**
   * - Awaiting action: not sent yet (waits for Trigger)
   * - Calling: send running (or, for a mode without a send, its download)
   * - Send failed: the consent call failed
   * - Sent: consent sent, data not downloaded / OTP not verified yet
   * - Downloading: Download Data running for this row
   * - Download failed / Verification failed (OTP): the last download or verify failed
   * - Verified: data downloaded / OTP verified
   */
  statusView(node: ICkycAuthNodeConfig): ConsentStatusView {
    if (node.status === 'PENDING') return { text: 'Awaiting action', icon: dotIcon, tone: 'neutral' };
    if (node.status === 'IN_PROGRESS') return { text: 'Calling', icon: null, tone: 'calling' };
    if (node.validateSuccess === true) return { text: 'Verified', icon: approveIcon, tone: 'success' };
    if (node.triggerSuccess === false) return { text: 'Send failed', icon: closeIcon, tone: 'failed' };
    const isCurrent = this.authStore.currentNode()?.id === node.id;
    if (isCurrent && this.authStore.authState().loading) {
      return { text: this.downloadable() ? 'Downloading' : 'Verifying', icon: null, tone: 'calling' };
    }
    if (node.validateSuccess === false || node.status === 'FAILED') {
      const text = this.downloadable() ? 'Download failed' : 'Verification failed';
      return { text, icon: closeIcon, tone: 'failed' };
    }
    return { text: 'Sent', icon: sendIcon, tone: 'neutral' };
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
