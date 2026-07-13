import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const projectId = "pwtkse-v2-rules-qa";
const now = Timestamp.fromDate(new Date("2026-07-13T00:00:00.000Z"));
let testEnv;

function userProfile(overrides = {}) {
  return {
    displayName: "ครูทดสอบ ระบบ",
    email: "teacher@example.com",
    phone: "0812345678",
    department: "สังคมศึกษา",
    base: "ฐานเกษตร",
    role: "teacher",
    status: "pending",
    active: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sessionPayload(overrides = {}) {
  return {
    sessionId: "session-1",
    academicTermId: "term-1",
    attendanceDate: "2026-07-14",
    weekNumber: 1,
    classroomId: "class-1",
    classroomName: "ม.1/1",
    baseId: "base-1",
    baseName: "ฐานเกษตร",
    teacherUid: "teacher-1",
    teacherName: "ครูหนึ่ง",
    status: "submitted",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function recordPayload(overrides = {}) {
  return {
    recordId: "record-1",
    sessionId: "session-1",
    studentId: "student-1",
    studentNumber: "1",
    studentName: "เด็กชายทดสอบ",
    status: "present",
    note: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function authedDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function guestDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "admin-1"), userProfile({
      displayName: "ผู้ดูแลระบบ",
      email: "admin@example.com",
      role: "admin",
      status: "approved",
      active: true,
    }));
    await setDoc(doc(db, "users", "teacher-1"), userProfile({
      displayName: "ครูหนึ่ง",
      email: "teacher1@example.com",
      role: "teacher",
      status: "approved",
      active: true,
    }));
    await setDoc(doc(db, "users", "teacher-2"), userProfile({
      displayName: "ครูสอง",
      email: "teacher2@example.com",
      role: "teacher",
      status: "approved",
      active: true,
    }));
    await setDoc(doc(db, "users", "pending-1"), userProfile({
      displayName: "ครูรออนุมัติ",
      email: "pending@example.com",
      status: "pending",
      active: false,
    }));
    await setDoc(doc(db, "users", "rejected-1"), userProfile({
      displayName: "ครูถูกปฏิเสธ",
      email: "rejected@example.com",
      status: "rejected",
      active: false,
    }));
    await setDoc(doc(db, "academicTerms", "term-1"), {
      academicTermId: "term-1",
      academicYear: "2569",
      semester: "1",
      name: "ภาคเรียนที่ 1/2569",
      active: true,
      startDate: now,
      endDate: now,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "classrooms", "class-1"), {
      classroomId: "class-1",
      displayName: "ม.1/1",
      level: "ม.1",
      roomNumber: "1",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "bases", "base-1"), {
      baseId: "base-1",
      baseName: "ฐานเกษตร",
      description: "",
      teacherUid: "teacher-1",
      teacherName: "ครูหนึ่ง",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "rotationPlans", "rotation-1"), {
      rotationId: "rotation-1",
      academicTermId: "term-1",
      weekNumber: 1,
      classroomId: "class-1",
      classroomName: "ม.1/1",
      baseId: "base-1",
      baseName: "ฐานเกษตร",
      teacherUid: "teacher-1",
      teacherName: "ครูหนึ่ง",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "students", "student-1"), {
      studentId: "student-1",
      classroomId: "class-1",
      classroomName: "ม.1/1",
      studentNumber: "1",
      fullName: "เด็กชายทดสอบ",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "attendanceSessions", "session-1"), sessionPayload());
    await setDoc(doc(db, "attendanceRecords", "record-1"), recordPayload());
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseData();
});

after(async () => {
  await testEnv.cleanup();
});

describe("unauthenticated users", () => {
  it("cannot read users collection or user documents", async () => {
    const db = guestDb();
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(getDoc(doc(db, "users", "admin-1")));
  });

  it("cannot create, update, or delete user documents", async () => {
    const db = guestDb();
    await assertFails(setDoc(doc(db, "users", "guest-1"), userProfile()));
    await assertFails(updateDoc(doc(db, "users", "pending-1"), { active: true }));
    await assertFails(deleteDoc(doc(db, "users", "pending-1")));
  });
});

describe("newly registered users", () => {
  it("can create only their own pending teacher profile", async () => {
    const db = authedDb("new-1");
    await assertSucceeds(setDoc(doc(db, "users", "new-1"), userProfile({
      email: "new1@example.com",
    })));
  });

  it("cannot create another user's profile", async () => {
    const db = authedDb("new-1");
    await assertFails(setDoc(doc(db, "users", "new-2"), userProfile({
      email: "new2@example.com",
    })));
  });

  it("cannot create admin, approved, or active profile directly", async () => {
    const db = authedDb("new-1");
    await assertFails(setDoc(doc(db, "users", "new-1"), userProfile({
      role: "admin",
      email: "new1@example.com",
    })));
    await assertFails(setDoc(doc(db, "users", "new-1"), userProfile({
      status: "approved",
      email: "new1@example.com",
    })));
    await assertFails(setDoc(doc(db, "users", "new-1"), userProfile({
      active: true,
      email: "new1@example.com",
    })));
  });

  it("cannot write invalid schema or delete users", async () => {
    const db = authedDb("new-1");
    await assertFails(setDoc(doc(db, "users", "new-1"), {
      ...userProfile({ email: "new1@example.com" }),
      extraData: "malicious",
    }));
    await assertFails(deleteDoc(doc(db, "users", "new-1")));
  });
});

describe("pending and rejected users", () => {
  it("cannot read protected collections", async () => {
    const db = authedDb("pending-1");
    await assertFails(getDocs(collection(db, "academicTerms")));
    await assertFails(getDocs(collection(db, "classrooms")));
    await assertFails(getDocs(collection(db, "bases")));
    await assertFails(getDocs(collection(db, "students")));
    await assertFails(getDocs(collection(db, "attendanceSessions")));
    await assertFails(getDocs(collection(db, "attendanceRecords")));
  });

  it("cannot approve themselves or edit role/status/active", async () => {
    const db = authedDb("pending-1");
    await assertFails(updateDoc(doc(db, "users", "pending-1"), { status: "approved" }));
    await assertFails(updateDoc(doc(db, "users", "pending-1"), { active: true }));
    await assertFails(updateDoc(doc(db, "users", "pending-1"), { role: "admin" }));
    await assertFails(updateDoc(doc(db, "users", "pending-1"), { department: "changed" }));
  });

  it("cannot approve or modify others", async () => {
    const db = authedDb("pending-1");
    await assertFails(updateDoc(doc(db, "users", "teacher-1"), { role: "admin" }));
    await assertFails(deleteDoc(doc(db, "users", "teacher-1")));
  });

  it("rejected and inactive users cannot bypass protected access", async () => {
    const db = authedDb("rejected-1");
    await assertFails(getDocs(collection(db, "academicTerms")));
    await assertFails(updateDoc(doc(db, "users", "rejected-1"), { active: true }));
  });
});

describe("approved teacher", () => {
  it("can read permitted setup collections", async () => {
    const db = authedDb("teacher-1");
    await assertSucceeds(getDocs(collection(db, "academicTerms")));
    await assertSucceeds(getDocs(collection(db, "classrooms")));
    await assertSucceeds(getDocs(collection(db, "bases")));
    await assertSucceeds(getDocs(collection(db, "students")));
  });

  it("can read only their assigned rotation and attendance session queries", async () => {
    const db = authedDb("teacher-1");
    await assertSucceeds(getDocs(query(collection(db, "rotationPlans"), where("teacherUid", "==", "teacher-1"))));
    await assertFails(getDocs(query(collection(db, "rotationPlans"), where("teacherUid", "==", "teacher-2"))));
    await assertSucceeds(getDocs(query(collection(db, "attendanceSessions"), where("teacherUid", "==", "teacher-1"))));
    await assertFails(getDocs(query(collection(db, "attendanceSessions"), where("teacherUid", "==", "teacher-2"))));
  });

  it("cannot modify users or approve accounts", async () => {
    const db = authedDb("teacher-1");
    await assertFails(updateDoc(doc(db, "users", "pending-1"), { status: "approved", active: true }));
    await assertFails(updateDoc(doc(db, "users", "teacher-1"), { department: "changed" }));
  });

  it("can create attendance for own session only", async () => {
    const db = authedDb("teacher-1");
    await assertSucceeds(setDoc(doc(db, "attendanceSessions", "session-new"), sessionPayload({
      sessionId: "session-new",
      teacherUid: "teacher-1",
    })));
    await assertSucceeds(setDoc(doc(db, "attendanceRecords", "record-new"), recordPayload({
      recordId: "record-new",
      sessionId: "session-new",
    })));
    await assertFails(setDoc(doc(db, "attendanceSessions", "session-other"), sessionPayload({
      sessionId: "session-other",
      teacherUid: "teacher-2",
    })));
  });

  it("cannot read admin-only reports data outside permitted teacher records", async () => {
    const db = authedDb("teacher-2");
    await assertFails(getDocs(collection(db, "attendanceRecords")));
    await assertFails(getDoc(doc(db, "attendanceRecords", "record-1")));
  });
});

describe("admin", () => {
  it("can approve, reject, activate, deactivate, assign roles, and update department/base", async () => {
    const db = authedDb("admin-1");
    await assertSucceeds(updateDoc(doc(db, "users", "pending-1"), {
      role: "teacher",
      status: "approved",
      active: true,
      department: "สังคมศึกษา",
      base: "ฐานอาชีพ",
      approvedAt: now,
      updatedAt: now,
    }));
    await assertSucceeds(updateDoc(doc(db, "users", "teacher-2"), {
      role: "admin",
      status: "approved",
      active: true,
      updatedAt: now,
    }));
    await assertSucceeds(updateDoc(doc(db, "users", "teacher-1"), {
      status: "rejected",
      active: false,
      rejectedAt: now,
      updatedAt: now,
    }));
  });

  it("cannot remove required fields or write invalid user schema", async () => {
    const db = authedDb("admin-1");
    await assertFails(updateDoc(doc(db, "users", "pending-1"), {
      displayName: deleteField(),
    }));
    await assertFails(updateDoc(doc(db, "users", "pending-1"), {
      phone: "x".repeat(31),
    }));
    await assertFails(updateDoc(doc(db, "users", "pending-1"), {
      status: "superuser",
    }));
  });

  it("can read reports and admin collections", async () => {
    const db = authedDb("admin-1");
    await assertSucceeds(getDocs(collection(db, "users")));
    await assertSucceeds(getDocs(collection(db, "attendanceSessions")));
    await assertSucceeds(getDocs(collection(db, "attendanceRecords")));
    await assertSucceeds(getDocs(collection(db, "rotationPlans")));
  });
});
