import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingScreen } from "./components/LoadingScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";

const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })),
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
