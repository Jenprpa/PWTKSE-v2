import { Link } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function PendingApprovalPage() {
  const { error, logout, profile, status } = useAuth();
  const isRejected = status === "rejected";

  return (
    <main className="page-shell center-shell">
      <section className="status-card access-card pending-approval-card" role="status">
        <p className="eyebrow">{isRejected ? "ไม่ผ่านการอนุมัติ" : "รออนุมัติ"}</p>
        <h1>{isRejected ? "บัญชีนี้ไม่ได้รับการอนุมัติ" : "รอผู้ดูแลระบบอนุมัติ"}</h1>
        <p>
          {error ||
            (isRejected
              ? "กรุณาติดต่อผู้ดูแลระบบหากต้องการตรวจสอบข้อมูลอีกครั้ง"
              : "ระบบได้รับคำขอสมัครสมาชิกแล้ว กรุณารอผู้ดูแลระบบตรวจสอบและเปิดใช้งานบัญชี")}
        </p>
        {profile ? (
          <div className="pending-profile-summary">
            <p>{profile.displayName}</p>
            <p>{profile.email}</p>
            {profile.phone ? <p>โทร: {profile.phone}</p> : null}
            {profile.department ? <p>กลุ่มสาระ: {profile.department}</p> : null}
            {profile.base ? <p>ฐาน: {profile.base}</p> : null}
          </div>
        ) : null}
        <div className="action-row">
          <button className="secondary-button compact-button" type="button" onClick={logout}>
            ออกจากระบบ
          </button>
          <Link className="primary-link-button" to="/login">
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </section>
    </main>
  );
}
