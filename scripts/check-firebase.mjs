/**
 * Throwaway diagnostic. Verifies the browser's real auth + database path:
 *
 *   1. Mint a Firebase custom token using the same service-account credentials
 *      the Worker uses (read from environment; never printed).
 *   2. Exchange it at identitytoolkit exactly like signInWithCustomToken does.
 *   3. Read /attendance with the resulting ID token, over REST.
 *
 * Run with the two secrets in the environment. Nothing here is committed to the
 * app bundle; delete this file once the database issue is understood.
 */

const API_KEY = "AIzaSyByGamhet_V0UJ4UPMJDb423DNakr42Q-Q";
const DB_URL = "https://lphs-attendance-default-rtdb.asia-southeast1.firebasedatabase.app";

// The role the rules gate on. "Dev" is allowed to write attendance + roster.
const TEST_ROLE = "Dev";
const TEST_UID = "lphs-dev";

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

if (!clientEmail || !privateKeyRaw) {
  console.error("Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in the environment first.");
  process.exit(1);
}

const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return Buffer.from(binary, "binary").toString("base64url");
}

async function importPrivateKey(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = Buffer.from(body, "base64");
  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function mintCustomToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid: TEST_UID,
    claims: { role: TEST_ROLE, badge: "DEV" },
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(signature)}`;
}

async function main() {
  console.log("1. Minting custom token from service account...");
  let customToken;
  try {
    customToken = await mintCustomToken();
    console.log("   OK - token minted (length " + customToken.length + ")");
  } catch (error) {
    console.log("   FAILED to mint: " + (error?.message ?? error));
    return;
  }

  // Decode our own payload so we can see the claims Firebase will receive.
  const payloadB64 = customToken.split(".")[1];
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  console.log("   claims sent to Firebase: " + JSON.stringify(payload.claims));
  console.log("   uid: " + payload.uid);

  console.log("2. Exchanging custom token for an ID token (as the browser does)...");
  const exchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const exchangeBody = await exchangeRes.json().catch(() => ({}));
  if (!exchangeRes.ok) {
    console.log("   FAILED: HTTP " + exchangeRes.status);
    console.log("   " + JSON.stringify(exchangeBody));
    return;
  }
  console.log("   OK - got ID token");

  const idToken = exchangeBody.idToken;

  console.log("3. Reading /attendance with that ID token...");
  const readRes = await fetch(`${DB_URL}/attendance.json?auth=${idToken}&shallow=true`);
  if (readRes.ok) {
    console.log("   OK - READ ALLOWED. Rules accept role '" + TEST_ROLE + "'.");
  } else {
    const txt = await readRes.text();
    console.log("   FAILED: HTTP " + readRes.status);
    console.log("   " + txt);
  }

  console.log("4. Attempting a write to /attendance (rules check role claims)...");
  const writeRes = await fetch(`${DB_URL}/attendance/__diagnostic__.json?auth=${idToken}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "DIAGNOSTIC - safe to delete",
      role: "Dev",
      time: "00:00",
      status: "On-Time",
      timestamp: Date.now(),
      source: "manual",
    }),
  });
  const writeTxt = await writeRes.text();
  if (writeRes.ok) {
    console.log("   OK - WRITE ALLOWED.");
    console.log("   Cleaning up the diagnostic node...");
    const cleanup = await fetch(`${DB_URL}/attendance/__diagnostic__.json?auth=${idToken}`, {
      method: "DELETE",
    });
    console.log("   cleanup: HTTP " + cleanup.status);
  } else {
    console.log("   FAILED: HTTP " + writeRes.status);
    console.log("   " + writeTxt);
  }
}

main().catch((error) => console.error("Unexpected: " + (error?.stack ?? error)));
