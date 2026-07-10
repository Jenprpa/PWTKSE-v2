export const teacherImportFields = ["displayName", "email", "password", "role", "active"] as const;

export type TeacherImportField = (typeof teacherImportFields)[number];

export type TeacherImportValue = Record<TeacherImportField, string>;

export type TeacherImportRow = TeacherImportValue & {
  rowNumber: number;
  normalizedEmail: string;
  activeValue: boolean;
  errors: string[];
  warnings: string[];
};

export type TeacherImportPreview = {
  fileName: string;
  rows: TeacherImportRow[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
};

export type TeacherImportResult = {
  importedCount: number;
  failedCount: number;
  failures: Array<{
    rowNumber: number;
    email: string;
    message: string;
  }>;
};
