import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseDb";
import { fetchAdminData } from "./adminData";
import type {
  AcademicTerm,
  AdminData,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Classroom,
  LearningBase,
  Student,
} from "../types/rotation";

export type ReportSourceData = AdminData & {
  attendanceRecords: AttendanceRecord[];
};

export type ReportFilters = {
  search: string;
  academicTermId: string;
  classroomId: string;
  baseId: string;
  teacherUid: string;
  startDate: string;
  endDate: string;
};

export type ReportCategoryStat = {
  key: string;
  label: string;
  sessionCount: number;
  recordCount: number;
  studentCount: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  presentRate: number;
};

export type ReportDayStat = ReportCategoryStat & {
  date: string;
  dayLabel: string;
};

export type ReportWeekStat = ReportCategoryStat & {
  weekNumber: number;
};

export type ReportHeatmapCell = {
  classroomId: string;
  classroomName: string;
  weekNumber: number;
  sessionCount: number;
  presentRate: number;
};

export type StudentHistoryRow = {
  recordId: string;
  sessionId: string;
  attendanceDate: string;
  weekNumber: number;
  classroomName: string;
  baseName: string;
  teacherName: string;
  status: AttendanceStatus;
  note: string;
};

export type ReportModel = {
  activeTerm: AcademicTerm | null;
  filters: ReportFilters;
  search: string;
  activeStudents: Student[];
  selectedStudent: Student | null;
  filteredSessions: AttendanceSession[];
  filteredRecords: AttendanceRecord[];
  kpis: Array<{ label: string; value: string; detail: string }>;
  statusBreakdown: Array<{ key: AttendanceStatus; label: string; count: number; percent: number }>;
  dailyStats: ReportDayStat[];
  weeklyStats: ReportWeekStat[];
  classroomStats: ReportCategoryStat[];
  baseStats: ReportCategoryStat[];
  teacherStats: ReportCategoryStat[];
  heatmap: ReportHeatmapCell[];
  studentHistory: StudentHistoryRow[];
  dateRangeLabel: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

function toDateLabel(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toWeekLabel(weekNumber: number) {
  return `สัปดาห์ที่ ${weekNumber}`;
}

function percent(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const current = map.get(key);
    if (current) {
      current.push(item);
    } else {
      map.set(key, [item]);
    }
  }

  return map;
}

function buildCategoryStat(
  key: string,
  label: string,
  sessions: AttendanceSession[],
  recordsBySessionId: Map<string, AttendanceRecord[]>,
): ReportCategoryStat {
  let sessionCount = 0;
  let recordCount = 0;
  let present = 0;
  let absent = 0;
  let leave = 0;
  let late = 0;
  const studentIds = new Set<string>();

  for (const session of sessions) {
    sessionCount += 1;
    const sessionRecords = recordsBySessionId.get(session.sessionId) ?? [];
    recordCount += sessionRecords.length;

    for (const record of sessionRecords) {
      studentIds.add(record.studentId);
      if (record.status === "present") {
        present += 1;
      } else if (record.status === "absent") {
        absent += 1;
      } else if (record.status === "leave") {
        leave += 1;
      } else if (record.status === "late") {
        late += 1;
      }
    }
  }

  return {
    key,
    label,
    sessionCount,
    recordCount,
    studentCount: studentIds.size,
    present,
    absent,
    leave,
    late,
    presentRate: percent(present, recordCount),
  };
}

function sortStats(stats: ReportCategoryStat[]) {
  return [...stats].sort(
    (a, b) => b.presentRate - a.presentRate || b.recordCount - a.recordCount || a.label.localeCompare(b.label, "th-TH"),
  );
}

export async function fetchReportSourceData(): Promise<ReportSourceData> {
  const [adminData, attendanceRecordsSnap] = await Promise.all([
    fetchAdminData(),
    getDocs(collection(db, "attendanceRecords")),
  ]);

  return {
    ...adminData,
    attendanceRecords: attendanceRecordsSnap.docs.map((recordDoc) => recordDoc.data() as AttendanceRecord),
  };
}

export function buildReportModel(
  source: ReportSourceData,
  filters: ReportFilters,
  selectedStudentId: string,
): ReportModel {
  const activeTerm = source.academicTerms.find((term) => term.active) ?? null;
  const search = normalize(filters.search);
  const activeStudents = [...source.students]
    .filter((student) => student.active)
    .sort((a, b) => {
      const classroomOrder = a.classroomName.localeCompare(b.classroomName, "th-TH", { numeric: true });
      return classroomOrder || Number(a.studentNumber) - Number(b.studentNumber) || a.fullName.localeCompare(b.fullName, "th-TH");
    });

  const submittedSessions = source.attendanceSessions.filter((session) => session.status === "submitted");
  const allRecordsBySessionId = groupBy(source.attendanceRecords, (record) => record.sessionId);
  const sessionLookup = new Map(submittedSessions.map((session) => [session.sessionId, session] as const));

  const filteredSessions = submittedSessions.filter((session) => {
    if (filters.academicTermId && session.academicTermId !== filters.academicTermId) {
      return false;
    }

    if (filters.classroomId && session.classroomId !== filters.classroomId) {
      return false;
    }

    if (filters.baseId && session.baseId !== filters.baseId) {
      return false;
    }

    if (filters.teacherUid && session.teacherUid !== filters.teacherUid) {
      return false;
    }

    if (filters.startDate && session.attendanceDate < filters.startDate) {
      return false;
    }

    if (filters.endDate && session.attendanceDate > filters.endDate) {
      return false;
    }

    if (search) {
      const sessionRecords = allRecordsBySessionId.get(session.sessionId) ?? [];
      const text = [
        session.attendanceDate,
        session.classroomName,
        session.baseName,
        session.teacherName,
        String(session.weekNumber),
        session.academicTermId,
        ...sessionRecords.flatMap((record) => [record.studentName, record.studentNumber, record.note]),
      ]
        .join(" ")
        .toLocaleLowerCase("th-TH");

      if (!text.includes(search)) {
        return false;
      }
    }

    return true;
  });

  const filteredSessionIds = new Set(filteredSessions.map((session) => session.sessionId));
  const filteredRecords = source.attendanceRecords.filter((record) => filteredSessionIds.has(record.sessionId));
  const recordsBySessionId = groupBy(filteredRecords, (record) => record.sessionId);

  const totalRecords = filteredRecords.length;
  const presentCount = filteredRecords.filter((record) => record.status === "present").length;
  const absentCount = filteredRecords.filter((record) => record.status === "absent").length;
  const leaveCount = filteredRecords.filter((record) => record.status === "leave").length;
  const lateCount = filteredRecords.filter((record) => record.status === "late").length;
  const studentIds = new Set(filteredRecords.map((record) => record.studentId));
  const teacherIds = new Set(filteredSessions.map((session) => session.teacherUid));
  const classroomIds = new Set(filteredSessions.map((session) => session.classroomId));
  const baseIds = new Set(filteredSessions.map((session) => session.baseId));
  const overallPresentRate = percent(presentCount, totalRecords);
  const averageSessionRate = filteredSessions.length
    ? filteredSessions.reduce((sum, session) => {
        const records = recordsBySessionId.get(session.sessionId) ?? [];
        return sum + percent(records.filter((record) => record.status === "present").length, records.length);
      }, 0) / filteredSessions.length
    : 0;

  const dailyGroups = groupBy(filteredSessions, (session) => session.attendanceDate);
  const dailyStats = [...dailyGroups.entries()]
    .map(([date, sessions]) => {
      const stat = buildCategoryStat(date, toDateLabel(date), sessions, recordsBySessionId);
      return {
        ...stat,
        date,
        dayLabel: toDateLabel(date),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyGroups = groupBy(filteredSessions, (session) => String(session.weekNumber));
  const weeklyStats = [...weeklyGroups.entries()]
    .map(([weekNumber, sessions]) => ({
      ...buildCategoryStat(weekNumber, toWeekLabel(Number(weekNumber)), sessions, recordsBySessionId),
      weekNumber: Number(weekNumber),
    }))
    .sort((a, b) => a.weekNumber - b.weekNumber);

  const classroomLookup = new Map(source.classrooms.map((classroom) => [classroom.classroomId, classroom] as const));
  const baseLookup = new Map(source.bases.map((base) => [base.baseId, base] as const));

  const classroomGroups = groupBy(filteredSessions, (session) => session.classroomId);
  const classroomStats = sortStats(
    [...classroomGroups.entries()].map(([classroomId, sessions]) => {
      const classroom = classroomLookup.get(classroomId);
      return buildCategoryStat(classroomId, classroom?.displayName ?? sessions[0]?.classroomName ?? classroomId, sessions, recordsBySessionId);
    }),
  );

  const baseGroups = groupBy(filteredSessions, (session) => session.baseId);
  const baseStats = sortStats(
    [...baseGroups.entries()].map(([baseId, sessions]) => {
      const base = baseLookup.get(baseId);
      return buildCategoryStat(baseId, base?.baseName ?? sessions[0]?.baseName ?? baseId, sessions, recordsBySessionId);
    }),
  );

  const teacherGroups = groupBy(filteredSessions, (session) => session.teacherUid);
  const teacherStats = sortStats(
    [...teacherGroups.entries()].map(([teacherUid, sessions]) =>
      buildCategoryStat(teacherUid, sessions[0]?.teacherName ?? teacherUid, sessions, recordsBySessionId),
    ),
  );

  const statusBreakdown = [
    { key: "present" as const, label: "มา", count: presentCount, percent: percent(presentCount, totalRecords) },
    { key: "absent" as const, label: "ขาด", count: absentCount, percent: percent(absentCount, totalRecords) },
    { key: "leave" as const, label: "ลา", count: leaveCount, percent: percent(leaveCount, totalRecords) },
    { key: "late" as const, label: "สาย", count: lateCount, percent: percent(lateCount, totalRecords) },
  ];

  const heatmapClassrooms = [...classroomGroups.entries()]
    .map(([classroomId, sessions]) => {
      const classroom = classroomLookup.get(classroomId);
      return {
        classroomId,
        classroomName: classroom?.displayName ?? sessions[0]?.classroomName ?? classroomId,
        sessions,
      };
    })
    .sort((a, b) => a.classroomName.localeCompare(b.classroomName, "th-TH", { numeric: true }));

  const heatmapWeeks = [...weeklyGroups.keys()].map(Number).sort((a, b) => a - b);
  const heatmap = heatmapClassrooms.flatMap((classroom) =>
    heatmapWeeks.map((weekNumber) => {
      const sessions = classroom.sessions.filter((session) => session.weekNumber === weekNumber);
      const records = sessions.flatMap((session) => recordsBySessionId.get(session.sessionId) ?? []);
      const rate = percent(records.filter((record) => record.status === "present").length, records.length);

      return {
        classroomId: classroom.classroomId,
        classroomName: classroom.classroomName,
        weekNumber,
        sessionCount: sessions.length,
        presentRate: rate,
      };
    }),
  );

  const selectedStudent = activeStudents.find((student) => student.studentId === selectedStudentId) ?? activeStudents[0] ?? null;
  const studentHistory = selectedStudent
    ? filteredRecords
        .filter((record) => record.studentId === selectedStudent.studentId)
        .map((record) => {
          const session = sessionLookup.get(record.sessionId);

          return {
            recordId: record.recordId,
            sessionId: record.sessionId,
            attendanceDate: session?.attendanceDate ?? "-",
            weekNumber: session?.weekNumber ?? 0,
            classroomName: session?.classroomName ?? "-",
            baseName: session?.baseName ?? "-",
            teacherName: session?.teacherName ?? "-",
            status: record.status,
            note: record.note,
          };
        })
        .sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate) || b.weekNumber - a.weekNumber)
    : [];

  return {
    activeTerm,
    filters,
    search,
    activeStudents,
    selectedStudent,
    filteredSessions,
    filteredRecords,
    kpis: [
      {
        label: "จำนวนรายการเช็กชื่อ",
        value: String(filteredSessions.length),
        detail: "เฉพาะรายการที่ส่งแล้ว",
      },
      {
        label: "จำนวนบันทึกนักเรียน",
        value: String(totalRecords),
        detail: `${studentIds.size} คน`,
      },
      {
        label: "อัตรามาเรียน",
        value: formatPercent(overallPresentRate),
        detail: `ค่าเฉลี่ยต่อคาบ ${formatPercent(averageSessionRate)}`,
      },
      {
        label: "ครูที่เกี่ยวข้อง",
        value: String(teacherIds.size),
        detail: `${classroomIds.size} ห้อง / ${baseIds.size} ฐาน`,
      },
    ],
    statusBreakdown,
    dailyStats,
    weeklyStats,
    classroomStats,
    baseStats,
    teacherStats,
    heatmap,
    studentHistory,
    dateRangeLabel:
      filters.startDate || filters.endDate
        ? `${filters.startDate ? toDateLabel(filters.startDate) : "เริ่มต้น"} - ${filters.endDate ? toDateLabel(filters.endDate) : "สิ้นสุด"}`
        : "ทั้งหมด",
  };
}

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildWorksheet(name: string, rows: Array<Array<string | number>>) {
  const rowXml = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const type = typeof cell === "number" ? "Number" : "String";
            return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`,
    )
    .join("");

  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rowXml}</Table></Worksheet>`;
}

export function buildExcelWorkbook(model: ReportModel) {
  const summaryRows = [
    ["School", "PWTKSE v2"],
    ["Active term", model.activeTerm?.name ?? "-"],
    ["Date range", model.dateRangeLabel],
    ["Search", model.search || "-"],
    ["Metric", "Value"],
    ...model.kpis.map((item) => [item.label, item.value]),
  ];

  const statusRows = [
    ["Status", "Count", "Percent"],
    ...model.statusBreakdown.map((item) => [item.label, item.count, formatPercent(item.percent)]),
  ];

  const dayRows = [
    ["Date", "Label", "Sessions", "Records", "Present rate"],
    ...model.dailyStats.map((item) => [item.date, item.dayLabel, item.sessionCount, item.recordCount, formatPercent(item.presentRate)]),
  ];

  const weekRows = [
    ["Week", "Sessions", "Records", "Present rate"],
    ...model.weeklyStats.map((item) => [item.weekNumber, item.sessionCount, item.recordCount, formatPercent(item.presentRate)]),
  ];

  const classroomRows = [
    ["Classroom", "Sessions", "Records", "Present rate"],
    ...model.classroomStats.map((item) => [item.label, item.sessionCount, item.recordCount, formatPercent(item.presentRate)]),
  ];

  const baseRows = [
    ["Base", "Sessions", "Records", "Present rate"],
    ...model.baseStats.map((item) => [item.label, item.sessionCount, item.recordCount, formatPercent(item.presentRate)]),
  ];

  const teacherRows = [
    ["Teacher", "Sessions", "Records", "Present rate"],
    ...model.teacherStats.map((item) => [item.label, item.sessionCount, item.recordCount, formatPercent(item.presentRate)]),
  ];

  const studentRows = [
    ["Date", "Week", "Classroom", "Base", "Teacher", "Status", "Note"],
    ...model.studentHistory.map((item) => [
      item.attendanceDate,
      item.weekNumber,
      item.classroomName,
      item.baseName,
      item.teacherName,
      item.status,
      item.note,
    ]),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    buildWorksheet("Summary", summaryRows),
    buildWorksheet("Status", statusRows),
    buildWorksheet("Day", dayRows),
    buildWorksheet("Week", weekRows),
    buildWorksheet("Classroom", classroomRows),
    buildWorksheet("Base", baseRows),
    buildWorksheet("Teacher", teacherRows),
    buildWorksheet("Student", studentRows),
    "</Workbook>",
  ].join("");
}
