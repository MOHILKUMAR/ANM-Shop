import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import { ListSkeleton } from "./Skeletons.jsx";
import { refreshCategories } from "../useCategories.js";

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-500";
const emptyForm = { name: "", description: "", icon: "✦", sortOrder: "" };
const countLabel = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Categories shown on the home page, the shop filter and the product form. Renaming one also
// renames it on its products and coupons; one in use can't be deleted. `onChanged` lets the
// dashboard reload its product list, which shows each product's category.
function AdminCategories({ token, onChanged }) {
  const [categories, setCategories] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/categories/manage", { token })
      .then((list) => {
        if (active) setCategories(list);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  // The admin list, every page's shared list and the dashboard's products all need the change.
  function changed(message) {
    setNotice(message);
    setReloadKey((key) => key + 1);
    refreshCategories();
    onChanged?.();
  }

  function startEdit(category) {
    setEditingId(category._id);
    setForm({ name: category.name, description: category.description || "", icon: category.icon || "✦", sortOrder: String(category.sortOrder ?? "") });
    setError("");
    setNotice("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await apiRequest(editingId ? `/categories/${editingId}` : "/categories", {
        method: editingId ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      cancelEdit();
      changed(editingId ? `Saved “${saved.name}”.` : `Added “${saved.name}”.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(category) {
    if (!window.confirm(`Delete the category “${category.name}”?`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(`/categories/${category._id}`, { method: "DELETE", token });
      if (editingId === category._id) cancelEdit();
      changed(`Deleted “${category.name}”.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <section className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form className="h-fit space-y-4 rounded-xl border border-gray-200 bg-white p-5" onSubmit={save}>
        <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit category" : "Add a category"}</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="category-name">Name</label>
          <input className={inputClass} id="category-name" required minLength={2} maxLength={60} value={form.name} onChange={update("name")} />
          {editingId && <p className="mt-1 text-xs text-gray-500">Renaming also updates its products and coupons.</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="category-description">Description</label>
          <textarea className={inputClass} id="category-description" rows={3} maxLength={200} value={form.description} onChange={update("description")} />
          <p className="mt-1 text-xs text-gray-500">Shown on the home page tile and in search results.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="category-icon">Icon</label>
            <input className={inputClass} id="category-icon" maxLength={8} value={form.icon} onChange={update("icon")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="category-order">Position</label>
            <input className={inputClass} id="category-order" type="number" min={0} max={999} step={1} placeholder="Last" value={form.sortOrder} onChange={update("sortOrder")} />
          </div>
        </div>
        <button className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={busy}>
          {busy ? "Saving..." : editingId ? "Save changes" : "Add category"}
        </button>
        {editingId && <button className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={cancelEdit}>Cancel edit</button>}
      </form>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <p className="mt-1 text-sm text-gray-500">Shown in this order on the home page and in the shop filter. Products in a category that no longer exists are hidden from the shop.</p>
        </div>
        {notice && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}
        {error && <p className="rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
        {!categories && <ListSkeleton rows={5} label="Loading categories" />}
        {categories?.length === 0 && !error && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No categories yet. Add the first one.</p>}
        {categories?.map((category) => {
          const inUse = category.productCount > 0 || category.couponCount > 0;
          return (
            <article className={`flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center ${editingId === category._id ? "border-brand-400" : "border-gray-200"}`} key={category._id}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 font-serif text-xl text-brand-800" aria-hidden="true">{category.icon}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{category.name} <span className="ml-1 text-xs font-normal text-gray-400">#{category.sortOrder}</span></h3>
                {category.description && <p className="text-sm text-gray-600">{category.description}</p>}
                <p className="mt-1 text-xs text-gray-500">{countLabel(category.productCount, "product")} · {countLabel(category.couponCount, "coupon")}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={() => startEdit(category)}>Edit</button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={inUse}
                  title={inUse ? "Move its products and edit its coupons first" : undefined}
                  onClick={() => remove(category)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default AdminCategories;
