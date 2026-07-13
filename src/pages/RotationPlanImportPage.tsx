import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { RoleLayout } from "../components/RoleLayout";
import {
  downloadRotationFlatCsvTemplate,
  downloadRotationFlatExcelTemplate,
  downloadRotationMatrixExcelTemplate,
  fetchRotationImportReferences,
  importRotationPreviewRows,
  parseRotationFlatFile,
  parseRotationMatrixFile,
} from "../services/rotationPlanImport";
import type { RotationImportMode, RotationImportPreview, RotationImportPreviewRow, RotationImportReferenceData, RotationImportWriteMode, ScheduleStatus } from "../types/rotationPlanImport";

const previewLimit = 300;
const statusOptions: Array<{ value: ScheduleStatus; label: string }> = [
  { value: "active", label: "ใช้งาน" },
  { value: "empty", label: "ว่าง" },
  { value: "preparation", label: "เตรียมการ" },
  { value: "teacher_presentation", label: "ครูนำเสนอ" },
  { value: "online", label: "ออนไลน์" },
  { value: "midterm_exam", label: "สอบกลางภาค" },
  { value: "public_holiday", label: "วันหยุดราชการ" },
  { value: "final_exam", label: "สอบปลายภาค" },
];

export function RotationPlanImportPage() {
  const [references, setReferences] = useState<RotationImportReferenceData | null>(null);
  const [mode, setMode] = useState<RotationImportMode>("matrix");
  const [writeMode, setWriteMode] = useState<RotationImportWriteMode>("append");
  const [preview, setPreview] = useState<RotationImportPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  async function loadReferences() {
    setIsLoading(true);
    setError("");
    try {
      setReferences(await fetchRotationImportReferences());
    } catch {
      setError("ไม่สามารถโหลดข้อมูลปีการศึกษา ห้องเรียน ฐาน และแผนเวียนฐานได้");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReferences();
  }, []);

  const previewRows = useMemo(() => {
    if (!preview) {
      return [];
    }

    return [...preview.rows]
      .sort(
        (a, b) =>
          Number(Boolean(b.blockingError)) - Number(Boolean(a.blockingError)) ||
          Number(Boolean(b.warning)) - Number(Boolean(a.warning)) ||
          Number(a.week || 0) - Number(b.week || 0) ||
          a.learningBaseName.localeCompare(b.learningBaseName, "th-TH") ||
          a.classroomName.localeCompare(b.classroomName, "th-TH", { numeric: true }),
      )
      .slice(0, previewLimit);
  }, [preview]);

  const hasBlockingErrors = Boolean(preview && (preview.fileErrors.length > 0 || preview.errorRows > 0 || preview.validAssignments === 0));
  const replaceWeeks = useMemo(() => {
    if (!preview) {
      return [];
    }

    return [...new Set(preview.rows.map((row) => row.week).filter(Boolean).map(Number))].sort((a, b) => a - b);
  }, [preview]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !references) {
      return;
    }

    setIsParsing(true);
    setError("");
    setSuccess("");
    setPreview(null);
    setProgress({ done: 0, total: 0 });

    try {
      const nextPreview =
        mode === "matrix"
          ? await parseRotationMatrixFile(file, references)
          : await parseRotationFlatFile(file, references);
      setPreview(nextPreview);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "อ่านไฟล์ไม่สำเร็จ");
      setFileInputKey((current) => current + 1);
    } finally {
      setIsParsing(false);
    }
  }

  function updateRow(rowId: string, patch: Partial<RotationImportPreviewRow>) {
    if (!preview) {
      return;
    }

    setPreview({
      ...preview,
      rows: preview.rows.map((row) => (row.id === rowId ? { ...row, ...patch, blockingError: "" } : row)),
    });
  }

  async function handleTemplate(download: () => Promise<void> | void) {
    setIsDownloadingTemplate(true);
    setError("");
    try {
      await download();
    } catch {
      setError("ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ");
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function handleImport() {
    if (!preview || !references || hasBlockingErrors || isImporting) {
      return;
    }

    if (writeMode === "replace") {
      const confirmed = window.confirm(
        `โหมดแทนที่จะแผนเดิมของปีการศึกษาปัจจุบันในสัปดาห์ ${replaceWeeks.join(", ")} ก่อนนำเข้าใหม่\nยืนยันดำเนินการต่อหรือไม่`,
      );
      if (!confirmed) {
        return;
      }
    }

    setIsImporting(true);
    setError("");
    setSuccess("");
    setProgress({ done: 0, total: preview.validAssignments });

    try {
      const result = await importRotationPreviewRows(preview.rows, references, writeMode, (done, total) => {
        setProgress({ done, total });
      });
      setSuccess(
        writeMode === "replace"
          ? `นำเข้าแผนเวียนฐานสำเร็จ ${result.importedCount} รายการ และลบแผนเดิม ${result.deletedCount} รายการ`
          : `นำเข้าแผนเวียนฐานสำเร็จ ${result.importedCount} รายการ`,
      );
      setPreview(null);
      setFileInputKey((current) => current + 1);
      await loadReferences();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "นำเข้าแผนเวียนฐานไม่สำเร็จ");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <RoleLayout title="นำเข้าแผนเวียนฐาน" tone="admin">
      <div className="import-page-actions">
        <Link className="secondary-button compact-button import-back-link" to="/admin">
          กลับหน้าผู้ดูแลระบบ
        </Link>
      </div>

      <section className="import-intro-card">
        <p className="eyebrow">Rotation Plan Matrix Import Wizard</p>
        <h1>นำเข้าแผนเวียนฐานจาก Excel</h1>
        <p>รองรับตาราง matrix ของโรงเรียนและไฟล์ normalized flat โดยตรวจสอบก่อนเขียนลง Firestore ทุกครั้ง</p>
        <div className="import-template-actions">
          <button className="secondary-button compact-button" disabled={isDownloadingTemplate} type="button" onClick={() => void handleTemplate(downloadRotationMatrixExcelTemplate)}>
            ตัวอย่าง Matrix Excel
          </button>
          <button className="secondary-button compact-button" disabled={isDownloadingTemplate} type="button" onClick={() => void handleTemplate(downloadRotationFlatExcelTemplate)}>
            ตัวอย่าง Flat Excel
          </button>
          <button className="secondary-button compact-button" disabled={isDownloadingTemplate} type="button" onClick={() => void handleTemplate(downloadRotationFlatCsvTemplate)}>
            ตัวอย่าง Flat CSV
          </button>
        </div>
      </section>

      {error ? <div className="error-message admin-message" role="alert">{error}</div> : null}
      {success ? <div className="success-message admin-message" role="status">{success}</div> : null}

      {isLoading ? (
        <section className="empty-state" aria-live="polite">
          <h2>กำลังเตรียมข้อมูล</h2>
          <p>กำลังโหลดปีการศึกษา ห้องเรียน ฐาน และแผนเวียนฐานเดิม</p>
        </section>
      ) : null}

      {!isLoading && references ? (
        <>
          <section className="import-note-card">
            <h2>ปีการศึกษาที่ใช้</h2>
            <p>{references.activeTerm ? references.activeTerm.name : "ยังไม่มีปีการศึกษาที่ active กรุณาตั้งค่าก่อนนำเข้า"}</p>
          </section>

          <section className="import-upload-card rotation-import-controls">
            <div>
              <p className="section-label">ขั้นที่ 1 เลือกรูปแบบ</p>
              <h2>เลือกไฟล์แผนเวียนฐาน</h2>
              <p>Matrix รองรับเฉพาะ .xlsx ส่วน Flat รองรับ .xlsx และ .csv</p>
            </div>
            <div className="form-grid">
              <label>
                รูปแบบไฟล์
                <select value={mode} onChange={(event) => setMode(event.target.value as RotationImportMode)}>
                  <option value="matrix">Original matrix spreadsheet</option>
                  <option value="flat">Normalized flat spreadsheet</option>
                </select>
              </label>
              <label>
                วิธีนำเข้า
                <select value={writeMode} onChange={(event) => setWriteMode(event.target.value as RotationImportWriteMode)}>
                  <option value="append">เพิ่มรายการใหม่</option>
                  <option value="replace">แทนที่สัปดาห์ที่เลือก</option>
                </select>
              </label>
            </div>
            <label className="file-picker">
              <span>{isParsing ? "กำลังอ่านไฟล์..." : "เลือกไฟล์แผนเวียนฐาน"}</span>
              <input
                accept={mode === "matrix" ? ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
                disabled={isParsing || isImporting || !references.activeTerm}
                key={fileInputKey}
                onChange={(event) => void handleFileChange(event)}
                type="file"
              />
            </label>
          </section>

          {preview ? (
            <>
              <section className="import-summary" aria-label="สรุปไฟล์นำเข้า">
                <article className="kpi-card"><p className="kpi-label">ทั้งหมด</p><p className="kpi-value">{preview.totalRows}</p></article>
                <article className="kpi-card import-valid-card"><p className="kpi-label">พร้อมนำเข้า</p><p className="kpi-value">{preview.validAssignments}</p></article>
                <article className="kpi-card import-warning-card"><p className="kpi-label">คำเตือน</p><p className="kpi-value">{preview.warningRows + preview.fileWarnings.length}</p></article>
                <article className="kpi-card import-error-card"><p className="kpi-label">ข้อผิดพลาด</p><p className="kpi-value">{preview.errorRows + preview.fileErrors.length}</p></article>
              </section>

              {preview.fileErrors.length || preview.fileWarnings.length ? (
                <section className="import-file-messages">
                  {preview.fileErrors.map((message) => <p className="import-message is-error" key={message}>{message}</p>)}
                  {preview.fileWarnings.map((message) => <p className="import-message is-warning" key={message}>{message}</p>)}
                </section>
              ) : null}

              <section className="import-preview-card">
                <div className="import-preview-heading">
                  <div>
                    <p className="section-label">ขั้นที่ 2 ตรวจสอบและแก้ไข</p>
                    <h2>{preview.fileName}</h2>
                  </div>
                  <p>แสดงสูงสุด {previewLimit} แถว โดยเรียงแถวที่ต้องตรวจสอบก่อน</p>
                </div>
                <div className="table-scroll">
                  <table className="data-table import-preview-table rotation-import-table">
                    <thead>
                      <tr>
                        <th>สัปดาห์</th>
                        <th>วันที่</th>
                        <th>ฐาน</th>
                        <th>ห้องเรียน</th>
                        <th>สถานที่</th>
                        <th>สถานะ</th>
                        <th>ต้นทาง</th>
                        <th>ผลตรวจ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr className={row.blockingError ? "import-row-error" : ""} key={row.id}>
                          <td><input value={row.week} onChange={(event) => updateRow(row.id, { week: Number(event.target.value) || "" })} /></td>
                          <td><input value={row.date} onChange={(event) => updateRow(row.id, { date: event.target.value })} /></td>
                          <td>
                            <select
                              value={row.learningBaseId}
                              onChange={(event) => {
                                const base = references.bases.find((item) => item.baseId === event.target.value);
                                updateRow(row.id, { learningBaseId: base?.baseId ?? "", learningBaseName: base?.baseName ?? "" });
                              }}
                            >
                              <option value="">เลือกฐาน</option>
                              {references.bases.filter((base) => base.active || base.baseId === row.learningBaseId).map((base) => (
                                <option key={base.baseId} value={base.baseId}>{base.baseName}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={row.classroomId}
                              onChange={(event) => {
                                const classroom = references.classrooms.find((item) => item.classroomId === event.target.value);
                                updateRow(row.id, { classroomId: classroom?.classroomId ?? "", classroomName: classroom?.displayName ?? "" });
                              }}
                            >
                              <option value="">เลือกห้อง</option>
                              {references.classrooms.filter((classroom) => classroom.active || classroom.classroomId === row.classroomId).map((classroom) => (
                                <option key={classroom.classroomId} value={classroom.classroomId}>{classroom.displayName}</option>
                              ))}
                            </select>
                          </td>
                          <td><input value={row.location} onChange={(event) => updateRow(row.id, { location: event.target.value })} /></td>
                          <td>
                            <select value={row.scheduleStatus} onChange={(event) => updateRow(row.id, { scheduleStatus: event.target.value as ScheduleStatus })}>
                              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                            </select>
                          </td>
                          <td>{row.sourceCell}<br />แถว {row.sourceRow}</td>
                          <td>
                            {row.blockingError ? <span className="import-status is-error">{row.blockingError}</span> : null}
                            {row.warning ? <span className="import-status is-warning">{row.warning}</span> : null}
                            {!row.blockingError && !row.warning ? <span className="import-status is-valid">พร้อม</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="import-submit-card">
                <div>
                  <p className="section-label">ขั้นที่ 3 ยืนยันนำเข้า</p>
                  <h2>{hasBlockingErrors ? "กรุณาแก้ข้อผิดพลาดก่อนนำเข้า" : `พร้อมนำเข้า ${preview.validAssignments} รายการ`}</h2>
                  <p>{writeMode === "replace" ? `โหมดแทนที่จะลบแผนเดิมในสัปดาห์ ${replaceWeeks.join(", ")} ก่อนเขียนใหม่` : "โหมดเพิ่มรายการใหม่จะไม่ลบแผนเดิม"}</p>
                </div>
                {isImporting ? (
                  <div className="import-progress" aria-live="polite">
                    <progress max={progress.total || 1} value={progress.done} />
                    <span>นำเข้าแล้ว {progress.done} / {progress.total}</span>
                  </div>
                ) : null}
                <button className="primary-button" disabled={hasBlockingErrors || isImporting} type="button" onClick={() => void handleImport()}>
                  {isImporting ? "กำลังนำเข้า..." : "ยืนยันนำเข้าแผนเวียนฐาน"}
                </button>
              </section>
            </>
          ) : (
            <section className="empty-state import-empty-state">
              <h2>ยังไม่ได้เลือกไฟล์</h2>
              <p>เลือกไฟล์แผนเวียนฐานเพื่อให้ระบบอ่านและตรวจสอบก่อนนำเข้า</p>
            </section>
          )}
        </>
      ) : null}
    </RoleLayout>
  );
}
