import { Link } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function AccessMessage({
  message,
  showHomeLink = false,
}: {
  message: string;
  showHomeLink?: boolean;
}) {
  const { logout, profile } = useAuth();
  const homePath = profile ? `/${profile.role}` : "/login";

  return (
    <main className="page-shell center-shell">
      <section className="status-card access-card" role="alert">
        <p className="error-title">ไม่สามารถเข้าถึงหน้านี้</p>
        <p>{message}</p>
        <div className="action-row">
          {showHomeLink ? (
            <Link className="primary-link-button" to={homePath}>
              กลับไปหน้าของฉัน
            </Link>
          ) : null}
          <button className="secondary-button compact-button" type="button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </section>
    </main>
  );
}
