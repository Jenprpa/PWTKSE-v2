import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth } from "../firebase";
import type { UserProfile, UserRole } from "../types/user";

export type AuthStatus =
  | "checking"
  | "loading-profile"
  | "authenticated"
  | "unauthenticated"
  | "pending"
  | "rejected"
  | "blocked"
  | "missing-profile"
  | "error";

type AuthContextValue = {
  authUser: User | null;
  profile: UserProfile | null;
  status: AuthStatus;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const MISSING_PROFILE_MESSAGE = "ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแล";
export const INACTIVE_ACCOUNT_MESSAGE = "บัญชีนี้ถูกระงับการใช้งาน";
export const PENDING_APPROVAL_MESSAGE = "บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ";
export const REJECTED_ACCOUNT_MESSAGE = "บัญชีนี้ไม่ได้รับการอนุมัติให้ใช้งาน";
const PROFILE_LOAD_ERROR_MESSAGE = "ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง";
const LOGIN_ERROR_MESSAGE = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
const INVALID_ROLE_MESSAGE = "บทบาทผู้ใช้ไม่ถูกต้อง กรุณาติดต่อผู้ดูแล";

function getLoginErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("auth/")
  ) {
    return LOGIN_ERROR_MESSAGE;
  }

  return PROFILE_LOAD_ERROR_MESSAGE;
}

function isValidRole(role: unknown): role is UserRole {
  return role === "admin" || role === "teacher";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (user: User) => {
    setStatus("loading-profile");

    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../firebaseDb");
    const profileRef = doc(db, "users", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      setProfile(null);
      setStatus("missing-profile");
      setError(MISSING_PROFILE_MESSAGE);
      return;
    }

    const userProfile = profileSnap.data() as UserProfile;

    if (!isValidRole(userProfile.role)) {
      setProfile(null);
      setStatus("error");
      setError(INVALID_ROLE_MESSAGE);
      return;
    }

    if (userProfile.status === "pending") {
      setProfile(userProfile);
      setStatus("pending");
      setError(PENDING_APPROVAL_MESSAGE);
      return;
    }

    if (userProfile.status === "rejected") {
      setProfile(userProfile);
      setStatus("rejected");
      setError(REJECTED_ACCOUNT_MESSAGE);
      return;
    }

    if (!userProfile.active) {
      setProfile(userProfile);
      setStatus("blocked");
      setError(INACTIVE_ACCOUNT_MESSAGE);
      return;
    }

    setProfile(userProfile);
    setStatus("authenticated");
    setError("");
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setStatus("checking");
      setError("");
      setAuthUser(user);

      if (!user) {
        setProfile(null);
        setStatus("unauthenticated");
        return;
      }

      try {
        await loadProfile(user);
      } catch {
        setProfile(null);
        setStatus("error");
        setError(PROFILE_LOAD_ERROR_MESSAGE);
      }
    });

    return unsubscribe;
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      setStatus("checking");
      setError("");

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        setAuthUser(credential.user);
        await loadProfile(credential.user);
      } catch (loginError) {
        setProfile(null);
        setStatus("unauthenticated");
        setError(getLoginErrorMessage(loginError));
      }
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setAuthUser(null);
    setProfile(null);
    setStatus("unauthenticated");
    setError("");
  }, []);

  const value = useMemo(
    () => ({
      authUser,
      profile,
      status,
      error,
      login,
      logout,
    }),
    [authUser, error, login, logout, profile, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
