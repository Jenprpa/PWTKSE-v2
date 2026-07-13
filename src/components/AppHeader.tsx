import { useAuth } from "../providers/AuthProvider";
import { roleLabels } from "../types/user";
import { SchoolBrand } from "./SchoolBrand";

export function AppHeader({ title }: { title: string }) {
  const { logout, profile } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-main">
        <SchoolBrand compact />
        <div className="app-header-title">
          <p className="header-system-name">ระบบเช็คชื่อฐานการเรียนรู้เศรษฐกิจพอเพียง</p>
          <p className="header-school-name">Pai Wittayakarn School</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="app-header-actions">
        {profile ? (
          <div className="user-summary">
            <p>{profile.displayName}</p>
            <p>{profile.email}</p>
            <p>บทบาท: {roleLabels[profile.role]}</p>
          </div>
        ) : null}
        <button className="secondary-button compact-button" type="button" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
    </header>
  );
}
