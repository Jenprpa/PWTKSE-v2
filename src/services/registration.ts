import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebaseDb";

export type RegistrationForm = {
  displayName: string;
  email: string;
  phone: string;
  department: string;
  base: string;
  password: string;
  confirmPassword: string;
};

export const emptyRegistrationForm: RegistrationForm = {
  displayName: "",
  email: "",
  phone: "",
  department: "",
  base: "",
  password: "",
  confirmPassword: "",
};

function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function hasLetter(value: string) {
  return /\p{L}/u.test(value);
}

export function validateRegistrationForm(form: RegistrationForm) {
  const errors: string[] = [];
  const displayName = form.displayName.trim();
  const email = normalizeEmail(form.email);
  const phone = form.phone.trim();
  const department = form.department.trim();
  const base = form.base.trim();

  if (!displayName || displayName.length < 3 || !hasLetter(displayName)) {
    errors.push("กรุณากรอกชื่อ-สกุลให้ถูกต้อง");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("กรุณากรอกอีเมลให้ถูกต้อง");
  }

  if (!phone || !/^[0-9+\-\s()]{8,20}$/.test(phone)) {
    errors.push("กรุณากรอกเบอร์โทรให้ถูกต้อง");
  }

  if (!department && !base) {
    errors.push("กรุณากรอกกลุ่มสาระหรือฐานที่เกี่ยวข้อง");
  }

  if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
    errors.push("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรกับตัวเลข");
  }

  if (form.password !== form.confirmPassword) {
    errors.push("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
  }

  return {
    errors,
    value: {
      displayName,
      email,
      phone,
      department,
      base,
    },
  };
}

function registrationErrorMessage(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  }

  const code = String((error as { code?: unknown }).code);

  if (code === "auth/email-already-in-use") {
    return "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบหรือติดต่อผู้ดูแล";
  }

  if (code === "auth/weak-password") {
    return "รหัสผ่านไม่ผ่านเงื่อนไขความปลอดภัย";
  }

  if (code === "auth/invalid-email") {
    return "รูปแบบอีเมลไม่ถูกต้อง";
  }

  if (code === "auth/operation-not-allowed") {
    return "ยังไม่ได้เปิดใช้งาน Email/Password ใน Firebase Auth";
  }

  return "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export async function registerTeacher(form: RegistrationForm) {
  const validation = validateRegistrationForm(form);

  if (validation.errors.length > 0) {
    throw new Error(validation.errors[0]);
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, validation.value.email, form.password);
    await updateProfile(credential.user, { displayName: validation.value.displayName });
    await setDoc(doc(db, "users", credential.user.uid), {
      displayName: validation.value.displayName,
      email: validation.value.email,
      phone: validation.value.phone,
      department: validation.value.department,
      base: validation.value.base,
      role: "teacher",
      status: "pending",
      active: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return credential.user.uid;
  } catch (error) {
    throw new Error(registrationErrorMessage(error));
  }
}
