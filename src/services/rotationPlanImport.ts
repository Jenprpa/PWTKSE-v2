import JSZip from "jszip";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import type { AcademicTerm, Classroom, LearningBase, RotationPlan } from "../types/rotation";
import type {
  RotationImportMode,
  RotationImportPreview,
  RotationImportPreviewRow,
  RotationImportReferenceData,
  RotationImportResult,
  RotationImportWriteMode,
  ScheduleStatus,
} from "../types/rotationPlanImport";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const BATCH_SIZE = 400;
const schoolBaseAliases = [
  "ไฟเบอร์ ทรงพลัง",
  "อาณาจักรอักษร",
  "เงาในน้ำ",
  "ไก่ไข่อารมณ์ดี",
  "หรรษา สุธารสเห็ด",
  "ต้นกล้า ประชาธิปไตย",
  "หลู่สู่จากนาเกลือเกื้อบุญ",
];

const flatHeaders = ["week", "date", "learningBaseName", "classroomName", "location", "scheduleStatus"] as const;

type MatrixCell = {
  value: string;
  address: string;
  row: number;
  col: number;
};

type MatrixSheet = {
  rows: MatrixCell[][];
  mergeCount: number;
};

type ParsedClassroom = {
  classroomId: string;
  classroomName: string;
  warnings: string[];
  errors: string[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH").replace(/[\s_.\-/\\\n\r]+/g, "");
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function toText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function parseWeek(value: string): number | "" {
  const match = value.match(/\d+/);
  if (!match) {
    return "";
  }

  const week = Number(match[0]);
  return Number.isInteger(week) && week > 0 ? week : "";
}

function parseDateValue(value: string) {
  const text = value.trim();
  if (!text) {
    return "";
  }

  const iso = text.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const thai = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (thai) {
    const rawYear = Number(thai[3]);
    const year = rawYear > 2400 ? rawYear - 543 : rawYear < 100 ? rawYear + 2000 : rawYear;
    return `${year}-${thai[2].padStart(2, "0")}-${thai[1].padStart(2, "0")}`;
  }

  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 30000 && serial < 60000) {
    const date = new Date(Date.UTC(1899, 11, 30 + serial));
    return date.toISOString().slice(0, 10);
  }

  return text;
}

function columnNameToNumber(name: string) {
  return name.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function splitAddress(address: string) {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return { col: 0, row: 0 };
  }

  return { col: columnNameToNumber(match[1]), row: Number(match[2]) };
}

function cellName(row: number, col: number) {
  let column = "";
  let index = col;
  while (index > 0) {
    const modulo = (index - 1) % 26;
    column = String.fromCharCode(65 + modulo) + column;
    index = Math.floor((index - modulo) / 26);
  }

  return `${column}${row}`;
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}

async function readXlsxMatrix(file: File): Promise<MatrixSheet> {
  const zip = await JSZip.loadAsync(file);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");

  if (!workbookXml || !workbookRelsXml) {
    throw new Error("อ่านโครงสร้างไฟล์ Excel ไม่สำเร็จ");
  }

  const workbookDoc = parseXml(workbookXml);
  const relsDoc = parseXml(workbookRelsXml);
  const firstSheet = workbookDoc.querySelector("sheet");
  const relId = firstSheet?.getAttribute("r:id");
  const rel = relId
    ? [...relsDoc.querySelectorAll("Relationship")].find((item) => item.getAttribute("Id") === relId)
    : undefined;
  const target = rel?.getAttribute("Target") ?? "worksheets/sheet1.xml";
  const sheetPath = `xl/${target.replace(/^\//, "")}`;
  const sheetXml = await zip.file(sheetPath)?.async("string");

  if (!sheetXml) {
    throw new Error("ไม่พบ worksheet แรกในไฟล์ Excel");
  }

  const sharedStrings = sharedStringsXml
    ? [...parseXml(sharedStringsXml).querySelectorAll("si")].map((item) =>
        [...item.querySelectorAll("t")].map((textNode) => textNode.textContent ?? "").join("\n"),
      )
    : [];
  const sheetDoc = parseXml(sheetXml);
  const cellMap = new Map<string, MatrixCell>();

  for (const cell of [...sheetDoc.querySelectorAll("sheetData c")]) {
    const address = cell.getAttribute("r") ?? "";
    const { row, col } = splitAddress(address);
    const type = cell.getAttribute("t");
    const valueNode = cell.querySelector("v");
    const inlineText = [...cell.querySelectorAll("is t")].map((node) => node.textContent ?? "").join("\n");
    let value = "";

    if (type === "s") {
      value = sharedStrings[Number(valueNode?.textContent ?? "")] ?? "";
    } else if (type === "inlineStr") {
      value = inlineText;
    } else {
      value = valueNode?.textContent ?? "";
    }

    cellMap.set(address, { address, row, col, value: normalizeText(value) });
  }

  let mergeCount = 0;
  for (const merge of [...sheetDoc.querySelectorAll("mergeCell")]) {
    const ref = merge.getAttribute("ref");
    if (!ref) {
      continue;
    }

    const [start, end] = ref.split(":");
    const startAddress = splitAddress(start);
    const endAddress = splitAddress(end);
    const source = cellMap.get(start);
    if (!source || !source.value) {
      continue;
    }

    mergeCount += 1;
    for (let row = startAddress.row; row <= endAddress.row; row += 1) {
      for (let col = startAddress.col; col <= endAddress.col; col += 1) {
        const address = cellName(row, col);
        if (!cellMap.has(address)) {
          cellMap.set(address, { address, row, col, value: source.value });
        }
      }
    }
  }

  const maxRow = Math.max(...[...cellMap.values()].map((cell) => cell.row), 0);
  const maxCol = Math.max(...[...cellMap.values()].map((cell) => cell.col), 0);
  const rows: MatrixCell[][] = [];

  for (let row = 1; row <= maxRow; row += 1) {
    const nextRow: MatrixCell[] = [];
    for (let col = 1; col <= maxCol; col += 1) {
      const address = cellName(row, col);
      nextRow.push(cellMap.get(address) ?? { address, row, col, value: "" });
    }
    rows.push(nextRow);
  }

  return { rows, mergeCount };
}

async function readCsv(file: File): Promise<string[][]> {
  const Papa = await import("papaparse");
  return new Promise<string[][]>((resolve, reject) => {
    Papa.default.parse<string[]>(file, {
      complete(result) {
        if (result.errors.length > 0) {
          reject(new Error(`อ่านไฟล์ CSV ไม่สำเร็จ: ${result.errors[0].message}`));
          return;
        }

        resolve(result.data.map((row) => row.map(toText)));
      },
      error(error) {
        reject(new Error(`อ่านไฟล์ CSV ไม่สำเร็จ: ${error.message}`));
      },
      skipEmptyLines: "greedy",
    });
  });
}

async function readFlatRows(file: File): Promise<string[][]> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("en-US");

  if (extension === "csv") {
    return readCsv(file);
  }

  if (extension === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    return ((await readSheet(file)) as unknown[][]).map((row) => row.map(toText));
  }

  throw new Error("รองรับเฉพาะไฟล์ .xlsx และ .csv");
}

function detectStatus(text: string): ScheduleStatus {
  const key = normalize(text);
  if (!key || key === normalize("ว่าง")) {
    return "empty";
  }
  if (key.includes(normalize("สอบกลางภาค"))) {
    return "midterm_exam";
  }
  if (key.includes(normalize("วันหยุดราชการ")) || key.includes(normalize("วันหยุด"))) {
    return "public_holiday";
  }
  if (key.includes(normalize("สอบปลายภาค"))) {
    return "final_exam";
  }
  if (key.includes("online") || key.includes(normalize("ออนไลน์"))) {
    return "online";
  }
  if (key.includes(normalize("เตรียม")) || key.includes(normalize("เตรียมงาน"))) {
    return "preparation";
  }
  if (key.includes(normalize("นำเสนอ")) || key.includes(normalize("ครูนำเสนอ"))) {
    return "teacher_presentation";
  }

  return "active";
}

function findBase(header: string, bases: LearningBase[]) {
  const normalizedHeader = normalize(header);
  return bases.find((base) => normalize(base.baseName) === normalizedHeader)
    ?? bases.find((base) => normalizedHeader.includes(normalize(base.baseName)) || normalize(base.baseName).includes(normalizedHeader))
    ?? bases.find((base) =>
      schoolBaseAliases.some((alias) => normalize(alias) === normalizedHeader && normalize(base.baseName) === normalize(alias)),
    );
}

function classroomLookup(classrooms: Classroom[]) {
  return new Map(classrooms.map((classroom) => [normalize(classroom.displayName), classroom] as const));
}

function classroomsByGrade(classrooms: Classroom[], grade: string) {
  return classrooms
    .filter((classroom) => classroom.active && normalize(classroom.displayName).startsWith(normalize(`ม.${grade}/`)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "th-TH", { numeric: true }));
}

function parseClassrooms(text: string, classrooms: Classroom[]): ParsedClassroom[] {
  const lookup = classroomLookup(classrooms);
  const results: ParsedClassroom[] = [];
  const seen = new Set<string>();
  const pattern = /ม\.\s*([1-6])(?:\s*\/\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?)?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [, grade, startRoom, endRoom] = match;
    const names: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!startRoom) {
      const gradeClassrooms = classroomsByGrade(classrooms, grade);
      if (gradeClassrooms.length === 0) {
        errors.push(`ไม่พบห้องเรียนระดับ ม.${grade}`);
      } else {
        warnings.push(`ขยายระดับชั้น ม.${grade} เป็น ${gradeClassrooms.length} ห้อง`);
        names.push(...gradeClassrooms.map((classroom) => classroom.displayName));
      }
    } else if (endRoom) {
      const start = Number(startRoom);
      const end = Number(endRoom);
      if (!Number.isInteger(start) || !Number.isInteger(end) || end < start || end - start > 20) {
        errors.push(`ช่วงห้องเรียน ม.${grade}/${startRoom}-${endRoom} ไม่ชัดเจน`);
      } else {
        for (let room = start; room <= end; room += 1) {
          names.push(`ม.${grade}/${room}`);
        }
      }
    } else {
      names.push(`ม.${grade}/${Number(startRoom)}`);
    }

    for (const name of names) {
      const key = normalize(name);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const classroom = lookup.get(key);
      if (!classroom) {
        results.push({
          classroomId: "",
          classroomName: name,
          warnings,
          errors: [...errors, `ไม่พบห้องเรียน ${name} ในระบบ`],
        });
      } else if (!classroom.active) {
        results.push({
          classroomId: classroom.classroomId,
          classroomName: classroom.displayName,
          warnings,
          errors: [...errors, `ห้องเรียน ${classroom.displayName} ถูกปิดใช้งาน`],
        });
      } else {
        results.push({
          classroomId: classroom.classroomId,
          classroomName: classroom.displayName,
          warnings,
          errors,
        });
      }
    }
  }

  return results;
}

function parseLocation(text: string) {
  const withoutClassrooms = text
    .replace(/ม\.\s*[1-6](?:\s*\/\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?)?/g, " ")
    .replace(/ว่าง|สอบกลางภาค|สอบปลายภาค|วันหยุดราชการ|วันหยุด|ออนไลน์|online/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutClassrooms;
}

function roomMappingWarning(text: string, classroomCount: number) {
  const roomNumbers = [...text.matchAll(/\b\d{4}(?:\s*[-–]\s*\d{4})?\b/g)].map((match) => match[0]);
  if (classroomCount > 1 && roomNumbers.length > 1 && classroomCount !== roomNumbers.length) {
    return "มีหลายห้องเรียนและหลายห้องสถานที่ ความสัมพันธ์ไม่ชัดเจน โปรดตรวจสอบ";
  }

  return "";
}

function makePreviewRow(
  row: Omit<RotationImportPreviewRow, "id" | "warning" | "blockingError"> & {
    warnings?: string[];
    errors?: string[];
  },
): RotationImportPreviewRow {
  return {
    ...row,
    id: `${row.sourceRow}-${row.sourceCell}-${row.week}-${row.learningBaseName}-${row.classroomName}-${Math.random().toString(36).slice(2)}`,
    warning: [...new Set(row.warnings ?? [])].filter(Boolean).join(" | "),
    blockingError: [...new Set(row.errors ?? [])].filter(Boolean).join(" | "),
  };
}

function validateRows(rows: RotationImportPreviewRow[], references: RotationImportReferenceData) {
  const existingAssignments = new Set(
    references.rotationPlans.map((rotation) => `${rotation.academicTermId}::${rotation.weekNumber}::${rotation.classroomId}`),
  );
  const seenAssignments = new Map<string, string>();

  return rows.map((row) => {
    const errors = row.blockingError ? row.blockingError.split(" | ") : [];
    const warnings = row.warning ? row.warning.split(" | ") : [];

    if (!row.academicTermId) {
      errors.push("ยังไม่ได้เลือกปีการศึกษาที่ active");
    }
    if (!row.week || !Number.isInteger(Number(row.week)) || Number(row.week) < 1) {
      errors.push("สัปดาห์ไม่ถูกต้อง");
    }
    if (row.date && !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      warnings.push("รูปแบบวันที่ไม่ใช่ YYYY-MM-DD");
    }
    if (!row.learningBaseId && row.scheduleStatus === "active") {
      errors.push("ไม่พบฐานการเรียนรู้ในระบบ");
    }
    if (!row.classroomId && row.scheduleStatus === "active") {
      errors.push("ไม่พบห้องเรียนในระบบ");
    }

    if (row.scheduleStatus === "active" && row.week && row.classroomId) {
      const key = `${row.academicTermId}::${row.week}::${row.classroomId}`;
      const duplicateBase = seenAssignments.get(key);
      if (duplicateBase) {
        errors.push(`ห้อง ${row.classroomName} ถูกจัดซ้ำในสัปดาห์นี้กับฐาน ${duplicateBase}`);
      } else {
        seenAssignments.set(key, row.learningBaseName);
      }

      if (existingAssignments.has(key)) {
        errors.push("มีแผนเวียนฐานของห้องนี้ใน Firestore แล้ว");
      }
    }

    return {
      ...row,
      warning: [...new Set(warnings)].filter(Boolean).join(" | "),
      blockingError: [...new Set(errors)].filter(Boolean).join(" | "),
    };
  });
}

function buildPreview(
  fileName: string,
  mode: RotationImportMode,
  rows: RotationImportPreviewRow[],
  fileWarnings: string[] = [],
  fileErrors: string[] = [],
): RotationImportPreview {
  const validAssignments = rows.filter((row) => row.scheduleStatus === "active" && !row.blockingError).length;

  return {
    fileName,
    mode,
    rows,
    totalRows: rows.length,
    validAssignments,
    warningRows: rows.filter((row) => row.warning).length,
    errorRows: rows.filter((row) => row.blockingError).length,
    skippedRows: rows.filter((row) => row.scheduleStatus !== "active").length,
    fileWarnings,
    fileErrors,
  };
}

export async function fetchRotationImportReferences(): Promise<RotationImportReferenceData> {
  const [termsSnap, classroomsSnap, basesSnap, rotationsSnap] = await Promise.all([
    getDocs(collection(db, "academicTerms")),
    getDocs(collection(db, "classrooms")),
    getDocs(collection(db, "bases")),
    getDocs(collection(db, "rotationPlans")),
  ]);
  const academicTerms = termsSnap.docs.map((termDoc) => termDoc.data() as AcademicTerm);

  return {
    academicTerms,
    activeTerm: academicTerms.find((term) => term.active),
    classrooms: classroomsSnap.docs.map((classroomDoc) => classroomDoc.data() as Classroom),
    bases: basesSnap.docs.map((baseDoc) => baseDoc.data() as LearningBase),
    rotationPlans: rotationsSnap.docs.map((rotationDoc) => rotationDoc.data() as RotationPlan),
  };
}

export async function parseRotationMatrixFile(
  file: File,
  references: RotationImportReferenceData,
): Promise<RotationImportPreview> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("ไฟล์มีขนาดเกิน 8 MB กรุณาแบ่งไฟล์แล้วนำเข้าใหม่");
  }
  if (!file.name.toLocaleLowerCase("en-US").endsWith(".xlsx")) {
    throw new Error("โหมด matrix รองรับเฉพาะไฟล์ .xlsx");
  }

  const sheet = await readXlsxMatrix(file);
  const fileWarnings = sheet.mergeCount > 0 ? [`อ่าน merged cells แล้ว ${sheet.mergeCount} จุด`] : [];
  const fileErrors: string[] = [];
  const headerIndex = sheet.rows.findIndex((row) => {
    const values = row.map((cell) => normalize(cell.value));
    return values.some((value) => value.includes(normalize("สัปดาห์")) || value === "week") &&
      values.some((value) => value.includes(normalize("วันที่")) || value === "date");
  });

  if (headerIndex < 0) {
    return buildPreview(file.name, "matrix", [], fileWarnings, ["ไม่พบแถวหัวตารางที่มีสัปดาห์และวันที่"]);
  }

  const headerRow = sheet.rows[headerIndex];
  const weekCol = headerRow.findIndex((cell) => normalize(cell.value).includes(normalize("สัปดาห์")) || normalize(cell.value) === "week");
  const dateCol = headerRow.findIndex((cell) => normalize(cell.value).includes(normalize("วันที่")) || normalize(cell.value) === "date");
  const baseColumns = headerRow
    .map((cell, index) => ({ cell, index, base: index > Math.max(weekCol, dateCol) ? findBase(cell.value, references.bases) : undefined }))
    .filter((item) => item.index > Math.max(weekCol, dateCol) && item.cell.value);

  if (baseColumns.length === 0) {
    fileErrors.push("ไม่พบคอลัมน์ฐานการเรียนรู้หลังคอลัมน์วันที่");
  }

  const rows: RotationImportPreviewRow[] = [];
  for (const row of sheet.rows.slice(headerIndex + 1)) {
    const week = parseWeek(row[weekCol]?.value ?? "");
    const date = parseDateValue(row[dateCol]?.value ?? "");
    const joined = row.map((cell) => cell.value).filter(Boolean).join("\n");
    const rowStatus = detectStatus(joined);

    if (!week && !joined) {
      continue;
    }

    for (const { cell: headerCell, index, base } of baseColumns) {
      const source = row[index];
      const sourceText = normalizeText(source?.value ?? "");
      const status = rowStatus !== "active" ? rowStatus : detectStatus(sourceText);
      const learningBaseName = base?.baseName ?? headerCell.value;
      const common = {
        academicTermId: references.activeTerm?.academicTermId ?? "",
        week,
        date,
        learningBaseId: base?.baseId ?? "",
        learningBaseName,
        location: parseLocation(sourceText),
        scheduleStatus: status,
        sourceCell: source?.address ?? headerCell.address,
        sourceRow: source?.row ?? row[0]?.row ?? 0,
      };

      if (status !== "active") {
        if (sourceText || rowStatus !== "active") {
          rows.push(
            makePreviewRow({
              ...common,
              classroomId: "",
              classroomName: "",
              sourceCell: source?.address ?? headerCell.address,
              warnings: status === "online" ? ["online week จะไม่ถูกนำเข้าเป็น assignment อัตโนมัติ"] : [],
              errors: [],
            }),
          );
        }
        continue;
      }

      if (!sourceText) {
        continue;
      }

      const classrooms = parseClassrooms(sourceText, references.classrooms);
      if (classrooms.length === 0) {
        rows.push(
          makePreviewRow({
            ...common,
            classroomId: "",
            classroomName: "",
            warnings: ["ไม่พบรูปแบบห้องเรียนใน cell โปรดตรวจสอบ"],
            errors: [],
          }),
        );
        continue;
      }

      const mappingWarning = roomMappingWarning(sourceText, classrooms.length);
      for (const classroom of classrooms) {
        rows.push(
          makePreviewRow({
            ...common,
            classroomId: classroom.classroomId,
            classroomName: classroom.classroomName,
            warnings: [...classroom.warnings, mappingWarning],
            errors: classroom.errors,
          }),
        );
      }
    }
  }

  return buildPreview(file.name, "matrix", validateRows(rows, references), fileWarnings, fileErrors);
}

export async function parseRotationFlatFile(
  file: File,
  references: RotationImportReferenceData,
): Promise<RotationImportPreview> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("ไฟล์มีขนาดเกิน 8 MB กรุณาแบ่งไฟล์แล้วนำเข้าใหม่");
  }

  const matrix = await readFlatRows(file);
  const headerIndex = matrix.findIndex((row) => row.some(Boolean));
  if (headerIndex < 0) {
    throw new Error("ไฟล์ไม่มีข้อมูล");
  }

  const headers = matrix[headerIndex].map(normalize);
  const columnIndex = new Map<string, number>();
  flatHeaders.forEach((header) => {
    const index = headers.findIndex((item) => item === normalize(header) || item.includes(normalize(header)));
    if (index >= 0) {
      columnIndex.set(header, index);
    }
  });

  const missing = ["week", "learningBaseName", "classroomName"].filter((header) => !columnIndex.has(header));
  const fileErrors = missing.length > 0 ? [`ไม่พบคอลัมน์ที่จำเป็น: ${missing.join(", ")}`] : [];
  const baseLookup = new Map(references.bases.map((base) => [normalize(base.baseName), base] as const));
  const classroomMap = classroomLookup(references.classrooms);

  const rows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some(Boolean))
    .map((row, index) => {
      const sourceRow = headerIndex + index + 2;
      const baseName = row[columnIndex.get("learningBaseName") ?? -1] ?? "";
      const classroomName = row[columnIndex.get("classroomName") ?? -1] ?? "";
      const status = (row[columnIndex.get("scheduleStatus") ?? -1] as ScheduleStatus) || detectStatus(classroomName);
      const base = baseLookup.get(normalize(baseName));
      const classroom = classroomMap.get(normalize(classroomName));

      return makePreviewRow({
        academicTermId: references.activeTerm?.academicTermId ?? "",
        week: parseWeek(row[columnIndex.get("week") ?? -1] ?? ""),
        date: parseDateValue(row[columnIndex.get("date") ?? -1] ?? ""),
        learningBaseId: base?.baseId ?? "",
        learningBaseName: base?.baseName ?? baseName,
        classroomId: classroom?.classroomId ?? "",
        classroomName: classroom?.displayName ?? classroomName,
        location: row[columnIndex.get("location") ?? -1] ?? "",
        scheduleStatus: status,
        sourceCell: `row ${sourceRow}`,
        sourceRow,
        warnings: [],
        errors: [
          !base && status === "active" ? `ไม่พบฐาน ${baseName}` : "",
          !classroom && status === "active" ? `ไม่พบห้องเรียน ${classroomName}` : "",
        ].filter(Boolean),
      });
    });

  return buildPreview(file.name, "flat", validateRows(rows, references), [], fileErrors);
}

export async function importRotationPreviewRows(
  rows: RotationImportPreviewRow[],
  references: RotationImportReferenceData,
  writeMode: RotationImportWriteMode,
  onProgress: (done: number, total: number) => void,
): Promise<RotationImportResult> {
  const validRows = rows.filter((row) => row.scheduleStatus === "active" && !row.blockingError);
  const weeks = [...new Set(validRows.map((row) => Number(row.week)).filter(Boolean))];
  const termId = references.activeTerm?.academicTermId ?? validRows[0]?.academicTermId;
  let deletedCount = 0;

  if (!termId) {
    throw new Error("ไม่พบปีการศึกษาที่ active");
  }

  const seenAssignments = new Set<string>();
  const existingAssignments = new Set(
    references.rotationPlans
      .filter((rotation) => writeMode !== "replace" || !weeks.includes(rotation.weekNumber))
      .map((rotation) => `${rotation.academicTermId}::${rotation.weekNumber}::${rotation.classroomId}`),
  );

  for (const row of validRows) {
    if (!row.week || !row.learningBaseId || !row.classroomId) {
      throw new Error(`ยังมีแถวที่ข้อมูลไม่ครบ โปรดตรวจสอบแถวต้นทาง ${row.sourceRow}`);
    }

    const key = `${row.academicTermId}::${row.week}::${row.classroomId}`;
    if (seenAssignments.has(key)) {
      throw new Error(`พบห้อง ${row.classroomName} ซ้ำในสัปดาห์ ${row.week} โปรดตรวจสอบก่อนนำเข้า`);
    }
    if (existingAssignments.has(key)) {
      throw new Error(`ห้อง ${row.classroomName} สัปดาห์ ${row.week} มีแผนเดิมอยู่แล้ว`);
    }
    seenAssignments.add(key);
  }

  if (writeMode === "replace") {
    const deleteTargets = references.rotationPlans.filter(
      (rotation) => rotation.academicTermId === termId && weeks.includes(rotation.weekNumber),
    );
    for (let offset = 0; offset < deleteTargets.length; offset += BATCH_SIZE) {
      const chunk = deleteTargets.slice(offset, offset + BATCH_SIZE);
      await Promise.all(chunk.map((rotation) => deleteDoc(doc(db, "rotationPlans", rotation.rotationId))));
      deletedCount += chunk.length;
    }
  }

  let importedCount = 0;
  for (let offset = 0; offset < validRows.length; offset += BATCH_SIZE) {
    const chunk = validRows.slice(offset, offset + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const row of chunk) {
      const base = references.bases.find((item) => item.baseId === row.learningBaseId);
      if (!base) {
        throw new Error(`ไม่พบฐานครูสำหรับ ${row.learningBaseName}`);
      }

      const rotationRef = doc(collection(db, "rotationPlans"));
      batch.set(rotationRef, {
        rotationId: rotationRef.id,
        academicTermId: row.academicTermId,
        weekNumber: Number(row.week),
        classroomId: row.classroomId,
        classroomName: row.classroomName,
        baseId: row.learningBaseId,
        baseName: row.learningBaseName,
        teacherUid: base.teacherUid,
        teacherName: base.teacherName,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    importedCount += chunk.length;
    onProgress(importedCount, validRows.length);
  }

  return { importedCount, deletedCount };
}

export function downloadRotationFlatCsvTemplate() {
  const content = [
    ["week", "date", "learningBaseName", "classroomName", "location", "scheduleStatus"],
    ["1", "2026-07-14", "ฐานเกษตร", "ม.1/1", "ห้อง 2206", "active"],
  ]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "rotation-plan-flat-template.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadRotationFlatExcelTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const workbook = writeXlsxFile(
    [
      ["week", "date", "learningBaseName", "classroomName", "location", "scheduleStatus"],
      ["1", "2026-07-14", "ฐานเกษตร", "ม.1/1", "ห้อง 2206", "active"],
    ],
    {
      sheet: "RotationPlans",
      columns: [{ width: 10 }, { width: 14 }, { width: 28 }, { width: 18 }, { width: 28 }, { width: 18 }],
    },
  );
  await workbook.toFile("rotation-plan-flat-template.xlsx");
}

export async function downloadRotationMatrixExcelTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const workbook = writeXlsxFile(
    [
      ["สัปดาห์", "วันที่", "ไฟเบอร์ ทรงพลัง", "อาณาจักรอักษร", "เงาในน้ำ"],
      ["1", "2026-07-14", "ม.1/1\nห้อง 2206", "ม.2/2-4\nห้องสมุด", "ว่าง"],
      ["2", "2026-07-21", "สอบกลางภาค", "สอบกลางภาค", "สอบกลางภาค"],
    ],
    {
      sheet: "Matrix",
      columns: [{ width: 12 }, { width: 16 }, { width: 28 }, { width: 28 }, { width: 28 }],
    },
  );
  await workbook.toFile("rotation-plan-matrix-template.xlsx");
}
