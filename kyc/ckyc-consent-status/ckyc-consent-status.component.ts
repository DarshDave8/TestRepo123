import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { AUTH_MODE_LABELS, AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import { AuthNodeStatus, ICkycAuthNodeConfig } from '../models/ckyc-onboarding.model';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

const STATUS_TEXT: Record<AuthNodeStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'Calling',
  SUCCESS: 'Success',
  FAILED: 'Failed',
};

/**
 * Consent call history for one auth mode: a row per node of that mode that has been sent.
 * Shown at the top of the Face, Physical and OTP screens. On the active screen it also shows the error message.
 */
@Component({
  selector: 'app-ckyc-consent-status',
  standalone: true,
  imports: [MatButtonModule],
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
  readonly caption = computed(() => `Consent call status: ${AUTH_MODE_LABELS[this.mode()]}`);
  readonly rows = computed(() =>
    this.authStore.authNodes().filter((node) => node.mode === this.mode() && node.status !== 'PENDING'),
  );
  readonly error = computed(() =>
    this.authStore.activeScreenMode() === this.mode() ? this.authStore.authState().error : null,
  );
  readonly isBusy = this.authStore.isBusy;
  readonly statusText = STATUS_TEXT;

  canDownload(node: ICkycAuthNodeConfig): boolean {
    return this.downloadable() && this.authStore.canValidate(node);
  }

  downloadData(node: ICkycAuthNodeConfig): void {
    if (!this.canDownload(node) || this.isBusy()) return;
    this.authStore.validate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}
