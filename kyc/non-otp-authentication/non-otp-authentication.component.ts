import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

@Component({
  selector: 'app-non-otp-authentication',
  standalone: true,
  imports: [CkycConsentStatusComponent],
  template: '<app-ckyc-consent-status />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonOtpAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
