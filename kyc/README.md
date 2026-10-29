# CKYC screenshot-source archive

This folder contains a **best-effort transcription**, not a verified build of an Angular application. Code was reconstructed from **17 photographs** supplied on 2026-10-29. Images were cropped, enlarged and contrast-enhanced for legibility.

## Initial 10 screenshots
- `services/ckyc-auth-state.service.ts` — screenshots 1–2 (partial, SOURCE GAP)
- `services/ckyc-flow-state.service.ts` — screenshots 3–4 (partial, SOURCE GAP)
- `services/ckyc-onboarding.service.ts` — screenshot 5
- `services/ckyc-search-phase.service.ts` — screenshot 6
- `ckyc-onboarding.component.html` — screenshot 7
- `ckyc-onboarding.component.ts` — screenshot 8
- `ckyc-step-manager.ts` — screenshot 9
- `models/ckyc-onboarding.model.ts` — screenshot 10; extended by screenshot 11

## Additional 7 screenshots
- `models/ckyc-onboarding.model.ts` — screenshot 11, tail (state and enquiry models)
- `models/ckyc-search-request.model.ts` — screenshot 12, left
- `models/ckyc-search-response.model.ts` — screenshot 12, right
- `ckyc-dv-flow/ckyc-dv-flow.component.ts` — screenshot 13, left
- `ckyc-dv-flow/ckyc-dv-flow.component.html` — screenshot 13, right
- `ckyc-enquiry-list/ckyc-enquiry-list.component.ts` — screenshot 14, left
- `ckyc-enquiry-list/ckyc-enquiry-list.component.html` — screenshot 14, right
- `ckyc-enquiry-list/ckyc-enquiry-details/ckyc-enquiry-details.component.ts` — screenshots 15–16, left
- `ckyc-enquiry-list/ckyc-enquiry-details/ckyc-enquiry-details.component.html` — screenshots 16–17, right/remaining

## Important limitations
- Some screenshots were clipped or blurry; uncertain sections are marked with comments such as `SOURCE GAP`. Some closing syntax was reconstructed for readability, and may differ from the exact original.
- The original digital-verification template screenshot shows an apparently unclosed `app-ckyc-onboarding` tag. **The anomaly is preserved.**
- A literal lead identifier visible on the monitor was replaced with `[REDACTED_LEAD_ID]` in the public archive. Restore it only from an authorized source, not this reconstruction.
- External constants, Angular modules, SCSS, dialog components, consent models, child components, and project infrastructure are not included unless explicitly shown in the photographs.
- Some imports and domain types might not compile, and the images themselves show possible business-logic inconsistencies. No attempt was made to silently correct those defects.
- Do not merge or deploy this code to a production system without validating it against the authorized original source.


## Latest change: OTP + FACEAUTH factor sequence (feature-gated)

- `services/ckyc-dv-consent-sequence.ts`: new isolated DOB -> Relation(Father/Mother/Spouse) -> Birth year + PINCODE -> OTP consent fallback, with a switch on the current factor.
- `services/ckyc-auth-state.service.ts`: adds optional sequence with reset on each `loadApplicableModes()`, retains existing `triggerConsent()` for other paths.
- `ckyc-enquiry-list/ckyc-enquiry-details/ckyc-enquiry-details.component.ts`: invokes this sequence only when both OTP and FACEAUTH are allowed for DIGITAL_VERIFICATION **and** the master flag is ON.
- `services/ckyc-dv-consent-sequence.spec.ts`: test cases for master OFF, all ON, DOB OFF, DOB+RELATION OFF, RELATION OFF, all factors OFF; early success, terminal OTP success, and missing data.
- `models/ckyc-consent-request.model.ts`, `models/ckyc-consent-response.model.ts`, and `constants/ckyc-onboarding.constants.ts` were transcribed from the two additional user screenshots. The constants file remains incomplete beyond photographed lines.

**Integration required before enabling this new flow:**
1. Provide `CKYC_DV_CONSENT_FLAGS` in the Angular app's DI from the **actual existing runtime flag/config service** (not present in this screenshot archive). The default provider returns `master:false`, `dob:true`, `relation:true`, `pincode:true`, preserving legacy behavior.
2. Provide `CKYC_DV_CONSENT_FACTOR_VALUES` from your authorized DOB, FATHER/MOTHER/SPOUSE, and birth-year/PINCODE data source. The default provider returns no values; enabling without wiring the values fails closed and does not transmit placeholders.
3. Confirm the correct backend relationName values and date formatting; the images show the field shapes, not these mapping rules.

Factor successes route to the existing `face` step; OTP fallback success routes to the existing `otp` step. Face GET, OTP validation, resend and all other authentication branches are unchanged.

**Validation status:** GitHub writes and file reads were verified. Jasmine/Angular tests have been **added but not executed**, because this reconstructed repository lacks a complete Angular project, dependencies, and test runner. Do not deploy until integrated and tested against authorized sources.
