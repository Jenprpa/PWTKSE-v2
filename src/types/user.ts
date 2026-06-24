import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "teacher";

export type UserProfile = {
  displayName: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const roleLabels: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  teacher: "ครูผู้สอน",
};
