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

## DV MANUAL + FACE consent chain

With `CKYC_DV_FACTOR_FLAGS.masterEnabled` enabled, Digital Verification with
MANUAL + FACEAUTH and no OTP starts with MANUAL. Existing factor flags and
`nextFactor()` are shared by both chains: DOB, RELATION (one step), BIRTHYEARPINCODE.
The API value of `AuthenticationMode.MANUAL` remains `PHYSICAL`.

- A successful MANUAL factor sets `manualConsentRequired()` and displays the existing
  non-OTP upload component alongside the consent history.
- That component must pass its existing uploaded-file value to
  `authStore.validate({ file: uploadedConsentFile })`. Its original source is
  absent from this archive, so the upload handler itself has not been wired here.
  No endpoint, file encoding, or upload widget has been invented.
- Upload success follows the existing validated-details emission/reset path.
  Upload failure starts FACEAUTH again from its first enabled factor.
- If every enabled MANUAL factor fails, FACEAUTH starts directly.
- FACEAUTH factor success retains the existing subsequent Face/GET integration.
  When every FACEAUTH factor fails, the chain stops with an error; it never
  returns to MANUAL or OTP.
- If every individual factor is disabled, the MANUAL chain is skipped and
  FACEAUTH is attempted without a factor. This does not count as manual success.

Master OFF retains the previous behavior. OTP + FACE, mixed modes containing
OTP, Profile Creation, and MANUAL-only branches keep their existing logic.
The missing closing parenthesis in the archived mode-discovery `finalize` call
has been repaired; the archive still lacks the full Angular application needed
for a complete build and upload/Face/GET integration test.
