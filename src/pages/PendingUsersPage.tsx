import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RoleLayout } from "../components/RoleLayout";
import { approveUser, fetchManagedUsers, rejectUser, setUserActive, type ManagedUser } from "../services/userApproval";
import { roleLabels, type UserRole } from "../types/user";

type Draft = {
  role: UserRole;
  department: string;
  base: string;
};

function statusLabel(user: ManagedUser) {
  if (user.status === "pending") {
    return "รออนุมัติ";
  }

  if (user.status === "rejected") {
    return "ปฏิเสธ";
  }

  if (user.status === "approved" || user.active) {
    return "อนุมัติแล้ว";
  }

  return "ยังไม่พร้อมใช้งาน";
}

function statusClass(user: ManagedUser) {
  if (user.status === "pending") {
    return "is-pending";
  }

  if (user.status === "rejected" || !user.active) {
    return "is-inactive";
  }

  return "is-active";
}

export function PendingUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pendingCount = useMemo(() => users.filter((user) => user.status === "pending").length, [users]);

  async function loadUsers() {
    setIsLoading(true);
    setError("");

    try {
      const nextUsers = await fetchManagedUsers();
      setUsers(nextUsers);
      setDrafts(
        Object.fromEntries(
          nextUsers.map((user) => [
            user.uid,
            {
              role: user.role,
              department: user.department ?? "",
              base: user.base ?? "",
            },
          ]),
        ),
      );
    } catch {
      setError("ไม่สามารถโหลดรายชื่อผู้สมัครได้");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function updateDraft(uid: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [uid]: {
        ...current[uid],
        [field]: field === "role" ? (value as UserRole) : value,
      },
    }));
  }

  async function runAction(action: () => Promise<void>, message: string) {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(message);
      await loadUsers();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RoleLayout title="อนุมัติสมาชิก" tone="admin">
      <div className="import-page-actions">
        <Link className="secondary-button compact-button import-back-link" to="/admin">
          กลับหน้าผู้ดูแลระบบ
        </Link>
      </div>

      <section className="import-intro-card">
        <p className="section-label">Teacher Registration Approval</p>
        <h1>อนุมัติสมาชิกครู</h1>
        <p>ตรวจสอบคำขอสมัครสมาชิก กำหนดบทบาท และเปิดใช้งานบัญชีก่อนให้ครูเข้าใช้งานจริง</p>
      </section>

      <section className="kpi-grid" aria-label="สรุปผู้สมัคร">
        <article className="kpi-card">
          <p className="kpi-label">รออนุมัติ</p>
          <p className="kpi-value">{pendingCount}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">ผู้ใช้ทั้งหมด</p>
          <p className="kpi-value">{users.length}</p>
        </article>
      </section>

      {error ? (
        <div className="error-message admin-message" role="alert">
          {error}
        </div>
      ) : null}
      {success ? <div className="success-message admin-message">{success}</div> : null}

      {isLoading ? (
        <section className="empty-state">
          <h2>กำลังโหลดรายชื่อผู้สมัคร</h2>
          <p>กรุณารอสักครู่</p>
        </section>
      ) : null}

      {!isLoading && users.length === 0 ? (
        <section className="empty-state">
          <h2>ยังไม่มีผู้สมัคร</h2>
          <p>เมื่อครูสมัครสมาชิก รายชื่อจะปรากฏที่นี่เพื่อรออนุมัติ</p>
        </section>
      ) : null}

      {!isLoading && users.length > 0 ? (
        <section className="records-list">
          {users.map((user) => {
            const draft = drafts[user.uid] ?? {
              role: user.role,
              department: user.department ?? "",
              base: user.base ?? "",
            };

            return (
              <article className="record-card user-approval-card" key={user.uid}>
                <div>
                  <span className={`status-badge ${statusClass(user)}`}>{statusLabel(user)}</span>
                  <h2>{user.displayName}</h2>
                  <p>{user.email}</p>
                  {user.phone ? <p>โทร: {user.phone}</p> : null}
                  <p>บทบาทปัจจุบัน: {roleLabels[user.role]}</p>
                </div>

                <div className="approval-controls">
                  <label>
                    บทบาท
                    <select value={draft.role} onChange={(event) => updateDraft(user.uid, "role", event.target.value)}>
                      <option value="teacher">ครูผู้สอน</option>
                      <option value="admin">ผู้ดูแลระบบ</option>
                    </select>
                  </label>
                  <label>
                    กลุ่มสาระ
                    <input
                      value={draft.department}
                      onChange={(event) => updateDraft(user.uid, "department", event.target.value)}
                      placeholder="กลุ่มสาระ"
                    />
                  </label>
                  <label>
                    ฐานที่เกี่ยวข้อง
                    <input
                      value={draft.base}
                      onChange={(event) => updateDraft(user.uid, "base", event.target.value)}
                      placeholder="ฐาน"
                    />
                  </label>
                  <div className="card-actions">
                    <button
                      className="primary-button compact-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() =>
                        void runAction(
                          () => approveUser(user.uid, draft),
                          `อนุมัติ ${user.displayName} เรียบร้อยแล้ว`,
                        )
                      }
                    >
                      อนุมัติ
                    </button>
                    <button
                      className="danger-button compact-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() => void runAction(() => rejectUser(user.uid), `ปฏิเสธ ${user.displayName} เรียบร้อยแล้ว`)}
                    >
                      ปฏิเสธ
                    </button>
                    <button
                      className="secondary-button compact-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() =>
                        void runAction(
                          () => setUserActive(user.uid, !user.active),
                          user.active ? "ปิดใช้งานบัญชีเรียบร้อยแล้ว" : "เปิดใช้งานบัญชีเรียบร้อยแล้ว",
                        )
                      }
                    >
                      {user.active ? "ปิดบัญชี" : "เปิดบัญชี"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </RoleLayout>
  );
}
