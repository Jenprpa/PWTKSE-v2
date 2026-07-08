export const studentImportFields = [
  "studentId",
  "prefix",
  "firstName",
  "lastName",
  "classroom",
  "number",
] as const;

export type StudentImportField = (typeof studentImportFields)[number];

export type StudentImportValue = {
  studentId: string;
  prefix: string;
  firstName: string;
  lastName: string;
  classroom: string;
  number: string;
};

export type StudentImportRow = StudentImportValue & {
  rowNumber: number;
  classroomId: string;
  classroomName: string;
  fullName: string;
  errors: string[];
  warnings: string[];
};

export type StudentImportPreview = {
  fileName: string;
  rows: StudentImportRow[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
};
