import type { AttendanceEntry } from "./attendance";
import type { RosterMember } from "./roster";

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

/* -------------------------------------------------------------------------- */
/* AUTHENTICATION                                                             */
/* -------------------------------------------------------------------------- */

export async function signInWithStaffToken(token: string): Promise<void> {
  const app = await getApp();

  const { getAuth, signInWithCustomToken } = await import("firebase/auth");

  const auth = getAuth(app as Parameters<typeof getAuth>[0]);

  try {
    await signInWithCustomToken(auth, token);

    console.log("[Firebase] Authentication successful:", auth.currentUser?.uid);
  } catch (error) {
    console.error("[Firebase] Custom token authentication failed:", error);

    throw error;
  }
}

export async function signOutStaff(): Promise<void> {
  const app = await getApp();

  const { getAuth, signOut } = await import("firebase/auth");

  const auth = getAuth(app as Parameters<typeof getAuth>[0]);

  if (auth.currentUser) {
    await signOut(auth);
  }
}

export async function waitForSignedInUser(timeoutMs = 15000): Promise<string> {
  const uid = await currentOrPendingUid(timeoutMs);
  if (!uid) {
    throw new Error("No signed-in user; a staff password is required before reading the database");
  }
  return uid;
}

/**
 * Resolves with the signed-in uid, or `null` when nobody signs in within the
 * timeout. This is the variant the UI should use on mount: being signed out is
 * the normal state for a visitor, NOT a database failure. Resolving (instead of
 * throwing) is what stops every guest from being told "Database Unreachable"
 * fifteen seconds after the page loads.
 */
export async function currentOrPendingUid(timeoutMs = 15000): Promise<string | null> {
  const app = await getApp();

  const { getAuth, onAuthStateChanged } = await import("firebase/auth");

  const auth = getAuth(app as Parameters<typeof getAuth>[0]);

  if (auth.currentUser) return auth.currentUser.uid;

  return new Promise<string | null>((resolve) => {
    let finished = false;

    const finish = (uid: string | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(uid);
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) finish(user.uid);
    });

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

export async function subscribeToAuthState(
  callback: (uid: string | null) => void,
): Promise<() => void> {
  const app = await getApp();

  const { getAuth, onAuthStateChanged } = await import("firebase/auth");

  const auth = getAuth(app as Parameters<typeof getAuth>[0]);

  return onAuthStateChanged(auth, (user) => {
    callback(user?.uid ?? null);
  });
}

/* -------------------------------------------------------------------------- */
/* DATABASE                                                                   */
/* -------------------------------------------------------------------------- */

async function getDb() {
  const app = await getApp();

  const { getAuth } = await import("firebase/auth");

  const { getDatabase } = await import("firebase/database");

  const auth = getAuth(app as Parameters<typeof getAuth>[0]);

  if (!auth.currentUser) {
    throw new Error("Firebase user is not authenticated");
  }

  console.log("[Firebase] Database access UID:", auth.currentUser.uid);

  return getDatabase(app);
}

/* -------------------------------------------------------------------------- */
/* ATTENDANCE                                                                 */
/* -------------------------------------------------------------------------- */

export async function subscribeAttendance(
  callback: (entries: AttendanceEntry[]) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  const db = await getDb();

  const { ref, onValue } = await import("firebase/database");

  const attendanceRef = ref(db, "attendance");

  return onValue(
    attendanceRef,
    (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<AttendanceEntry, "id">> | null;

      const entries: AttendanceEntry[] = data
        ? Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }))
        : [];

      callback(entries);
    },
    (error) => {
      console.error("[Firebase] ATTENDANCE READ FAILED:", error);
      onError?.(error);
    },
  );
}

export async function pushAttendance(entry: Omit<AttendanceEntry, "id">) {
  const db = await getDb();

  const { ref, push } = await import("firebase/database");

  try {
    await push(ref(db, "attendance"), entry);

    console.log("[Firebase] Attendance write successful");
  } catch (error) {
    console.error("[Firebase] ATTENDANCE WRITE FAILED:", error);

    throw error;
  }
}

export async function removeAttendance(id: string) {
  const db = await getDb();

  const { ref, remove } = await import("firebase/database");

  try {
    await remove(ref(db, `attendance/${id}`));
  } catch (error) {
    console.error("[Firebase] ATTENDANCE DELETE FAILED:", error);

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* ROSTER                                                                     */
/* -------------------------------------------------------------------------- */

export async function subscribeRoster(
  callback: (list: RosterMember[]) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  const db = await getDb();

  const { ref, onValue } = await import("firebase/database");

  return onValue(
    ref(db, "roster"),
    (snapshot) => {
      const data = snapshot.val() as RosterMember[] | Record<string, RosterMember> | null;

      if (!data) {
        callback([]);
        return;
      }

      callback(Array.isArray(data) ? data.filter(Boolean) : Object.values(data));
    },
    (error) => {
      console.error("[Firebase] ROSTER READ FAILED:", error);
      onError?.(error);
    },
  );
}

export async function publishRoster(list: RosterMember[]) {
  const db = await getDb();

  const { ref, set } = await import("firebase/database");

  try {
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
  } catch (error) {
    console.error("[Firebase] ROSTER WRITE FAILED:", error);

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* SCAN EVENTS                                                                */
/* -------------------------------------------------------------------------- */

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

export async function subscribeScanEvents(
  callback: (events: ScanEvent[]) => void,
  onError?: (error: Error) => void,
): Promise<() => void> {
  const db = await getDb();

  const { ref, onValue, query, limitToLast } = await import("firebase/database");

  const q = query(ref(db, "scanEvents"), limitToLast(SCAN_LOG_LIMIT));

  return onValue(
    q,
    (snapshot) => {
      const data = snapshot.val() as Record<string, Omit<ScanEvent, "id">> | null;

      const events: ScanEvent[] = data
        ? Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }))
        : [];

      callback(events.sort((a, b) => b.timestamp - a.timestamp));
    },
    (error) => {
      console.error("[Firebase] SCAN EVENT READ FAILED:", error);
      onError?.(error);
    },
  );
}

export async function pushScanEvent(event: Omit<ScanEvent, "id">) {
  const db = await getDb();

  const { ref, push } = await import("firebase/database");

  try {
    await push(ref(db, "scanEvents"), event);
  } catch (error) {
    console.error("[Firebase] SCAN EVENT WRITE FAILED:", error);

    throw error;
  }
}

export async function clearScanEvents() {
  const db = await getDb();

  const { ref, remove } = await import("firebase/database");

  try {
    await remove(ref(db, "scanEvents"));
  } catch (error) {
    console.error("[Firebase] CLEAR SCAN EVENTS FAILED:", error);

    throw error;
  }
}
