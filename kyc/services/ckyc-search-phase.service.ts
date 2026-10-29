import { Injectable, signal } from '@angular/core';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';

@Injectable({
  providedIn: 'root',
})
export class CkycSearchPhaseService {
  private readonly _searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);
  private readonly _leadId = signal<string | null>(null);
  readonly searchAttemptedPhase = this._searchAttemptedPhase.asReadonly();
  readonly leadId = this._leadId.asReadonly();

  setSearchAttemptedPhase(phase: SearchAttemptedPhase): void {
    this._searchAttemptedPhase.set(phase);
  }

  setLeadId(newLeadId: string | null) {
    this._leadId.set(newLeadId);
  }
}
