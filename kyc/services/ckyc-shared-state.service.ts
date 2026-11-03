// Transcribed from the photograph supplied 2026-11-03. Replaces CkycSearchPhaseService everywhere.
import { Injectable, signal } from '@angular/core';
import { SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import { ILeadDetails } from 'src/app/nri/workflow/models/lead.model';
@Injectable({
  providedIn: 'root',
})
export class CkycSharedStateService {
  // private signals holding the values
  private readonly _searchAttemptedPhase = signal<SearchAttemptedPhase | null>(null);
  private readonly _leadId = signal<string | null>(null); // was string | null | undefined; undefined can never be set
  private readonly _isManualVerificationEnabled = signal<boolean>(false);
  private readonly _isDvCkycSubmitEnabled = signal<boolean>(false);
  private readonly _leadDetails = signal<ILeadDetails | null>(null);
  private readonly _isCkycConsentChecked = signal<boolean>(false);
  // read-only versions exposed to other services
  readonly searchAttemptedPhase = this._searchAttemptedPhase.asReadonly();
  readonly leadId = this._leadId.asReadonly();
  readonly isManualVerificationEnabled = this._isManualVerificationEnabled.asReadonly();
  readonly isDvCkycSubmitEnabled = this._isDvCkycSubmitEnabled.asReadonly();
  readonly leadDetails = this._leadDetails.asReadonly();
  readonly isCkycConsentChecked = this._isCkycConsentChecked.asReadonly();
  // setters used by other services
  setSearchAttemptedPhase(phase: SearchAttemptedPhase): void {
    this._searchAttemptedPhase.set(phase);
  }
  setLeadId(newLeadId: string | null) {
    this._leadId.set(newLeadId);
  }
  setManualVerificationEnabled(status: boolean) {
    this._isManualVerificationEnabled.set(status);
  }
  setIsDvCkycSubmitEnabled(currentStatus: boolean) {
    this._isDvCkycSubmitEnabled.set(currentStatus);
  }
  setLeadDetails(currentLead: ILeadDetails) {
    this._leadDetails.set(currentLead);
  }
  setIsCkycConsentChecked(isChecked: boolean) {
    this._isCkycConsentChecked.set(isChecked);
  }
}
