import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  templateUrl: './ckyc-face-authentication.component.html',
  styleUrl: './ckyc-face-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consentAttempts = this.authStore.consentAttempts;
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;

  ngOnInit(): void {
    this.authStore.triggerConsent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
