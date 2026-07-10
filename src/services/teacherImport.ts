import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseConfig } from "../firebase";
import { db } from "../firebaseDb";
import type { UserProfile } from "../types/user";
import {
  teacherImportFields,
  type TeacherImportField,
  type TeacherImportPreview,
  type TeacherImportResult,
  type TeacherImportRow,
  type TeacherImportValue,
} from "../types/teacherImport";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_ROWS = 200;

const fieldLabels: Record<TeacherImportField, string> = {
  displayName: "ชื่อครู",
  email: "อีเมล",
  password: "รหัสผ่าน",
  role: "บทบาท",
  active: "สถานะใช้งาน",
};

const requiredFields: TeacherImportField[] = ["displayName", "email", "password"];

const columnAliases: Record<TeacherImportField, string[]> = {
  displayName: ["displayname", "display name", "name", "teachername", "teacher name", "ชื่อครู", "ชื่อ-สกุล", "ชื่อสกุล"],
  email: ["email", "e-mail", "mail", "อีเมล", "อีเมล์"],
  password: ["password", "รหัสผ่าน"],
  role: ["role", "บทบาท"],
  active: ["active", "enabled", "status", "สถานะ", "เปิดใช้งาน", "ใช้งาน"],
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH").replace(/[\s_.\-/\\]+/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function toText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isValidName(value: string) {
  return value.length > 0 && /\p{L}/u.test(value) && !/[\u0000-\u001f]/u.test(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseActive(value: string) {
  const normalized = normalize(value);

  if (!normalized) {
    return { value: true, error: "" };
  }

  if (["true", "yes", "y", "1", "active", "ใช่", "เปิด", "เปิดใช้งาน", "ใช้งาน"].includes(normalized)) {
    return { value: true, error: "" };
  }

  if (["false", "no", "n", "0", "inactive", "ไม่ใช่", "ปิด", "ปิดใช้งาน", "ระงับ"].includes(normalized)) {
    return { value: false, error: "" };
  }

  return { value: true, error: "สถานะใช้งานต้องเป็น true/false, yes/no, เปิด/ปิด" };
}

function resolveHeaders(headerRow: unknown[]) {
  const resolved = new Map<TeacherImportField, number>();
  const duplicateFields: TeacherImportField[] = [];

  headerRow.forEach((header, index) => {
    const normalizedHeader = normalize(toText(header));
    const field = teacherImportFields.find((candidate) =>
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

function makeEmptyValue(): TeacherImportValue {
  return {
    displayName: "",
    email: "",
    password: "",
    role: "",
    active: "",
  };
}

export async function fetchExistingUserEmails() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs
    .map((userDoc) => userDoc.data() as Partial<UserProfile>)
    .map((profile) => normalizeEmail(profile.email ?? ""))
    .filter(Boolean);
}

export async function parseTeacherImportFile(
  file: File,
  existingEmails: string[],
): Promise<TeacherImportPreview> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("ไฟล์มีขนาดเกิน 2 MB กรุณาแบ่งไฟล์แล้วนำเข้าใหม่");
  }

  const matrix = await readSpreadsheet(file);
  const firstContentRow = matrix.findIndex((row) => row.some((cell) => toText(cell)));

  if (firstContentRow < 0) {
    throw new Error("ไฟล์ไม่มีข้อมูล");
  }

  if (matrix.length - firstContentRow - 1 > MAX_ROWS) {
    throw new Error(`ไฟล์มีข้อมูลเกิน ${MAX_ROWS.toLocaleString("th-TH")} แถว กรุณาแบ่งไฟล์แล้วนำเข้าใหม่`);
  }

  const { resolved, duplicateFields } = resolveHeaders(matrix[firstContentRow]);
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields = requiredFields.filter((field) => !resolved.has(field));

  if (missingFields.length > 0) {
    errors.push(`ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.map((field) => fieldLabels[field]).join(", ")}`);
  }

  if (duplicateFields.length > 0) {
    errors.push(`พบคอลัมน์ซ้ำ: ${[...new Set(duplicateFields)].map((field) => fieldLabels[field]).join(", ")}`);
  }

  const unknownColumns = matrix[firstContentRow]
    .map(toText)
    .filter(
      (header) =>
        header && !teacherImportFields.some((field) => columnAliases[field].some((alias) => normalize(alias) === normalize(header))),
    );

  if (unknownColumns.length > 0) {
    warnings.push(`ข้ามคอลัมน์ที่ไม่รู้จัก: ${unknownColumns.join(", ")}`);
  }

  const existingEmailSet = new Set(existingEmails.map(normalizeEmail));
  const seenEmails = new Map<string, number>();

  const rows = matrix
    .slice(firstContentRow + 1)
    .map((sourceRow, index): TeacherImportRow | null => {
      if (!sourceRow.some((cell) => toText(cell))) {
        return null;
      }

      const value = makeEmptyValue();
      for (const field of teacherImportFields) {
        const columnIndex = resolved.get(field);
        if (columnIndex !== undefined) {
          value[field] = toText(sourceRow[columnIndex]);
        }
      }

      const rowNumber = firstContentRow + index + 2;
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];
      const emailKey = normalizeEmail(value.email);
      const activeResult = parseActive(value.active);

      for (const field of requiredFields) {
        if (!value[field]) {
          rowErrors.push(`ไม่มี${fieldLabels[field]}`);
        }
      }

      if (value.displayName && !isValidName(value.displayName)) {
        rowErrors.push("ชื่อครูไม่ถูกต้อง");
      }

      if (value.email && !isValidEmail(value.email)) {
        rowErrors.push("รูปแบบอีเมลไม่ถูกต้อง");
      }

      if (value.password && value.password.length < 6) {
        rowErrors.push("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      }

      if (value.role && normalize(value.role) !== "teacher" && value.role !== "ครูผู้สอน") {
        rowErrors.push("บทบาทต้องเป็น teacher เท่านั้น");
      }

      if (activeResult.error) {
        rowErrors.push(activeResult.error);
      }

      if (emailKey) {
        const duplicateRow = seenEmails.get(emailKey);
        if (duplicateRow) {
          rowErrors.push(`อีเมลซ้ำกับแถว ${duplicateRow}`);
        } else {
          seenEmails.set(emailKey, rowNumber);
        }

        if (existingEmailSet.has(emailKey)) {
          rowErrors.push("อีเมลนี้มี profile อยู่ในระบบแล้ว");
        }
      }

      if (!value.role) {
        rowWarnings.push("ไม่ได้ระบุบทบาท ระบบจะตั้งเป็น teacher");
      }

      if (!value.active) {
        rowWarnings.push("ไม่ได้ระบุสถานะ ระบบจะเปิดใช้งานให้");
      }

      if (sourceRow.length > matrix[firstContentRow].length) {
        rowWarnings.push("มีข้อมูลเกินจำนวนคอลัมน์ ระบบจะข้ามข้อมูลส่วนเกิน");
      }

      return {
        ...value,
        rowNumber,
        normalizedEmail: emailKey,
        activeValue: activeResult.value,
        errors: rowErrors,
        warnings: rowWarnings,
      };
    })
    .filter((row): row is TeacherImportRow => row !== null);

  if (rows.length === 0) {
    errors.push("ไม่พบแถวครูใต้หัวตาราง");
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

function authErrorMessage(code: string) {
  if (code === "EMAIL_EXISTS") {
    return "อีเมลนี้มีบัญชี Firebase Auth อยู่แล้ว";
  }

  if (code === "WEAK_PASSWORD") {
    return "รหัสผ่านไม่ผ่านเงื่อนไขของ Firebase";
  }

  if (code === "INVALID_EMAIL") {
    return "อีเมลไม่ถูกต้อง";
  }

  if (code === "OPERATION_NOT_ALLOWED") {
    return "ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Auth";
  }

  return `Firebase Auth error: ${code}`;
}

async function createAuthUser(email: string, password: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false,
      }),
    },
  );
  const payload = (await response.json()) as { localId?: string; error?: { message?: string } };

  if (!response.ok || !payload.localId) {
    throw new Error(authErrorMessage(payload.error?.message ?? "UNKNOWN"));
  }

  return payload.localId;
}

export async function importTeacherRows(
  rows: TeacherImportRow[],
  onProgress: (importedCount: number, totalCount: number) => void,
): Promise<TeacherImportResult> {
  const validRows = rows.filter((row) => row.errors.length === 0);
  const latestEmails = await fetchExistingUserEmails().catch(() => {
    throw new Error("ตรวจสอบบัญชีครูล่าสุดไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
  });
  const latestEmailSet = new Set(latestEmails.map(normalizeEmail));
  const staleRow = validRows.find((row) => latestEmailSet.has(row.normalizedEmail));

  if (staleRow) {
    throw new Error(`ข้อมูลเปลี่ยนแปลงหลังตรวจไฟล์ กรุณาเลือกไฟล์ใหม่อีกครั้ง (แถว ${staleRow.rowNumber})`);
  }

  const failures: TeacherImportResult["failures"] = [];
  let importedCount = 0;

  for (const row of validRows) {
    try {
      const uid = await createAuthUser(row.normalizedEmail, row.password);
      await setDoc(doc(db, "users", uid), {
        displayName: row.displayName,
        email: row.normalizedEmail,
        role: "teacher",
        active: row.activeValue,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      importedCount += 1;
      onProgress(importedCount, validRows.length);
    } catch (error) {
      failures.push({
        rowNumber: row.rowNumber,
        email: row.email,
        message: error instanceof Error ? error.message : "สร้างบัญชีไม่สำเร็จ",
      });
    }
  }

  return {
    importedCount,
    failedCount: failures.length,
    failures,
  };
}

export function downloadTeacherCsvTemplate() {
  const content = [
    ["ชื่อครู", "อีเมล", "รหัสผ่าน", "บทบาท", "สถานะ"],
    ["ครูสมศรี ใจดี", "teacher1@example.com", "ChangeMe123", "teacher", "เปิด"],
  ]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "teacher-import-template.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadTeacherExcelTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const headerStyle = { fontWeight: "bold" as const, backgroundColor: "#E7F3EE" };
  const workbook = writeXlsxFile(
    [
      [
        { value: "ชื่อครู", ...headerStyle },
        { value: "อีเมล", ...headerStyle },
        { value: "รหัสผ่าน", ...headerStyle },
        { value: "บทบาท", ...headerStyle },
        { value: "สถานะ", ...headerStyle },
      ],
      ["ครูสมศรี ใจดี", "teacher1@example.com", "ChangeMe123", "teacher", "เปิด"],
    ],
    {
      sheet: "Teachers",
      columns: [{ width: 28 }, { width: 30 }, { width: 18 }, { width: 14 }, { width: 14 }],
    },
  );
  await workbook.toFile("teacher-import-template.xlsx");
}
