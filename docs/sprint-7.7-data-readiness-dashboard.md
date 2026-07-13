# Sprint 7.7 - Data Readiness Dashboard

## Purpose

The Data Readiness Dashboard helps an admin verify whether PWTKSE v2 has the required production data before go-live. It is validation-only and does not import or modify production data.

Route:

- `/admin/readiness`

Access:

- Admin only.
- Teachers are blocked by RBAC.
- Unauthenticated users redirect to `/login`.

## Firestore Collections Read

- `academicTerms`
- `classrooms`
- `students`
- `bases`
- `users`
- `rotationPlans`
- `attendanceSessions`

No permanent aggregate documents are created.

## Overall Readiness Status

- `Ready`: no blocking errors and no warnings.
- `Ready with warnings`: no blocking errors, but one or more warnings require admin review.
- `Not ready`: one or more blocking errors prevent safe go-live.

## Readiness Cards

The dashboard shows these cards:

- Academic term
- Classrooms
- Students
- Learning bases
- Teachers
- Rotation plans
- Attendance readiness
- Data integrity

Each card shows:

- current count or status
- expected condition
- pass/warning/fail state
- short explanation
- action button linking to the relevant admin page

## Pass / Warning / Fail Rules

### Academic Term

- Pass: one active academic term exists.
- Fail: no active academic term exists.

### Classrooms

- Pass: at least one active classroom exists.
- Fail: no active classroom exists.
- Expected classroom count is derived from the current active classrooms in the system. The dashboard does not hard-code 45 rooms.

### Students

- Pass: active students exist and no student readiness warnings are found.
- Warning: one or more active classrooms have zero active students.
- Fail: no active student exists, or student records reference unknown classrooms.

### Learning Bases

- Pass: active bases exist and each has teacher information.
- Warning: a base references a teacher profile that is missing or inactive.
- Fail: no active base exists, or an active base has no responsible teacher information.

### Teachers

- Pass: at least one active teacher profile exists and no teacher reference warning is found.
- Warning: base or rotation records reference inactive/missing teachers, or a teacher is assigned to multiple bases in the same week.
- Fail: no active teacher profile exists.

### Rotation Plans

- Pass: active-term rotation plans exist and no rotation warnings are found.
- Warning: classrooms have no rotation plan, week/classroom combinations are missing, or rotation records are outside the active term.
- Fail: no active-term rotation plan exists, duplicate classroom/week assignments exist, or rotation records reference unknown classrooms/bases.

### Attendance Readiness

- Pass: active students and active-term rotation plans exist.
- Warning: attendance sessions are zero before go-live, which may be acceptable; the card remains advisory.

### Data Integrity

- Pass: no reference or duplicate issues found.
- Warning: inactive references exist.
- Fail: unknown references, duplicate student IDs, duplicate classroom/student-number records, or duplicate classroom/week assignments exist.

## Data Gaps Detected

- classrooms with zero students
- students with missing or unknown classroom
- classrooms with no rotation plan
- week/classroom combinations with no active rotation plan
- unknown classroom references in rotation plans
- unknown learning-base references in rotation plans
- bases without a responsible teacher
- inactive or missing teacher references
- duplicate classroom assignments in the same week
- teacher scheduling conflicts in the same week
- duplicate student IDs
- duplicate classroom + student number
- rotation plans outside the active academic term

## Filters

Admins can filter issues by:

- academic term
- week
- classroom
- learning base
- severity

## Admin Operating Steps

1. Log in as admin.
2. Open `/admin/readiness`.
3. Click `ตรวจใหม่` before making decisions.
4. Review overall status.
5. Review each readiness card.
6. Use filters to inspect blocking errors and warnings.
7. Fix data using the relevant admin/import pages.
8. Recheck until the status is `Ready` or `Ready with warnings` with accepted warnings.

## Known Limitations

- Special schedule weeks are not stored as permanent `rotationPlans` records in the current production schema, so the dashboard cannot count special weeks unless they are represented by existing data.
- Teacher scheduling conflict detection warns when the same teacher appears across multiple bases in the same week. Some school workflows may intentionally allow a teacher to support more than one group at the same base.
- Expected classroom count is derived from configured active classrooms rather than a hard-coded school total.
- The dashboard does not validate student name formatting beyond existing stored data.
- The dashboard reads current Firestore data at check time and does not maintain history.
