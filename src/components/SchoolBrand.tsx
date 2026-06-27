export function SchoolBrand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className={compact ? "school-brand compact" : "school-brand"}>
      <img
        alt="โลโก้โรงเรียน"
        className="school-logo"
        src="/assets/school-logo.png"
      />
      <div className="school-brand-copy">
        <p className="school-name">โรงเรียนปายวิทยาคาร</p>
        <p className="school-subtitle">ระบบเช็กชื่อคาบเศรษฐกิจพอเพียง PWTKSE v2</p>
      </div>
    </div>
  );
}
