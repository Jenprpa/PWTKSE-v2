import { useEffect, useMemo, useState } from "react";
import { RoleLayout } from "../components/RoleLayout";
import {
  deactivateRecord,
  fetchAdminData,
  saveStudent,
  saveAcademicTerm,
  saveClassroom,
  saveLearningBase,
  saveRotationPlan,
  timestampToDateInput,
} from "../services/adminData";
import {
  FIXED_COURSE_DAY_TH,
  FIXED_COURSE_PERIOD,
  type AcademicTerm,
  type AcademicTermForm,
  type AdminData,
  type Classroom,
  type ClassroomForm,
  type LearningBase,
  type LearningBaseForm,
  type RotationPlan,
  type RotationPlanForm,
  type Student,
  type StudentForm,
} from "../types/rotation";
import { timestampToDisplayDate } from "../services/attendanceData";

type AdminTab = "terms" | "classrooms" | "students" | "bases" | "rotations" | "attendance";

const emptyData: AdminData = {
  academicTerms: [],
  classrooms: [],
  bases: [],
  rotationPlans: [],
  students: [],
  attendanceSessions: [],
};

const emptyTermForm: AcademicTermForm = {
  academicYear: "",
  semester: "",
  name: "",
  active: true,
  startDate: "",
  endDate: "",
};

const emptyClassroomForm: ClassroomForm = {
  displayName: "",
  level: "",
  roomNumber: "",
  active: true,
};

const emptyBaseForm: LearningBaseForm = {
  baseName: "",
  description: "",
  teacherUid: "",
  teacherName: "",
  active: true,
};

const emptyRotationForm: RotationPlanForm = {
  academicTermId: "",
  weekNumber: "",
  classroomId: "",
  baseId: "",
  active: true,
};

const emptyStudentForm: StudentForm = {
  classroomId: "",
  studentNumber: "",
  fullName: "",
  active: true,
};

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "terms", label: "ปีการศึกษา" },
  { id: "classrooms", label: "ห้องเรียน" },
  { id: "students", label: "นักเรียน" },
  { id: "bases", label: "ฐานการเรียนรู้" },
  { id: "rotations", label: "แผนเวียนฐาน" },
  { id: "attendance", label: "การเช็กชื่อ" },
];

function StatusBadge({ active }: { active: boolean }) {
  return <span className={`status-badge ${active ? "is-active" : "is-inactive"}`}>{active ? "ใช้งาน" : "ปิดใช้งาน"}</span>;
}

function CardActions({
  onEdit,
  onDeactivate,
  disabled,
}: {
  onEdit: () => void;
  onDeactivate: () => void;
  disabled: boolean;
}) {
  return (
    <div className="card-actions">
      <button className="secondary-button compact-button" type="button" onClick={onEdit}>
        แก้ไข
      </button>
      <button className="danger-button compact-button" type="button" onClick={onDeactivate} disabled={disabled}>
        ปิดใช้งาน
      </button>
    </div>
  );
}

function formatTermName(term?: AcademicTerm) {
  if (!term) {
    return "ยังไม่ได้ตั้งค่าปีการศึกษาปัจจุบัน";
  }

  return `${term.name} ปีการศึกษา ${term.academicYear} ภาคเรียนที่ ${term.semester}`;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("terms");
  const [data, setData] = useState<AdminData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingTermId, setEditingTermId] = useState<string | undefined>();
  const [editingClassroomId, setEditingClassroomId] = useState<string | undefined>();
  const [editingStudentId, setEditingStudentId] = useState<string | undefined>();
  const [editingBaseId, setEditingBaseId] = useState<string | undefined>();
  const [editingRotationId, setEditingRotationId] = useState<string | undefined>();
  const [termForm, setTermForm] = useState<AcademicTermForm>(emptyTermForm);
  const [classroomForm, setClassroomForm] = useState<ClassroomForm>(emptyClassroomForm);
  const [studentForm, setStudentForm] = useState<StudentForm>(emptyStudentForm);
  const [baseForm, setBaseForm] = useState<LearningBaseForm>(emptyBaseForm);
  const [rotationForm, setRotationForm] = useState<RotationPlanForm>(emptyRotationForm);

  const sortedTerms = useMemo(
    () =>
      [...data.academicTerms].sort((a, b) =>
        `${b.academicYear}-${b.semester}`.localeCompare(`${a.academicYear}-${a.semester}`),
      ),
    [data.academicTerms],
  );

  const sortedClassrooms = useMemo(
    () =>
      [...data.classrooms].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "th-TH", { numeric: true }),
      ),
    [data.classrooms],
  );

  const sortedBases = useMemo(
    () => [...data.bases].sort((a, b) => a.baseName.localeCompare(b.baseName, "th-TH")),
    [data.bases],
  );

  const sortedStudents = useMemo(
    () =>
      [...data.students].sort(
        (a, b) =>
          a.classroomName.localeCompare(b.classroomName, "th-TH", { numeric: true }) ||
          Number(a.studentNumber) - Number(b.studentNumber),
      ),
    [data.students],
  );

  const sortedRotations = useMemo(
    () =>
      [...data.rotationPlans].sort(
        (a, b) =>
          a.weekNumber - b.weekNumber ||
          a.classroomName.localeCompare(b.classroomName, "th-TH", { numeric: true }),
      ),
    [data.rotationPlans],
  );

  const sortedAttendanceSessions = useMemo(
    () =>
      [...data.attendanceSessions].sort(
        (a, b) =>
          b.attendanceDate.localeCompare(a.attendanceDate) ||
          a.classroomName.localeCompare(b.classroomName, "th-TH", { numeric: true }),
      ),
    [data.attendanceSessions],
  );

  async function loadData() {
    setIsLoading(true);
    setError("");

    try {
      const nextData = await fetchAdminData();
      setData(nextData);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลการตั้งค่าได้");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(successMessage);
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  }

  function resetForms() {
    setEditingTermId(undefined);
    setEditingClassroomId(undefined);
    setEditingStudentId(undefined);
    setEditingBaseId(undefined);
    setEditingRotationId(undefined);
    setTermForm(emptyTermForm);
    setClassroomForm(emptyClassroomForm);
    setStudentForm(emptyStudentForm);
    setBaseForm(emptyBaseForm);
    setRotationForm(emptyRotationForm);
  }

  function editTerm(term: AcademicTerm) {
    setActiveTab("terms");
    setEditingTermId(term.academicTermId);
    setTermForm({
      academicYear: term.academicYear,
      semester: term.semester,
      name: term.name,
      active: term.active,
      startDate: timestampToDateInput(term.startDate),
      endDate: timestampToDateInput(term.endDate),
    });
  }

  function editClassroom(classroom: Classroom) {
    setActiveTab("classrooms");
    setEditingClassroomId(classroom.classroomId);
    setClassroomForm({
      displayName: classroom.displayName,
      level: classroom.level,
      roomNumber: classroom.roomNumber,
      active: classroom.active,
    });
  }

  function editStudent(student: Student) {
    setActiveTab("students");
    setEditingStudentId(student.studentId);
    setStudentForm({
      classroomId: student.classroomId,
      studentNumber: student.studentNumber,
      fullName: student.fullName,
      active: student.active,
    });
  }

  function editBase(base: LearningBase) {
    setActiveTab("bases");
    setEditingBaseId(base.baseId);
    setBaseForm({
      baseName: base.baseName,
      description: base.description,
      teacherUid: base.teacherUid,
      teacherName: base.teacherName,
      active: base.active,
    });
  }

  function editRotation(rotation: RotationPlan) {
    setActiveTab("rotations");
    setEditingRotationId(rotation.rotationId);
    setRotationForm({
      academicTermId: rotation.academicTermId,
      weekNumber: String(rotation.weekNumber),
      classroomId: rotation.classroomId,
      baseId: rotation.baseId,
      active: rotation.active,
    });
  }

  async function deactivate(collectionName: string, recordId: string) {
    if (!window.confirm("ยืนยันการปิดใช้งานรายการนี้")) {
      return;
    }

    await runAction(() => deactivateRecord(collectionName, recordId), "ปิดใช้งานรายการเรียบร้อยแล้ว");
  }

  return (
    <RoleLayout title="หน้าผู้ดูแลระบบ" tone="admin">
      <section className="fixed-rule-panel" aria-label="กฎรายวิชาคงที่">
        <p className="section-label">กฎรายวิชาคงที่</p>
        <p>
          วิชานี้เรียนเฉพาะ {FIXED_COURSE_DAY_TH} คาบที่ {FIXED_COURSE_PERIOD}
        </p>
      </section>

      <nav className="admin-tabs" aria-label="เมนูตั้งค่าผู้ดูแล">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "tab-button is-selected" : "tab-button"}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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

      {!isLoading && activeTab === "terms" ? (
        <section className="admin-section">
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () => saveAcademicTerm(termForm, data.academicTerms, editingTermId),
                "บันทึกปีการศึกษาเรียบร้อยแล้ว",
              );
            }}
          >
            <FormTitle title={editingTermId ? "แก้ไขปีการศึกษา" : "เพิ่มปีการศึกษา"} onReset={resetForms} />
            <label>
              ปีการศึกษา
              <input
                value={termForm.academicYear}
                onChange={(event) => setTermForm({ ...termForm, academicYear: event.target.value })}
                placeholder="2567"
              />
            </label>
            <label>
              ภาคเรียน
              <input
                value={termForm.semester}
                onChange={(event) => setTermForm({ ...termForm, semester: event.target.value })}
                placeholder="1"
              />
            </label>
            <label>
              ชื่อ
              <input
                value={termForm.name}
                onChange={(event) => setTermForm({ ...termForm, name: event.target.value })}
                placeholder="ภาคเรียนที่ 1/2567"
              />
            </label>
            <div className="form-grid">
              <label>
                วันเริ่มต้น
                <input
                  type="date"
                  value={termForm.startDate}
                  onChange={(event) => setTermForm({ ...termForm, startDate: event.target.value })}
                />
              </label>
              <label>
                วันสิ้นสุด
                <input
                  type="date"
                  value={termForm.endDate}
                  onChange={(event) => setTermForm({ ...termForm, endDate: event.target.value })}
                />
              </label>
            </div>
            <ToggleLabel checked={termForm.active} onChange={(active) => setTermForm({ ...termForm, active })} />
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึกปีการศึกษา"}
            </button>
          </form>

          <div className="records-list">
            {sortedTerms.map((term) => (
              <article className="record-card" key={term.academicTermId}>
                <div>
                  <StatusBadge active={term.active} />
                  <h2>{term.name}</h2>
                  <p>ปีการศึกษา {term.academicYear} ภาคเรียนที่ {term.semester}</p>
                  <p>
                    {timestampToDateInput(term.startDate)} ถึง {timestampToDateInput(term.endDate)}
                  </p>
                </div>
                <CardActions
                  onEdit={() => editTerm(term)}
                  onDeactivate={() => void deactivate("academicTerms", term.academicTermId)}
                  disabled={!term.active || isSaving}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "classrooms" ? (
        <section className="admin-section">
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () => saveClassroom(classroomForm, data.classrooms, editingClassroomId),
                "บันทึกห้องเรียนเรียบร้อยแล้ว",
              );
            }}
          >
            <FormTitle title={editingClassroomId ? "แก้ไขห้องเรียน" : "เพิ่มห้องเรียน"} onReset={resetForms} />
            <label>
              ชื่อห้องเรียน
              <input
                value={classroomForm.displayName}
                onChange={(event) => setClassroomForm({ ...classroomForm, displayName: event.target.value })}
                placeholder="ม.1/1"
              />
            </label>
            <div className="form-grid">
              <label>
                ระดับชั้น
                <input
                  value={classroomForm.level}
                  onChange={(event) => setClassroomForm({ ...classroomForm, level: event.target.value })}
                  placeholder="ม.1"
                />
              </label>
              <label>
                เลขห้อง
                <input
                  value={classroomForm.roomNumber}
                  onChange={(event) => setClassroomForm({ ...classroomForm, roomNumber: event.target.value })}
                  placeholder="1"
                />
              </label>
            </div>
            <ToggleLabel checked={classroomForm.active} onChange={(active) => setClassroomForm({ ...classroomForm, active })} />
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึกห้องเรียน"}
            </button>
          </form>

          <div className="records-list">
            {sortedClassrooms.map((classroom) => (
              <article className="record-card" key={classroom.classroomId}>
                <div>
                  <StatusBadge active={classroom.active} />
                  <h2>{classroom.displayName}</h2>
                  <p>ระดับชั้น {classroom.level}</p>
                  <p>ห้อง {classroom.roomNumber}</p>
                </div>
                <CardActions
                  onEdit={() => editClassroom(classroom)}
                  onDeactivate={() => void deactivate("classrooms", classroom.classroomId)}
                  disabled={!classroom.active || isSaving}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "students" ? (
        <section className="admin-section">
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () => saveStudent(studentForm, data, editingStudentId),
                "บันทึกรายชื่อนักเรียนเรียบร้อยแล้ว",
              );
            }}
          >
            <FormTitle title={editingStudentId ? "แก้ไขนักเรียน" : "เพิ่มนักเรียน"} onReset={resetForms} />
            <label>
              ห้องเรียน
              <select
                value={studentForm.classroomId}
                onChange={(event) => setStudentForm({ ...studentForm, classroomId: event.target.value })}
              >
                <option value="">เลือกห้องเรียน</option>
                {sortedClassrooms
                  .filter((classroom) => classroom.active || classroom.classroomId === studentForm.classroomId)
                  .map((classroom) => (
                    <option key={classroom.classroomId} value={classroom.classroomId}>
                      {classroom.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                เลขที่
                <input
                  value={studentForm.studentNumber}
                  onChange={(event) => setStudentForm({ ...studentForm, studentNumber: event.target.value })}
                  placeholder="1"
                />
              </label>
              <label>
                ชื่อ-สกุลนักเรียน
                <input
                  value={studentForm.fullName}
                  onChange={(event) => setStudentForm({ ...studentForm, fullName: event.target.value })}
                  placeholder="ชื่อ นักเรียน"
                />
              </label>
            </div>
            <ToggleLabel checked={studentForm.active} onChange={(active) => setStudentForm({ ...studentForm, active })} />
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึกรายชื่อนักเรียน"}
            </button>
          </form>

          <div className="records-list">
            {sortedStudents.map((student) => (
              <article className="record-card" key={student.studentId}>
                <div>
                  <StatusBadge active={student.active} />
                  <h2>
                    {student.studentNumber}. {student.fullName}
                  </h2>
                  <p>ห้องเรียน: {student.classroomName}</p>
                </div>
                <CardActions
                  onEdit={() => editStudent(student)}
                  onDeactivate={() => void deactivate("students", student.studentId)}
                  disabled={!student.active || isSaving}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "bases" ? (
        <section className="admin-section">
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () => saveLearningBase(baseForm, data.bases, editingBaseId),
                "บันทึกฐานการเรียนรู้เรียบร้อยแล้ว",
              );
            }}
          >
            <FormTitle title={editingBaseId ? "แก้ไขฐานการเรียนรู้" : "เพิ่มฐานการเรียนรู้"} onReset={resetForms} />
            <label>
              ชื่อฐาน
              <input
                value={baseForm.baseName}
                onChange={(event) => setBaseForm({ ...baseForm, baseName: event.target.value })}
                placeholder="ฐานเกษตร"
              />
            </label>
            <label>
              รายละเอียด
              <textarea
                value={baseForm.description}
                onChange={(event) => setBaseForm({ ...baseForm, description: event.target.value })}
                placeholder="รายละเอียดสั้น ๆ ของฐาน"
              />
            </label>
            <div className="form-grid">
              <label>
                Teacher UID
                <input
                  value={baseForm.teacherUid}
                  onChange={(event) => setBaseForm({ ...baseForm, teacherUid: event.target.value })}
                  placeholder="UID จาก Firebase Auth"
                />
              </label>
              <label>
                ชื่อครูประจำฐาน
                <input
                  value={baseForm.teacherName}
                  onChange={(event) => setBaseForm({ ...baseForm, teacherName: event.target.value })}
                  placeholder="ชื่อครู"
                />
              </label>
            </div>
            <ToggleLabel checked={baseForm.active} onChange={(active) => setBaseForm({ ...baseForm, active })} />
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึกฐาน"}
            </button>
          </form>

          <div className="records-list">
            {sortedBases.map((base) => (
              <article className="record-card" key={base.baseId}>
                <div>
                  <StatusBadge active={base.active} />
                  <h2>{base.baseName}</h2>
                  <p>{base.description || "ไม่มีรายละเอียด"}</p>
                  <p>ครูประจำฐาน: {base.teacherName}</p>
                </div>
                <CardActions
                  onEdit={() => editBase(base)}
                  onDeactivate={() => void deactivate("bases", base.baseId)}
                  disabled={!base.active || isSaving}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "rotations" ? (
        <section className="admin-section">
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () => saveRotationPlan(rotationForm, data, editingRotationId),
                "บันทึกแผนเวียนฐานเรียบร้อยแล้ว",
              );
            }}
          >
            <FormTitle title={editingRotationId ? "แก้ไขแผนเวียนฐาน" : "เพิ่มแผนเวียนฐาน"} onReset={resetForms} />
            <label>
              ปีการศึกษา
              <select
                value={rotationForm.academicTermId}
                onChange={(event) => setRotationForm({ ...rotationForm, academicTermId: event.target.value })}
              >
                <option value="">เลือกปีการศึกษา</option>
                {sortedTerms
                  .filter((term) => term.active || term.academicTermId === rotationForm.academicTermId)
                  .map((term) => (
                    <option key={term.academicTermId} value={term.academicTermId}>
                      {formatTermName(term)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              สัปดาห์ที่
              <input
                min="1"
                type="number"
                value={rotationForm.weekNumber}
                onChange={(event) => setRotationForm({ ...rotationForm, weekNumber: event.target.value })}
                placeholder="1"
              />
            </label>
            <label>
              ห้องเรียน
              <select
                value={rotationForm.classroomId}
                onChange={(event) => setRotationForm({ ...rotationForm, classroomId: event.target.value })}
              >
                <option value="">เลือกห้องเรียน</option>
                {sortedClassrooms
                  .filter((classroom) => classroom.active || classroom.classroomId === rotationForm.classroomId)
                  .map((classroom) => (
                    <option key={classroom.classroomId} value={classroom.classroomId}>
                      {classroom.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              ฐานการเรียนรู้
              <select
                value={rotationForm.baseId}
                onChange={(event) => setRotationForm({ ...rotationForm, baseId: event.target.value })}
              >
                <option value="">เลือกฐาน</option>
                {sortedBases
                  .filter((base) => base.active || base.baseId === rotationForm.baseId)
                  .map((base) => (
                    <option key={base.baseId} value={base.baseId}>
                      {base.baseName} - {base.teacherName}
                    </option>
                  ))}
              </select>
            </label>
            <ToggleLabel checked={rotationForm.active} onChange={(active) => setRotationForm({ ...rotationForm, active })} />
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึกแผนเวียนฐาน"}
            </button>
          </form>

          <div className="records-list">
            {sortedRotations.map((rotation) => (
              <article className="record-card" key={rotation.rotationId}>
                <div>
                  <StatusBadge active={rotation.active} />
                  <h2>
                    สัปดาห์ที่ {rotation.weekNumber} - {rotation.classroomName}
                  </h2>
                  <p>ฐาน: {rotation.baseName}</p>
                  <p>ครู: {rotation.teacherName}</p>
                  <p>{formatTermName(data.academicTerms.find((term) => term.academicTermId === rotation.academicTermId))}</p>
                </div>
                <CardActions
                  onEdit={() => editRotation(rotation)}
                  onDeactivate={() => void deactivate("rotationPlans", rotation.rotationId)}
                  disabled={!rotation.active || isSaving}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "attendance" ? (
        <section className="placeholder-panel">
          <p className="section-label">รายการเช็กชื่อที่บันทึกแล้ว</p>
          {sortedAttendanceSessions.length === 0 ? (
            <p>ยังไม่มีรายการเช็กชื่อ</p>
          ) : (
            <div className="records-list">
              {sortedAttendanceSessions.map((session) => (
                <article className="record-card" key={session.sessionId}>
                  <div>
                    <StatusBadge active={session.status === "submitted"} />
                    <h2>
                      {session.classroomName} - {session.baseName}
                    </h2>
                    <p>วันที่: {session.attendanceDate}</p>
                    <p>สัปดาห์ที่: {session.weekNumber}</p>
                    <p>ครู: {session.teacherName}</p>
                    <p>ส่งเมื่อ: {timestampToDisplayDate(session.submittedAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </RoleLayout>
  );
}
function FormTitle({ title, onReset }: { title: string; onReset: () => void }) {
  return (
    <div className="form-title">
      <h2>{title}</h2>
      <button className="text-button" type="button" onClick={onReset}>
        ล้างฟอร์ม
      </button>
    </div>
  );
}

function ToggleLabel({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-label">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      เปิดใช้งาน
    </label>
  );
}
