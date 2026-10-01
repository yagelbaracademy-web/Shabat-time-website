import { LEGAL_VERSION } from "@/content/legal";

/**
 * Consent given on the sign-up form, before there's a session to save it to.
 * The app stores it on the profile at first sign-in.
 */
const KEY = "calil:consent";

export function rememberConsent() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: LEGAL_VERSION, at: new Date().toISOString() }));
  } catch {}
}

export function pendingConsent(): { version: string; at: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v?.version === LEGAL_VERSION ? v : null;
  } catch {
    return null;
  }
}

export function clearPendingConsent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
