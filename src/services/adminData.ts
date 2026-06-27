import {
  Timestamp,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import type {
  AcademicTerm,
  AcademicTermForm,
  AdminData,
  Classroom,
  ClassroomForm,
  LearningBase,
  LearningBaseForm,
  RotationPlan,
  RotationPlanForm,
  Student,
  StudentForm,
} from "../types/rotation";

const academicTermsCollection = collection(db, "academicTerms");
const classroomsCollection = collection(db, "classrooms");
const basesCollection = collection(db, "bases");
const rotationPlansCollection = collection(db, "rotationPlans");
const studentsCollection = collection(db, "students");
const attendanceSessionsCollection = collection(db, "attendanceSessions");

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

function requireFields(fields: Array<[string, string]>) {
  const missingField = fields.find(([, value]) => !value.trim());

  if (missingField) {
    throw new Error(`กรุณากรอก${missingField[0]}`);
  }
}

function toDateTimestamp(dateValue: string) {
  return Timestamp.fromDate(new Date(`${dateValue}T00:00:00`));
}

export function timestampToDateInput(value?: Timestamp) {
  if (!value) {
    return "";
  }

  const date = value.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function fetchAdminData(): Promise<AdminData> {
  const [academicTermsSnap, classroomsSnap, basesSnap, rotationPlansSnap, studentsSnap, attendanceSessionsSnap] = await Promise.all([
    getDocs(academicTermsCollection),
    getDocs(classroomsCollection),
    getDocs(basesCollection),
    getDocs(rotationPlansCollection),
    getDocs(studentsCollection),
    getDocs(attendanceSessionsCollection),
  ]);

  return {
    academicTerms: academicTermsSnap.docs.map((termDoc) => termDoc.data() as AcademicTerm),
    classrooms: classroomsSnap.docs.map((classroomDoc) => classroomDoc.data() as Classroom),
    bases: basesSnap.docs.map((baseDoc) => baseDoc.data() as LearningBase),
    rotationPlans: rotationPlansSnap.docs.map((rotationDoc) => rotationDoc.data() as RotationPlan),
    students: studentsSnap.docs.map((studentDoc) => studentDoc.data() as Student),
    attendanceSessions: attendanceSessionsSnap.docs.map((sessionDoc) => sessionDoc.data() as AdminData["attendanceSessions"][number]),
  };
}

export async function saveAcademicTerm(
  form: AcademicTermForm,
  existingTerms: AcademicTerm[],
  editingId?: string,
) {
  requireFields([
    ["ปีการศึกษา", form.academicYear],
    ["ภาคเรียน", form.semester],
    ["ชื่อเทอม", form.name],
    ["วันเริ่มต้น", form.startDate],
    ["วันสิ้นสุด", form.endDate],
  ]);

  if (new Date(form.startDate) > new Date(form.endDate)) {
    throw new Error("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
  }

  const termRef = editingId ? doc(db, "academicTerms", editingId) : doc(academicTermsCollection);
  const academicTermId = editingId ?? termRef.id;
  const batch = writeBatch(db);

  if (form.active) {
    existingTerms
      .filter((term) => term.active && term.academicTermId !== academicTermId)
      .forEach((term) => {
        batch.update(doc(db, "academicTerms", term.academicTermId), {
          active: false,
          updatedAt: serverTimestamp(),
        });
      });
  }

  const payload = {
    academicTermId,
    academicYear: form.academicYear.trim(),
    semester: form.semester.trim(),
    name: form.name.trim(),
    active: form.active,
    startDate: toDateTimestamp(form.startDate),
    endDate: toDateTimestamp(form.endDate),
    updatedAt: serverTimestamp(),
  };

  if (editingId) {
    batch.update(termRef, payload);
  } else {
    batch.set(termRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function saveClassroom(
  form: ClassroomForm,
  existingClassrooms: Classroom[],
  editingId?: string,
) {
  requireFields([
    ["ชื่อห้องเรียน", form.displayName],
    ["ระดับชั้น", form.level],
    ["เลขห้อง", form.roomNumber],
  ]);

  const duplicate = existingClassrooms.some(
    (classroom) =>
      classroom.classroomId !== editingId &&
      normalize(classroom.displayName) === normalize(form.displayName),
  );

  if (duplicate) {
    throw new Error("มีชื่อห้องเรียนนี้ในระบบแล้ว");
  }

  const classroomRef = editingId ? doc(db, "classrooms", editingId) : doc(classroomsCollection);
  const classroomId = editingId ?? classroomRef.id;
  const payload = {
    classroomId,
    displayName: form.displayName.trim(),
    level: form.level.trim(),
    roomNumber: form.roomNumber.trim(),
    active: form.active,
    updatedAt: serverTimestamp(),
  };

  if (editingId) {
    await updateDoc(classroomRef, payload);
    return;
  }

  await setDoc(classroomRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function saveLearningBase(
  form: LearningBaseForm,
  existingBases: LearningBase[],
  editingId?: string,
) {
  requireFields([
    ["ชื่อฐาน", form.baseName],
    ["Teacher UID", form.teacherUid],
    ["ชื่อครูประจำฐาน", form.teacherName],
  ]);

  const duplicate = existingBases.some(
    (base) => base.baseId !== editingId && normalize(base.baseName) === normalize(form.baseName),
  );

  if (duplicate) {
    throw new Error("มีชื่อฐานนี้ในระบบแล้ว");
  }

  const baseRef = editingId ? doc(db, "bases", editingId) : doc(basesCollection);
  const baseId = editingId ?? baseRef.id;
  const payload = {
    baseId,
    baseName: form.baseName.trim(),
    description: form.description.trim(),
    teacherUid: form.teacherUid.trim(),
    teacherName: form.teacherName.trim(),
    active: form.active,
    updatedAt: serverTimestamp(),
  };

  if (editingId) {
    await updateDoc(baseRef, payload);
    return;
  }

  await setDoc(baseRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function saveRotationPlan(
  form: RotationPlanForm,
  data: AdminData,
  editingId?: string,
) {
  requireFields([
    ["ปีการศึกษา", form.academicTermId],
    ["สัปดาห์", form.weekNumber],
    ["ห้องเรียน", form.classroomId],
    ["ฐานการเรียนรู้", form.baseId],
  ]);

  const weekNumber = Number(form.weekNumber);

  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error("สัปดาห์ต้องเป็นตัวเลขตั้งแต่ 1 ขึ้นไป");
  }

  const duplicate = data.rotationPlans.some(
    (rotation) =>
      rotation.rotationId !== editingId &&
      rotation.academicTermId === form.academicTermId &&
      rotation.weekNumber === weekNumber &&
      rotation.classroomId === form.classroomId,
  );

  if (duplicate) {
    throw new Error("มีแผนเวียนฐานของห้องนี้ในสัปดาห์นี้แล้ว");
  }

  const classroom = data.classrooms.find((item) => item.classroomId === form.classroomId);
  const base = data.bases.find((item) => item.baseId === form.baseId);

  if (!classroom || !base) {
    throw new Error("ไม่พบข้อมูลห้องเรียนหรือฐานการเรียนรู้");
  }

  const rotationRef = editingId ? doc(db, "rotationPlans", editingId) : doc(rotationPlansCollection);
  const rotationId = editingId ?? rotationRef.id;
  const payload = {
    rotationId,
    academicTermId: form.academicTermId,
    weekNumber,
    classroomId: classroom.classroomId,
    classroomName: classroom.displayName,
    baseId: base.baseId,
    baseName: base.baseName,
    teacherUid: base.teacherUid,
    teacherName: base.teacherName,
    active: form.active,
    updatedAt: serverTimestamp(),
  };

  if (editingId) {
    await updateDoc(rotationRef, payload);
    return;
  }

  await setDoc(rotationRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function saveStudent(
  form: StudentForm,
  data: AdminData,
  editingId?: string,
) {
  requireFields([
    ["ห้องเรียน", form.classroomId],
    ["เลขที่", form.studentNumber],
    ["ชื่อ-สกุลนักเรียน", form.fullName],
  ]);

  const classroom = data.classrooms.find((item) => item.classroomId === form.classroomId);

  if (!classroom) {
    throw new Error("ไม่พบข้อมูลห้องเรียน");
  }

  const duplicate = data.students.some(
    (student) =>
      student.studentId !== editingId &&
      student.classroomId === form.classroomId &&
      normalize(student.studentNumber) === normalize(form.studentNumber),
  );

  if (duplicate) {
    throw new Error("มีเลขที่นักเรียนนี้ในห้องแล้ว");
  }

  const studentRef = editingId ? doc(db, "students", editingId) : doc(studentsCollection);
  const studentId = editingId ?? studentRef.id;
  const payload = {
    studentId,
    classroomId: classroom.classroomId,
    classroomName: classroom.displayName,
    studentNumber: form.studentNumber.trim(),
    fullName: form.fullName.trim(),
    active: form.active,
    updatedAt: serverTimestamp(),
  };

  if (editingId) {
    await updateDoc(studentRef, payload);
    return;
  }

  await setDoc(studentRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function deactivateRecord(collectionName: string, recordId: string) {
  await updateDoc(doc(db, collectionName, recordId), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}
