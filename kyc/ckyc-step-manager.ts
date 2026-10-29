import { signal } from '@angular/core';
import { CkycFlowStep } from './models/ckyc-onboarding.model';

export class CkycStepManager {
  private readonly current = signal<CkycFlowStep>('search');
  readonly step = this.current.asReadonly();

  goTo(step: CkycFlowStep): void {
    this.current.set(step);
  }
}
