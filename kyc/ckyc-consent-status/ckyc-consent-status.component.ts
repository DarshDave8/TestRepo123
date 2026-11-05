import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { approveIcon, closeIcon, dotIcon, downloadIcon, errorIcon, refreshIcon, sendIcon } from 'src/app/constants/icons.constants';
import { AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { AuthNodeStatus, ICkycAuthNodeConfig } from '../models/ckyc-onboarding.model';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

// Heading of each mode's table; the stacked screens read as steps.
const MODE_TITLES: Record<AuthenticationMode, string> = {
  [AuthenticationMode.MANUAL]: 'Manual authentication',
  [AuthenticationMode.FACEAUTH]: 'Face authentication',
  [AuthenticationMode.OTP]: 'OTP verification',
};

const STATUS_TEXT: Record<AuthNodeStatus, string> = {
  PENDING: 'Awaiting action',
  IN_PROGRESS: 'Calling',
  SUCCESS: 'Success',
  FAILED: 'Failed',
};

// Icon beside the status text, so Success / Failed do not rely on colour alone. IN_PROGRESS keeps its pulsing dot.
const STATUS_ICON: Record<AuthNodeStatus, IconDefinition | null> = {
  PENDING: dotIcon,
  IN_PROGRESS: null,
  SUCCESS: approveIcon,
  FAILED: closeIcon,
};

/**
 * Consent call history for one auth mode: a row per node of that mode that has been sent, plus the node that
 * waits for the user to send it (its row carries Trigger / Re-trigger).
 * Shown at the top of the Face, Physical and OTP screens. On the active screen it also shows the error message.
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
  readonly error = computed(() =>
    this.authStore.activeScreenMode() === this.mode() ? this.authStore.authState().error : null,
  );
  readonly isBusy = this.authStore.isBusy;
  readonly statusText = STATUS_TEXT;
  readonly statusIcon = STATUS_ICON;
  // Font Awesome icons from the app's icons.constants
  readonly errorIcon = errorIcon;
  readonly downloadIcon = downloadIcon;
  readonly refreshIcon = refreshIcon;
  readonly sendIcon = sendIcon;

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
