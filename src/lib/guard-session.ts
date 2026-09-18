export interface GuardSession {
  name: string;
  startedAt: number;
  /** Verified account role, e.g. "Security Guard". */
  role?: string;
  /** Short badge for the verified account, e.g. "GUARD". */
  badge?: string;
}

const SESSION_KEY = "lphs_guard_session";
const KIOSK_KEY = "lphs_kiosk_mode";

export function loadGuardSession(): GuardSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuardSession;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export function startGuardSession(name: string, role?: string, badge?: string): GuardSession {
  const session: GuardSession = {
    name: name.trim().toUpperCase(),
    startedAt: Date.now(),
    ...(role ? { role } : {}),
    ...(badge ? { badge } : {}),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("lphs-guard-change"));
  return session;
}

export function endGuardSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("lphs-guard-change"));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function loadKioskMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KIOSK_KEY) === "1";
}

export function setKioskMode(on: boolean) {
  localStorage.setItem(KIOSK_KEY, on ? "1" : "0");
  document.documentElement.classList.toggle("dark", on);
}

export function haptic(pattern: number | number[] = 18) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
