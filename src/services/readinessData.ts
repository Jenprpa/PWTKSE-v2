import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseDb";
import type {
  AcademicTerm,
  AttendanceSession,
  Classroom,
  LearningBase,
  RotationPlan,
  Student,
} from "../types/rotation";
import type { UserProfile } from "../types/user";

export type ReadinessSeverity = "pass" | "warning" | "fail";
export type OverallReadiness = "ready" | "ready_with_warnings" | "not_ready";

export type ReadinessIssue = {
  id: string;
  category:
    | "academic-term"
    | "classrooms"
    | "students"
    | "bases"
    | "teachers"
    | "rotation-plans"
    | "attendance"
    | "integrity";
  severity: Exclude<ReadinessSeverity, "pass">;
  title: string;
  detail: string;
  academicTermId?: string;
  weekNumber?: number;
  classroomId?: string;
  classroomName?: string;
  baseId?: string;
  baseName?: string;
  teacherUid?: string;
};

export type ReadinessCard = {
  id: string;
  title: string;
  status: ReadinessSeverity;
  countLabel: string;
  expected: string;
  explanation: string;
  actionLabel: string;
  actionPath: string;
};

export type ReadinessFilters = {
  academicTermId: string;
  weekNumber: string;
  classroomId: string;
  baseId: string;
  severity: string;
};

export type ReadinessSourceData = {
  academicTerms: AcademicTerm[];
  classrooms: Classroom[];
  students: Student[];
  bases: LearningBase[];
  rotationPlans: RotationPlan[];
  attendanceSessions: AttendanceSession[];
  users: Array<UserProfile & { uid: string }>;
};

export type ReadinessModel = {
  overallStatus: OverallReadiness;
  overallLabel: string;
  lastCheckedAt: Date;
  activeTerm?: AcademicTerm;
  cards: ReadinessCard[];
  issues: ReadinessIssue[];
  counts: {
    activeClassrooms: number;
    activeStudents: number;
    activeBases: number;
    activeTeachers: number;
    activeRotationPlans: number;
    weeksWithPlans: number;
    attendanceSessions: number;
    specialScheduleWeeks: number;
  };
  options: {
    academicTerms: AcademicTerm[];
    classrooms: Classroom[];
    bases: LearningBase[];
    weeks: number[];
  };
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

function issueId(parts: Array<string | number | undefined>) {
  return parts.filter((part) => part !== undefined && part !== "").join("::");
}

function activeItems<T extends { active: boolean }>(items: T[]) {
  return items.filter((item) => item.active);
}

export async function fetchReadinessSourceData(): Promise<ReadinessSourceData> {
  const [academicTermsSnap, classroomsSnap, studentsSnap, basesSnap, rotationPlansSnap, attendanceSessionsSnap, usersSnap] =
    await Promise.all([
      getDocs(collection(db, "academicTerms")),
      getDocs(collection(db, "classrooms")),
      getDocs(collection(db, "students")),
      getDocs(collection(db, "bases")),
      getDocs(collection(db, "rotationPlans")),
      getDocs(collection(db, "attendanceSessions")),
      getDocs(collection(db, "users")),
    ]);

  return {
    academicTerms: academicTermsSnap.docs.map((termDoc) => termDoc.data() as AcademicTerm),
    classrooms: classroomsSnap.docs.map((classroomDoc) => classroomDoc.data() as Classroom),
    students: studentsSnap.docs.map((studentDoc) => studentDoc.data() as Student),
    bases: basesSnap.docs.map((baseDoc) => baseDoc.data() as LearningBase),
    rotationPlans: rotationPlansSnap.docs.map((rotationDoc) => rotationDoc.data() as RotationPlan),
    attendanceSessions: attendanceSessionsSnap.docs.map((sessionDoc) => sessionDoc.data() as AttendanceSession),
    users: usersSnap.docs.map((userDoc) => ({ ...(userDoc.data() as UserProfile), uid: userDoc.id })),
  };
}

function makeCard(
  id: string,
  title: string,
  status: ReadinessSeverity,
  countLabel: string,
  expected: string,
  explanation: string,
  actionLabel: string,
  actionPath: string,
): ReadinessCard {
  return { id, title, status, countLabel, expected, explanation, actionLabel, actionPath };
}

export function buildReadinessModel(data: ReadinessSourceData): ReadinessModel {
  const activeTerm = data.academicTerms.find((term) => term.active);
  const activeClassrooms = activeItems(data.classrooms);
  const activeStudents = activeItems(data.students);
  const activeBases = activeItems(data.bases);
  const activeTeachers = data.users.filter((user) => user.role === "teacher" && user.active);
  const activeTeacherIds = new Set(activeTeachers.map((teacher) => teacher.uid));
  const classroomIds = new Set(data.classrooms.map((classroom) => classroom.classroomId));
  const activeClassroomIds = new Set(activeClassrooms.map((classroom) => classroom.classroomId));
  const baseIds = new Set(data.bases.map((base) => base.baseId));
  const activeBaseIds = new Set(activeBases.map((base) => base.baseId));
  const activeTermRotationPlans = data.rotationPlans.filter(
    (rotation) => rotation.active && (!activeTerm || rotation.academicTermId === activeTerm.academicTermId),
  );
  const weeks = [...new Set(activeTermRotationPlans.map((rotation) => rotation.weekNumber))].sort((a, b) => a - b);
  const issues: ReadinessIssue[] = [];

  if (!activeTerm) {
    issues.push({
      id: "missing-active-term",
      category: "academic-term",
      severity: "fail",
      title: "ยังไม่มีปีการศึกษาที่ active",
      detail: "ต้องมีปีการศึกษาที่ active ก่อนใช้งานระบบเช็กชื่อ",
    });
  }

  if (activeClassrooms.length === 0) {
    issues.push({
      id: "missing-classrooms",
      category: "classrooms",
      severity: "fail",
      title: "ยังไม่มีห้องเรียนที่ใช้งาน",
      detail: "ต้องเพิ่มห้องเรียนก่อน import นักเรียนหรือแผนเวียนฐาน",
    });
  }

  if (activeStudents.length === 0) {
    issues.push({
      id: "missing-students",
      category: "students",
      severity: "fail",
      title: "ยังไม่มีนักเรียนที่ใช้งาน",
      detail: "ต้องมีรายชื่อนักเรียนก่อนครูเช็กชื่อ",
    });
  }

  if (activeBases.length === 0) {
    issues.push({
      id: "missing-bases",
      category: "bases",
      severity: "fail",
      title: "ยังไม่มีฐานการเรียนรู้",
      detail: "ต้องมีฐานการเรียนรู้เพื่อสร้างแผนเวียนฐาน",
    });
  }

  if (activeTeachers.length === 0) {
    issues.push({
      id: "missing-teachers",
      category: "teachers",
      severity: "fail",
      title: "ยังไม่มีบัญชีครูที่ active",
      detail: "ต้องมีบัญชีครูก่อนมอบหมายฐานและเช็กชื่อ",
    });
  }

  if (activeTermRotationPlans.length === 0) {
    issues.push({
      id: "missing-rotation-plans",
      category: "rotation-plans",
      severity: "fail",
      title: "ยังไม่มีแผนเวียนฐานของปีการศึกษาปัจจุบัน",
      detail: "ต้อง import หรือสร้างแผนเวียนฐานก่อนใช้งานวันอังคาร",
      academicTermId: activeTerm?.academicTermId,
    });
  }

  for (const classroom of activeClassrooms) {
    const studentCount = activeStudents.filter((student) => student.classroomId === classroom.classroomId).length;
    if (studentCount === 0) {
      issues.push({
        id: issueId(["classroom-no-students", classroom.classroomId]),
        category: "students",
        severity: "warning",
        title: "ห้องเรียนยังไม่มีนักเรียน",
        detail: `${classroom.displayName} ยังไม่มีนักเรียนที่ active`,
        classroomId: classroom.classroomId,
        classroomName: classroom.displayName,
      });
    }

    const hasRotation = activeTermRotationPlans.some((rotation) => rotation.classroomId === classroom.classroomId);
    if (activeTermRotationPlans.length > 0 && !hasRotation) {
      issues.push({
        id: issueId(["classroom-no-rotation", classroom.classroomId]),
        category: "rotation-plans",
        severity: "warning",
        title: "ห้องเรียนยังไม่มีแผนเวียนฐาน",
        detail: `${classroom.displayName} ยังไม่พบในแผนเวียนฐานของปีการศึกษาปัจจุบัน`,
        academicTermId: activeTerm?.academicTermId,
        classroomId: classroom.classroomId,
        classroomName: classroom.displayName,
      });
    }

    for (const weekNumber of weeks) {
      const hasWeekRotation = activeTermRotationPlans.some(
        (rotation) => rotation.weekNumber === weekNumber && rotation.classroomId === classroom.classroomId,
      );
      if (!hasWeekRotation) {
        issues.push({
          id: issueId(["missing-week-rotation", weekNumber, classroom.classroomId]),
          category: "rotation-plans",
          severity: "warning",
          title: "ขาดแผนรายสัปดาห์",
          detail: `${classroom.displayName} ยังไม่มีแผนเวียนฐานสัปดาห์ ${weekNumber}`,
          academicTermId: activeTerm?.academicTermId,
          weekNumber,
          classroomId: classroom.classroomId,
          classroomName: classroom.displayName,
        });
      }
    }
  }

  for (const student of data.students) {
    if (!classroomIds.has(student.classroomId)) {
      issues.push({
        id: issueId(["student-unknown-classroom", student.studentId]),
        category: "integrity",
        severity: "fail",
        title: "นักเรียนอ้างอิงห้องเรียนที่ไม่มีในระบบ",
        detail: `${student.fullName} อ้างอิงห้อง ${student.classroomName || student.classroomId}`,
        classroomId: student.classroomId,
        classroomName: student.classroomName,
      });
    }
  }

  for (const base of activeBases) {
    if (!base.teacherUid || !base.teacherName) {
      issues.push({
        id: issueId(["base-no-teacher", base.baseId]),
        category: "bases",
        severity: "fail",
        title: "ฐานยังไม่มีครูรับผิดชอบ",
        detail: `${base.baseName} ยังไม่มี teacherUid หรือ teacherName`,
        baseId: base.baseId,
        baseName: base.baseName,
      });
    } else if (!activeTeacherIds.has(base.teacherUid)) {
      issues.push({
        id: issueId(["base-inactive-teacher", base.baseId, base.teacherUid]),
        category: "teachers",
        severity: "warning",
        title: "ครูประจำฐานไม่ active หรือไม่มี profile",
        detail: `${base.baseName} ใช้ครู ${base.teacherName} แต่ไม่พบ active teacher profile`,
        baseId: base.baseId,
        baseName: base.baseName,
        teacherUid: base.teacherUid,
      });
    }
  }

  const assignmentByClassWeek = new Map<string, RotationPlan[]>();
  const assignmentByTeacherWeek = new Map<string, RotationPlan[]>();

  for (const rotation of data.rotationPlans) {
    if (activeTerm && rotation.academicTermId !== activeTerm.academicTermId) {
      issues.push({
        id: issueId(["rotation-outside-active-term", rotation.rotationId]),
        category: "rotation-plans",
        severity: "warning",
        title: "แผนเวียนฐานอยู่นอกปีการศึกษาปัจจุบัน",
        detail: `${rotation.classroomName} สัปดาห์ ${rotation.weekNumber} ไม่อยู่ใน active term`,
        academicTermId: rotation.academicTermId,
        weekNumber: rotation.weekNumber,
        classroomId: rotation.classroomId,
        classroomName: rotation.classroomName,
        baseId: rotation.baseId,
        baseName: rotation.baseName,
      });
    }

    if (!classroomIds.has(rotation.classroomId)) {
      issues.push({
        id: issueId(["rotation-unknown-classroom", rotation.rotationId]),
        category: "integrity",
        severity: "fail",
        title: "แผนเวียนฐานอ้างอิงห้องเรียนที่ไม่มีในระบบ",
        detail: `${rotation.classroomName} สัปดาห์ ${rotation.weekNumber}`,
        weekNumber: rotation.weekNumber,
        classroomId: rotation.classroomId,
        classroomName: rotation.classroomName,
      });
    } else if (!activeClassroomIds.has(rotation.classroomId)) {
      issues.push({
        id: issueId(["rotation-inactive-classroom", rotation.rotationId]),
        category: "integrity",
        severity: "warning",
        title: "แผนเวียนฐานอ้างอิงห้องเรียนที่ปิดใช้งาน",
        detail: `${rotation.classroomName} สัปดาห์ ${rotation.weekNumber}`,
        weekNumber: rotation.weekNumber,
        classroomId: rotation.classroomId,
        classroomName: rotation.classroomName,
      });
    }

    if (!baseIds.has(rotation.baseId)) {
      issues.push({
        id: issueId(["rotation-unknown-base", rotation.rotationId]),
        category: "integrity",
        severity: "fail",
        title: "แผนเวียนฐานอ้างอิงฐานที่ไม่มีในระบบ",
        detail: `${rotation.baseName} สัปดาห์ ${rotation.weekNumber}`,
        weekNumber: rotation.weekNumber,
        baseId: rotation.baseId,
        baseName: rotation.baseName,
      });
    } else if (!activeBaseIds.has(rotation.baseId)) {
      issues.push({
        id: issueId(["rotation-inactive-base", rotation.rotationId]),
        category: "integrity",
        severity: "warning",
        title: "แผนเวียนฐานอ้างอิงฐานที่ปิดใช้งาน",
        detail: `${rotation.baseName} สัปดาห์ ${rotation.weekNumber}`,
        weekNumber: rotation.weekNumber,
        baseId: rotation.baseId,
        baseName: rotation.baseName,
      });
    }

    if (rotation.active && (!activeTeacherIds.has(rotation.teacherUid) || !rotation.teacherUid)) {
      issues.push({
        id: issueId(["rotation-missing-teacher", rotation.rotationId]),
        category: "teachers",
        severity: "warning",
        title: "แผนเวียนฐานอ้างอิงครูที่ไม่ active",
        detail: `${rotation.teacherName || "(ไม่มีชื่อครู)"} ใน ${rotation.baseName} สัปดาห์ ${rotation.weekNumber}`,
        weekNumber: rotation.weekNumber,
        baseId: rotation.baseId,
        baseName: rotation.baseName,
        teacherUid: rotation.teacherUid,
      });
    }

    if (rotation.active && (!activeTerm || rotation.academicTermId === activeTerm.academicTermId)) {
      const classWeekKey = `${rotation.weekNumber}::${rotation.classroomId}`;
      assignmentByClassWeek.set(classWeekKey, [...(assignmentByClassWeek.get(classWeekKey) ?? []), rotation]);

      if (rotation.teacherUid) {
        const teacherWeekKey = `${rotation.weekNumber}::${rotation.teacherUid}`;
        assignmentByTeacherWeek.set(teacherWeekKey, [...(assignmentByTeacherWeek.get(teacherWeekKey) ?? []), rotation]);
      }
    }
  }

  for (const [key, rotations] of assignmentByClassWeek) {
    const bases = new Set(rotations.map((rotation) => rotation.baseId));
    if (rotations.length > 1 || bases.size > 1) {
      const [weekNumber, classroomId] = key.split("::");
      issues.push({
        id: issueId(["duplicate-class-week", key]),
        category: "integrity",
        severity: "fail",
        title: "ห้องเรียนถูกจัดซ้ำในสัปดาห์เดียวกัน",
        detail: `${rotations[0].classroomName} สัปดาห์ ${weekNumber} พบ ${rotations.length} รายการ`,
        academicTermId: activeTerm?.academicTermId,
        weekNumber: Number(weekNumber),
        classroomId,
        classroomName: rotations[0].classroomName,
      });
    }
  }

  for (const [key, rotations] of assignmentByTeacherWeek) {
    const bases = new Set(rotations.map((rotation) => rotation.baseId));
    if (bases.size > 1) {
      const [weekNumber, teacherUid] = key.split("::");
      issues.push({
        id: issueId(["teacher-conflict", key]),
        category: "teachers",
        severity: "warning",
        title: "ครูถูกมอบหมายหลายฐานในสัปดาห์เดียวกัน",
        detail: `${rotations[0].teacherName} สัปดาห์ ${weekNumber} พบ ${bases.size} ฐาน`,
        academicTermId: activeTerm?.academicTermId,
        weekNumber: Number(weekNumber),
        teacherUid,
      });
    }
  }

  const studentIdMap = new Map<string, Student[]>();
  const studentNumberMap = new Map<string, Student[]>();
  for (const student of data.students) {
    const studentIdKey = normalize(student.studentId);
    const numberKey = `${student.classroomId}::${normalize(student.studentNumber)}`;
    studentIdMap.set(studentIdKey, [...(studentIdMap.get(studentIdKey) ?? []), student]);
    studentNumberMap.set(numberKey, [...(studentNumberMap.get(numberKey) ?? []), student]);
  }

  for (const [studentId, duplicates] of studentIdMap) {
    if (studentId && duplicates.length > 1) {
      issues.push({
        id: issueId(["duplicate-student-id", studentId]),
        category: "integrity",
        severity: "fail",
        title: "รหัสนักเรียนซ้ำ",
        detail: `รหัส ${studentId} พบ ${duplicates.length} รายการ`,
      });
    }
  }

  for (const [, duplicates] of studentNumberMap) {
    if (duplicates.length > 1) {
      issues.push({
        id: issueId(["duplicate-class-number", duplicates[0].classroomId, duplicates[0].studentNumber]),
        category: "integrity",
        severity: "fail",
        title: "เลขที่นักเรียนซ้ำในห้องเดียวกัน",
        detail: `${duplicates[0].classroomName} เลขที่ ${duplicates[0].studentNumber} พบ ${duplicates.length} รายการ`,
        classroomId: duplicates[0].classroomId,
        classroomName: duplicates[0].classroomName,
      });
    }
  }

  const failCount = issues.filter((issue) => issue.severity === "fail").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const overallStatus: OverallReadiness = failCount > 0 ? "not_ready" : warningCount > 0 ? "ready_with_warnings" : "ready";
  const cards = [
    makeCard(
      "academic-term",
      "Academic term",
      activeTerm ? "pass" : "fail",
      activeTerm ? activeTerm.name : "ไม่มี active term",
      "ต้องมีปีการศึกษาที่ active 1 รายการ",
      activeTerm ? "พบปีการศึกษาที่พร้อมใช้งาน" : "ยังไม่สามารถใช้งานระบบจริงได้",
      "จัดการปีการศึกษา",
      "/admin",
    ),
    makeCard(
      "classrooms",
      "Classrooms",
      activeClassrooms.length > 0 ? "pass" : "fail",
      `${activeClassrooms.length.toLocaleString("th-TH")} ห้อง`,
      "ต้องมีห้องเรียนที่ใช้งานอย่างน้อย 1 ห้อง ตาม configuration ปัจจุบัน",
      "จำนวนคาดหวังอ้างอิงจากห้องเรียนที่เปิดใช้งานในระบบ ไม่ hard-code จำนวนห้อง",
      "จัดการห้องเรียน",
      "/admin",
    ),
    makeCard(
      "students",
      "Students",
      activeStudents.length > 0 ? (issues.some((issue) => issue.category === "students") ? "warning" : "pass") : "fail",
      `${activeStudents.length.toLocaleString("th-TH")} คน`,
      "ต้องมีนักเรียนที่ active มากกว่า 0",
      activeStudents.length > 0 ? "ตรวจหาห้องที่ยังไม่มีนักเรียนแล้ว" : "ยังไม่มีรายชื่อนักเรียนสำหรับเช็กชื่อ",
      "จัดการ/นำเข้านักเรียน",
      "/admin/students/import",
    ),
    makeCard(
      "bases",
      "Learning bases",
      activeBases.length > 0 ? (issues.some((issue) => issue.category === "bases") ? "warning" : "pass") : "fail",
      `${activeBases.length.toLocaleString("th-TH")} ฐาน`,
      "ต้องมีฐานการเรียนรู้ที่ active และมีครูรับผิดชอบ",
      "ตรวจฐานที่ไม่มีครูหรือครูไม่ active แล้ว",
      "จัดการฐาน",
      "/admin",
    ),
    makeCard(
      "teachers",
      "Teachers",
      activeTeachers.length > 0 ? (issues.some((issue) => issue.category === "teachers") ? "warning" : "pass") : "fail",
      `${activeTeachers.length.toLocaleString("th-TH")} บัญชี`,
      "ต้องมีบัญชีครูที่ active อย่างน้อย 1 บัญชี",
      "ตรวจความสัมพันธ์ teacherUid กับ users profile แล้ว",
      "นำเข้าบัญชีครู",
      "/admin/teachers/import",
    ),
    makeCard(
      "rotation-plans",
      "Rotation plans",
      activeTermRotationPlans.length > 0 ? (issues.some((issue) => issue.category === "rotation-plans") ? "warning" : "pass") : "fail",
      `${activeTermRotationPlans.length.toLocaleString("th-TH")} รายการ / ${weeks.length.toLocaleString("th-TH")} สัปดาห์`,
      "ต้องมีแผนเวียนฐานของ active term",
      "ตรวจห้องที่ไม่มีแผนและสัปดาห์ที่ขาดแผนแล้ว",
      "นำเข้าแผนเวียนฐาน",
      "/admin/rotation-plans/import",
    ),
    makeCard(
      "attendance",
      "Attendance readiness",
      activeTermRotationPlans.length > 0 && activeStudents.length > 0 ? "pass" : "warning",
      `${data.attendanceSessions.length.toLocaleString("th-TH")} sessions`,
      "มี student + rotation plan ก่อนเริ่มเช็กชื่อ",
      data.attendanceSessions.length > 0 ? "พบรายการเช็กชื่อแล้ว" : "ยังไม่มี session ซึ่งปกติก่อน go-live อาจยังเป็น 0 ได้",
      "ดูรายการเช็กชื่อ",
      "/admin",
    ),
    makeCard(
      "integrity",
      "Data integrity",
      issues.some((issue) => issue.category === "integrity" && issue.severity === "fail")
        ? "fail"
        : issues.some((issue) => issue.category === "integrity")
          ? "warning"
          : "pass",
      `${issues.filter((issue) => issue.category === "integrity").length.toLocaleString("th-TH")} issues`,
      "ไม่มี reference ผิดหรือ record ซ้ำ",
      "ตรวจ duplicate และ reference ข้าม collection แล้ว",
      "ตรวจข้อมูล",
      "/admin/readiness",
    ),
  ];

  return {
    overallStatus,
    overallLabel:
      overallStatus === "ready" ? "Ready" : overallStatus === "ready_with_warnings" ? "Ready with warnings" : "Not ready",
    lastCheckedAt: new Date(),
    activeTerm,
    cards,
    issues,
    counts: {
      activeClassrooms: activeClassrooms.length,
      activeStudents: activeStudents.length,
      activeBases: activeBases.length,
      activeTeachers: activeTeachers.length,
      activeRotationPlans: activeTermRotationPlans.length,
      weeksWithPlans: weeks.length,
      attendanceSessions: data.attendanceSessions.length,
      specialScheduleWeeks: 0,
    },
    options: {
      academicTerms: data.academicTerms,
      classrooms: activeClassrooms,
      bases: activeBases,
      weeks,
    },
  };
}

export function filterReadinessIssues(issues: ReadinessIssue[], filters: ReadinessFilters) {
  return issues.filter((issue) => {
    if (filters.academicTermId && issue.academicTermId && issue.academicTermId !== filters.academicTermId) {
      return false;
    }
    if (filters.weekNumber && issue.weekNumber !== Number(filters.weekNumber)) {
      return false;
    }
    if (filters.classroomId && issue.classroomId !== filters.classroomId) {
      return false;
    }
    if (filters.baseId && issue.baseId !== filters.baseId) {
      return false;
    }
    if (filters.severity && issue.severity !== filters.severity) {
      return false;
    }
    return true;
  });
}
