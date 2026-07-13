import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RoleLayout } from "../components/RoleLayout";
import {
  buildReadinessModel,
  fetchReadinessSourceData,
  filterReadinessIssues,
  type ReadinessFilters,
  type ReadinessIssue,
  type ReadinessModel,
  type ReadinessSeverity,
} from "../services/readinessData";

const defaultFilters: ReadinessFilters = {
  academicTermId: "",
  weekNumber: "",
  classroomId: "",
  baseId: "",
  severity: "",
};

const severityLabels: Record<ReadinessSeverity, string> = {
  pass: "ผ่าน",
  warning: "คำเตือน",
  fail: "ไม่พร้อม",
};

const issueGroupLabels: Record<string, string> = {
  "rotation-plans": "Missing rotation plans by classroom/week",
  bases: "Bases without teachers",
  teachers: "Teacher scheduling conflicts",
  students: "Classrooms without students",
  integrity: "Invalid references / duplicate records",
  "academic-term": "Academic term",
  classrooms: "Classrooms",
  attendance: "Attendance readiness",
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatusPill({ status }: { status: ReadinessSeverity }) {
  return <span className={`readiness-pill is-${status}`}>{severityLabels[status]}</span>;
}

function OverallBanner({ model }: { model: ReadinessModel }) {
  return (
    <section className={`readiness-hero is-${model.overallStatus}`}>
      <div>
        <p className="eyebrow">Data Readiness</p>
        <h1>{model.overallLabel}</h1>
        <p>
          ตรวจความพร้อมข้อมูลล่าสุดเมื่อ {formatDateTime(model.lastCheckedAt)}
          {model.activeTerm ? ` • ${model.activeTerm.name}` : ""}
        </p>
      </div>
      <div className="readiness-score">
        <strong>{model.issues.length.toLocaleString("th-TH")}</strong>
        <span>issues</span>
      </div>
    </section>
  );
}

function ReadinessCardView({ card }: { card: ReadinessModel["cards"][number] }) {
  return (
    <article className={`readiness-card is-${card.status}`}>
      <div className="readiness-card-head">
        <h2>{card.title}</h2>
        <StatusPill status={card.status} />
      </div>
      <p className="readiness-count">{card.countLabel}</p>
      <p className="readiness-expected">{card.expected}</p>
      <p>{card.explanation}</p>
      <Link className="secondary-button compact-button readiness-action" to={card.actionPath}>
        {card.actionLabel}
      </Link>
    </article>
  );
}

function IssueTable({ title, issues }: { title: string; issues: ReadinessIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="readiness-issue-section">
      <div className="readiness-section-heading">
        <h2>{title}</h2>
        <p>{issues.length.toLocaleString("th-TH")} รายการ</p>
      </div>
      <div className="table-scroll">
        <table className="data-table readiness-table">
          <thead>
            <tr>
              <th>ระดับ</th>
              <th>เรื่อง</th>
              <th>รายละเอียด</th>
              <th>สัปดาห์</th>
              <th>ห้องเรียน</th>
              <th>ฐาน</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id}>
                <td>
                  <span className={`readiness-mini-pill is-${issue.severity}`}>
                    {issue.severity === "fail" ? "Fail" : "Warning"}
                  </span>
                </td>
                <td>{issue.title}</td>
                <td>{issue.detail}</td>
                <td>{issue.weekNumber ?? "-"}</td>
                <td>{issue.classroomName ?? "-"}</td>
                <td>{issue.baseName ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReadinessPage() {
  const [model, setModel] = useState<ReadinessModel | null>(null);
  const [filters, setFilters] = useState<ReadinessFilters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReadiness() {
    setIsLoading(true);
    setError("");

    try {
      const source = await fetchReadinessSourceData();
      setModel(buildReadinessModel(source));
    } catch {
      setError("ไม่สามารถตรวจความพร้อมข้อมูลได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReadiness();
  }, []);

  const filteredIssues = useMemo(() => {
    if (!model) {
      return [];
    }

    return filterReadinessIssues(model.issues, filters);
  }, [filters, model]);

  const groupedIssues = useMemo(() => {
    return filteredIssues.reduce<Record<string, ReadinessIssue[]>>((groups, issue) => {
      groups[issue.category] = [...(groups[issue.category] ?? []), issue];
      return groups;
    }, {});
  }, [filteredIssues]);

  return (
    <RoleLayout title="ตรวจความพร้อมข้อมูล" tone="admin">
      <div className="import-page-actions readiness-top-actions">
        <Link className="secondary-button compact-button import-back-link" to="/admin">
          กลับหน้าผู้ดูแลระบบ
        </Link>
        <button className="primary-button compact-button" disabled={isLoading} type="button" onClick={() => void loadReadiness()}>
          {isLoading ? "กำลังตรวจ..." : "ตรวจใหม่"}
        </button>
      </div>

      {error ? (
        <div className="error-message admin-message" role="alert">
          {error}
          <button className="secondary-button compact-button" type="button" onClick={() => void loadReadiness()}>
            ลองใหม่
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <section className="empty-state" aria-live="polite">
          <h2>กำลังตรวจความพร้อมข้อมูล</h2>
          <p>กำลังอ่านข้อมูลจาก Firestore และคำนวณสถานะ readiness</p>
        </section>
      ) : null}

      {!isLoading && model ? (
        <>
          <OverallBanner model={model} />

          <section className="readiness-kpi-strip" aria-label="readiness summary">
            <article><span>{model.counts.activeClassrooms}</span><p>ห้องเรียน</p></article>
            <article><span>{model.counts.activeStudents}</span><p>นักเรียน</p></article>
            <article><span>{model.counts.activeBases}</span><p>ฐาน</p></article>
            <article><span>{model.counts.activeTeachers}</span><p>ครู active</p></article>
            <article><span>{model.counts.activeRotationPlans}</span><p>แผนเวียนฐาน</p></article>
            <article><span>{model.counts.weeksWithPlans}</span><p>สัปดาห์</p></article>
          </section>

          <section className="readiness-card-grid">
            {model.cards.map((card) => (
              <ReadinessCardView card={card} key={card.id} />
            ))}
          </section>

          <section className="report-filters readiness-filters" aria-label="ตัวกรอง readiness issues">
            <div className="report-filter-grid">
              <label>
                ปีการศึกษา
                <select value={filters.academicTermId} onChange={(event) => setFilters({ ...filters, academicTermId: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {model.options.academicTerms.map((term) => (
                    <option key={term.academicTermId} value={term.academicTermId}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                สัปดาห์
                <select value={filters.weekNumber} onChange={(event) => setFilters({ ...filters, weekNumber: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {model.options.weeks.map((week) => (
                    <option key={week} value={week}>
                      สัปดาห์ {week}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ห้องเรียน
                <select value={filters.classroomId} onChange={(event) => setFilters({ ...filters, classroomId: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {model.options.classrooms.map((classroom) => (
                    <option key={classroom.classroomId} value={classroom.classroomId}>
                      {classroom.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ฐาน
                <select value={filters.baseId} onChange={(event) => setFilters({ ...filters, baseId: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {model.options.bases.map((base) => (
                    <option key={base.baseId} value={base.baseId}>
                      {base.baseName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ระดับปัญหา
                <select value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  <option value="fail">Blocking error</option>
                  <option value="warning">Warning</option>
                </select>
              </label>
            </div>
          </section>

          {filteredIssues.length === 0 ? (
            <section className="empty-state">
              <h2>ไม่พบ issue ตามตัวกรองนี้</h2>
              <p>ถ้า overall เป็น Ready แปลว่าข้อมูลหลักพร้อมใช้งานตามกติกาที่ตรวจได้</p>
            </section>
          ) : (
            Object.entries(groupedIssues).map(([category, issues]) => (
              <IssueTable issues={issues} key={category} title={issueGroupLabels[category] ?? category} />
            ))
          )}
        </>
      ) : null}
    </RoleLayout>
  );
}
