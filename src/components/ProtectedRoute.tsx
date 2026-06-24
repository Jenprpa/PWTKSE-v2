import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { RoleGuard } from "./RoleGuard";
import { useAuth } from "../providers/AuthProvider";
import type { UserRole } from "../types/user";

export function ProtectedRoute({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: ReactNode;
}) {
  const { status } = useAuth();

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <RoleGuard allowedRole={allowedRole}>{children}</RoleGuard>;
}
