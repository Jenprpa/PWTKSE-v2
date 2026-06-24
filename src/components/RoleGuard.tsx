import type { ReactNode } from "react";
import { AccessMessage } from "./AccessMessage";
import { LoadingScreen } from "./LoadingScreen";
import { useAuth } from "../providers/AuthProvider";
import type { UserRole } from "../types/user";

const WRONG_ROLE_MESSAGE = "คุณไม่มีสิทธิ์เข้าถึงหน้านี้";

export function RoleGuard({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: ReactNode;
}) {
  const { error, profile, status } = useAuth();

  if (status === "checking" || status === "loading-profile") {
    return <LoadingScreen />;
  }

  if (status === "missing-profile" || status === "blocked" || status === "error") {
    return <AccessMessage message={error} />;
  }

  if (status === "authenticated" && profile?.role !== allowedRole) {
    return <AccessMessage message={WRONG_ROLE_MESSAGE} showHomeLink />;
  }

  return <>{children}</>;
}
