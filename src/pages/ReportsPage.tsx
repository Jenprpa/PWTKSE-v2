import { FormEvent, useEffect, useMemo, useState } from "react";
import { RoleLayout } from "../components/RoleLayout";
import { SchoolBrand } from "../components/SchoolBrand";
import {
  buildExcelWorkbook,
  buildReportModel,
  fetchReportSourceData,
  type ReportCategoryStat,
  type ReportFilters,
  type ReportModel,
  type ReportSourceData,
} from "../services/reportData";
import { type AttendanceStatus } from "../types/rotation";
import { Fragment } from "react";

const defaultFilters: ReportFilters = {
  search: "",
  academicTermId: "",
  classroomId: "",
  baseId: "",
  teacherUid: "",
  startDate: "",
  endDate: "",
};

const statusLabels: Record<AttendanceStatus, string> = {
  present: "มา",
  absent: "ขาด",
  leave: "ลา",
  late: "สาย",
};

type ChartPoint = {
  label: string;
  value: number;
  secondaryValue?: number;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createPalette(index: number) {
  const colors = ["#2b8075", "#4f8e53", "#799d46", "#2f6f8f", "#7e6a3d", "#8b5a4e"];
  return colors[index % colors.length];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getReadableCount(value: number) {
  return Intl.NumberFormat("th-TH").format(value);
}

function StatBarChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ChartPoint[];
}) {
  const width = 720;
  const height = 280;
  const padding = { top: 24, right: 20, bottom: 70, left: 32 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  const barWidth = items.length > 0 ? chartWidth / items.length : chartWidth;

  return (
    <article className="chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} className="chart-axis" />
          {items.map((item, index) => {
            const barHeight = (item.value / maxValue) * chartHeight;
            const x = padding.left + index * barWidth + barWidth * 0.15;
            const y = padding.top + chartHeight - barHeight;
            const w = barWidth * 0.7;

            return (
              <g key={item.label}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={barHeight}
                  rx="10"
                  fill={createPalette(index)}
                />
                <text x={x + w / 2} y={y - 8} textAnchor="middle" className="chart-value">
                  {getReadableCount(item.value)}
                </text>
                <text x={x + w / 2} y={padding.top + chartHeight + 22} textAnchor="middle" className="chart-label">
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
}

function StatLineChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: ChartPoint[];
}) {
  const width = 720;
  const height = 280;
  const padding = { top: 24, right: 20, bottom: 60, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  const stepX = items.length > 1 ? chartWidth / (items.length - 1) : chartWidth;
  const points = items
    .map((item, index) => {
      const x = padding.left + index * stepX;
      const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <article className="chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} className="chart-axis" />
          <polyline points={points} className="chart-line" />
          {items.map((item, index) => {
            const x = padding.left + index * stepX;
            const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
            return (
              <g key={item.label}>
                <circle cx={x} cy={y} r="5" fill={createPalette(index)} />
                <text x={x} y={padding.top + chartHeight + 22} textAnchor="middle" className="chart-label">
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
}

function StatusPieChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; count: number; percent: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const segments = items.map((item, index) => {
    const start = cursor;
    const size = total ? (item.count / total) * 100 : 0;
    cursor += size;
    return `${createPalette(index)} ${start}% ${cursor}%`;
  });

  return (
    <article className="chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="pie-wrap">
        <div
          className="pie-chart"
          style={{
            background: total > 0 ? `conic-gradient(${segments.join(", ")})` : "linear-gradient(180deg, #edf4ee 0%, #f7faf7 100%)",
          }}
          aria-label={title}
          role="img"
        >
          <div className="pie-center">
            <strong>{getReadableCount(total)}</strong>
            <span>รายการ</span>
          </div>
        </div>
        <div className="chart-legend">
          {items.map((item, index) => (
            <div className="legend-item" key={item.label}>
              <span className="legend-swatch" style={{ background: createPalette(index) }} />
              <div>
                <strong>{item.label}</strong>
                <p>
                  {getReadableCount(item.count)} รายการ - {formatPercent(item.percent)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function HeatmapGrid({
  title,
  subtitle,
  rows,
  weeks,
  cells,
}: {
  title: string;
  subtitle: string;
  rows: string[];
  weeks: number[];
  cells: ReportModel["heatmap"];
}) {
  function getIntensity(rate: number) {
    return clamp(rate / 100, 0.12, 1);
  }

  return (
    <article className="chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-grid" style={{ gridTemplateColumns: `160px repeat(${weeks.length}, minmax(72px, 1fr))` }}>
          <div className="heatmap-head heatmap-sticky">ห้องเรียน</div>
          {weeks.map((weekNumber) => (
            <div className="heatmap-head" key={weekNumber}>
              W{weekNumber}
            </div>
          ))}

          {rows.map((row) => {
            return (
              <Fragment key={row}>
                <div className="heatmap-sticky heatmap-row-label">
                  {row}
                </div>
                {weeks.map((weekNumber) => {
                  const cell = cells.find((item) => item.classroomName === row && item.weekNumber === weekNumber);
                  const rate = cell?.presentRate ?? 0;
                  return (
                    <div
                      className="heatmap-cell"
                      key={`${row}-${weekNumber}`}
                      style={{ opacity: getIntensity(rate) }}
                      title={`${row} / W${weekNumber} - ${formatPercent(rate)}`}
                    >
                      <strong>{formatPercent(rate)}</strong>
                      <span>{cell?.sessionCount ? `${cell.sessionCount} คาบ` : "-"}</span>
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function StatTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: ReportCategoryStat[];
}) {
  return (
    <article className="table-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <h2>ยังไม่มีข้อมูล</h2>
          <p>เลือกตัวกรองอื่นเพื่อดูผลลัพธ์</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table report-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>คาบ</th>
                <th>บันทึก</th>
                <th>อัตรามา</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{row.sessionCount}</td>
                  <td>{row.recordCount}</td>
                  <td>{formatPercent(row.presentRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function ReportsPage() {
  const [source, setSource] = useState<ReportSourceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const nextSource = await fetchReportSourceData();
        setSource(nextSource);
        setSelectedStudentId((current) => current || nextSource.students.find((student) => student.active)?.studentId || "");
      } catch {
        setError("ไม่สามารถโหลดข้อมูลรายงานได้");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const model = useMemo(
    () => (source ? buildReportModel(source, filters, selectedStudentId) : null),
    [filters, selectedStudentId, source],
  );

  function updateFilters(next: Partial<ReportFilters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handlePdfExport() {
    window.print();
  }

  async function handleExcelExport() {
    if (!model) {
      return;
    }

    setIsExporting(true);
    try {
      const workbook = buildExcelWorkbook(model);
      downloadBlob(
        new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }),
        `PWTKSE-v2-reports-${new Date().toISOString().slice(0, 10)}.xls`,
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <RoleLayout title="รายงานและสถิติ" tone="admin">
      <section className="report-banner">
        <SchoolBrand />
        <div className="report-banner-copy">
          <p className="eyebrow">Decision Support</p>
          <h1>รายงานและสถิติ</h1>
          <p className="intro">
            รวมภาพรวมการเช็กชื่อ รายวัน รายสัปดาห์ รายห้อง รายฐาน และรายครู สำหรับการตัดสินใจของผู้ดูแลระบบ
          </p>
        </div>
      </section>

      <form className="report-toolbar no-print" onSubmit={handleSubmit}>
        <div className="action-row report-actions">
          <button className="primary-button compact-button" type="button" onClick={handlePdfExport} disabled={!model || isLoading}>
            พิมพ์ / PDF
          </button>
          <button className="secondary-button compact-button" type="button" onClick={() => void handleExcelExport()} disabled={!model || isLoading || isExporting}>
            {isExporting ? "กำลังส่งออก..." : "Excel"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="error-message" role="alert">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <section className="status-card report-loading" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>กำลังโหลดรายงาน...</p>
        </section>
      ) : null}

      {!isLoading && model ? (
        <>
          <section className="report-filters no-print" aria-label="ตัวกรองรายงาน">
            <label>
              ค้นหา
              <input
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value })}
                placeholder="ค้นหาห้องเรียน ฐาน ครู หรือวันที่"
              />
            </label>
            <div className="report-filter-grid">
              <label>
                ปีการศึกษา
                <select value={filters.academicTermId} onChange={(event) => updateFilters({ academicTermId: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {source?.academicTerms.map((term) => (
                    <option key={term.academicTermId} value={term.academicTermId}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ห้องเรียน
                <select value={filters.classroomId} onChange={(event) => updateFilters({ classroomId: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {source?.classrooms.map((classroom) => (
                    <option key={classroom.classroomId} value={classroom.classroomId}>
                      {classroom.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ฐาน
                <select value={filters.baseId} onChange={(event) => updateFilters({ baseId: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {source?.bases.map((base) => (
                    <option key={base.baseId} value={base.baseId}>
                      {base.baseName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ครู
                <select value={filters.teacherUid} onChange={(event) => updateFilters({ teacherUid: event.target.value })}>
                  <option value="">ทั้งหมด</option>
                  {source?.bases
                    .filter((base, index, array) => array.findIndex((item) => item.teacherUid === base.teacherUid) === index)
                    .map((base) => (
                      <option key={base.teacherUid} value={base.teacherUid}>
                        {base.teacherName}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                วันที่เริ่ม
                <input type="date" value={filters.startDate} onChange={(event) => updateFilters({ startDate: event.target.value })} />
              </label>
              <label>
                วันที่สิ้นสุด
                <input type="date" value={filters.endDate} onChange={(event) => updateFilters({ endDate: event.target.value })} />
              </label>
            </div>
            <label>
              นักเรียน
              <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                <option value="">เลือกนักเรียน</option>
                {model.activeStudents.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {student.classroomName} - {student.studentNumber}. {student.fullName}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="kpi-grid report-kpi-grid" aria-label="ภาพรวมรายงาน">
            {model.kpis.map((item) => (
              <article className="kpi-card" key={item.label}>
                <p className="kpi-label">{item.label}</p>
                <p className="kpi-value">{item.value}</p>
                <p className="kpi-detail">{item.detail}</p>
              </article>
            ))}
          </section>

          <section className="report-chart-grid">
            <StatusPieChart title="สัดส่วนสถานะ" subtitle="ภาพรวมมา ขาด ลา และสาย" items={model.statusBreakdown} />
            <StatLineChart
              title="แนวโน้มรายวัน"
              subtitle={`ช่วงข้อมูล: ${model.dateRangeLabel}`}
              items={model.dailyStats.map((item) => ({ label: item.date.slice(5), value: item.presentRate }))}
            />
            <StatLineChart
              title="แนวโน้มรายสัปดาห์"
              subtitle="อัตรามาเรียนเฉลี่ยต่อสัปดาห์"
              items={model.weeklyStats.map((item) => ({ label: `W${item.weekNumber}`, value: item.presentRate }))}
            />
            <StatBarChart
              title="ครูที่ใช้งาน"
              subtitle="จำนวนคาบตามครูผู้สอน"
              items={model.teacherStats.slice(0, 6).map((item) => ({ label: item.label, value: item.sessionCount }))}
            />
          </section>

          <section className="report-chart-grid">
            <StatBarChart
              title="ห้องเรียน"
              subtitle="ปริมาณคาบที่บันทึกตามห้อง"
              items={model.classroomStats.slice(0, 6).map((item) => ({ label: item.label, value: item.sessionCount }))}
            />
            <StatBarChart
              title="ฐานการเรียนรู้"
              subtitle="ปริมาณคาบที่บันทึกตามฐาน"
              items={model.baseStats.slice(0, 6).map((item) => ({ label: item.label, value: item.sessionCount }))}
            />
            <StatTable title="ผลวิเคราะห์รายห้อง" subtitle="เรียงตามอัตรามาเรียน" rows={model.classroomStats} />
            <StatTable title="ผลวิเคราะห์รายฐาน" subtitle="เรียงตามอัตรามาเรียน" rows={model.baseStats} />
          </section>

          <HeatmapGrid
            title="Attendance Heatmap"
            subtitle="อัตรามาเรียนตามห้องและสัปดาห์"
            rows={model.classroomStats.map((item) => item.label)}
            weeks={Array.from(new Set(model.weeklyStats.map((item) => item.weekNumber)))}
            cells={model.heatmap}
          />

          <section className="report-table-grid">
            <StatTable title="รายงานรายวัน" subtitle="สรุปตามวันที่เช็กชื่อ" rows={model.dailyStats} />
            <StatTable title="รายงานรายสัปดาห์" subtitle="สรุปตามสัปดาห์" rows={model.weeklyStats} />
            <article className="table-card">
              <div className="chart-head">
                <div>
                  <h2>ประวัตินักเรียน</h2>
                  <p>{model.selectedStudent ? `${model.selectedStudent.classroomName} - ${model.selectedStudent.studentNumber}. ${model.selectedStudent.fullName}` : "เลือกนักเรียนเพื่อดูประวัติ"}</p>
                </div>
              </div>
              {model.studentHistory.length === 0 ? (
                <div className="empty-state">
                  <h2>ยังไม่มีประวัติ</h2>
                  <p>ระบบจะแสดงรายการเมื่อมีการเช็กชื่อในห้องนี้</p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table report-table">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>สัปดาห์</th>
                        <th>ห้อง</th>
                        <th>ฐาน</th>
                        <th>ครู</th>
                        <th>สถานะ</th>
                        <th>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.studentHistory.map((row) => (
                        <tr key={row.recordId}>
                          <td>{row.attendanceDate}</td>
                          <td>{row.weekNumber}</td>
                          <td>{row.classroomName}</td>
                          <td>{row.baseName}</td>
                          <td>{row.teacherName}</td>
                          <td>{statusLabels[row.status]}</td>
                          <td>{row.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}
    </RoleLayout>
  );
}
