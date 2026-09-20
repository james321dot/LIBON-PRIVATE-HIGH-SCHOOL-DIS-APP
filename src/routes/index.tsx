import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ClientView } from "@/components/ClientView";
import { AdminLock } from "@/components/AdminLock";
import { AdminView } from "@/components/AdminView";
import { GuardBar } from "@/components/GuardBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SuccessScreen } from "@/components/SuccessScreen";
import { Toaster } from "@/components/Toaster";
import { CrestIntro } from "@/components/CrestIntro";
import { ClassStatusView } from "@/components/ClassStatus";
import { ShiftReportModal } from "@/components/ShiftReport";
import { GuardLogin } from "@/components/GuardLogin";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { QRModeView } from "@/components/QRMode";
import { StaffPasswordLock } from "@/components/StaffPasswordLock";
import type { StaffAccount } from "@/lib/staff-accounts";
import { computeShiftSummary, type ShiftSummary } from "@/lib/insights";
import { loadRoster, saveRosterLocalOnly } from "@/lib/roster";
import {
  isLateAt,
  exportEntriesToCSV,
  playSuccessSound,
  type AttendanceEntry,
  type ToastItem,
} from "@/lib/attendance";

import {
  endGuardSession,
  haptic,
  loadGuardSession,
  loadKioskMode,
  setKioskMode,
  startGuardSession,
  type GuardSession,
} from "@/lib/guard-session";
import { adminSignInFn } from "@/lib/staff-auth.server";
import {
  clearScanEvents,
  publishRoster,
  pushAttendance,
  removeAttendance,
  subscribeAttendance,
  subscribeRoster,
  subscribeScanEvents,
  signInWithStaffToken,
  signOutStaff,
  waitForSignedInUser,
  type ScanEvent,
} from "@/lib/firebase-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LPHS Digital Attendance System" },
      {
        name: "description",
        content:
          "Guard-verified attendance portal for Libon Private High School â€” real-time gate logging, roster verification and secure admin analytics.",
      },
      { property: "og:title", content: "LPHS Digital Attendance System" },
      {
        property: "og:description",
        content:
          "Real-time gate logging, roster verification and secure admin analytics for Libon Private High School.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [view, setView] = useState<"client" | "admin" | "classes" | "qr">("client");
  const [qrLockOpen, setQrLockOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [isQuickView, setIsQuickView] = useState(false);
  const [csvDownloaded, setCsvDownloaded] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [success, setSuccess] = useState({ visible: false, isLate: false, time: "" });
  const [guard, setGuard] = useState<GuardSession | null>(null);
  const [kiosk, setKiosk] = useState(false);
  const [shiftReport, setShiftReport] = useState<ShiftSummary | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [confirmEndShift, setConfirmEndShift] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const devClicks = useRef(0);
  const toastId = useRef(0);
  const entriesRef = useRef<AttendanceEntry[]>([]);
  entriesRef.current = entries;

  const notify = useCallback((title: string, message: string, icon = "ðŸŸ¢") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, title, message, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    setGuard(loadGuardSession());
    const k = loadKioskMode();
    setKiosk(k);
    document.documentElement.classList.toggle("dark", k);
    return () => document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    // Wait for a real Firebase session first: the database rules reject
    // anonymous reads, so subscribing on mount would always fail and falsely
    // report the database as unreachable to someone who is simply not signed in.
    waitForSignedInUser()
      .then(() =>
        subscribeAttendance((list) => {
          if (!cancelled) setEntries(list);
        }),
      )
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      // Only a signed-in user whose read still fails reaches here, so this
      // toast now means a genuine database problem rather than "not logged in".
      .catch(() => notify("System Error", "Database Unreachable", "âŒ"));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [guard, notify]);

  // Live scanner feed â€” every scan from every station, viewable on any admin device.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    waitForSignedInUser()
      .then(() =>
        subscribeScanEvents((list) => {
          if (!cancelled) setScanEvents(list);
        }),
      )
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [guard]);

  // Shared roster sync â€” every tablet and admin device sees the same list.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    let hydrated = false;
    waitForSignedInUser()
      .then(() =>
        subscribeRoster((list) => {
          if (cancelled) return;
          hydrated = true;
          const local = loadRoster();
          if (list.length === 0 && local.length > 0) {
            void publishRoster(local);
            return;
          }
          if (JSON.stringify(list) !== JSON.stringify(local)) saveRosterLocalOnly(list);
        }),
      )
      .then((u) => {
        if (cancelled) u();
        else unsub = u;
      })
      .catch(() => undefined);

    const onLocalChange = () => {
      if (hydrated) void publishRoster(loadRoster());
    };
    window.addEventListener("lphs-roster-change", onLocalChange);
    return () => {
      cancelled = true;
      unsub?.();
      window.removeEventListener("lphs-roster-change", onLocalChange);
    };
  }, [guard]);

  const handleDevClick = () => {
    devClicks.current++;
    if (devClicks.current >= 3) {
      devClicks.current = 0;
      setLoginOpen(true);
    }
  };

  const promptGuardName = () => setLoginOpen(true);

  const handleLoginSuccess = (n: string, account: StaffAccount) => {
    setGuard(startGuardSession(n, account.role, account.badge));
    setLoginOpen(false);
    notify("Shift Started", `WELCOME ${n.toUpperCase()} Â· ${account.badge}`, "ðŸ›¡ï¸");
  };

  const handleQRUnlock = (account: StaffAccount) => {
    if (!guard) {
      setGuard(startGuardSession(`QR STATION Â· ${account.badge}`, account.role, account.badge));
    }
    setQrLockOpen(false);
    setView("qr");
    notify("QR Mode Active", `SCANNING STATION UNLOCKED Â· ${account.badge}`, "ðŸ”³");
  };

  const handleEndShift = () => {
    if (!guard) return;
    setConfirmEndShift(true);
  };

  const confirmEnd = () => {
    setConfirmEndShift(false);
    if (!guard) return;
    setShiftReport(computeShiftSummary(entriesRef.current, guard.name, guard.startedAt));
  };

  const closeShiftReport = () => {
    setShiftReport(null);
    endGuardSession();
    setGuard(null);
    notify("Shift Ended", "GUARD SIGNED OUT", "ðŸ‘‹");
  };

  const toggleKiosk = () => {
    const next = !kiosk;
    setKiosk(next);
    setKioskMode(next);
    haptic(20);
    try {
      if (next) void document.documentElement.requestFullscreen?.();
      else if (document.fullscreenElement) void document.exitFullscreen?.();
    } catch {
      /* fullscreen unsupported */
    }
  };

  const handleSubmit = async (
    name: string,
    role: string,
    studentId?: string,
    gradeLevel?: string,
    section?: string,
    /** QR mode renders its own confirmation, so skip the shared success screen. */
    silent = false,
  ): Promise<boolean> => {
    // The guard must be authenticated through GuardLogin (name + verified staff
    // password). The verified account's badge/role travels with the session, so
    // recording is authorized by who signed in â€” never by a client-side flag.
    if (!guard) {
      notify("Shift Required", "START A GUARD SHIFT FIRST", "ðŸ›¡ï¸");
      promptGuardName();
      return false;
    }
    if (!guard.badge || !guard.role) {
      notify("Unauthorized", "SIGN IN WITH A STAFF PASSWORD", "ðŸš«");
      promptGuardName();
      return false;
    }
    if (!name || !role) {
      notify("Input Error", "NAME AND ROLE ARE REQUIRED", "âŒ");
      return false;
    }

    const existing = entriesRef.current.find((e) => e.name.toUpperCase() === name.toUpperCase());
    if (existing && Date.now() - existing.timestamp < 60000) {
      notify("Notice", "ENTRY ALREADY RECORDED RECENTLY", "âš ï¸");
      return false;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const isLate = isLateAt(now);

    try {
      await pushAttendance({
        name,
        role,
        time: timeStr,
        status: isLate ? "Late" : "On-Time",
        timestamp: now.getTime(),
        ...(studentId ? { studentId } : {}),
        ...(gradeLevel ? { gradeLevel } : {}),
        ...(section ? { section } : {}),
        guard: guard.name,
        source: silent ? "qr" : "manual",
      });
      if (!silent) {
        setSuccess({ visible: true, isLate, time: timeStr });
        playSuccessSound(isLate);
        haptic(isLate ? [30, 60, 30] : 40);
        setTimeout(() => {
          setSuccess((s) => ({ ...s, visible: false }));
          notify("Registry Success", `CONGRATS ${name.toUpperCase()}, LOGGED IN`, "ðŸŽ“");
        }, 2000);
      }
      return true;
    } catch {
      notify("System Error", "Database Unreachable", "âŒ");
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(id);
  };

  const confirmDelete = async () => {
    const id = pendingDelete;
    setPendingDelete(null);
    if (!id) return;
    try {
      await removeAttendance(id);
      notify("System Update", "RECORD DELETED", "ðŸ—‘ï¸");
    } catch {
      notify("Error", "Permission Denied", "âŒ");
    }
  };

  const handleClearScanLog = async () => {
    try {
      await clearScanEvents();
      notify("Scan Log", "SCANNER HISTORY CLEARED", "ðŸ§¹");
    } catch {
      notify("Error", "Permission Denied", "âŒ");
    }
  };

  const openGate = (quick: boolean) => {
    setIsQuickView(quick);
    setLoginAttempts(0);
    setLockOpen(true);
  };

  const verifyAccess = async (password: string) => {
    let ok = false;
    try {
      // The admin passcode is compared on the server; it is never shipped to the browser.
      const payload = { password: password };
      const result = await adminSignInFn({ data: payload });
      // Exchange the role-scoped custom token for a real Firebase session.
      if (result.ok) await signInWithStaffToken(result.token);
      ok = result.ok;
    } catch {
      notify("System Error", "COULD NOT REACH SERVER", "âŒ");
      return;
    }
    if (ok) {
      setLoginAttempts(0);
      setLockOpen(false);
      setView("admin");
      setCsvDownloaded(false);
      notify("System Access", "ADMIN DASHBOARD ACTIVE", "ðŸ›¡ï¸");
    } else {
      const attempts = loginAttempts + 1;
      notify("Access Denied", "INVALID PASS", "ðŸš«");
      if (attempts >= 3) {
        setLockOpen(false);
        setLoginAttempts(0);
      } else {
        setLoginAttempts(attempts);
      }
    }
  };

  const handleExport = () => {
    if (entries.length === 0) {
      notify("System Info", "NO DATA", "â„¹ï¸");
      return;
    }
    exportEntriesToCSV(entries);
    setCsvDownloaded(true);
    notify("Export Success", "ATTENDANCE DOWNLOADED", "ðŸ’¾");
  };

  const handleLogout = () => {
    // Drop the Firebase session so the token cannot be reused.
    void signOutStaff();
    setView("client");
    notify("System Update", "SIGNED OUT", "ðŸ‘‹");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <CrestIntro />
      <Toaster toasts={toasts} />
      <SuccessScreen visible={success.visible} isLate={success.isLate} time={success.time} />

      {view === "client" && (
        <>
          {guard && (
            <GuardBar
              session={guard}
              kiosk={kiosk}
              onToggleKiosk={toggleKiosk}
              onEndShift={handleEndShift}
            />
          )}
          <AppHeader
            onShowClient={() => setLockOpen(false)}
            onOpenGate={openGate}
            onOpenClasses={() => setView("classes")}
            onOpenQR={() => setQrLockOpen(true)}
          />
          <ClientView onSubmit={handleSubmit} kiosk={kiosk} />
          <SiteFooter onDevClick={handleDevClick} />
        </>
      )}

      {view === "classes" && <ClassStatusView entries={entries} onBack={() => setView("client")} />}

      {view === "qr" && (
        <QRModeView
          operator={guard?.name ?? ""}
          onSubmit={handleSubmit}
          onBack={() => setView("client")}
        />
      )}

      {qrLockOpen && (
        <StaffPasswordLock
          title="QR Code Mode"
          subtitle="Enter a staff access password to open the contactless scanning station."
          onSuccess={handleQRUnlock}
          onCancel={() => setQrLockOpen(false)}
        />
      )}

      {shiftReport && <ShiftReportModal summary={shiftReport} onClose={closeShiftReport} />}

      {view === "admin" && (
        <AdminView
          entries={entries}
          scanEvents={scanEvents}
          isQuickView={isQuickView}
          csvDownloaded={csvDownloaded}
          onExport={handleExport}
          onLogout={handleLogout}
          onDelete={handleDelete}
          onClearScanLog={handleClearScanLog}
        />
      )}

      {lockOpen && (
        <AdminLock
          isQuickView={isQuickView}
          attemptsLeft={3 - loginAttempts}
          onVerify={verifyAccess}
          onCancel={() => setLockOpen(false)}
        />
      )}

      {loginOpen && (
        <GuardLogin onSuccess={handleLoginSuccess} onCancel={() => setLoginOpen(false)} />
      )}

      {confirmEndShift && (
        <ConfirmDialog
          title="End this shift?"
          message="Your shift summary report will be generated before you are signed out."
          confirmLabel="End Shift"
          onConfirm={confirmEnd}
          onCancel={() => setConfirmEndShift(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this record?"
          message="This permanently removes the attendance entry from the cloud database. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
