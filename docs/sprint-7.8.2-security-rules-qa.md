# Sprint 7.8.2 - Registration Security Rules QA

## Summary

ตรวจ Firestore Security Rules สำหรับระบบสมัครสมาชิกครูและการอนุมัติสมาชิกด้วย Firebase Emulator Suite

## Tooling

- Firebase CLI / Emulator Suite: 15.22.1
- Firestore Emulator: Standard edition
- Test runner: Node.js built-in test runner (`node --test`)
- Rules test library: `@firebase/rules-unit-testing`

## Commands Executed

```cmd
firebase emulators:exec --only firestore "npm run test:rules"
npm run build
firebase deploy --only firestore:rules --project pwtkse-v2 --dry-run
npm audit
```

## Test Result

- Total tests: 18
- Passed: 18
- Failed: 0
- Skipped: 0

## Rules Tested

### Unauthenticated Users

- Cannot read `users` collection
- Cannot read user documents
- Cannot create arbitrary user documents
- Cannot update existing users
- Cannot delete users

### Newly Registered Users

- Can create only `users/{theirUid}`
- Created profile must be `role: "teacher"`
- Created profile must be `status: "pending"`
- Created profile must be `active: false`
- Cannot create `role: "admin"`
- Cannot create `status: "approved"`
- Cannot create `active: true`
- Cannot create another user's profile
- Cannot write unknown fields
- Cannot delete users

### Pending / Rejected Users

- Cannot read protected setup collections
- Cannot read attendance sessions
- Cannot read attendance records used by reports
- Cannot approve themselves
- Cannot approve others
- Cannot edit role
- Cannot edit status
- Cannot edit active
- Cannot edit non-control profile fields after registration

### Approved Teacher

- Can read permitted setup collections
- Can query only assigned rotation plans
- Can query only assigned attendance sessions
- Can create attendance session only for own `teacherUid`
- Can create attendance record only for own session
- Cannot modify `users`
- Cannot approve pending users
- Cannot read all attendance records as report data

### Admin

- Can read `users`
- Can approve pending users
- Can reject users
- Can activate/deactivate users
- Can assign `teacher` or `admin` role
- Can update department/base
- Cannot remove required user fields
- Cannot write invalid enum values
- Cannot write oversized phone field

## Privilege Escalation Attempts

- Self-create admin profile: blocked
- Self-approve pending profile: blocked
- Set `active=true` during registration: blocked
- Pending user updates own `role/status/active`: blocked
- Pending user approves another user: blocked
- Approved teacher promotes self or others: blocked
- Teacher writes another teacher's attendance session: blocked
- Teacher reads all report attendance records: blocked

## Unauthorized Access Attempts

- Guest reads `users`: blocked
- Guest writes `users`: blocked
- Pending user reads protected collections: blocked
- Rejected user reads protected collections: blocked
- Teacher reads another teacher's rotation query: blocked
- Teacher reads another teacher's attendance session query: blocked

## Defects Found

1. Owner update path on `users/{uid}` was more permissive than Sprint 7.8.2 requires.
   - Before fix: a user could update some own non-control profile fields if role/status/active were unchanged.
   - Risk: unnecessary mutation surface on PII-bearing `users` documents.

## Defects Fixed

1. Changed `users/{uid}` update rule to admin-only:

```js
allow update: if isAdmin() && validUserProfile(request.resource.data);
```

This preserves self-registration create access while preventing pending, rejected, and approved teacher users from modifying user profiles or approval fields.

## Security Auditor Assessment

```json
{
  "score": 5,
  "summary": "Registration and approval rules now enforce admin-only mutation after initial self-registration, block self-approval and privilege escalation, validate user schema, and restrict teacher attendance reads/writes to assigned data paths.",
  "findings": []
}
```

## Remaining Risks

- Emulator tests validate rules behavior against seeded synthetic data, not live production data.
- Tests do not verify browser UI behavior; production UAT is still required.
- Firestore rules are compiled and emulator-tested, but the stricter rule change has not been deployed in this sprint commit.
- GitHub Actions Firebase secret values should still be rechecked before future hosting deployments.

## Production Recommendation

Proceed to deploy the updated Firestore rules only after reviewing this test matrix. Then run a focused production UAT:

1. Register a new teacher account.
2. Confirm profile is `pending/active:false`.
3. Confirm pending account cannot access `/teacher`.
4. Approve from `/admin/users/pending`.
5. Confirm approved teacher can access `/teacher`.
6. Confirm approved teacher cannot access `/admin` or `/reports`.
