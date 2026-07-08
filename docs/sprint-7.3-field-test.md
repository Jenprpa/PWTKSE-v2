# Sprint 7.3 - Tuesday Attendance Field Test

## Test Information

- Test date: 2026-07-08 (Wednesday, Asia/Bangkok)
- Tester: Codex with Pai Wittayakarn School administrator
- Device/browser: Windows desktop, Codex in-app Chromium browser
- Account role tested: admin
- Firebase project: `pwtkse-v2`
- Application commit: `2dbc44d`

## Pre-test Results

| Test case | Result | Evidence |
| --- | --- | --- |
| Latest commit is pushed | Pass | Local `main` and `origin/main` both point to `2dbc44d` |
| Firebase environment is correct | Pass | App and Firebase CLI configuration use project `pwtkse-v2` |
| Fixed course schedule is correct | Pass | Tuesday, period 9 |
| Real admin account is active | Pass | Real admin login reached `/admin` |
| Real teacher account is active | Pass | Confirmed during Sprint 7.2 real-account UAT |
| Active academic term exists | Pass | ภาคเรียนที่ 1/2569, 2026-05-18 to 2026-09-30 |
| Active classrooms exist | Pass | 45 active classrooms |
| Active learning bases exist | Pass | 1 active learning base |
| Rotation plans exist | Blocked | 0 rotation plans |
| Active students exist | Blocked | 0 active students |
| Test is performed on Tuesday | Blocked | Test date is Wednesday, 2026-07-08 |

## Field-test Cases

| Test case | Result | Notes |
| --- | --- | --- |
| Teacher desktop login | Not run | Previously passed in Sprint 7.2; Tuesday field test is blocked at pre-test |
| Teacher mobile login | Not run | Real mobile device not available in this session |
| Assigned week, classroom, base, and students load | Blocked | Rotation plans and students are missing |
| Save real attendance | Blocked | Not Tuesday and required data is missing |
| Refresh preserves saved attendance | Blocked | No real attendance session could be created |
| Duplicate attendance is prevented | Blocked | No real attendance session could be created |
| Saved attendance appears in Reports | Blocked | No real attendance session could be created |
| KPI matches real attendance | Blocked | No submitted attendance records exist |
| Real-data report filters | Blocked | No attendance session, week, or student records exist |
| PDF and Excel with real attendance | Blocked | No real attendance records exist |
| Chrome Android, Samsung Internet, Messenger | Not run | Real devices and app browsers were not available |
| Weak-network behavior | Not run | Avoided because the primary workflow was already blocked by missing data |

## Bugs Found

No application defect was reproduced. The field test is blocked by production data readiness and the calendar date, not by a code failure.

## Bugs Fixed

None. Authentication, Firestore structure, attendance logic, and UI were not changed.

## Required Before Resuming

1. Add active students to the classrooms that will participate in the test.
2. Create active rotation plans for the active term and the intended Tuesday week.
3. Confirm each rotation uses the correct teacher UID, classroom, and learning base.
4. Resume with the assigned teacher on Tuesday, 2026-07-14, before period 9.
5. Have an Android Chrome device, Samsung Internet device, and Messenger in-app browser available if those environments must be signed off.

## Remaining Risks

- The complete real attendance save and duplicate-prevention path has not run against production data.
- Reports KPI, filters, PDF, and Excel have not been reconciled against a real submitted attendance session.
- Mobile browser compatibility has not been confirmed on physical Android, Samsung Internet, or Messenger devices.

## Production Readiness Judgment

**Blocked for attendance go-live.** Authentication and existing UAT checks remain valid, but the Tuesday attendance workflow cannot be approved until rotation plans and students exist and one complete Tuesday period-9 session passes end to end.
