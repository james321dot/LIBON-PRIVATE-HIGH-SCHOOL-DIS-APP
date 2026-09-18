import { createServerFn } from "@tanstack/react-start";

/**
 * Server-only authentication.
 *
 * Flow:
 *   1. The guard/admin types their staff password.
 *   2. This server function verifies it against server-only secrets
 *      (`process.env`, no `VITE_` prefix — never bundled to the browser).
 *   3. On success it mints a Firebase **custom token** whose claims carry the
 *      user's role, and returns only that token plus the public role/badge.
 *   4. The browser calls `signInWithCustomToken`, exchanging it for a real
 *      Firebase ID token. Realtime Database rules then key off `auth.uid` and
 *      the role claims, so per-account access is enforced by Firebase itself.
 *
 * Why sign by hand: this project deploys to Cloudflare Workers, where
 * `firebase-admin` does not run (protobufjs needs runtime code generation).
 * A custom token is just a JWT signed RS256 with the service-account key, which
 * WebCrypto can do natively.
 */
export type StaffRole = "Guard" | "Admin" | "EClub" | "Dev";

export interface StaffAccount {
  /** Role label shown on the guard bar. */
  role: string;
  /** Short badge label. */
  badge: string;
  /** Stable identifier used by the client session (never the password itself). */
  staffRole: StaffRole;
}

/** Reads a required secret, rejecting blank/placeholder values. */
function requiredSecret(key: string): string | null {
  const value = process.env[key];
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "change-me") return null;
  return trimmed;
}

/** The table of staff accounts. Passwords live on the server only. */
function staffTable(): { account: StaffAccount; envKey: string }[] {
  return [
    {
      account: { role: "Security Guard", badge: "GUARD", staffRole: "Guard" },
      envKey: "STAFF_GUARD_PASSWORD",
    },
    {
      account: { role: "School Admin", badge: "ADMIN", staffRole: "Admin" },
      envKey: "STAFF_ADMIN_PASSWORD",
    },
    {
      account: { role: "Electronics Club", badge: "E-CLUB", staffRole: "EClub" },
      envKey: "STAFF_ECLUB_PASSWORD",
    },
    {
      account: { role: "Lead Developer", badge: "DEV", staffRole: "Dev" },
      envKey: "STAFF_DEV_PASSWORD",
    },
  ];
}

/** Constant-time-ish comparison to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ----------------------------- custom tokens ----------------------------- */

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlFromString(input: string): string {
  return base64Url(new TextEncoder().encode(input));
}

/** Converts a PEM RSA private key into a WebCrypto key. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Mints a Firebase custom token (JWT) for the given uid + role claims.
 * Returns null when the service-account key is not configured.
 */
async function mintCustomToken(
  uid: string,
  claims: { role: StaffRole; badge: string },
): Promise<string | null> {
  const clientEmail = requiredSecret("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = requiredSecret("FIREBASE_PRIVATE_KEY");
  if (!clientEmail || !privateKeyRaw) return null;

  // Hosts often store newlines escaped as \n inside an env var.
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims,
  };

  const signingInput = `${base64UrlFromString(JSON.stringify(header))}.${base64UrlFromString(
    JSON.stringify(payload),
  )}`;

  try {
    const key = await importPrivateKey(privateKey);
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput),
    );
    return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  } catch {
    return null;
  }
}

/** uid is derived from the account so each role maps to a stable identity. */
function uidFor(staffRole: StaffRole): string {
  return `lphs-${staffRole.toLowerCase()}`;
}

/* ------------------------------ server fns ------------------------------- */

/**
 * Verifies a staff password and returns a Firebase custom token plus the
 * account's public identity. The password never leaves the server; the returned
 * token is short-lived and role-scoped.
 */
export const staffSignInFn = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => {
    if (typeof data?.password !== "string") throw new Error("Invalid request");
    return { password: data.password.slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const candidate = data.password.trim();
    if (!candidate) return { ok: false as const };

    for (const { account, envKey } of staffTable()) {
      const expected = requiredSecret(envKey);
      if (expected && safeEqual(candidate, expected)) {
        const token = await mintCustomToken(uidFor(account.staffRole), {
          role: account.staffRole,
          badge: account.badge,
        });
        if (!token) return { ok: false as const, reason: "auth-not-configured" as const };
        return { ok: true as const, account, token };
      }
    }
    // Distinguish "nothing is configured yet" from "wrong password" so setup
    // problems are obvious instead of looking like a bad credential.
    const anyConfigured = staffTable().some((entry) => requiredSecret(entry.envKey) !== null);
    return { ok: false as const, reason: anyConfigured ? undefined : ("no-passwords-set" as const) };
  });

/**
 * Verifies the admin dashboard passcode and returns a role-scoped custom token.
 */
export const adminSignInFn = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => {
    if (typeof data?.password !== "string") throw new Error("Invalid request");
    return { password: data.password.slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const expected = requiredSecret("ADMIN_PASSWORD");
    if (!expected || !safeEqual(data.password.trim(), expected)) {
      return { ok: false as const };
    }
    const token = await mintCustomToken("lphs-admin", { role: "Admin", badge: "ADMIN" });
    if (!token) return { ok: false as const, reason: "auth-not-configured" as const };
    return { ok: true as const, token };
  });

