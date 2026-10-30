import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { AuthenticationMode, AuthFactor } from '../constants/ckyc-onboarding.constants';
import { CkycAuthStateService } from '../services/ckyc-auth-state.service';

@Component({
  selector: 'app-ckyc-face-authentication',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './ckyc-face-authentication.component.html',
  styleUrl: './ckyc-face-authentication.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CkycFaceAuthenticationComponent implements OnInit {
  private readonly authStore = inject(CkycAuthStateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly consentAttempts = this.authStore.consentAttempts;
  readonly isCalling = computed(() => this.consentAttempts().some((attempt) => attempt.status === 'Calling'));
  readonly authMode = AuthenticationMode;
  readonly authFactor = AuthFactor;

  ngOnInit(): void {
    this.authStore.prepareConsentAttempt();
  }

  runAttempt(id: number): void {
    this.authStore.runConsentAttempt(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
}
