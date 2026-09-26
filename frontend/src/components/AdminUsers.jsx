import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import { TableSkeleton } from "./Skeletons.jsx";

const money = (amount) => Number(amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const day = (date) => (date ? new Date(date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "-");

// One header row plus one row per account. Cells without an explicit formula type are
// written as plain text/numbers, so a name like "=HYPERLINK(...)" can't run in Excel.
function toSheet(users) {
  const header = ["Name", "Email", "Role", "Email verified", "Joined", "Orders", "Total spent (INR)", "Last order", "User ID"]
    .map((value) => ({ value, fontWeight: "bold" }));
  const rows = users.map((user) => [
    user.name,
    user.email,
    user.role === "admin" ? "Admin" : "Customer",
    user.verified ? "Yes" : "No",
    { value: new Date(user.joinedAt), type: Date },
    user.orderCount,
    { value: user.totalSpent, format: "#,##0.00" },
    user.lastOrderAt ? { value: new Date(user.lastOrderAt), type: Date } : null,
    String(user._id),
  ]);
  return [header, ...rows];
}

async function downloadExcel(users) {
  // Loaded only when needed, like the PDF library for bills.
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const today = new Date().toISOString().slice(0, 10);
  await writeExcelFile(toSheet(users), {
    sheet: "Users",
    columns: [{ width: 24 }, { width: 32 }, { width: 11 }, { width: 14 }, { width: 13 }, { width: 9 }, { width: 18 }, { width: 13 }, { width: 27 }],
    dateFormat: "dd mmm yyyy",
    stickyRowsCount: 1,
  }).toFile(`anm-shop-users-${today}.xlsx`);
}

function AdminUsers({ token }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest("/auth/users", { token })
      .then((data) => {
        if (active) setUsers(Array.isArray(data) ? data : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const term = filter.trim().toLowerCase();
  const visible = (users || []).filter((user) =>
    !term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term));

  async function exportUsers() {
    setExporting(true);
    setError("");
    try {
      await downloadExcel(visible);
    } catch (exportError) {
      setError(`The Excel file could not be created: ${exportError.message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">User accounts {users ? `(${users.length})` : ""}</h2>
          <p className="mt-1 text-sm text-gray-500">Every customer and admin account, newest first.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="user-filter">Filter users by name or email</label>
          <input id="user-filter" className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" type="search" placeholder="Filter by name or email" value={filter} onChange={(event) => setFilter(event.target.value)} disabled={!users} />
          <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!users || visible.length === 0 || exporting} onClick={exportUsers}>
            {exporting ? "Preparing…" : `Download Excel (${visible.length})`}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {!users && !error && <TableSkeleton rows={8} columns={7} label="Loading user accounts" />}
      {users && visible.length === 0 && (
        <p className="rounded-xl bg-gray-50 p-6 text-gray-600">{users.length ? `No accounts match "${filter.trim()}".` : "No accounts yet."}</p>
      )}
      {users && visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Total spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((user) => (
                <tr key={user._id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="break-all px-4 py-3 text-gray-700">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.role === "admin"
                      ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800">Admin</span>
                      : <span className="text-gray-700">Customer</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.verified ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                      {user.verified ? "Verified" : "Not verified"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{day(user.joinedAt)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{user.orderCount}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{money(user.totalSpent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default AdminUsers;
