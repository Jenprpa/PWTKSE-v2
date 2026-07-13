import type { AcademicTerm, Classroom, LearningBase, RotationPlan } from "./rotation";

export type RotationImportMode = "matrix" | "flat";
export type RotationImportWriteMode = "append" | "replace";

export type ScheduleStatus =
  | "preparation"
  | "teacher_presentation"
  | "online"
  | "active"
  | "empty"
  | "midterm_exam"
  | "public_holiday"
  | "final_exam";

export type RotationImportReferenceData = {
  activeTerm?: AcademicTerm;
  academicTerms: AcademicTerm[];
  classrooms: Classroom[];
  bases: LearningBase[];
  rotationPlans: RotationPlan[];
};

export type RotationImportPreviewRow = {
  id: string;
  academicTermId: string;
  week: number | "";
  date: string;
  learningBaseId: string;
  learningBaseName: string;
  classroomId: string;
  classroomName: string;
  location: string;
  scheduleStatus: ScheduleStatus;
  sourceCell: string;
  sourceRow: number;
  warning: string;
  blockingError: string;
};

export type RotationImportPreview = {
  fileName: string;
  mode: RotationImportMode;
  rows: RotationImportPreviewRow[];
  totalRows: number;
  validAssignments: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  fileWarnings: string[];
  fileErrors: string[];
};

export type RotationImportResult = {
  importedCount: number;
  deletedCount: number;
};
