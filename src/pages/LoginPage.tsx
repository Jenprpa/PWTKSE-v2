import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAuth } from "../providers/AuthProvider";

export function LoginPage() {
  const { error, login, profile, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        </div>
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
              <path d="M7.5 10V8.5a4.5 4.5 0 1 1 9 0V10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <rect x="6" y="10" width="12" height="9" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 13.2v2.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
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
              <span className="password-field">
                <input
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M7.4 7.8C5.2 8.9 3.6 10.5 2.5 12c2.2 3.1 5.4 5 9.5 5 1.4 0 2.8-.2 4-.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.8 7.1c.4-.1.8-.1 1.2-.1 4.1 0 7.3 1.9 9.5 5-.6.8-1.2 1.6-2 2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12c2.2-3.1 5.4-5 9.5-5s7.3 1.9 9.5 5c-2.2 3.1-5.4 5-9.5 5s-7.3-1.9-9.5-5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </span>
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
