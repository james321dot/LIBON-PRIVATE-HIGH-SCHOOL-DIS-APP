import type { AttendanceEntry } from "./attendance";

/**
 * Firebase web configuration.
 *
 * NOTE: these values are NOT secrets. Firebase documents that the web apiKey
 * only *identifies* the project — it does not authorize access. Data is
 * protected by Security Rules (see `database.rules.json`) plus Authentication.
 * See https://firebase.google.com/docs/projects/api-keys
 */
const firebaseConfig = {
  apiKey: "AIzaSyByGamhet_V0UJ4UPMJDb423DNakr42Q-Q",
  authDomain: "lphs-attendance.firebaseapp.com",
  databaseURL: "https://lphs-attendance-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lphs-attendance",
  storageBucket: "lphs-attendance.firebasestorage.app",
  messagingSenderId: "406670151685",
  appId: "1:406670151685:web:b85827d0c2bf97577e4c6c",
};

async function getApp() {
  const { initializeApp, getApps, getApp: getExistingApp } = await import("firebase/app");
  return getApps().length ? getExistingApp() : initializeApp(firebaseConfig);
}

/**
 * Signs the browser in with a Firebase custom token minted by the server.
 *
 * The database rules key off `auth.uid` and the token's role claims, so access
 * is granted per signed-in account — an anonymous visitor gets PERMISSION_DENIED.
 */
export async function signInWithStaffToken(token: string): Promise<void> {
  const app = await getApp();
  const { getAuth, signInWithCustomToken } = await import("firebase/auth");
  const auth = getAuth(app as Parameters<typeof getAuth>[0]);
  await signInWithCustomToken(auth, token);
}

/** Signs the current browser session out of Firebase. */
export async function signOutStaff(): Promise<void> {
  const app = await getApp();
  const { getAuth, signOut } = await import("firebase/auth");
  const auth = getAuth(app as Parameters<typeof getAuth>[0]);
  if (auth.currentUser) await signOut(auth);
}

/**
 * Resolves once a signed-in Firebase user exists, or rejects after `timeoutMs`.
 *
 * The database is unreadable until a staff password has been exchanged for a
 * real session, so callers must not subscribe on mount — they would always race
 * ahead of login and report a spurious failure. Awaiting this instead makes the
 * subscription start at the moment the session becomes usable.
 */
export async function waitForSignedInUser(timeoutMs = 15000): Promise<string> {
  const app = await getApp();
  const { getAuth, onAuthStateChanged } = await import("firebase/auth");
  const auth = getAuth(app as Parameters<typeof getAuth>[0]);
  if (auth.currentUser) return auth.currentUser.uid;

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("auth-timeout"));
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(user.uid);
    });
  });
}

/**
 * Fires whenever the signed-in user appears or disappears, so long-lived
 * subscriptions can start on login and tear down on sign-out.
 */
export async function subscribeToAuthState(
  callback: (uid: string | null) => void,
): Promise<() => void> {
  const app = await getApp();
  const { getAuth, onAuthStateChanged } = await import("firebase/auth");
  const auth = getAuth(app as Parameters<typeof getAuth>[0]);
  return onAuthStateChanged(auth, (user) => callback(user?.uid ?? null));
}

/**
 * Only touches the database once a signed-in user exists. The rules reject
 * unauthenticated reads/writes, so there is no anonymous fallback.
 */
async function getDb() {
  const { getDatabase } = await import("firebase/database");
  const app = await getApp();
  const { getAuth } = await import("firebase/auth");
  const auth = getAuth(app as Parameters<typeof getAuth>[0]);
  if (!auth.currentUser) throw new Error("not-authenticated");
  return getDatabase(app);
}

export async function subscribeAttendance(
  callback: (entries: AttendanceEntry[]) => void,
): Promise<() => void> {
  const db = await getDb();
  const { ref, onValue } = await import("firebase/database");
  const attendanceRef = ref(db, "attendance");
  return onValue(attendanceRef, (snapshot) => {
    const data = snapshot.val() as Record<string, Omit<AttendanceEntry, "id">> | null;
    const entries: AttendanceEntry[] = data
      ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
      : [];
    callback(entries);
  });
}

export async function pushAttendance(entry: Omit<AttendanceEntry, "id">) {
  const db = await getDb();
  const { ref, push } = await import("firebase/database");
  await push(ref(db, "attendance"), entry);
}

export async function removeAttendance(id: string) {
  const db = await getDb();
  const { ref, remove } = await import("firebase/database");
  await remove(ref(db, `attendance/${id}`));
}

import type { RosterMember } from "./roster";

/** Live roster shared across all guard tablets and admin devices. */
export async function subscribeRoster(
  callback: (list: RosterMember[]) => void,
): Promise<() => void> {
  const db = await getDb();
  const { ref, onValue } = await import("firebase/database");
  return onValue(ref(db, "roster"), (snapshot) => {
    const data = snapshot.val() as RosterMember[] | Record<string, RosterMember> | null;
    if (!data) return callback([]);
    callback(Array.isArray(data) ? data.filter(Boolean) : Object.values(data));
  });
}

export async function publishRoster(list: RosterMember[]) {
  const db = await getDb();
  const { ref, set } = await import("firebase/database");
  await set(
    ref(db, "roster"),
    list.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      ...(m.gradeLevel ? { gradeLevel: m.gradeLevel } : {}),
      ...(m.section ? { section: m.section } : {}),
    })),
  );
}

/* ------------------------- Scanner session log ------------------------- */

export type ScanResult = "logged" | "duplicate" | "unreadable" | "failed";

export interface ScanEvent {
  id: string;
  timestamp: number;
  time: string;
  name: string;
  detail: string;
  result: ScanResult;
  late: boolean;
  station: string;
  source: "camera" | "manual";
  studentId?: string;
}

const SCAN_LOG_LIMIT = 500;

/** Every scan attempt from any station — visible live on the admin dashboard. */
export async function subscribeScanEvents(
  callback: (events: ScanEvent[]) => void,
): Promise<() => void> {
  const db = await getDb();
  const { ref, onValue, query, limitToLast } = await import("firebase/database");
  const q = query(ref(db, "scanEvents"), limitToLast(SCAN_LOG_LIMIT));
  return onValue(q, (snapshot) => {
    const data = snapshot.val() as Record<string, Omit<ScanEvent, "id">> | null;
    const events: ScanEvent[] = data
      ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
      : [];
    callback(events.sort((a, b) => b.timestamp - a.timestamp));
  });
}

export async function pushScanEvent(event: Omit<ScanEvent, "id">) {
  const db = await getDb();
  const { ref, push } = await import("firebase/database");
  await push(ref(db, "scanEvents"), event);
}

export async function clearScanEvents() {
  const db = await getDb();
  const { ref, remove } = await import("firebase/database");
  await remove(ref(db, "scanEvents"));
}
