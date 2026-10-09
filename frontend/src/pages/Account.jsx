import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import MyCoupons from "../components/MyCoupons.jsx";
import DeleteAccount from "../components/DeleteAccount.jsx";
import { usePageMeta } from "../usePageMeta.js";

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Account() {
  const { user, login, logout } = useContext(AuthContext);
  usePageMeta({ title: "Account settings", noindex: true });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletedMessage, setDeletedMessage] = useState("");

  // After deleting the account: forget its saved cart on this device and sign out.
  function accountDeleted(message) {
    try {
      localStorage.removeItem(`shopnestCart:${user._id}`);
    } catch {
      // Storage blocked: nothing saved to remove.
    }
    setDeletedMessage(message);
    logout();
  }

  if (deletedMessage) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Account deleted</h1>
        <p className="mt-3 text-gray-600">{deletedMessage} A confirmation is on its way to your email.</p>
        <Link className="mt-6 inline-block font-semibold text-brand-700" to="/">Back to the shop</Link>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Sign in to manage your account</h1>
        <Link className="mt-6 inline-block font-semibold text-brand-700" to="/login" state={{ from: "/account" }}>Sign in</Link>
      </main>
    );
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiRequest("/auth/password", {
        method: "PUT",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      // The old token no longer works after a password change; keep this session on the new one.
      login(result.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">Your account</p>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Account settings</h1>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-gray-500">Name</dt><dd className="mt-1 text-gray-900">{user.name}</dd></div>
          <div><dt className="text-sm text-gray-500">Email</dt><dd className="mt-1 break-all text-gray-900">{user.email}</dd></div>
        </dl>
      </section>

      <div className="mb-6"><MyCoupons token={user.token} /></div>

      <form className="space-y-5 rounded-xl border border-gray-200 bg-white p-6" onSubmit={changePassword}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
          <p className="mt-1 text-sm text-gray-600">Changing your password signs you out on every other device.</p>
        </div>
        {/* Lets password managers attach the new password to this account. */}
        <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="current-password">Current password</label>
          <input className={inputClass} id="current-password" type={showPasswords ? "text" : "password"} autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="new-password">New password</label>
            <input className={inputClass} id="new-password" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirm-password">Confirm new password</label>
            <input className={inputClass} id="confirm-password" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray-500">Use at least 8 characters.</p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} />
          Show passwords
        </label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
        <button className="rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitting}>
          {submitting ? "Changing…" : "Change password"}
        </button>
      </form>

      <DeleteAccount user={user} onDeleted={accountDeleted} />
    </main>
  );
}

export default Account;
