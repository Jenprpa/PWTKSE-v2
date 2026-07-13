# Sprint 7.8.1 - Teacher Registration and Admin Approval

## Scope

เพิ่มระบบสมัครสมาชิกสำหรับครู พร้อมสถานะรอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งานจริง

## Routes

- `/register` - สมัครสมาชิกครู
- `/pending` - หน้ารออนุมัติหรือแจ้งถูกปฏิเสธ
- `/admin/users/pending` - หน้าอนุมัติสมาชิกสำหรับ admin เท่านั้น

## Firestore Profile

ผู้สมัครใหม่ถูกสร้างใน `users/{uid}` ด้วยค่าเริ่มต้น:

- `role: "teacher"`
- `status: "pending"`
- `active: false`
- `displayName`
- `email`
- `phone`
- `department`
- `base`
- `createdAt`
- `updatedAt`

บัญชีเดิมที่ยังไม่มี `status` แต่ `active: true` ยังเข้าใช้งานได้ตามเดิม เพื่อไม่กระทบ production account เดิม

## Approval Rules

- `pending` เข้า `/teacher`, `/admin`, `/reports` ไม่ได้
- `rejected` เข้า protected routes ไม่ได้
- `active: false` เข้า protected routes ไม่ได้
- admin เท่านั้นที่อนุมัติ ปฏิเสธ เปลี่ยน role และเปิด/ปิดบัญชีได้
- ผู้สมัครสร้างได้เฉพาะ profile ของตัวเอง และเป็น `teacher/pending/active:false`

## Firestore Collections Read/Written

- `users` - registration profile, admin approval
- collections เดิมยังคงใช้ตาม workflow เดิม: `academicTerms`, `classrooms`, `bases`, `rotationPlans`, `students`, `attendanceSessions`, `attendanceRecords`

## QA Checklist

- สมัครสำเร็จ: สร้าง Auth user และ `users/{uid}` เป็น pending
- อีเมลซ้ำ: Firebase Auth คืนข้อความอีเมลมีบัญชีอยู่แล้ว
- รหัสผ่านอ่อน: แสดงข้อความภาษาไทยและไม่บันทึก profile
- pending user: ถูกส่งไปหน้า `/pending` และเข้า protected routes ไม่ได้
- teacher self-approve: rules ไม่อนุญาตให้เปลี่ยน `role/status/active` เอง
- admin approval: เปลี่ยนเป็น `status: "approved"` และ `active: true`
- rejected user: เปลี่ยนเป็น `status: "rejected"` และ `active: false`

## Known Limitations

- ยังไม่มี automated test runner ในโปรเจกต์ จึงตรวจด้วย build, rules dry-run, และ manual QA checklist
- ถ้าสมัครสำเร็จแต่การเขียน Firestore ล้มเหลว ผู้ใช้จะมี Auth account แต่ไม่มี profile ต้องให้ admin ตรวจใน Firebase Console
- ต้อง deploy Firestore rules แยกจาก hosting เมื่อพร้อมใช้จริง
