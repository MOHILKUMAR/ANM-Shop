import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function requestLink(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-gray-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Password help</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Forgot your password?</h1>
        <p className="mt-2 text-gray-600">Enter your account email and we'll send you a link to choose a new password.</p>

        <form className="mt-7 space-y-5" onSubmit={requestLink}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="forgot-email">Email</label>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice} Check your spam folder if it doesn't arrive.</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <button className="gradient-action w-full justify-center py-3 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link className="font-semibold text-brand-700 hover:text-brand-900" to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPassword;
