import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/anm-shop-logo.svg";
import CartContext from "../context/CartContext.js";
import AuthContext from "../context/AuthContext.js";

function ThemeToggle({ darkMode, onToggle }) {
  return (
    <button
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 text-brand-800 transition hover:bg-brand-50"
      type="button"
      aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
      aria-pressed={darkMode}
      title={`Switch to ${darkMode ? "light" : "dark"} mode`}
      onClick={onToggle}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {darkMode ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42M3 12h2m14 0h2M5.64 18.36l1.42-1.42m9.88-9.88 1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.2 15.6A8.5 8.5 0 0 1 8.4 3.8 8.5 8.5 0 1 0 20.2 15.6Z" />
        )}
      </svg>
    </button>
  );
}

const Navbar = () => {
  const { itemCount } = useContext(CartContext);
  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("anmShopTheme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    try {
      localStorage.setItem("anmShopTheme", darkMode ? "dark" : "light");
    } catch {
      // The theme still works for this session when storage is unavailable.
    }
  }, [darkMode]);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center" aria-label="ANM-Shop home">
          <img src={logo} className="h-14 w-auto object-contain" alt="ANM-Shop" />
        </Link>

        <ul className="hidden items-center gap-8 font-medium text-gray-700 md:flex">
          <li><ThemeToggle darkMode={darkMode} onToggle={() => setDarkMode((value) => !value)} /></li>
          <li><Link className="transition hover:text-brand-700" to="/shop">Shop</Link></li>
          <li>
            <Link className="transition hover:text-brand-700" to="/cart">
              Cart {itemCount > 0 && <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-sm text-brand-800">{itemCount}</span>}
            </Link>
          </li>
          {user ? (
            <>
              <li><Link className="transition hover:text-brand-700" to="/orders">My orders</Link></li>
              <li><Link className="transition hover:text-brand-700" to="/account">Account</Link></li>
              {user.role === "admin" && <li><Link className="transition hover:text-brand-700" to="/admin">Admin</Link></li>}
              <li>
                <button className="gradient-icon-action" type="button" aria-label="Sign out" title="Sign out" onClick={logout}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 17l5-5-5-5M15 12H3" />
                    <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                  </svg>
                </button>
              </li>
            </>
          ) : (
            <li><Link className="gradient-action" to="/login">Sign in</Link></li>
          )}
        </ul>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle darkMode={darkMode} onToggle={() => setDarkMode((value) => !value)} />
          <button
            className="rounded-lg p-2 hover:bg-gray-100"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="border-t border-gray-100 px-4 py-3 md:hidden">
          <Link className="block py-2 text-gray-700 hover:text-brand-700" to="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
          <Link className="block py-2 text-gray-700 hover:text-brand-700" to="/cart" onClick={() => setMenuOpen(false)}>Cart{itemCount > 0 ? ` (${itemCount})` : ""}</Link>
          {user ? (
            <>
              <Link className="block py-2 text-gray-700 hover:text-brand-700" to="/orders" onClick={() => setMenuOpen(false)}>My orders</Link>
              <Link className="block py-2 text-gray-700 hover:text-brand-700" to="/account" onClick={() => setMenuOpen(false)}>Account</Link>
              {user.role === "admin" && <Link className="block py-2 text-gray-700 hover:text-brand-700" to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
              <button className="gradient-icon-action mt-2" type="button" aria-label="Sign out" title="Sign out" onClick={() => { logout(); setMenuOpen(false); }}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 17l5-5-5-5M15 12H3" />
                  <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
                </svg>
              </button>
            </>
          ) : (
            <Link className="gradient-action mt-2" to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
          )}
        </div>
      )}
    </nav>
  )
}

export default Navbar