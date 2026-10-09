import { Link } from "react-router-dom";
import logo from "../assets/anm-shop-logo.svg";
import { supportEmail, linkedinProfile } from "../data/contactInfo.js";
import { OPEN_CONSENT_EVENT } from "../consent.js";

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="md:col-span-2 lg:col-span-1">
          <Link className="inline-flex" to="/" aria-label="ANM-Shop home">
            <img className="h-16 w-auto" src={logo} alt="ANM-Shop" />
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-6 text-gray-600">Beauty for your everyday rituals. Explore skincare, makeup, haircare, and body essentials.</p>
        </div>

        <nav aria-label="Shop links">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Shop</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link className="text-gray-600 hover:text-brand-700" to="/shop">All beauty</Link></li>
            <li><Link className="text-gray-600 hover:text-brand-700" to="/cart">Shopping cart</Link></li>
            <li><Link className="text-gray-600 hover:text-brand-700" to="/orders">My orders</Link></li>
          </ul>
        </nav>

        <nav aria-label="Information links">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Information</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link className="text-gray-600 hover:text-brand-700" to="/about">About us</Link></li>
            <li><Link className="text-gray-600 hover:text-brand-700" to="/contact">Contact us</Link></li>
            <li><Link className="text-gray-600 hover:text-brand-700" to="/privacy">Privacy policy</Link></li>
            <li><Link className="text-gray-600 hover:text-brand-700" to="/terms">Terms and conditions</Link></li>
            <li><Link className="text-gray-600 hover:text-brand-700" to="/returns">Returns and refunds</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Get in touch</h2>
          <a className="mt-4 inline-block break-all text-sm text-gray-600 hover:text-brand-700" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          <a className="mt-3 block text-sm text-gray-600 hover:text-brand-700" href={linkedinProfile} target="_blank" rel="noreferrer">LinkedIn profile</a>
        </div>
      </div>
      <div className="border-t border-gray-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} ANM-Shop. All rights reserved.</p>
          <button className="w-fit text-left text-gray-500 underline-offset-2 hover:text-brand-700 hover:underline" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
            Privacy choices
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
