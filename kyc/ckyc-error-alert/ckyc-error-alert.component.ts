import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { closeIcon, errorIcon } from 'src/app/constants/icons.constants';
import { CKYC_ERROR_TITLES, CkycErrorScope } from '../constants/ckyc-onboarding.constants';
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
 * - auth:    above all the consent tables, under the match card (load modes, send, verify, fallback errors);
 *            on the enquiry list, in the card whose Authenticate did not start (modes failed to load, or none
 *            is usable)
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
      case 'auth':
        // One auth error, one place: above all the consent tables (or, on the enquiry list, in the match card).
        return this.auth.authState().error;
    }
  }
}
