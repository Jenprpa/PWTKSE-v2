import { MenuCard } from "../components/MenuCard";
import { RoleLayout } from "../components/RoleLayout";

const teacherMenuItems = ["เช็กชื่อนักเรียน", "ประวัติการเช็กชื่อ"];

export function TeacherPage() {
  return (
    <RoleLayout title="หน้าเช็กชื่อครู" tone="teacher">
      <section className="placeholder-panel">
        <p className="section-label">เมนูครูผู้สอน</p>
        <div className="menu-grid teacher-menu-grid">
          {teacherMenuItems.map((item) => (
            <MenuCard key={item} title={item} />
          ))}
        </div>
      </section>
    </RoleLayout>
  );
}
