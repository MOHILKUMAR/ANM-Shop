import { useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import Honeypot from "../components/Honeypot.jsx";
import { usePageMeta } from "../usePageMeta.js";

function AuthPage({ register = false }) {
  const { login } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  usePageMeta({ title: register ? "Create an account" : "Sign in", noindex: true });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Spam protection (see backend/middleware/spamGuard.js): when the form was opened, and a
  // hidden field only bots fill in.
  const [formStartedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (register && !name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (register && new TextEncoder().encode(password).length > 72) {
      setError("Use a password of at most 72 characters.");
      return;
    }
    setSubmitting(true);

    try {
      const result = await apiRequest(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register ? { name: name.trim(), email, password, website, formStartedAt } : { email, password }),
      });
      if (register) {
        navigate("/verify-email", {
          replace: true,
          state: { email: result.email, emailSent: result.emailSent, from: location.state?.from },
        });
        return;
      }
      login(result);
      navigate(location.state?.from || "/shop", { replace: true });
    } catch (requestError) {
      if (requestError.data?.verificationRequired) {
        navigate("/verify-email", {
          replace: true,
          state: { email: requestError.data.email || email, from: location.state?.from },
        });
        return;
      }
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-gray-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">ANM-Shop account</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{register ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-gray-600">{register ? "Sign up to continue to checkout and track orders." : "Sign in to continue with your order."}</p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          {register && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="name">Name</label>
              <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id="name" autoComplete="name" maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">Email</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id="email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">Password</label>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-12 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={register ? "Create a password" : "Enter your password"}
                minLength={register ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-brand-700 hover:text-brand-900"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  {showPassword ? (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5 0 8.5 5 9.5 7a16 16 0 0 1-3.1 4.1M6.2 6.2A16.6 16.6 0 0 0 2.5 12c1 2 4.5 7 9.5 7 1.2 0 2.3-.3 3.3-.8" />
                    </>
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  )}
                </svg>
                <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
              </button>
            </div>
            {register && <p className="mt-1 text-xs text-gray-500">Use at least 8 characters.</p>}
            {!register && (
              <p className="mt-2 text-right text-sm">
                <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/forgot-password">Forgot password?</Link>
              </p>
            )}
          </div>
          {register && <Honeypot value={website} onChange={setWebsite} />}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="gradient-action w-full justify-center py-3 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          {register ? "Already have an account? " : "New to ANM-Shop? "}
          <Link className="font-semibold text-brand-700 hover:text-brand-900" to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {!register && (
          <p className="mt-3 text-center text-sm text-gray-600">
            Need to verify your email? <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/verify-email">Verify email</Link>
          </p>
        )}
      </section>
    </main>
  );
}

export default AuthPage;
