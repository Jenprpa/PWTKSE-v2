import { useAuth } from "../providers/AuthProvider";
import { roleLabels } from "../types/user";

export function AppHeader({ title }: { title: string }) {
  const { logout, profile } = useAuth();

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">PWTKSE v2</p>
        <h1>{title}</h1>
        {profile ? (
          <div className="user-summary">
            <p>{profile.displayName}</p>
            <p>{profile.email}</p>
            <p>บทบาท: {roleLabels[profile.role]}</p>
          </div>
        ) : null}
      </div>
      <button className="secondary-button compact-button" type="button" onClick={logout}>
        ออกจากระบบ
      </button>
    </header>
  );
}
