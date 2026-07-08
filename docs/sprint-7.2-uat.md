# Sprint 7.2 - Real Account UAT

Test date: 2026-07-08 (Asia/Bangkok)

## Environment

- Local Vite application connected to the production Firebase project
- Real admin and teacher accounts
- Desktop in-app Chromium browser
- Responsive viewport check at 390 x 844 pixels
- PDF verified through the native print dialog by the user
- Excel verified in Microsoft Excel by the user

## Passed

- Admin login, `/admin`, `/reports`, logout, and session restore
- Teacher login, `/teacher`, logout, and session restore
- Teacher blocked from `/admin` and `/reports`
- Unauthenticated `/reports` redirected to `/login`
- Wrong password displayed the expected Thai error message
- Wednesday correctly displayed that there is no PWTKSE period today
- Reports loaded real Firestore configuration without console errors
- Reports handled empty students and attendance data without crashing
- Available report filters worked together and displayed a safe empty result
- PDF opened through the print flow with Thai text, school logo, and A4 output verified by the user
- Excel opened in Microsoft Excel with Thai text, worksheets, and readable columns verified by the user
- Admin Reports and teacher pages had no horizontal overflow at 390 pixels

## Not Testable With Current Data

- Inactive account and missing-profile account behavior: no test accounts were available
- Teacher attendance save and duplicate prevention: the test date was Wednesday and Firestore had no students or attendance sessions
- KPI comparison against submitted attendance: Firestore had no submitted attendance sessions
- Week filter with real data: no attendance weeks were available
- Samsung Internet and Messenger in-app browser: those browser environments were not available in this session

## Findings

No application bug was reproduced, so no authentication, Firestore, attendance, or UI logic was changed.

## Readiness

Authentication, role protection, empty Reports behavior, exports, and responsive layout passed. Production readiness remains conditional until students and a Tuesday rotation are available for one complete attendance save, duplicate-submission, and report reconciliation test.
