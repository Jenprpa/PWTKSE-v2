import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebaseDb";
import type { UserProfile, UserRole, UserStatus } from "../types/user";

export type ManagedUser = UserProfile & {
  uid: string;
};

export type UserApprovalUpdate = {
  role: UserRole;
  department: string;
  base: string;
};

export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map((userDoc) => ({ uid: userDoc.id, ...(userDoc.data() as UserProfile) }))
    .sort((a, b) => {
      const statusOrder: Record<UserStatus | "legacy", number> = {
        pending: 0,
        rejected: 1,
        approved: 2,
        legacy: 3,
      };
      const aStatus = a.status ?? "legacy";
      const bStatus = b.status ?? "legacy";
      return statusOrder[aStatus] - statusOrder[bStatus] || a.displayName.localeCompare(b.displayName, "th-TH");
    });
}

export async function approveUser(uid: string, update: UserApprovalUpdate) {
  await updateDoc(doc(db, "users", uid), {
    role: update.role,
    department: update.department.trim(),
    base: update.base.trim(),
    status: "approved",
    active: true,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function rejectUser(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    status: "rejected",
    active: false,
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setUserActive(uid: string, active: boolean) {
  await updateDoc(doc(db, "users", uid), {
    active,
    status: active ? "approved" : "rejected",
    updatedAt: serverTimestamp(),
  });
}
