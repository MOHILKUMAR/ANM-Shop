import { useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";

function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    location.state?.emailSent === false
      ? "The account was created, but the email could not be sent. Check the email settings and request a new code."
      : location.state?.email
        ? "Enter the 6-digit code sent to your email."
        : "Enter your account email and verification code.",
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function verifyCode(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequest("/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      login(result.user);
      navigate(location.state?.from || "/shop", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError("");
    try {
      const result = await apiRequest("/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-gray-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Email verification</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Check your inbox</h1>
        <p className="mt-2 text-gray-600">Verify your address once when you create your ANM-Shop account. After that, sign in normally without another code.</p>

        <form className="mt-7 space-y-5" onSubmit={verifyCode}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="verification-email">Email</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id="verification-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="verification-code">6-digit code</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-[0.4em] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
          {notice && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800" role="status">{notice}</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "Verifying…" : "Verify email"}
          </button>
        </form>

        <button className="mt-4 w-full rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60" type="button" disabled={resending || !email} onClick={resendCode}>
          {resending ? "Requesting…" : "Send a new code"}
        </button>
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default VerifyEmail;
