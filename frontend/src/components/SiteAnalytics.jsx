import { lazy, Suspense, useEffect, useState } from "react";
import { CONSENT_CHANGED_EVENT, readConsent } from "../consent.js";

// Vercel Web Analytics and Speed Insights: cookie-free page views and loading-speed data.
// Loaded only after the visitor accepts analytics, so declining downloads nothing.
// Turn both on in the Vercel dashboard (project -> Analytics / Speed Insights -> Enable).
const VercelAnalytics = lazy(() => import("@vercel/analytics/react").then((module) => ({ default: module.Analytics })));
const VercelSpeedInsights = lazy(() => import("@vercel/speed-insights/react").then((module) => ({ default: module.SpeedInsights })));

// Query values that are safe to report; anything else (such as a password-reset token) is dropped.
const KEPT_PARAMS = ["category", "page"];

// Nothing is sent after consent is withdrawn.
const beforeSend = (event) => {
  if (readConsent() !== "granted") return null;
  const url = new URL(event.url);
  const kept = new URLSearchParams();
  KEPT_PARAMS.forEach((name) => url.searchParams.has(name) && kept.set(name, url.searchParams.get(name)));
  url.search = kept.toString();
  return { ...event, url: url.toString() };
};

function SiteAnalytics() {
  const [granted, setGranted] = useState(() => readConsent() === "granted");

  useEffect(() => {
    const update = (event) => setGranted(event.detail === "granted");
    window.addEventListener(CONSENT_CHANGED_EVENT, update);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, update);
  }, []);

  if (!granted) return null;
  return (
    <Suspense fallback={null}>
      <VercelAnalytics beforeSend={beforeSend} />
      <VercelSpeedInsights beforeSend={beforeSend} />
    </Suspense>
  );
}

export default SiteAnalytics;
