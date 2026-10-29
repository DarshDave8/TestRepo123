import { defer, of, type Observable } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthFactor, AuthenticationMode } from '../constants/ckyc-onboarding.constants';
import type {
  ITriggerConsentRequest,
  TriggerConsentAuthFactor,
} from '../models/ckyc-consent-request.model';

/** Internal step state, independent of the application's UI flow steps. */
export enum DvConsentFactor {
  DOB = 'DOB',
  RELATION = 'RELATION',
  PINCODE = 'PINCODE',
  OTP = 'OTP',
}

export interface DvConsentFlags {
  readonly master: boolean;
  readonly dob: boolean;
  readonly relation: boolean;
  readonly pincode: boolean;
}

type ConsentBase = Pick<
  ITriggerConsentRequest,
  'attemptId' | 'leadId' | 'searchAttemptedPhase' | 'mobileNumber'
>;

function nextCandidate(current: DvConsentFactor | null): DvConsentFactor | null {
  switch (current) {
    case null:
      return DvConsentFactor.DOB;
    case DvConsentFactor.DOB:
      return DvConsentFactor.RELATION;
    case DvConsentFactor.RELATION:
      return DvConsentFactor.PINCODE;
    case DvConsentFactor.PINCODE:
      return DvConsentFactor.OTP;
    case DvConsentFactor.OTP:
    default:
      return null;
  }
}

/** Skip disabled factors; OTP always remains the final step. */
export function getNextDvConsentStep(
  current: DvConsentFactor | null,
  flags: DvConsentFlags,
): DvConsentFactor | null {
  let candidate = nextCandidate(current);
  // Maximum of four steps: DOB, RELATION, PINCODE, OTP.
  for (let i = 0; candidate !== null && i < 4; i++) {
    switch (candidate) {
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

/**
 * Backend identifies each factor by its authFactor enum alone.
 * Do not transmit DOB, names, birth year or PINCODE values.
 */
export function buildDvConsentRequest(
  step: DvConsentFactor,
  base: ConsentBase,
): ITriggerConsentRequest {
  let authFactors: TriggerConsentAuthFactor[] = [];

  switch (step) {
    case DvConsentFactor.DOB:
      authFactors = [{ authFactor: AuthFactor.DOB }];
      break;
    case DvConsentFactor.RELATION:
      authFactors = [{ authFactor: AuthFactor.RELATION }];
      break;
    case DvConsentFactor.PINCODE:
      authFactors = [{ authFactor: AuthFactor.BIRTHYEARPINCODE }];
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
  readonly base: ConsentBase;
  readonly send: (request: ITriggerConsentRequest) => Observable<{ success: boolean } | null>;
  readonly onSuccess: (step: DvConsentFactor) => void;
}

/** Failure advances once; success stops; OTP is terminal. Legacy consent is separate. */
export function executeDvConsentSequence(options: DvConsentSequenceOptions): Observable<boolean> {
  const { flags, base, send, onSuccess } = options;

  const run = (step: DvConsentFactor | null): Observable<boolean> => {
    if (step === null) return of(false);

    const request = buildDvConsentRequest(step, base);
    return send(request).pipe(
      catchError(() => of(null)),
      switchMap((response) => {
        if (response?.success) {
          onSuccess(step);
          return of(true);
        }
        return run(getNextDvConsentStep(step, flags));
      }),
    );
  };

  return defer(() =>
    flags.master ? run(getNextDvConsentStep(null, flags)) : of(false),
  );
}
