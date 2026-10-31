// INFERRED from usage in the 2026-10-31 screenshots; this file was not photographed.
// It replaces CkycSearchPhaseService for the auth service and onboarding component.
import { Injectable, signal } from '@angular/core';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';

@Injectable({ providedIn: 'root' })
export class CkycSharedStateService {
  private readonly _searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);
  private readonly _leadId = signal<string | null>(null);
  private readonly _manualVerificationEnabled = signal(false);
  readonly searchAttemptedPhase = this._searchAttemptedPhase.asReadonly();
  readonly leadId = this._leadId.asReadonly();
  readonly isManualVerificationEnabled = this._manualVerificationEnabled.asReadonly();

  setSearchAttemptedPhase(phase: SearchAttemptedPhase): void {
    this._searchAttemptedPhase.set(phase);
  }
  setLeadId(newLeadId: string | null): void {
    this._leadId.set(newLeadId);
  }
  setManualVerificationEnabled(enabled: boolean): void {
    this._manualVerificationEnabled.set(enabled);
  }
}
