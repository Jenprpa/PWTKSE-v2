import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebaseDb";
import type { Classroom, Student } from "../types/rotation";
import {
  studentImportFields,
  type StudentImportField,
  type StudentImportPreview,
  type StudentImportRow,
  type StudentImportValue,
} from "../types/studentImport";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const BATCH_SIZE = 400;

const fieldLabels: Record<StudentImportField, string> = {
  studentId: "รหัสนักเรียน",
  prefix: "คำนำหน้า",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  classroom: "ห้องเรียน",
  number: "เลขที่",
};

const columnAliases: Record<StudentImportField, string[]> = {
  studentId: ["studentid", "student id", "เลขประจำตัว", "รหัสนักเรียน", "เลขประจำตัวนักเรียน"],
  prefix: ["prefix", "คำนำหน้า", "คํานําหน้า"],
  firstName: ["firstname", "first name", "ชื่อ"],
  lastName: ["lastname", "last name", "สกุล", "นามสกุล"],
  classroom: ["classroom", "class", "room", "ห้อง", "ชั้นเรียน", "ห้องเรียน"],
  number: ["number", "studentnumber", "student number", "เลขที่"],
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH").replace(/[\s_.\-/\\]+/g, "");
}

function toText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isValidName(value: string) {
  return value.length > 0 && /\p{L}/u.test(value) && !/[\d\u0000-\u001f]/u.test(value);
}

function resolveHeaders(headerRow: unknown[]) {
  const resolved = new Map<StudentImportField, number>();
  const duplicateFields: StudentImportField[] = [];

  headerRow.forEach((header, index) => {
    const normalizedHeader = normalize(toText(header));
    const field = studentImportFields.find((candidate) =>
      columnAliases[candidate].some((alias) => normalize(alias) === normalizedHeader),
    );

    if (!field) {
      return;
    }

    if (resolved.has(field)) {
      duplicateFields.push(field);
      return;
    }

    resolved.set(field, index);
  });

  return { resolved, duplicateFields };
}

async function readSpreadsheet(file: File): Promise<unknown[][]> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("en-US");

  if (extension === "csv") {
    const Papa = await import("papaparse");
    return new Promise<unknown[][]>((resolve, reject) => {
      Papa.default.parse<unknown[]>(file, {
        complete(result) {
          if (result.errors.length > 0) {
            reject(new Error(`อ่านไฟล์ CSV ไม่สำเร็จ: ${result.errors[0].message}`));
            return;
          }

          resolve(result.data);
        },
        error(error) {
          reject(new Error(`อ่านไฟล์ CSV ไม่สำเร็จ: ${error.message}`));
        },
        skipEmptyLines: "greedy",
      });
    });
  }

  if (extension === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }

  throw new Error("รองรับเฉพาะไฟล์ .xlsx และ .csv");
}

function makeEmptyValue(): StudentImportValue {
  return {
    studentId: "",
    prefix: "",
    firstName: "",
    lastName: "",
    classroom: "",
    number: "",
  };
}

export async function parseStudentImportFile(
  file: File,
  classrooms: Classroom[],
  existingStudents: Student[],
): Promise<StudentImportPreview> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("ไฟล์มีขนาดเกิน 5 MB กรุณาแบ่งไฟล์แล้วนำเข้าใหม่");
  }

  const matrix = await readSpreadsheet(file);
  const firstContentRow = matrix.findIndex((row) => row.some((cell) => toText(cell)));

  if (firstContentRow < 0) {
    throw new Error("ไฟล์ไม่มีข้อมูล");
  }

  const { resolved, duplicateFields } = resolveHeaders(matrix[firstContentRow]);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (matrix.length - firstContentRow - 1 > MAX_ROWS) {
    throw new Error(`ไฟล์มีข้อมูลเกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว กรุณาแบ่งไฟล์แล้วนำเข้าใหม่`);
  }
  const missingFields = studentImportFields.filter((field) => !resolved.has(field));

  if (missingFields.length > 0) {
    errors.push(`ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.map((field) => fieldLabels[field]).join(", ")}`);
  }

  if (duplicateFields.length > 0) {
    errors.push(`พบคอลัมน์ซ้ำ: ${[...new Set(duplicateFields)].map((field) => fieldLabels[field]).join(", ")}`);
  }

  const unknownColumns = matrix[firstContentRow]
    .map(toText)
    .filter((header) => header && !studentImportFields.some((field) => columnAliases[field].some((alias) => normalize(alias) === normalize(header))));

  if (unknownColumns.length > 0) {
    warnings.push(`ข้ามคอลัมน์ที่ไม่รู้จัก: ${unknownColumns.join(", ")}`);
  }

  const classroomLookup = new Map(classrooms.map((classroom) => [normalize(classroom.displayName), classroom] as const));
  const existingStudentIds = new Set(existingStudents.map((student) => normalize(student.studentId)));
  const existingClassNumbers = new Set(
    existingStudents.map((student) => `${normalize(student.classroomName)}::${normalize(student.studentNumber)}`),
  );
  const seenStudentIds = new Map<string, number>();
  const seenClassNumbers = new Map<string, number>();

  const rows = matrix
    .slice(firstContentRow + 1)
    .map((sourceRow, index): StudentImportRow | null => {
      if (!sourceRow.some((cell) => toText(cell))) {
        return null;
      }

      const value = makeEmptyValue();
      for (const field of studentImportFields) {
        const columnIndex = resolved.get(field);
        if (columnIndex !== undefined) {
          value[field] = toText(sourceRow[columnIndex]);
        }
      }

      const rowNumber = firstContentRow + index + 2;
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];
      const classroom = classroomLookup.get(normalize(value.classroom));
      const studentIdKey = normalize(value.studentId);
      const classNumberKey = `${normalize(value.classroom)}::${normalize(value.number)}`;

      for (const field of studentImportFields) {
        if (!value[field]) {
          rowErrors.push(`ไม่มี${fieldLabels[field]}`);
        }
      }

      const studentIdColumn = resolved.get("studentId");
      if (studentIdColumn !== undefined && typeof sourceRow[studentIdColumn] === "number") {
        rowWarnings.push("รหัสนักเรียนเป็นตัวเลข โปรดตรวจสอบเลขศูนย์นำหน้า");
      }

      if (value.prefix && !isValidName(value.prefix)) {
        rowErrors.push("คำนำหน้าไม่ถูกต้อง");
      }
      if (value.firstName && !isValidName(value.firstName)) {
        rowErrors.push("ชื่อไม่ถูกต้อง");
      }
      if (value.lastName && !isValidName(value.lastName)) {
        rowErrors.push("นามสกุลไม่ถูกต้อง");
      }
      if (value.number && (!/^\d+$/.test(value.number) || Number(value.number) < 1)) {
        rowErrors.push("เลขที่ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป");
      }
      if (value.studentId && !/^[\p{L}\p{N}._-]+$/u.test(value.studentId)) {
        rowErrors.push("รหัสนักเรียนมีอักขระที่ไม่รองรับ");
      }
      if (!classroom) {
        rowErrors.push(`ไม่พบห้องเรียน ${value.classroom || "(ว่าง)"} ในระบบ`);
      } else if (!classroom.active) {
        rowErrors.push(`ห้องเรียน ${classroom.displayName} ถูกปิดใช้งาน`);
      }

      if (studentIdKey) {
        const duplicateRow = seenStudentIds.get(studentIdKey);
        if (duplicateRow) {
          rowErrors.push(`รหัสนักเรียนซ้ำกับแถว ${duplicateRow}`);
        } else {
          seenStudentIds.set(studentIdKey, rowNumber);
        }

        if (existingStudentIds.has(studentIdKey)) {
          rowErrors.push("รหัสนักเรียนมีอยู่ในระบบแล้ว");
        }
      }

      if (value.classroom && value.number) {
        const duplicateRow = seenClassNumbers.get(classNumberKey);
        if (duplicateRow) {
          rowErrors.push(`ห้องและเลขที่ซ้ำกับแถว ${duplicateRow}`);
        } else {
          seenClassNumbers.set(classNumberKey, rowNumber);
        }

        if (existingClassNumbers.has(classNumberKey)) {
          rowErrors.push("ห้องและเลขที่มีอยู่ในระบบแล้ว");
        }
      }

      if (sourceRow.length > matrix[firstContentRow].length) {
        rowWarnings.push("มีข้อมูลเกินจำนวนคอลัมน์ ระบบจะข้ามข้อมูลส่วนเกิน");
      }

      return {
        ...value,
        rowNumber,
        classroomId: classroom?.classroomId ?? "",
        classroomName: classroom?.displayName ?? value.classroom,
        fullName: `${value.prefix}${value.firstName}${value.lastName ? ` ${value.lastName}` : ""}`,
        errors: rowErrors,
        warnings: rowWarnings,
      };
    })
    .filter((row): row is StudentImportRow => row !== null);

  if (rows.length === 0) {
    errors.push("ไม่พบแถวนักเรียนใต้หัวตาราง");
  }

  return {
    fileName: file.name,
    rows,
    errors,
    warnings,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    warningRows: rows.filter((row) => row.warnings.length > 0).length,
  };
}

export class StudentImportWriteError extends Error {
  importedCount: number;

  constructor(message: string, importedCount: number) {
    super(message);
    this.name = "StudentImportWriteError";
    this.importedCount = importedCount;
  }
}

export async function importStudentRows(
  rows: StudentImportRow[],
  onProgress: (importedCount: number, totalCount: number) => void,
) {
  const validRows = rows.filter((row) => row.errors.length === 0);
  let importedCount = 0;

  const { latestStudents, latestClassrooms } = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "classrooms")),
  ])
    .then(([studentsSnapshot, classroomsSnapshot]) => ({
      latestStudents: studentsSnapshot.docs.map((studentDoc) => studentDoc.data() as Student),
      latestClassrooms: classroomsSnapshot.docs.map((classroomDoc) => classroomDoc.data() as Classroom),
    }))
    .catch(() => {
      throw new StudentImportWriteError(
        "ตรวจสอบข้อมูลล่าสุดไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
        0,
      );
    });
  const latestStudentIds = new Set(latestStudents.map((student) => normalize(student.studentId)));
  const latestClassNumbers = new Set(
    latestStudents.map((student) => `${normalize(student.classroomName)}::${normalize(student.studentNumber)}`),
  );
  const activeClassroomIds = new Set(
    latestClassrooms.filter((classroom) => classroom.active).map((classroom) => classroom.classroomId),
  );
  const staleRow = validRows.find(
    (row) =>
      latestStudentIds.has(normalize(row.studentId)) ||
      latestClassNumbers.has(`${normalize(row.classroomName)}::${normalize(row.number)}`) ||
      !activeClassroomIds.has(row.classroomId),
  );

  if (staleRow) {
    throw new StudentImportWriteError(
      `ข้อมูลเปลี่ยนแปลงหลังตรวจไฟล์ กรุณาเลือกไฟล์ใหม่และตรวจสอบอีกครั้ง (แถว ${staleRow.rowNumber})`,
      0,
    );
  }

  for (let offset = 0; offset < validRows.length; offset += BATCH_SIZE) {
    const chunk = validRows.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const row of chunk) {
      const studentRef = doc(db, "students", row.studentId);
      batch.set(studentRef, {
        studentId: row.studentId,
        classroomId: row.classroomId,
        classroomName: row.classroomName,
        studentNumber: row.number,
        fullName: row.fullName,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      importedCount += chunk.length;
      onProgress(importedCount, validRows.length);
    } catch {
      throw new StudentImportWriteError(
        importedCount > 0
          ? `นำเข้าแล้ว ${importedCount} คน ก่อนเกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูลก่อนลองอีกครั้ง`
          : "นำเข้าข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
        importedCount,
      );
    }
  }

  return importedCount;
}

export function downloadStudentCsvTemplate() {
  const content = [
    ["เลขประจำตัว", "คำนำหน้า", "ชื่อ", "นามสกุล", "ห้อง", "เลขที่"],
    ["65001", "เด็กชาย", "สมชาย", "ใจดี", "ม.1/1", "1"],
  ]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-import-template.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadStudentExcelTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const headerStyle = { fontWeight: "bold" as const, backgroundColor: "#E7F3EE" };
  const workbook = writeXlsxFile(
    [
      [
        { value: "เลขประจำตัว", ...headerStyle },
        { value: "คำนำหน้า", ...headerStyle },
        { value: "ชื่อ", ...headerStyle },
        { value: "นามสกุล", ...headerStyle },
        { value: "ห้อง", ...headerStyle },
        { value: "เลขที่", ...headerStyle },
      ],
      ["65001", "เด็กชาย", "สมชาย", "ใจดี", "ม.1/1", "1"],
    ],
    {
      sheet: "Students",
      columns: [{ width: 18 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 10 }],
    },
  );
  await workbook.toFile("student-import-template.xlsx");
}
