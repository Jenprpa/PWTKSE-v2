import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "teacher";
export type UserStatus = "pending" | "approved" | "rejected";

export type UserProfile = {
  displayName: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  active: boolean;
  phone?: string;
  department?: string;
  base?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export const roleLabels: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  teacher: "ครูผู้สอน",
};
