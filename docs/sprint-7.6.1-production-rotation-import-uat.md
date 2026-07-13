# Sprint 7.6.1 - Production Rotation Import UAT

## UAT Metadata

- UAT date: 2026-07-13 13:25 +07:00
- Tester: Codex with school admin to complete real-file review
- Production URL: https://pwtkse-v2.web.app
- Latest commit verified: `2451f89 feat(Sprint7.6): Rotation plan matrix import wizard`
- Production data imported: No

## Repository And Deployment Readiness

- GitHub push status: verified clean before UAT readiness work.
- Working tree before documentation: clean except deployment cache ignored by Git.
- Build command: `npm run build`
- Build result: passed.
- Production deploy action: Hosting only.
- Deploy command: `firebase deploy --only hosting --project pwtkse-v2`
- Deploy result: passed.
- Firestore rules/indexes deployed: No. This UAT did not modify Firestore rules or indexes.

## Production Build Verification

The production route `/admin/rotation-plans/import` was requested directly and returned the Vite app shell with the current bundle:

- Main bundle: `/assets/index-CcD5BmVc.js`
- Rotation import bundle: `/assets/RotationPlanImportPage-BgLgowqZ.js`
- Direct route status: `200 OK`
- SPA refresh behavior: route serves `index.html` correctly.

## Source File

- Source file name: Not provided in this UAT turn.
- File structure: Expected matrix spreadsheet, but real file dry-run is pending.
- Production spreadsheet upload: Not performed.
- Dry-run preview approval: Not performed.
- Production import approval: Not provided.

## Accounts And Roles Tested

- Unauthenticated route behavior: production route is deployed; browser login redirect still requires manual browser verification.
- Teacher account: not tested in this turn because no teacher credentials were provided.
- Admin account: not tested in this turn because no admin credentials were provided.
- Sensitive credentials were not requested or recorded.

## Browser And Device Tested

- HTTP direct route verification via `curl.exe`.
- Desktop browser was not driven for login or upload in this turn.
- Mobile width 390px, Android Chrome, Samsung Internet, and Messenger in-app browser are pending real-device UAT.

## Source-To-Preview Reconciliation

Pending real spreadsheet upload.

Required reconciliation checks for the next hands-on UAT:

- Detect week column.
- Detect Buddhist-calendar date column.
- Detect all seven learning-base columns.
- Carry merged cells across affected week rows.
- Preserve multiline source-cell text.
- Detect special full-row states.
- Compare source cells with normalized preview rows by week, base, classroom, and status.

## Expected Base Headers

These source headers must be confirmed against Firestore `bases` during real-file dry run:

- ไฟเบอร์ ทรงพลัง
- อาณาจักรอักษร
- เงาในน้ำ
- ไก่ไข่อารมณ์ดี
- หรรษา สุธารสเห็ด
- ต้นกล้า ประชาธิปไตย
- หลู่สู่จากนาเกลือเกื้อบุญ

## Warning And Error Counts

Real-file counts are pending.

Current UAT readiness counts:

- Total source cells: not available
- Normalized assignment rows: not available
- Valid rows: not available
- Warning rows: not available
- Blocking errors: not available
- Unknown bases: not available
- Unknown classrooms: not available
- Ambiguous room mappings: not available
- Duplicate assignments: not available

## Import Mode Used

- Import mode used: None.
- Add mode: not executed.
- Replace mode: not executed.
- Existing `rotationPlans` backup: not created because no production import was approved.

## Firestore Verification

No write was performed in this UAT turn.

Pending after approved import:

- Verify document count is plausible.
- Verify `academicTermId`.
- Verify week values.
- Verify `learningBaseId`.
- Verify `classroomId`.
- Verify no special-state row was written as active.
- Verify no duplicate classroom/week assignment exists.

## Defects Found

No parser defect was confirmed because the real source spreadsheet was not provided.

## Defects Fixed

No UAT defect fix was required in this turn.

## Remaining Risks

- Real school matrix file may use header spelling, merged-cell layout, or Buddhist-date formats not represented in current parser assumptions.
- Grade-only values such as `ม.1`, `ม.4`, `ม.5`, `ม.6` require admin review before import.
- Multiple classrooms with multiple room numbers may remain ambiguous and must be reviewed manually.
- Location is currently preview-only and is not written to `rotationPlans` to preserve the existing teacher workflow and Firestore schema.
- Authentication and role access must be tested manually with real admin and teacher accounts on production.
- Real-device tests are still pending for Samsung Internet and Messenger in-app browser.

## Production Readiness Judgment

Recommendation: ready with conditions.

Conditions before importing production rotation plans:

1. Provide the real Excel rotation-plan file.
2. Log in as admin on production and upload it in Matrix XLSX mode.
3. Review all warnings and blocking errors.
4. Confirm all seven base headers map to the correct Firestore bases.
5. Confirm weeks 1-20 and special weeks:
   - week 1: preparation
   - week 2: teacher presentation
   - week 3: online
   - week 10: midterm exam
   - week 11: public holiday
   - week 20: final exam
6. Back up existing `rotationPlans` before any replace-mode import.
7. Prefer a limited pilot week before full import.
8. Verify `/teacher` behavior with a real teacher account after import.
