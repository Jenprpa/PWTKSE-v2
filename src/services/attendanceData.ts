import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import type {
  AcademicTerm,
  AttendanceStatus,
  RotationPlan,
  Student,
} from "../types/rotation";

export type AttendanceEntry = {
  studentId: string;
  studentNumber: string;
  studentName: string;
  status: AttendanceStatus;
  note: string;
};

export type TeacherAttendanceData = {
  today: Date;
  attendanceDate: string;
  isCourseDay: boolean;
  activeTerm: AcademicTerm | null;
  weekNumber: number | null;
  rotations: RotationPlan[];
};

const attendanceSessionsCollection = collection(db, "attendanceSessions");
const attendanceRecordsCollection = collection(db, "attendanceRecords");

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateWeekNumber(term: AcademicTerm, today: Date) {
  const startDate = startOfDay(term.startDate.toDate());
  const todayDate = startOfDay(today);
  const diffMs = todayDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

export async function fetchTeacherAttendanceData(teacherUid: string): Promise<TeacherAttendanceData> {
  const today = new Date();
  const attendanceDate = toDateInput(today);
  const isCourseDay = today.getDay() === 2;

  const termsSnap = await getDocs(query(collection(db, "academicTerms"), where("active", "==", true)));
  const activeTerm = termsSnap.docs[0]?.data() as AcademicTerm | undefined;

  if (!isCourseDay || !activeTerm) {
    return {
      today,
      attendanceDate,
      isCourseDay,
      activeTerm: activeTerm ?? null,
      weekNumber: activeTerm ? calculateWeekNumber(activeTerm, today) : null,
      rotations: [],
    };
  }

  const weekNumber = calculateWeekNumber(activeTerm, today);
  const rotationsSnap = await getDocs(
    query(collection(db, "rotationPlans"), where("teacherUid", "==", teacherUid)),
  );

  return {
    today,
    attendanceDate,
    isCourseDay,
    activeTerm,
    weekNumber,
    rotations: rotationsSnap.docs
      .map((rotationDoc) => rotationDoc.data() as RotationPlan)
      .filter(
        (rotation) =>
          rotation.active &&
          rotation.academicTermId === activeTerm.academicTermId &&
          rotation.weekNumber === weekNumber,
      ),
  };
}

export async function fetchActiveStudents(classroomId: string) {
  const studentsSnap = await getDocs(
    query(collection(db, "students"), where("classroomId", "==", classroomId)),
  );

  return studentsSnap.docs
    .map((studentDoc) => studentDoc.data() as Student)
    .filter((student) => student.active)
    .sort((a, b) => Number(a.studentNumber) - Number(b.studentNumber));
}

export async function saveAttendanceSession({
  activeTerm,
  attendanceDate,
  entries,
  rotation,
  weekNumber,
}: {
  activeTerm: AcademicTerm;
  attendanceDate: string;
  entries: AttendanceEntry[];
  rotation: RotationPlan;
  weekNumber: number;
}) {
  if (entries.length === 0) {
    throw new Error("ไม่สามารถบันทึกการเช็กชื่อว่างได้");
  }

  const duplicateSnap = await getDocs(
    query(attendanceSessionsCollection, where("teacherUid", "==", rotation.teacherUid)),
  );

  const hasDuplicate = duplicateSnap.docs
    .map((sessionDoc) => sessionDoc.data())
    .some(
      (session) =>
        session.academicTermId === activeTerm.academicTermId &&
        session.attendanceDate === attendanceDate &&
        session.weekNumber === weekNumber &&
        session.classroomId === rotation.classroomId &&
        session.baseId === rotation.baseId,
    );

  if (hasDuplicate) {
    throw new Error("มีการเช็กชื่อรายการนี้แล้ว");
  }

  const sessionRef = doc(attendanceSessionsCollection);
  const batch = writeBatch(db);

  batch.set(sessionRef, {
    sessionId: sessionRef.id,
    academicTermId: activeTerm.academicTermId,
    attendanceDate,
    weekNumber,
    classroomId: rotation.classroomId,
    classroomName: rotation.classroomName,
    baseId: rotation.baseId,
    baseName: rotation.baseName,
    teacherUid: rotation.teacherUid,
    teacherName: rotation.teacherName,
    status: "submitted",
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  entries.forEach((entry) => {
    const recordRef = doc(attendanceRecordsCollection);
    batch.set(recordRef, {
      recordId: recordRef.id,
      sessionId: sessionRef.id,
      studentId: entry.studentId,
      studentNumber: entry.studentNumber,
      studentName: entry.studentName,
      status: entry.status,
      note: entry.note.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export function makeAttendanceEntries(students: Student[]): AttendanceEntry[] {
  return students.map((student) => ({
    studentId: student.studentId,
    studentNumber: student.studentNumber,
    studentName: student.fullName,
    status: "present",
    note: "",
  }));
}

export function timestampToDisplayDate(value: Timestamp | null) {
  if (!value) {
    return "-";
  }

  return value.toDate().toLocaleDateString("th-TH");
}
