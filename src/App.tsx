import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingScreen } from "./components/LoadingScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";

const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const ReadinessPage = lazy(() =>
  import("./pages/ReadinessPage").then((module) => ({ default: module.ReadinessPage })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })),
);
const RotationPlanImportPage = lazy(() =>
  import("./pages/RotationPlanImportPage").then((module) => ({ default: module.RotationPlanImportPage })),
);
const StudentImportPage = lazy(() =>
  import("./pages/StudentImportPage").then((module) => ({ default: module.StudentImportPage })),
);
const TeacherImportPage = lazy(() =>
  import("./pages/TeacherImportPage").then((module) => ({ default: module.TeacherImportPage })),
);
const TeacherPage = lazy(() =>
  import("./pages/TeacherPage").then((module) => ({ default: module.TeacherPage })),
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <AdminPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/readiness"
        element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <ReadinessPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students/import"
        element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <StudentImportPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rotation-plans/import"
        element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <RotationPlanImportPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/teachers/import"
        element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <TeacherImportPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingScreen />}>
              <ReportsPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowedRole="teacher">
            <Suspense fallback={<LoadingScreen />}>
              <TeacherPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
