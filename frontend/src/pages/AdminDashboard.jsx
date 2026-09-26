import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api.js";
import AuthContext from "../context/AuthContext.js";
import { beautyCategories } from "../data/beautyCategories.js";

// The shared list holds { name, description, icon } for the home page; the admin form needs names.
const categoryNames = beautyCategories.map((category) => category.name);

const emptyProduct = { name: "", description: "", price: "", category: "Skincare", stock: "" };
const money = (amount) => Number(amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });

function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [productPagination, setProductPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [productPage, setProductPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("products");
  const [product, setProduct] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (user?.role !== "admin") return undefined;
    let active = true;

    Promise.all([
      apiRequest("/analytics", { token: user.token }),
      apiRequest(`/products/manage?page=${productPage}&limit=50`, { token: user.token }),
      apiRequest("/orders", { token: user.token }),
    ])
      .then(([nextStats, nextProducts, nextOrders]) => {
        if (!active) return;
        setStats(nextStats);
        setProducts(nextProducts.items || []);
        setProductPagination(nextProducts.pagination || { page: 1, pages: 1, total: 0 });
        setOrders(nextOrders);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });

    return () => {
      active = false;
    };
  }, [user?.role, user?.token, refreshKey, productPage]);

  if (!user) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Admin sign-in required</h1>
        <Link className="mt-5 inline-block font-semibold text-brand-700" to="/login">Sign in</Link>
      </main>
    );
  }

  if (user.role !== "admin") {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Access denied</h1>
        <p className="mt-3 text-gray-600">This dashboard is available to administrators only.</p>
        <Link className="mt-5 inline-block font-semibold text-brand-700" to="/shop">Return to shop</Link>
      </main>
    );
  }

  async function saveProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const body = new FormData();
      Object.entries(product).forEach(([key, value]) => body.append(key, value));
      if (image) body.append("image", image);
      await apiRequest(editingProductId ? `/products/${editingProductId}` : "/products", {
        method: editingProductId ? "PUT" : "POST",
        token: user.token,
        body,
      });
      setNotice(editingProductId ? "Product updated." : "Product added to the beauty catalog.");
      setProduct(emptyProduct);
      setImage(null);
      setEditingProductId(null);
      form.reset();
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(productId) {
    if (!window.confirm("Remove this product from the catalog?")) return;
    setError("");
    try {
      await apiRequest(`/products/${productId}`, { method: "DELETE", token: user.token });
      setNotice("Product removed.");
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function updateStatus(orderId, status) {
    setError("");
    try {
      await apiRequest(`/orders/${orderId}/status`, {
        method: "PUT",
        token: user.token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setRefreshKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function startEditing(item) {
    setEditingProductId(item._id);
    setProduct({
      name: item.name,
      description: item.description,
      price: String(item.price),
      category: categoryNames.includes(item.category) ? item.category : "Skincare",
      stock: String(item.stock),
    });
    setImage(null);
    setNotice("");
  }

  return (
    <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-700">ANM-Shop management</p>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Admin dashboard</h1>
      {error && <p className="mb-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">{error}</p>}
      {notice && <p className="mb-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">{notice}</p>}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Customers", stats?.totalUser],
          ["Orders", stats?.totalOrder],
          ["Products", stats?.totalProduct],
          ["Paid revenue", stats ? money(stats.totalRevenue) : null],
          ["Paid orders", stats?.paidOrderCount],
          ["This month", stats ? money(stats.revenueThisMonth) : null],
          ["Average order value", stats ? money(stats.averageOrderValue) : null],
        ].map(([label, value]) => (
          <article className="rounded-xl border border-gray-200 bg-white p-5" key={label}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value ?? "N/A"}</p>
          </article>
        ))}
      </section>

      {stats && (
        <section className="mb-10 grid gap-5 lg:grid-cols-3" aria-label="Store analytics">
          <article className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sales overview</h2>
                <p className="mt-1 text-sm text-gray-500">Paid revenue over the last 7 days</p>
              </div>
              <p className="text-sm text-gray-500">Previous month: <span className="font-semibold text-gray-900">{money(stats.revenueLastMonth)}</span></p>
            </div>
            <div className="mt-6 grid h-52 grid-cols-7 items-end gap-3 border-b border-gray-200 px-1">
              {(stats.salesLast7Days || []).map((day) => {
                const maxRevenue = Math.max(...(stats.salesLast7Days || []).map((item) => item.revenue), 1);
                const barHeight = day.revenue > 0 ? Math.max((day.revenue / maxRevenue) * 100, 5) : 0;
                return (
                  <div className="flex h-full flex-col items-center justify-end gap-2" key={day.date}>
                    <span className="text-center text-[10px] text-gray-500">{day.revenue ? money(day.revenue) : "-"}</span>
                    <div className="flex h-36 w-full items-end">
                      <div className="w-full rounded-t-md bg-brand-500 transition-all" style={{ height: `${barHeight}%` }} title={`${day.date}: ${money(day.revenue)}, ${day.orders} orders`} role="img" aria-label={`${day.date}: ${money(day.revenue)} revenue, ${day.orders} orders`} />
                    </div>
                    <span className="pb-2 text-xs text-gray-500">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {(stats.revenueByMonth || []).map((month) => (
                <div key={month.month}>
                  <p className="text-xs text-gray-500">{new Date(`${month.month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900" title={money(month.revenue)}>{money(month.revenue)}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Order status</h2>
            <p className="mt-1 text-sm text-gray-500">{stats.totalOrder} total orders</p>
            <div className="mt-6 space-y-5">
              {[
                ["Pending", stats.orderStatus?.pending || 0, "bg-amber-500"],
                ["Shipped", stats.orderStatus?.shipped || 0, "bg-brand-500"],
                ["Delivered", stats.orderStatus?.delivered || 0, "bg-emerald-500"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-sm"><span className="text-gray-600">{label}</span><span className="font-semibold text-gray-900">{value}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${color}`} style={{ width: `${stats.totalOrder ? (value / stats.totalOrder) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
            {stats.lowStockCount > 0 && <p className="mt-7 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{stats.lowStockCount} product{stats.lowStockCount === 1 ? "" : "s"} with 5 or fewer units in stock.</p>}
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-3">
            <h2 className="text-lg font-semibold text-gray-900">Top-selling products</h2>
            <p className="mt-1 text-sm text-gray-500">Ranked by units sold from paid orders</p>
            {stats.topProducts?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stats.topProducts.map((item, index) => (
                  <div className="rounded-lg bg-gray-50 p-4" key={item.productId || item.name}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">#{index + 1}</p>
                    <p className="mt-2 truncate font-semibold text-gray-900" title={item.name}>{item.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{item.unitsSold} sold</p>
                    <p className="mt-2 text-sm font-semibold text-gray-800">{money(item.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">Sales data will appear after the first paid order.</p>}
          </article>
        </section>
      )}

      <div className="mb-6 flex gap-3 border-b border-gray-200">
        {["products", "orders"].map((item) => (
          <button className={`border-b-2 px-4 py-3 font-semibold capitalize ${tab === item ? "border-brand-600 text-brand-800" : "border-transparent text-gray-500"}`} key={item} type="button" onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>

      {tab === "products" ? (
        <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
          <form className="h-fit space-y-4 rounded-xl border border-gray-200 bg-white p-5" onSubmit={saveProduct}>
            <h2 className="text-lg font-semibold text-gray-900">{editingProductId ? "Edit product" : "Add a beauty product"}</h2>
            {[
              ["name", "Name", "text"],
              ["description", "Description", "text"],
              ["price", "Price (INR)", "number"],
              ["stock", "Stock quantity", "number"],
            ].map(([field, label, type]) => (
              <div key={field}>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor={`product-${field}`}>{label}</label>
                <input className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-500" id={`product-${field}`} type={type} min={type === "number" ? (field === "price" ? "0.01" : "0") : undefined} step={field === "price" ? "0.01" : undefined} required value={product[field]} onChange={(event) => setProduct((current) => ({ ...current, [field]: event.target.value }))} />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="product-category">Category</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand-500" id="product-category" required value={product.category} onChange={(event) => setProduct((current) => ({ ...current, category: event.target.value }))}>
                {categoryNames.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="product-image">Product image</label>
              <input className="w-full text-sm text-gray-600" id="product-image" type="file" accept="image/jpeg,image/png,image/webp" required={!editingProductId} onChange={(event) => setImage(event.target.files?.[0] || null)} />
            </div>
            <button className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60" type="submit" disabled={busy}>{busy ? "Saving..." : editingProductId ? "Save changes" : "Add product"}</button>
            {editingProductId && <button className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={() => { setEditingProductId(null); setProduct(emptyProduct); setImage(null); }}>Cancel edit</button>}
          </form>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Beauty catalog ({productPagination.total})</h2>
            {products.map((item) => (
              <article className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4" key={item._id}>
                <img className="h-16 w-16 rounded-lg bg-gray-50 object-contain" src={item.imageUrls} alt="" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500">{item.category} | {money(item.price)} | {item.stock} in stock</p>
                </div>
                <button className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" type="button" onClick={() => startEditing(item)}>Edit</button>
                <button className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" type="button" onClick={() => deleteProduct(item._id)}>Delete</button>
              </article>
            ))}
            {products.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No products found.</p>}
            {productPagination.pages > 1 && (
              <nav className="flex items-center justify-end gap-3 pt-3" aria-label="Admin catalog pages">
                <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={productPage <= 1} onClick={() => setProductPage((current) => current - 1)}>Previous</button>
                <span className="text-sm text-gray-600">Page {productPage} of {productPagination.pages}</span>
                <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40" type="button" disabled={productPage >= productPagination.pages} onClick={() => setProductPage((current) => current + 1)}>Next</button>
              </nav>
            )}
          </section>
        </div>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Customer orders ({orders.length})</h2>
          {orders.map((order) => (
            <article className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 md:flex-row md:items-center" key={order._id}>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">Order #{order._id.slice(-8).toUpperCase()}</h3>
                <p className="mt-1 text-sm text-gray-500">{order.user?.name || "Customer"} | {order.user?.email || ""} | {new Date(order.createdAt).toLocaleDateString()}</p>
                <p className="mt-2 text-sm text-gray-700">{order.items.map((item) => `${item.productId?.name || "Product"} x ${item.qty}`).join(", ")}</p>
              </div>
              <p className="font-semibold text-gray-900">{money(order.totalAmount)}</p>
              <label className="sr-only" htmlFor={`status-${order._id}`}>Order status</label>
              <select className="rounded-lg border border-gray-300 px-3 py-2 capitalize" id={`status-${order._id}`} value={order.status} onChange={(event) => updateStatus(order._id, event.target.value)}>
                {["pending", "shipped", "delivered"].map((status) => <option className="capitalize" key={status} value={status}>{status}</option>)}
              </select>
            </article>
          ))}
          {orders.length === 0 && <p className="rounded-xl bg-gray-50 p-6 text-gray-600">No orders yet.</p>}
        </section>
      )}
    </main>
  );
}

export default AdminDashboard;
