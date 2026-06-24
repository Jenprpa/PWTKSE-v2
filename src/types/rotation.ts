import type { Timestamp } from "firebase/firestore";

export const FIXED_COURSE_DAY = "Tuesday";
export const FIXED_COURSE_DAY_TH = "วันอังคาร";
export const FIXED_COURSE_PERIOD = 9;

export type AcademicTerm = {
  academicTermId: string;
  academicYear: string;
  semester: string;
  name: string;
  active: boolean;
  startDate: Timestamp;
  endDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Classroom = {
  classroomId: string;
  displayName: string;
  level: string;
  roomNumber: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type LearningBase = {
  baseId: string;
  baseName: string;
  description: string;
  teacherUid: string;
  teacherName: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type RotationPlan = {
  rotationId: string;
  academicTermId: string;
  weekNumber: number;
  classroomId: string;
  classroomName: string;
  baseId: string;
  baseName: string;
  teacherUid: string;
  teacherName: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Student = {
  studentId: string;
  classroomId: string;
  classroomName: string;
  studentNumber: string;
  fullName: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AttendanceStatus = "present" | "absent" | "leave" | "late";

export type AttendanceSession = {
  sessionId: string;
  academicTermId: string;
  attendanceDate: string;
  weekNumber: number;
  classroomId: string;
  classroomName: string;
  baseId: string;
  baseName: string;
  teacherUid: string;
  teacherName: string;
  status: "draft" | "submitted";
  submittedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AttendanceRecord = {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  status: AttendanceStatus;
  note: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AdminData = {
  academicTerms: AcademicTerm[];
  classrooms: Classroom[];
  bases: LearningBase[];
  rotationPlans: RotationPlan[];
  students: Student[];
  attendanceSessions: AttendanceSession[];
};

export type AcademicTermForm = {
  academicYear: string;
  semester: string;
  name: string;
  active: boolean;
  startDate: string;
  endDate: string;
};

export type ClassroomForm = {
  displayName: string;
  level: string;
  roomNumber: string;
  active: boolean;
};

export type LearningBaseForm = {
  baseName: string;
  description: string;
  teacherUid: string;
  teacherName: string;
  active: boolean;
};

export type RotationPlanForm = {
  academicTermId: string;
  weekNumber: string;
  classroomId: string;
  baseId: string;
  active: boolean;
};

export type StudentForm = {
  classroomId: string;
  studentNumber: string;
  fullName: string;
  active: boolean;
};
