// The visitor's privacy choice. Essential storage (sign-in, cart, theme) is always used;
// analytics only runs after "granted". The choice stays in this browser.
const CONSENT_KEY = "anmShopConsent";

// Fired to show the banner again (the "Privacy choices" links).
export const OPEN_CONSENT_EVENT = "anm-shop:open-consent";
// Fired after the choice changes, with the new value in event.detail.
export const CONSENT_CHANGED_EVENT = "anm-shop:consent-changed";

// "granted", "denied", or null when the visitor hasn't chosen yet.
export function readConsent() {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked: the choice still applies until the page is closed.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: value }));
}
