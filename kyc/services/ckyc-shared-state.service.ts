// Transcribed from the photograph supplied 2026-11-03. Replaces CkycSearchPhaseService everywhere.
import { Injectable, signal } from '@angular/core';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
@Injectable({
  providedIn: 'root',
})
export class CkycSharedStateService {
  private readonly _searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);
  private readonly _leadId = signal<string | null>(null); // was string | null | undefined; undefined can never be set
  private readonly _isManualVerificationEnabled = signal<boolean>(false);
  readonly searchAttemptedPhase = this._searchAttemptedPhase.asReadonly();
  readonly leadId = this._leadId.asReadonly();
  readonly isManualVerificationEnabled = this._isManualVerificationEnabled.asReadonly();
  setSearchAttemptedPhase(phase: SearchAttemptedPhase): void {
    this._searchAttemptedPhase.set(phase);
  }
  setLeadId(newLeadId: string | null) {
    this._leadId.set(newLeadId);
  }
  setManualVerificationEnabled(status: boolean) {
    this._isManualVerificationEnabled.set(status);
  }
}
