import { defer, of, type Observable } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthFactor, AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import type {
  IBirthYearPincodeAuthFactorValue,
  IRelationAuthFactorValue,
  ITriggerConsentRequest,
  TriggerConsentAuthFactor,
} from '../models/ckyc-consent-request.model';

/** Independent of the UI's CkycFlowStep: only the OTP + FACEAUTH DV branch. */
export enum DvConsentFactor {
  DOB = 'DOB',
  RELATION = 'RELATION',
  PINCODE = 'PINCODE',
  OTP = 'OTP',
}

export enum DvRelation {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  SPOUSE = 'SPOUSE',
}

export interface DvConsentFlags {
  readonly master: boolean;
  readonly dob: boolean;
  readonly relation: boolean;
  readonly pincode: boolean;
}

export interface DvConsentFactorValues {
  readonly dob?: string;
  readonly relations?: Partial<Record<DvRelation, IRelationAuthFactorValue>>;
  readonly yearPincode?: IBirthYearPincodeAuthFactorValue;
}

export interface DvConsentCursor {
  readonly factor: DvConsentFactor;
  readonly relation?: DvRelation;
}

type ConsentBase = Pick<
  ITriggerConsentRequest,
  'attemptId' | 'leadId' | 'searchAttemptedPhase' | 'mobileNumber'
>;

function nextCandidate(current: DvConsentCursor | null): DvConsentCursor | null {
  if (current === null) return { factor: DvConsentFactor.DOB };

  switch (current.factor) {
    case DvConsentFactor.DOB:
      return { factor: DvConsentFactor.RELATION, relation: DvRelation.FATHER };
    case DvConsentFactor.RELATION:
      switch (current.relation) {
        case DvRelation.FATHER:
          return { factor: DvConsentFactor.RELATION, relation: DvRelation.MOTHER };
        case DvRelation.MOTHER:
          return { factor: DvConsentFactor.RELATION, relation: DvRelation.SPOUSE };
        case DvRelation.SPOUSE:
          return { factor: DvConsentFactor.PINCODE };
        default:
          return null; // Unknown relation: do not guess another step.
      }
    case DvConsentFactor.PINCODE:
      return { factor: DvConsentFactor.OTP };
    case DvConsentFactor.OTP:
    default:
      return null;
  }
}

/** Returns the next enabled attempt, always ending with OTP. */
export function getNextDvConsentStep(
  current: DvConsentCursor | null,
  flags: DvConsentFlags,
): DvConsentCursor | null {
  let candidate = nextCandidate(current);
  // At most DOB + three relations + PINCODE + OTP.
  for (let i = 0; candidate && i < 6; i++) {
    switch (candidate.factor) {
      case DvConsentFactor.DOB:
        if (flags.dob) return candidate;
        break;
      case DvConsentFactor.RELATION:
        if (flags.relation) return candidate;
        break;
      case DvConsentFactor.PINCODE:
        if (flags.pincode) return candidate;
        break;
      case DvConsentFactor.OTP:
        return candidate;
      default:
        return null;
    }
    candidate = nextCandidate(candidate);
  }
  return null;
}

/** Never send placeholders or empty required factor values to the bank API. */
export function buildDvConsentRequest(
  cursor: DvConsentCursor,
  base: ConsentBase,
  values: DvConsentFactorValues,
): ITriggerConsentRequest {
  let authFactors: TriggerConsentAuthFactor[];

  switch (cursor.factor) {
    case DvConsentFactor.DOB:
      if (!values.dob?.trim()) throw new Error('DOB auth factor is unavailable.');
      authFactors = [{ authFactor: AuthFactor.DOB, authValue: values.dob }];
      break;
    case DvConsentFactor.RELATION: {
      const value = cursor.relation && values.relations?.[cursor.relation];
      if (!value?.firstName?.trim() || !value.lastName?.trim() || !value.relationName?.trim()) {
        throw new Error('Required relation auth factor is unavailable.');
      }
      authFactors = [{ authFactor: AuthFactor.RELATION, authFactorValueObj: value }];
      break;
    }
    case DvConsentFactor.PINCODE:
      if (!values.yearPincode?.year?.trim() || !values.yearPincode.pincode?.trim()) {
        throw new Error('Birth year and PINCODE auth factor is unavailable.');
      }
      authFactors = [{
        authFactor: AuthFactor.BIRTHYEARPINCODE,
        authFactorValueObj: values.yearPincode,
      }];
      break;
    case DvConsentFactor.OTP:
      return { ...base, consentType: AuthenticationMode.OTP, authFactors: [] };
    default:
      throw new Error('Unknown digital-verification consent step.');
  }

  return { ...base, consentType: AuthenticationMode.FACEAUTH, authFactors };
}

export interface DvConsentSequenceOptions {
  readonly flags: DvConsentFlags;
  readonly values: DvConsentFactorValues;
  readonly base: ConsentBase;
  readonly send: (request: ITriggerConsentRequest) => Observable<{ success: boolean } | null>;
  readonly onSuccess: (cursor: DvConsentCursor) => void;
  readonly onMissingData: (message: string) => void;
}

/** Sequential calls only. Failure advances; success stops; OTP never retries here. */
export function executeDvConsentSequence(options: DvConsentSequenceOptions): Observable<boolean> {
  const { flags, values, base, send, onSuccess, onMissingData } = options;

  const run = (cursor: DvConsentCursor | null): Observable<boolean> => {
    if (!cursor) return of(false);

    let request: ITriggerConsentRequest;
    try {
      request = buildDvConsentRequest(cursor, base, values);
    } catch (error) {
      onMissingData(error instanceof Error ? error.message : 'Invalid auth factor.');
      return of(false);
    }

    return send(request).pipe(
      // A network failure counts as one failed attempt; do not trigger the legacy fallback handler.
      catchError(() => of(null)),
      switchMap((response) => {
        if (response?.success) {
          onSuccess(cursor);
          return of(true);
        }
        return run(getNextDvConsentStep(cursor, flags));
      }),
    );
  };

  return defer(() => {
    if (!flags.master) return of(false);
    return run(getNextDvConsentStep(null, flags));
  });
}
