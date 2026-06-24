export function LoadingScreen() {
  return (
    <main className="page-shell center-shell">
      <div className="status-card" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    </main>
  );
}
