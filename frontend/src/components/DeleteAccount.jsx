import { useState } from "react";
import { apiRequest } from "../api.js";

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

// Lets a customer delete their own account after confirming their password. The server keeps
// order and payment records and refuses while an order is still on its way.
function DeleteAccount({ user, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest("/auth/me", {
        method: "DELETE",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      onDeleted(result.message);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  if (user.role === "admin") {
    return (
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Delete account</h2>
        <p className="mt-1 text-sm text-gray-600">Admin accounts can’t be deleted. Another admin can change your role to customer in the dashboard first.</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-red-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Delete account</h2>
      <p className="mt-1 text-sm text-gray-600">
        Deletes your account, reviews and chat history. Records of past orders and payments are kept, as our privacy policy explains. Orders that are still on their way must be delivered or cancelled first.
      </p>
      {!open ? (
        <button className="mt-4 rounded-lg border border-red-300 px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50" type="button" onClick={() => setOpen(true)}>
          Delete my account…
        </button>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={remove}>
          <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="delete-password">Your password</label>
            <input className={inputClass} id="delete-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input className="mt-1" type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} />
            I understand this can’t be undone.
          </label>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-red-700 px-5 py-2.5 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={busy || !understood || !password}>
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button className="rounded-lg border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={() => { setOpen(false); setPassword(""); setUnderstood(false); setError(""); }}>
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default DeleteAccount;
