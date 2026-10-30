import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CkycConsentStatusComponent } from '../ckyc-consent-status/ckyc-consent-status.component';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  imports: [CkycConsentStatusComponent],
  templateUrl: './ckyc-face-authentication.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
