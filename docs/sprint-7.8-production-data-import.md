# Sprint 7.8 - Production Data Import Verification

## Import Metadata

- Import date: 2026-07-13 14:33 +07:00
- Tester/admin: Codex pre-import verification; real admin required for import approval
- Firebase project: `pwtkse-v2`
- Production URL: https://pwtkse-v2.web.app
- Latest commit verified: `98719df feat(Sprint7.7): Data readiness dashboard`
- Production data imported: No

## Phase 1 - Pre-import Verification

Repository and deployment checks:

- Local branch: `main`
- Local status: clean and matching `origin/main`
- Latest commit pushed to GitHub: yes
- GitHub Actions deployment: success
  - Workflow: `Deploy to Firebase Hosting on merge`
  - Commit: `98719dfa736a0768ea702c9d28a37467d7a059c8`
  - Run ID: `29229696614`
  - Conclusion: `success`
- Production URL accessible: yes

Production routes checked by direct HTTP request:

- `/admin/students/import`: `200 OK`
- `/admin/rotation-plans/import`: `200 OK`
- `/admin/readiness`: `200 OK`
- `/reports`: `200 OK`

Build and audit:

- `npm run build`: passed
- `npm audit`: passed, `0 vulnerabilities`

Real admin login:

- Not tested in this automation turn because no production admin session/credentials were provided.
- No passwords or sensitive credentials were requested or recorded.

## Phase 2 - Production Backup

Backup status: Not completed in this turn.

Reason:

- No production import was executed.
- No real source files were provided.
- No admin approval to write production data was provided.

Required before any import:

- Back up `students`.
- Back up `rotationPlans`.
- Store backup files outside the Git repository.
- Verify backup files can be opened and inspected.

Recommended backup record format:

| Collection | Document count | Backup method | Backup location | Verified |
| --- | ---: | --- | --- | --- |
| students | pending | Firestore export or admin script | outside repo | pending |
| rotationPlans | pending | Firestore export or admin script | outside repo | pending |

## Rollback Procedure

Before import:

1. Create timestamped backups of `students` and `rotationPlans`.
2. Record document counts for both collections.
3. Store backups outside `C:\Users\jenpr\Documents\Codex\PWTKSE-v2`.
4. Confirm the backup files are readable.

If rollback is required:

1. Stop further imports.
2. Export current affected collections for investigation.
3. Delete only the documents created by the failed import, or restore the backed-up collection state.
4. Re-run `/admin/readiness`.
5. Re-test `/teacher` and `/reports`.

## Phase 3 - Student Import Dry Run

Status: Not performed.

Reason:

- The real student Excel/CSV file was not provided in this turn.
- Preview approval was not available.

Pending checks:

- total source rows
- valid rows
- warnings
- blocking errors
- duplicate student IDs
- duplicate classroom + student number
- unknown classrooms
- missing required values
- invalid names
- empty rows
- malformed classroom values
- expected total student count
- expected count by classroom

## Phase 4 - Student Production Import

Status: Not performed.

Counts:

- Student source row count: pending
- Student imported count: 0
- Student skipped count: 0
- Student failed count: 0

Firestore verification pending:

- total students
- students grouped by classroom
- duplicate student IDs
- duplicate classroom + number
- unknown classroom references
- Thai names and prefixes

## Phase 5 - Rotation-plan Dry Run

Status: Not performed.

Reason:

- The real production matrix XLSX file was not provided in this turn.
- Preview approval was not available.

Pending checks:

- week column detection
- Buddhist dates parsed correctly
- all seven learning-base columns detected
- merged cells expanded correctly
- multiline cells preserved
- classroom ranges expanded correctly
- source-cell tracing available
- special schedule states detected

Expected special weeks to verify with the real file:

- week 1: preparation
- week 2: teacher presentation
- week 3: online
- week 10: midterm exam
- week 11: public holiday
- week 20: final exam

## Phase 6 - Controlled Rotation-plan Import

Status: Not performed.

Counts:

- Rotation source cells processed: pending
- Normalized rotation assignments: pending
- Rotation imported count: 0
- Rotation skipped count: 0
- Rotation failed count: 0

Required before import:

- Confirm `rotationPlans` backup exists.
- Prefer Add mode if no existing production plans exist.
- Use Replace mode only after explicit approval and verified backup.
- Prefer a limited pilot week first if possible.

## Phase 7 - Data Readiness Verification

Status: Production route available, real data readiness not reviewed.

Pending:

- Log in as admin.
- Open `/admin/readiness`.
- Click `ตรวจใหม่`.
- Resolve every red blocking status.
- Review every warning and classify it as defect or accepted intentional warning.

Readiness dashboard result: Pending real admin review.

## Phase 8 - Production Spot Checks

Status: Not performed because production data was not imported.

Pending checks:

- student ID search
- first name search
- last name search
- classroom search
- student number search
- rotation lookup by week/classroom/base
- `/teacher` with real teacher account

## Phase 9 - Access And Mobile Checks

HTTP route availability:

- Admin import/readiness pages serve the SPA shell.

Pending real browser/account checks:

- admin can open import and readiness pages
- teacher cannot open admin import/readiness pages
- unauthenticated users redirect to login
- desktop Chrome or Edge
- mobile width 390px
- Android Chrome
- Samsung Internet
- Messenger in-app browser
- browser console review

## Defects Found

No production-import defect was confirmed because no production files were provided and no import was executed.

## Defects Fixed

No code fix was required in this turn.

## Remaining Risks

- Production student and rotation source files still need dry-run validation.
- No production backup has been made yet.
- Real admin and teacher authentication was not tested in this turn.
- `/admin/readiness` has not been reviewed against real imported data.
- Teacher workflow cannot be verified until student and rotation data exist.
- Replace-mode import must not be used until backup is verified.

## Recommendation For Sprint 7.9

Do not proceed to Sprint 7.9 yet.

Recommended next step:

1. Provide the real student file and real rotation-plan XLSX file.
2. Create verified backups for `students` and `rotationPlans`.
3. Perform dry-run previews in production.
4. Import only after admin approval.
5. Re-run `/admin/readiness`.
6. Proceed only when readiness is `Ready` or `Ready with accepted warnings`.

## Final Judgment

Production readiness judgment: not ready for Tuesday field test until real data import and verification are completed.

Proceed to Sprint 7.9: No.
