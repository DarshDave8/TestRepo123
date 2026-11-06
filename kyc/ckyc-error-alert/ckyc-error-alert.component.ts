import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { closeIcon, errorIcon } from 'src/app/constants/icons.constants';
import { AuthenticationMode, CKYC_ERROR_TITLES, CkycErrorScope } from '../constants/ckyc-onboarding.constants';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';
import { CkycFlowStateService } from '../services/ckyc-flow-state.service';

interface CkycActiveError {
  title: string;
  message: string;
}

/**
 * Error alert for one part of the CKYC flow, placed next to that part (`scope`):
 * - enquiry: under the search form (search failed, no record found)
 * - history: in the enquiry list (history could not be loaded)
 * - auth:    with `mode`, in that mode's consent table, only while it is the active screen (send / verify errors);
 *            without `mode`, under the match card, only while no consent table is on screen (modes failed to load)
 * - submit:  above Submit CKYC (update enquiries / submit)
 * So each error shows once, in one place. The message is set by the services: the backend's own text when it sent
 * one, else ours from CKYC_ERROR_MESSAGES.
 */
@Component({
  selector: 'app-ckyc-error-alert',
  standalone: true,
  imports: [FontAwesomeModule],
  templateUrl: './ckyc-error-alert.component.html',
  styleUrl: './ckyc-error-alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycErrorAlertComponent {
  readonly scope = input.required<CkycErrorScope>();
  readonly mode = input<AuthenticationMode | null>(null);

  private readonly flow = inject(CkycFlowStateService);
  private readonly auth = inject(CkycAuthStateService);

  readonly errorIcon = errorIcon;
  readonly closeIcon = closeIcon;

  readonly activeError = computed<CkycActiveError | null>(() => {
    const message = this.messageFor(this.scope());
    return message ? { title: CKYC_ERROR_TITLES[this.scope()], message } : null;
  });

  clearError(): void {
    switch (this.scope()) {
      case 'enquiry':
        this.flow.enquiryError.set(null);
        break;
      case 'history':
        this.flow.historyError.set(null);
        break;
      case 'submit':
        this.flow.submitError.set(null);
        break;
      case 'auth':
        this.auth.authState.update((s) => ({ ...s, error: null }));
        break;
    }
  }

  private messageFor(scope: CkycErrorScope): string | null {
    switch (scope) {
      case 'enquiry':
        return this.flow.enquiryError();
      case 'history':
        return this.flow.historyError();
      case 'submit':
        return this.flow.submitError();
      case 'auth': {
        // One auth error, one place: the active screen's table, or (no table yet) the alert under the match card.
        const activeScreen = this.auth.activeScreenMode();
        const mode = this.mode();
        return (mode ? activeScreen === mode : activeScreen === null) ? this.auth.authState().error : null;
      }
    }
  }
}
