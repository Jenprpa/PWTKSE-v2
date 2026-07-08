import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { RoleLayout } from "../components/RoleLayout";
import { fetchAdminData } from "../services/adminData";
import {
  downloadStudentCsvTemplate,
  downloadStudentExcelTemplate,
  importStudentRows,
  parseStudentImportFile,
  StudentImportWriteError,
} from "../services/studentImport";
import type { Classroom, Student } from "../types/rotation";
import type { StudentImportPreview } from "../types/studentImport";

const PREVIEW_LIMIT = 200;

export function StudentImportPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [progress, setProgress] = useState({ imported: 0, total: 0 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  async function loadReferenceData() {
    setIsLoading(true);
    setError("");

    try {
      const data = await fetchAdminData();
      setClassrooms(data.classrooms);
      setExistingStudents(data.students);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลห้องเรียนและนักเรียนได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, []);

  const hasBlockingErrors = Boolean(
    preview && (preview.errors.length > 0 || preview.errorRows > 0 || preview.validRows === 0),
  );

  const previewRows = useMemo(() => {
    if (!preview) {
      return [];
    }

    return [...preview.rows]
      .sort((a, b) => Number(b.errors.length > 0) - Number(a.errors.length > 0) || a.rowNumber - b.rowNumber)
      .slice(0, PREVIEW_LIMIT);
  }, [preview]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsParsing(true);
    setError("");
    setSuccess("");
    setPreview(null);
    setProgress({ imported: 0, total: 0 });

    try {
      const nextPreview = await parseStudentImportFile(file, classrooms, existingStudents);
      setPreview(nextPreview);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "อ่านไฟล์ไม่สำเร็จ");
      setFileInputKey((current) => current + 1);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport() {
    if (!preview || hasBlockingErrors || isImporting) {
      return;
    }

    setIsImporting(true);
    setError("");
    setSuccess("");
    setProgress({ imported: 0, total: preview.validRows });

    try {
      const importedCount = await importStudentRows(preview.rows, (imported, total) => {
        setProgress({ imported, total });
      });
      setSuccess(`นำเข้านักเรียนสำเร็จ ${importedCount} คน`);
      setPreview(null);
      setFileInputKey((current) => current + 1);
      await loadReferenceData();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "นำเข้าข้อมูลไม่สำเร็จ";
      setError(message);

      if (importError instanceof StudentImportWriteError && importError.importedCount > 0) {
        setPreview(null);
        setFileInputKey((current) => current + 1);
        await loadReferenceData();
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleExcelTemplate() {
    setIsDownloadingTemplate(true);
    setError("");

    try {
      await downloadStudentExcelTemplate();
    } catch {
      setError("สร้างไฟล์ตัวอย่าง Excel ไม่สำเร็จ กรุณาลองดาวน์โหลด CSV แทน");
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  return (
    <RoleLayout title="นำเข้ารายชื่อนักเรียน" tone="admin">
      <div className="import-page-actions">
        <Link className="secondary-button compact-button import-back-link" to="/admin">
          กลับหน้าผู้ดูแลระบบ
        </Link>
      </div>

      <section className="import-intro-card">
        <p className="eyebrow">Student Import Wizard</p>
        <h1>นำเข้าจาก Excel หรือ CSV</h1>
        <p>
          ตรวจสอบชื่อคอลัมน์ ห้องเรียน รหัสนักเรียน และเลขที่ให้เรียบร้อยก่อนบันทึกลงระบบ
        </p>
        <div className="import-template-actions">
          <button className="secondary-button compact-button" type="button" onClick={downloadStudentCsvTemplate}>
            ดาวน์โหลดตัวอย่าง CSV
          </button>
          <button
            className="secondary-button compact-button"
            disabled={isDownloadingTemplate}
            type="button"
            onClick={() => void handleExcelTemplate()}
          >
            {isDownloadingTemplate ? "กำลังสร้างไฟล์..." : "ดาวน์โหลดตัวอย่าง Excel"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="error-message admin-message" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="success-message admin-message" role="status">
          {success}
        </div>
      ) : null}

      {isLoading ? (
        <section className="empty-state" aria-live="polite">
          <h2>กำลังเตรียมข้อมูล</h2>
          <p>กำลังโหลดห้องเรียนและรายชื่อนักเรียนที่มีอยู่</p>
        </section>
      ) : null}

      {!isLoading && classrooms.filter((classroom) => classroom.active).length === 0 ? (
        <section className="empty-state">
          <h2>ยังไม่มีห้องเรียนที่ใช้งาน</h2>
          <p>กรุณาสร้างหรือเปิดใช้งานห้องเรียนก่อนนำเข้ารายชื่อนักเรียน</p>
        </section>
      ) : null}

      {!isLoading && classrooms.some((classroom) => classroom.active) ? (
        <>
          <section className="import-upload-card">
            <div>
              <p className="section-label">ขั้นที่ 1 เลือกไฟล์</p>
              <h2>อัปโหลดรายชื่อนักเรียน</h2>
              <p>รองรับ .xlsx และ .csv ขนาดไม่เกิน 5 MB</p>
            </div>
            <label className="file-picker">
              <span>{isParsing ? "กำลังอ่านไฟล์..." : "เลือกไฟล์ Excel หรือ CSV"}</span>
              <input
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={isParsing || isImporting}
                key={fileInputKey}
                onChange={(event) => void handleFileChange(event)}
                type="file"
              />
            </label>
          </section>

          {preview ? (
            <>
              <section className="import-summary" aria-label="สรุปไฟล์นำเข้า">
                <article className="kpi-card">
                  <p className="kpi-label">ทั้งหมด</p>
                  <p className="kpi-value">{preview.totalRows}</p>
                </article>
                <article className="kpi-card import-valid-card">
                  <p className="kpi-label">พร้อมนำเข้า</p>
                  <p className="kpi-value">{preview.validRows}</p>
                </article>
                <article className="kpi-card import-warning-card">
                  <p className="kpi-label">คำเตือน</p>
                  <p className="kpi-value">{preview.warningRows + preview.warnings.length}</p>
                </article>
                <article className="kpi-card import-error-card">
                  <p className="kpi-label">ข้อผิดพลาด</p>
                  <p className="kpi-value">{preview.errorRows + preview.errors.length}</p>
                </article>
              </section>

              {preview.errors.length > 0 || preview.warnings.length > 0 ? (
                <section className="import-file-messages">
                  {preview.errors.map((message) => (
                    <p className="import-message is-error" key={message}>
                      {message}
                    </p>
                  ))}
                  {preview.warnings.map((message) => (
                    <p className="import-message is-warning" key={message}>
                      {message}
                    </p>
                  ))}
                </section>
              ) : null}

              <section className="import-preview-card">
                <div className="import-preview-heading">
                  <div>
                    <p className="section-label">ขั้นที่ 2 ตรวจสอบ</p>
                    <h2>{preview.fileName}</h2>
                  </div>
                  {preview.rows.length > PREVIEW_LIMIT ? (
                    <p>แสดง {PREVIEW_LIMIT} แถวแรก โดยเรียงแถวที่มีข้อผิดพลาดขึ้นก่อน</p>
                  ) : null}
                </div>
                <div className="table-scroll">
                  <table className="data-table import-preview-table">
                    <thead>
                      <tr>
                        <th>แถว</th>
                        <th>รหัส</th>
                        <th>ชื่อ-สกุล</th>
                        <th>ห้อง</th>
                        <th>เลขที่</th>
                        <th>ผลตรวจ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr className={row.errors.length > 0 ? "import-row-error" : ""} key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td>{row.studentId || "-"}</td>
                          <td>{row.fullName || "-"}</td>
                          <td>{row.classroomName || "-"}</td>
                          <td>{row.number || "-"}</td>
                          <td>
                            {row.errors.length === 0 && row.warnings.length === 0 ? (
                              <span className="import-status is-valid">พร้อมนำเข้า</span>
                            ) : null}
                            {row.errors.map((message) => (
                              <span className="import-status is-error" key={message}>
                                {message}
                              </span>
                            ))}
                            {row.warnings.map((message) => (
                              <span className="import-status is-warning" key={message}>
                                {message}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="import-submit-card">
                <div>
                  <p className="section-label">ขั้นที่ 3 บันทึก</p>
                  <h2>{hasBlockingErrors ? "กรุณาแก้ไฟล์ก่อนนำเข้า" : `พร้อมนำเข้า ${preview.validRows} คน`}</h2>
                  <p>
                    {hasBlockingErrors
                      ? "ระบบจะไม่บันทึกข้อมูลจนกว่าข้อผิดพลาดทั้งหมดจะได้รับการแก้ไข"
                      : "ข้อมูลจะถูกบันทึกเป็นนักเรียนที่เปิดใช้งานในห้องเรียนที่ตรวจสอบแล้ว"}
                  </p>
                </div>
                {isImporting ? (
                  <div className="import-progress" aria-live="polite">
                    <progress max={progress.total || 1} value={progress.imported} />
                    <span>
                      นำเข้าแล้ว {progress.imported} / {progress.total}
                    </span>
                  </div>
                ) : null}
                <button
                  className="primary-button"
                  disabled={hasBlockingErrors || isImporting}
                  onClick={() => void handleImport()}
                  type="button"
                >
                  {isImporting ? "กำลังนำเข้า..." : "ยืนยันนำเข้ารายชื่อนักเรียน"}
                </button>
              </section>
            </>
          ) : (
            <section className="empty-state import-empty-state">
              <h2>ยังไม่ได้เลือกไฟล์</h2>
              <p>ดาวน์โหลดไฟล์ตัวอย่างหรือเลือกไฟล์ของโรงเรียนเพื่อดูตัวอย่างก่อนบันทึก</p>
            </section>
          )}
        </>
      ) : null}
    </RoleLayout>
  );
}
