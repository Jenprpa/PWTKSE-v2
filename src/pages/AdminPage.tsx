import { MenuCard } from "../components/MenuCard";
import { RoleLayout } from "../components/RoleLayout";

const adminMenuItems = [
  "จัดการครู",
  "จัดการห้องเรียน",
  "ตั้งค่ารอบเวียนฐาน",
  "รายงานภาพรวม",
];

export function AdminPage() {
  return (
    <RoleLayout title="หน้าผู้ดูแลระบบ" tone="admin">
      <section className="placeholder-panel">
        <p className="section-label">เมนูผู้ดูแลระบบ</p>
        <div className="menu-grid">
          {adminMenuItems.map((item) => (
            <MenuCard key={item} title={item} />
          ))}
        </div>
      </section>
    </RoleLayout>
  );
}
