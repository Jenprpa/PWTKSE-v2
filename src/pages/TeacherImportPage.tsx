import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { RoleLayout } from "../components/RoleLayout";
import {
  downloadTeacherCsvTemplate,
  downloadTeacherExcelTemplate,
  fetchExistingUserEmails,
  importTeacherRows,
  parseTeacherImportFile,
} from "../services/teacherImport";
import type { TeacherImportPreview, TeacherImportResult } from "../types/teacherImport";

const PREVIEW_LIMIT = 200;

export function TeacherImportPage() {
  const [existingEmails, setExistingEmails] = useState<string[]>([]);
  const [preview, setPreview] = useState<TeacherImportPreview | null>(null);
  const [result, setResult] = useState<TeacherImportResult | null>(null);
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
      setExistingEmails(await fetchExistingUserEmails());
    } catch {
      setError("ไม่สามารถโหลดรายชื่อบัญชีผู้ใช้เดิมได้ กรุณาลองใหม่อีกครั้ง");
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
    setResult(null);
    setPreview(null);
    setProgress({ imported: 0, total: 0 });

    try {
      setPreview(await parseTeacherImportFile(file, existingEmails));
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
    setResult(null);
    setProgress({ imported: 0, total: preview.validRows });

    try {
      const nextResult = await importTeacherRows(preview.rows, (imported, total) => {
        setProgress({ imported, total });
      });
      setResult(nextResult);

      if (nextResult.failedCount > 0) {
        setError(`สร้างบัญชีสำเร็จ ${nextResult.importedCount} คน แต่ไม่สำเร็จ ${nextResult.failedCount} คน`);
      } else {
        setSuccess(`สร้างบัญชีครูสำเร็จ ${nextResult.importedCount} คน`);
        setPreview(null);
        setFileInputKey((current) => current + 1);
      }

      await loadReferenceData();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "นำเข้าข้อมูลไม่สำเร็จ");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleExcelTemplate() {
    setIsDownloadingTemplate(true);
    setError("");

    try {
      await downloadTeacherExcelTemplate();
    } catch {
      setError("สร้างไฟล์ตัวอย่าง Excel ไม่สำเร็จ กรุณาลองดาวน์โหลด CSV แทน");
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  return (
    <RoleLayout title="นำเข้าบัญชีครู" tone="admin">
      <div className="import-page-actions">
        <Link className="secondary-button compact-button import-back-link" to="/admin">
          กลับหน้าผู้ดูแลระบบ
        </Link>
      </div>

      <section className="import-intro-card">
        <p className="eyebrow">Teacher Import Wizard</p>
        <h1>สร้างบัญชีครูจาก Excel หรือ CSV</h1>
        <p>
          ระบบจะสร้างบัญชี Firebase Auth และสร้าง profile ที่ users/&lbrace;uid&rbrace; เป็นบทบาทครูผู้สอนเท่านั้น
        </p>
        <div className="import-template-actions">
          <button className="secondary-button compact-button" type="button" onClick={downloadTeacherCsvTemplate}>
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

      <section className="import-note-card" aria-label="คำเตือนการสร้างบัญชีครู">
        <h2>ข้อมูลที่ต้องเตรียม</h2>
        <p>คอลัมน์ที่จำเป็น: ชื่อครู, อีเมล, รหัสผ่าน</p>
        <p>คอลัมน์เสริม: บทบาท, สถานะ โดยบทบาทต้องเป็น teacher เท่านั้น</p>
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
          <p>กำลังตรวจสอบบัญชีผู้ใช้เดิมในระบบ</p>
        </section>
      ) : null}

      {!isLoading ? (
        <>
          <section className="import-upload-card">
            <div>
              <p className="section-label">ขั้นที่ 1 เลือกไฟล์</p>
              <h2>อัปโหลดรายชื่อครู</h2>
              <p>รองรับ .xlsx และ .csv ขนาดไม่เกิน 2 MB หรือไม่เกิน 200 บัญชีต่อครั้ง</p>
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
                  <p className="kpi-label">พร้อมสร้างบัญชี</p>
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
                </div>
                <div className="table-scroll">
                  <table className="data-table import-preview-table">
                    <thead>
                      <tr>
                        <th>แถว</th>
                        <th>ชื่อครู</th>
                        <th>อีเมล</th>
                        <th>บทบาท</th>
                        <th>สถานะ</th>
                        <th>ผลตรวจ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr className={row.errors.length > 0 ? "import-row-error" : ""} key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td>{row.displayName || "-"}</td>
                          <td>{row.email || "-"}</td>
                          <td>teacher</td>
                          <td>{row.activeValue ? "เปิดใช้งาน" : "ระงับ"}</td>
                          <td>
                            {row.errors.length === 0 && row.warnings.length === 0 ? (
                              <span className="import-status is-valid">พร้อมสร้างบัญชี</span>
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
                  <p className="section-label">ขั้นที่ 3 สร้างบัญชี</p>
                  <h2>{hasBlockingErrors ? "กรุณาแก้ไฟล์ก่อนสร้างบัญชี" : `พร้อมสร้างบัญชีครู ${preview.validRows} คน`}</h2>
                  <p>
                    {hasBlockingErrors
                      ? "ระบบจะไม่สร้างบัญชีจนกว่าข้อผิดพลาดทั้งหมดจะได้รับการแก้ไข"
                      : "ระบบจะสร้าง Firebase Auth และ Firestore profile ให้ครูแต่ละคน"}
                  </p>
                </div>
                {isImporting ? (
                  <div className="import-progress" aria-live="polite">
                    <progress max={progress.total || 1} value={progress.imported} />
                    <span>
                      สร้างบัญชีสำเร็จ {progress.imported} / {progress.total}
                    </span>
                  </div>
                ) : null}
                <button
                  className="primary-button"
                  disabled={hasBlockingErrors || isImporting}
                  onClick={() => void handleImport()}
                  type="button"
                >
                  {isImporting ? "กำลังสร้างบัญชี..." : "ยืนยันสร้างบัญชีครู"}
                </button>
              </section>
            </>
          ) : (
            <section className="empty-state import-empty-state">
              <h2>ยังไม่ได้เลือกไฟล์</h2>
              <p>ดาวน์โหลดไฟล์ตัวอย่างหรือเลือกไฟล์ครูของโรงเรียนเพื่อตรวจสอบก่อนสร้างบัญชี</p>
            </section>
          )}

          {result && result.failures.length > 0 ? (
            <section className="import-file-messages">
              {result.failures.map((failure) => (
                <p className="import-message is-error" key={`${failure.rowNumber}-${failure.email}`}>
                  แถว {failure.rowNumber} {failure.email}: {failure.message}
                </p>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </RoleLayout>
  );
}
