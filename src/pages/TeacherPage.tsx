import { useEffect, useMemo, useState } from "react";
import { RoleLayout } from "../components/RoleLayout";
import { useAuth } from "../providers/AuthProvider";
import {
  fetchActiveStudents,
  fetchTeacherAttendanceData,
  makeAttendanceEntries,
  saveAttendanceSession,
  type AttendanceEntry,
  type TeacherAttendanceData,
} from "../services/attendanceData";
import {
  FIXED_COURSE_DAY_TH,
  FIXED_COURSE_PERIOD,
  type AttendanceStatus,
  type RotationPlan,
  type Student,
} from "../types/rotation";

const statusOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "present", label: "มา" },
  { value: "absent", label: "ขาด" },
  { value: "leave", label: "ลา" },
  { value: "late", label: "สาย" },
];

export function TeacherPage() {
  const { authUser } = useAuth();
  const [data, setData] = useState<TeacherAttendanceData | null>(null);
  const [selectedRotationId, setSelectedRotationId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedRotation = useMemo(
    () => data?.rotations.find((rotation) => rotation.rotationId === selectedRotationId) ?? null,
    [data?.rotations, selectedRotationId],
  );

  async function loadTeacherData() {
    if (!authUser) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const nextData = await fetchTeacherAttendanceData(authUser.uid);
      setData(nextData);
      setSelectedRotationId(nextData.rotations[0]?.rotationId ?? "");
    } catch {
      setError("ไม่สามารถโหลดข้อมูลเช็กชื่อได้");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTeacherData();
  }, [authUser]);

  useEffect(() => {
    async function loadStudents(rotation: RotationPlan) {
      setIsLoadingStudents(true);
      setError("");
      setSuccess("");

      try {
        const nextStudents = await fetchActiveStudents(rotation.classroomId);
        setStudents(nextStudents);
        setEntries(makeAttendanceEntries(nextStudents));
      } catch {
        setError("ไม่สามารถโหลดรายชื่อนักเรียนได้");
      } finally {
        setIsLoadingStudents(false);
      }
    }

    if (selectedRotation) {
      void loadStudents(selectedRotation);
      return;
    }

    setStudents([]);
    setEntries([]);
  }, [selectedRotation]);

  function updateEntry(studentId: string, nextEntry: Partial<AttendanceEntry>) {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.studentId === studentId ? { ...entry, ...nextEntry } : entry,
      ),
    );
  }

  async function handleSave() {
    if (!data?.activeTerm || !selectedRotation || !data.weekNumber) {
      setError("ไม่พบแผนเวียนฐานสำหรับวันนี้");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveAttendanceSession({
        activeTerm: data.activeTerm,
        attendanceDate: data.attendanceDate,
        entries,
        rotation: selectedRotation,
        weekNumber: data.weekNumber,
      });
      setSuccess("บันทึกการเช็กชื่อสำเร็จ");
      await loadTeacherData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ไม่สามารถบันทึกการเช็กชื่อได้");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RoleLayout title="หน้าเช็กชื่อครู" tone="teacher">
      <section className="fixed-rule-panel" aria-label="กฎรายวิชาคงที่">
        <p className="section-label">เช็กชื่อนักเรียน</p>
        <p>
          วิชานี้เรียนเฉพาะ {FIXED_COURSE_DAY_TH} คาบที่ {FIXED_COURSE_PERIOD}
        </p>
      </section>

      {error ? (
        <div className="error-message admin-message" role="alert">
          {error}
        </div>
      ) : null}
      {success ? <div className="success-message admin-message">{success}</div> : null}

      {isLoading ? (
        <section className="placeholder-panel">
          <p>กำลังโหลดข้อมูล...</p>
        </section>
      ) : null}

      {!isLoading && data && !data.isCourseDay ? (
        <section className="placeholder-panel">
          <h2>วันนี้ไม่มีคาบเศรษฐกิจพอเพียง</h2>
          <p>ระบบเช็กชื่อเปิดสำหรับวันอังคาร คาบที่ 9 เท่านั้น</p>
        </section>
      ) : null}

      {!isLoading && data?.isCourseDay ? (
        <section className="admin-section">
          <div className="placeholder-panel">
            <p className="section-label">วันนี้มีคาบเศรษฐกิจพอเพียง</p>
            <div className="summary-grid">
              <SummaryItem label="วันที่" value={data.attendanceDate} />
              <SummaryItem label="สัปดาห์ที่" value={data.weekNumber ?? "-"} />
              <SummaryItem label="จำนวนแผนของฉัน" value={data.rotations.length} />
              <SummaryItem label="คาบเรียน" value={`คาบที่ ${FIXED_COURSE_PERIOD}`} />
            </div>
          </div>

          {!data.activeTerm ? (
            <div className="error-message">กรุณาตั้งค่าปีการศึกษาที่ใช้งานก่อน</div>
          ) : null}

          {data.activeTerm && data.rotations.length === 0 ? (
            <div className="error-message">ไม่พบแผนเวียนฐานสำหรับวันนี้</div>
          ) : null}

          {data.activeTerm && data.rotations.length > 0 ? (
            <form className="admin-form">
              <label>
                เลือกห้องเรียน
                <select
                  value={selectedRotationId}
                  onChange={(event) => setSelectedRotationId(event.target.value)}
                >
                  {data.rotations.map((rotation) => (
                    <option key={rotation.rotationId} value={rotation.rotationId}>
                      {rotation.classroomName} - {rotation.baseName}
                    </option>
                  ))}
                </select>
              </label>
            </form>
          ) : null}

          {selectedRotation ? (
            <section className="placeholder-panel">
              <p className="section-label">รายชื่อนักเรียน</p>
              <p>
                {selectedRotation.classroomName} / {selectedRotation.baseName}
              </p>

              {isLoadingStudents ? <p>กำลังโหลดรายชื่อนักเรียน...</p> : null}
              {!isLoadingStudents && students.length === 0 ? (
                <div className="error-message student-empty-message">ยังไม่มีรายชื่อนักเรียนในห้องนี้</div>
              ) : null}

              {!isLoadingStudents && students.length > 0 ? (
                <div className="attendance-list">
                  {entries.map((entry) => (
                    <article className="attendance-card" key={entry.studentId}>
                      <div>
                        <h2>
                          {entry.studentNumber}. {entry.studentName}
                        </h2>
                      </div>
                      <div className="status-options" role="group" aria-label={`สถานะ ${entry.studentName}`}>
                        {statusOptions.map((option) => (
                          <button
                            className={
                              entry.status === option.value
                                ? "status-option is-selected"
                                : "status-option"
                            }
                            key={option.value}
                            type="button"
                            onClick={() => updateEntry(entry.studentId, { status: option.value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <label>
                        หมายเหตุ
                        <input
                          value={entry.note}
                          onChange={(event) => updateEntry(entry.studentId, { note: event.target.value })}
                          placeholder="หมายเหตุ"
                        />
                      </label>
                    </article>
                  ))}
                </div>
              ) : null}

              <button
                className="primary-button save-attendance-button"
                type="button"
                disabled={isSaving || entries.length === 0}
                onClick={handleSave}
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึกการเช็กชื่อ"}
              </button>
            </section>
          ) : null}
        </section>
      ) : null}
    </RoleLayout>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
