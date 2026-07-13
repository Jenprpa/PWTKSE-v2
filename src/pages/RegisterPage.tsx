import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { emptyRegistrationForm, registerTeacher, type RegistrationForm } from "../services/registration";
import { useAuth } from "../providers/AuthProvider";

export function RegisterPage() {
  const { profile, status } = useAuth();
  const [form, setForm] = useState<RegistrationForm>(emptyRegistrationForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (status === "authenticated" && profile) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  if (status === "pending" || status === "rejected") {
    return <Navigate to="/pending" replace />;
  }

  function updateField(field: keyof RegistrationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await registerTeacher(form);
      window.location.replace("/pending");
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell login-shell">
      <section className="login-shell-inner" aria-labelledby="register-title">
        <div className="login-banner">
          <img alt="แบนเนอร์โรงเรียน" className="login-banner-image" src="/assets/school-banner.jpg" />
        </div>
        <section className="login-panel register-panel" aria-labelledby="register-title">
          <p className="eyebrow">สมัครสมาชิกครูผู้สอน</p>
          <h1 id="register-title">สมัครสมาชิก</h1>
          <p className="intro">หลังสมัครแล้วต้องรอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              ชื่อ-สกุล
              <input
                autoComplete="name"
                value={form.displayName}
                onChange={(event) => updateField("displayName", event.target.value)}
                placeholder="เช่น ครูสมศรี ใจดี"
                required
              />
            </label>
            <label>
              อีเมล
              <input
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                inputMode="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>
            <label>
              เบอร์โทร
              <input
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="08xxxxxxxx"
                required
              />
            </label>
            <div className="form-grid">
              <label>
                กลุ่มสาระ
                <input
                  value={form.department}
                  onChange={(event) => updateField("department", event.target.value)}
                  placeholder="เช่น สังคมศึกษา"
                />
              </label>
              <label>
                ฐานที่เกี่ยวข้อง
                <input
                  value={form.base}
                  onChange={(event) => updateField("base", event.target.value)}
                  placeholder="เช่น ฐานเกษตร"
                />
              </label>
            </div>
            <label>
              รหัสผ่าน
              <input
                autoComplete="new-password"
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="อย่างน้อย 8 ตัวอักษร มีตัวเลข"
                required
              />
            </label>
            <label>
              ยืนยันรหัสผ่าน
              <input
                autoComplete="new-password"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                required
              />
            </label>

            {error ? (
              <div className="error-message" role="alert">
                {error}
              </div>
            ) : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "กำลังส่งคำขอสมัคร..." : "สมัครสมาชิก"}
            </button>
            <Link className="text-button register-login-link" to="/login">
              มีบัญชีแล้ว เข้าสู่ระบบ
            </Link>
          </form>
        </section>
      </section>
    </main>
  );
}
