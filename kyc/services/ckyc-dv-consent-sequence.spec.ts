import { of, throwError } from 'rxjs';
import { AuthFactor, AuthenticationMode, SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import type { ITriggerConsentRequest } from '../models/ckyc-consent-request.model';
import {
  buildDvConsentRequest,
  DvConsentFactor,
  executeDvConsentSequence,
  getNextDvConsentStep,
  type DvConsentFlags,
} from './ckyc-dv-consent-sequence';

describe('OTP + FACEAUTH digital-verification factor-only consent sequence', () => {
  const enabled: DvConsentFlags = { master: true, dob: true, relation: true, pincode: true };
  const base = {
    attemptId: 'attempt-test',
    leadId: 'lead-test',
    searchAttemptedPhase: SearchAttemptedPhase.DIGITAL_VERIFICATION,
  };

  const summarize = (requests: ITriggerConsentRequest[]) =>
    requests.map((request) =>
      request.consentType === AuthenticationMode.OTP
        ? 'OTP'
        : request.authFactors[0]?.authFactor,
    );

  function scenario(flags: Partial<DvConsentFlags> = {}, successAt?: number) {
    const requests: ITriggerConsentRequest[] = [];
    const successes: DvConsentFactor[] = [];
    let finalResult: boolean | undefined;

    executeDvConsentSequence({
      flags: { ...enabled, ...flags },
      base,
      send: (request) => {
        requests.push(request);
        return of({ success: requests.length === successAt });
      },
      onSuccess: (step) => successes.push(step),
    }).subscribe((result) => { finalResult = result; });

    return { requests, successes, finalResult };
  }

  it('master OFF: sequence does nothing, existing caller uses legacy behavior', () => {
    const result = scenario({ master: false });
    expect(result.requests).toEqual([]);
    expect(result.finalResult).toBe(false);
  });

  it('all ON: DOB -> RELATION -> PINCODE -> OTP', () => {
    const result = scenario();
    expect(summarize(result.requests)).toEqual([
      AuthFactor.DOB,
      AuthFactor.RELATION,
      AuthFactor.BIRTHYEARPINCODE,
      'OTP',
    ]);
    expect(result.finalResult).toBe(false);
  });

  it('DOB OFF: RELATION -> PINCODE -> OTP', () => {
    expect(summarize(scenario({ dob: false }).requests)).toEqual([
      AuthFactor.RELATION, AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
  });

  it('DOB + RELATION OFF: PINCODE -> OTP', () => {
    expect(summarize(scenario({ dob: false, relation: false }).requests)).toEqual([
      AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
  });

  it('RELATION OFF: DOB -> PINCODE -> OTP', () => {
    expect(summarize(scenario({ relation: false }).requests)).toEqual([
      AuthFactor.DOB, AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
  });

  it('all factor flags OFF: OTP only', () => {
    const result = scenario({ dob: false, relation: false, pincode: false });
    expect(summarize(result.requests)).toEqual(['OTP']);
    expect(result.requests[0].authFactors).toEqual([]);
    expect(result.requests[0].consentType).toBe(AuthenticationMode.OTP);
  });

  it('each factor sends only the authFactor identifier, no personal values', () => {
    const result = scenario();
    expect(result.requests[0].authFactors).toEqual([{ authFactor: AuthFactor.DOB }]);
    expect(result.requests[1].authFactors).toEqual([{ authFactor: AuthFactor.RELATION }]);
    expect(result.requests[2].authFactors).toEqual([{ authFactor: AuthFactor.BIRTHYEARPINCODE }]);
    expect(result.requests.slice(0, 3).every((r) => r.consentType === AuthenticationMode.FACEAUTH)).toBe(true);
    expect(result.requests.every((r) => r.attemptId === base.attemptId && r.leadId === base.leadId)).toBe(true);
  });

  it('stops on first factor success and invokes the existing face hook', () => {
    const result = scenario({}, 2);
    expect(result.requests).toHaveSize(2);
    expect(result.successes).toEqual([DvConsentFactor.RELATION]);
    expect(result.finalResult).toBe(true);
  });

  it('OTP is the terminal step even when consent fails', () => {
    const result = scenario();
    expect(result.requests).toHaveSize(4);
    expect(result.successes).toEqual([]);
    expect(result.finalResult).toBe(false);
  });

  it('OTP success invokes the OTP success hook exactly once', () => {
    const result = scenario({ dob: false, relation: false, pincode: false }, 1);
    expect(result.successes).toEqual([DvConsentFactor.OTP]);
    expect(result.requests).toHaveSize(1);
    expect(result.finalResult).toBe(true);
  });

  it('API exception advances to the next enabled step', () => {
    const requests: ITriggerConsentRequest[] = [];
    executeDvConsentSequence({
      flags: enabled,
      base,
      send: (req) => {
        requests.push(req);
        return requests.length === 1 ? throwError(() => new Error('network')) : of({ success: true });
      },
      onSuccess: () => {},
    }).subscribe();
    expect(summarize(requests)).toEqual([AuthFactor.DOB, AuthFactor.RELATION]);
  });

  it('unknown step cannot send a fabricated auth factor', () => {
    expect(() => buildDvConsentRequest('UNKNOWN' as DvConsentFactor, base)).toThrow();
    expect(getNextDvConsentStep('UNKNOWN' as DvConsentFactor, enabled)).toBeNull();
  });
});
