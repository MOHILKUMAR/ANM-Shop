import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OPEN_CONSENT_EVENT, readConsent, saveConsent } from "../consent.js";

// Asks once whether analytics may run; reopened from the "Privacy choices" links.
function ConsentBanner() {
  const [open, setOpen] = useState(() => readConsent() === null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, show);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, show);
  }, []);

  if (!open) return null;

  function choose(value) {
    saveConsent(value);
    setOpen(false);
  }

  return (
    <section
      className="fixed bottom-4 left-4 right-20 z-40 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:right-auto sm:max-w-md sm:p-5"
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
    >
      <h2 className="font-semibold text-gray-900" id="consent-title">Your privacy choices</h2>
      <p className="mt-1 text-sm leading-6 text-gray-600" id="consent-text">
        We store your sign-in and cart in this browser. May we also use cookie-free analytics to see visits and page speed?
        No advertising trackers. <Link className="font-medium text-brand-700 underline" to="/privacy">Privacy policy</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800" type="button" onClick={() => choose("granted")}>
          Accept
        </button>
        <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50" type="button" onClick={() => choose("denied")}>
          Essential only
        </button>
      </div>
    </section>
  );
}

export default ConsentBanner;
