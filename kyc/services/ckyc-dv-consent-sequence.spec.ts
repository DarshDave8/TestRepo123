import { of } from 'rxjs';
import { AuthFactor, AuthenticationMode, SearchAttemptedPhase } from '../constants/ckyc-onboarding.constants';
import type { ITriggerConsentRequest } from '../models/ckyc-consent-request.model';
import {
  DvConsentFactor,
  DvRelation,
  executeDvConsentSequence,
  type DvConsentFlags,
  type DvConsentFactorValues,
} from './ckyc-dv-consent-sequence';

describe('OTP + FACEAUTH digital-verification consent sequence', () => {
  const values: DvConsentFactorValues = {
    dob: '1990-01-01',
    relations: {
      [DvRelation.FATHER]: { firstName: 'Father', lastName: 'Test', relationName: 'FATHER' },
      [DvRelation.MOTHER]: { firstName: 'Mother', lastName: 'Test', relationName: 'MOTHER' },
      [DvRelation.SPOUSE]: { firstName: 'Spouse', lastName: 'Test', relationName: 'SPOUSE' },
    },
    yearPincode: { year: '1990', pincode: '400001' },
  };

  const flags: DvConsentFlags = { master: true, dob: true, relation: true, pincode: true };
  const base = { attemptId: 'test-attempt', leadId: 'test-lead', searchAttemptedPhase: SearchAttemptedPhase.DIGITAL_VERIFICATION };

  function scenario(override: Partial<DvConsentFlags>, successAt?: number) {
    const requests: ITriggerConsentRequest[] = [];
    const successes: DvConsentFactor[] = [];
    const errors: string[] = [];
    let finalResult: boolean | undefined;

    executeDvConsentSequence({
      flags: { ...flags, ...override },
      base,
      values,
      send: (request) => {
        requests.push(request);
        return of({ success: successAt === requests.length });
      },
      onSuccess: ({ factor }) => successes.push(factor),
      onMissingData: (message) => errors.push(message),
    }).subscribe((result) => { finalResult = result; });

    return { requests, successes, errors, finalResult };
  }

  const summarize = (requests: ITriggerConsentRequest[]) =>
    requests.map((r) => {
      if (r.consentType === AuthenticationMode.OTP) return 'OTP';
      const factor = r.authFactors[0];
      if (factor?.authFactor === AuthFactor.RELATION) {
        return 'RELATION_' + factor.authFactorValueObj.relationName;
      }
      return factor?.authFactor;
    });

  it('master OFF: no new consent API call (caller keeps legacy branch)', () => {
    const s = scenario({ master: false });
    expect(s.requests.length).toBe(0);
    expect(s.finalResult).toBe(false);
  });

  it('all ON: DOB, Father, Mother, Spouse, PINCODE, OTP', () => {
    const s = scenario({});
    expect(summarize(s.requests)).toEqual([
      AuthFactor.DOB, 'RELATION_FATHER', 'RELATION_MOTHER',
      'RELATION_SPOUSE', AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
    expect(s.finalResult).toBe(false);
  });

  it('DOB OFF: start with Father and preserve order', () => {
    expect(summarize(scenario({ dob: false }).requests)).toEqual([
      'RELATION_FATHER', 'RELATION_MOTHER', 'RELATION_SPOUSE',
      AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
  });

  it('DOB and RELATION OFF: PINCODE then OTP', () => {
    expect(summarize(scenario({ dob: false, relation: false }).requests)).toEqual([
      AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
  });

  it('RELATION OFF: DOB, PINCODE, OTP', () => {
    expect(summarize(scenario({ relation: false }).requests)).toEqual([
      AuthFactor.DOB, AuthFactor.BIRTHYEARPINCODE, 'OTP',
    ]);
  });

  it('all factors OFF: OTP only with empty authFactors', () => {
    const s = scenario({ dob: false, relation: false, pincode: false });
    expect(summarize(s.requests)).toEqual(['OTP']);
    expect(s.requests[0].authFactors).toEqual([]);
  });

  it('stops at first factor success and invokes the face-auth hook', () => {
    const s = scenario({}, 2);
    expect(s.requests.length).toBe(2);
    expect(s.successes).toEqual([DvConsentFactor.RELATION]);
    expect(s.finalResult).toBe(true);
  });

  it('stops at OTP success without sending more requests', () => {
    const s = scenario({ dob: false, relation: false, pincode: false }, 1);
    expect(s.successes).toEqual([DvConsentFactor.OTP]);
    expect(s.finalResult).toBe(true);
  });

  it('does not send fake customer values if an enabled factor is missing', () => {
    const sent: ITriggerConsentRequest[] = [];
    const errors: string[] = [];
    executeDvConsentSequence({
      flags,
      values: {},
      base,
      send: (request) => { sent.push(request); return of({ success: false }); },
      onSuccess: () => {},
      onMissingData: (message) => errors.push(message),
    }).subscribe();
    expect(sent).toEqual([]);
    expect(errors.length).toBe(1);
  });
});
