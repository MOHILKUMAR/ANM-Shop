import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import { usePageMeta } from "../usePageMeta.js";

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function ResetPassword() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  usePageMeta({ title: "Choose a new password", noindex: true });
  // Read the emailed token once; it is removed from the address bar below.
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Keep the one-time token out of browser history and any shared screenshots of the URL.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  if (!token) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-lg px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Reset link missing</h1>
        <p className="mt-3 text-gray-600">Open the link from your password reset email, or request a new one.</p>
        <Link className="mt-6 inline-block font-semibold text-brand-700" to="/forgot-password">Request a new link</Link>
      </main>
    );
  }

  async function resetPassword(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiRequest("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      login(result.user);
      navigate(result.user.role === "admin" ? "/admin" : "/shop", { replace: true });
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
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Choose a new password</h1>
        <p className="mt-2 text-gray-600">After this you'll be signed in here and signed out on every other device.</p>

        <form className="mt-7 space-y-5" onSubmit={resetPassword}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reset-password">New password</label>
            <input className={inputClass} id="reset-password" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reset-confirm">Confirm new password</label>
            <input className={inputClass} id="reset-confirm" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <p className="mt-1 text-xs text-gray-500">Use at least 8 characters.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} />
            Show passwords
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error} {/expired|invalid/i.test(error) && <Link className="font-semibold underline" to="/forgot-password">Request a new link</Link>}
            </p>
          )}
          <button className="gradient-action w-full justify-center py-3 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save new password"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default ResetPassword;
