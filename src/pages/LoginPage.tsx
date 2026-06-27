import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoadingScreen } from "../components/LoadingScreen";
import { SchoolBrand } from "../components/SchoolBrand";
import { useAuth } from "../providers/AuthProvider";

export function LoginPage() {
  const { error, login, profile, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && profile) {
      navigate(`/${profile.role}`, { replace: true });
    }
  }, [navigate, profile, status]);

  if ((status === "checking" || status === "loading-profile") && !isSubmitting) {
    return <LoadingScreen />;
  }

  if (status === "authenticated" && profile) {
    return <Navigate to={`/${profile.role}`} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell login-shell">
      <section className="login-shell-inner" aria-labelledby="login-title">
        <div className="login-banner">
          <img alt="แบนเนอร์โรงเรียน" className="login-banner-image" src="/assets/school-banner.jpg" />
          <div className="login-banner-overlay">
            <SchoolBrand />
          </div>
        </div>
        <section className="login-panel" aria-labelledby="login-title">
          <h1 id="login-title">เข้าสู่ระบบ</h1>
          <p className="intro">สำหรับผู้ดูแลระบบและครูผู้สอน</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              อีเมล
              <input
                autoComplete="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label>
              รหัสผ่าน
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="กรอกรหัสผ่าน"
                required
                type="password"
                value={password}
              />
            </label>

            {error ? (
              <div className="error-message" role="alert">
                {error}
              </div>
            ) : null}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
