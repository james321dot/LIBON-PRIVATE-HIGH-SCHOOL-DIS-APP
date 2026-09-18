import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { KeyRound, Lock, X } from "lucide-react";
import type { StaffAccount } from "@/lib/staff-accounts";
import { staffSignInFn } from "@/lib/staff-auth.server";
import { signInWithStaffToken } from "@/lib/firebase-client";
import { haptic } from "@/lib/guard-session";

interface StaffPasswordLockProps {
  title: string;
  subtitle: string;
  onSuccess: (account: StaffAccount) => void;
  onCancel: () => void;
}

/** Password-only gate reusing the four preset staff accounts. */
export function StaffPasswordLock({
  title,
  subtitle,
  onSuccess,
  onCancel,
}: StaffPasswordLockProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [checking, setChecking] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Escape closes the lock so it can never trap the user behind its backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const verify = async () => {
    if (checking) return;
    setChecking(true);
    try {
      // Password is verified on the server; nothing sensitive reaches the browser.
      const payload = { password: password };
      const result = await staffSignInFn({ data: payload });
      if (!result.ok) {
        setError("Invalid access password.");
        setPassword("");
        setShake((s) => s + 1);
        haptic([20, 50, 20]);
        return;
      }
      try {
        await signInWithStaffToken(result.token);
      } catch {
        setError("Could not start a secure session. Please try again.");
        setShake((s) => s + 1);
        return;
      }
      haptic(35);
      onSuccess(result.account);
    } catch {
      setError("Could not reach the server. Please try again.");
      setShake((s) => s + 1);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-2000 flex items-center justify-center bg-forest-deep/80 px-5 backdrop-blur-md">
      <motion.div
        key={shake}
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: shake ? [0, -10, 10, -6, 0] : 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="glass-panel relative w-full max-w-sm rounded-2xl px-7 py-8 text-primary-foreground"
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-primary-foreground/50 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-leaf/15 text-leaf">
          <Lock className="h-6 w-6" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">
          Restricted Mode
        </p>
        <h3 className="mt-1.5 font-display text-2xl font-bold">{title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-primary-foreground/60">{subtitle}</p>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 px-3">
          <KeyRound className="h-4 w-4 shrink-0 text-leaf" />
          <input
            ref={ref}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void verify()}
            placeholder="Access password"
            className="w-full bg-transparent py-3 text-sm tracking-widest text-primary-foreground placeholder:text-primary-foreground/35 focus:outline-none"
          />
        </div>
        {error && <p className="mt-2 text-[11px] font-semibold text-destructive">{error}</p>}

        <button
          disabled={checking}
          onClick={() => void verify()}
          className="mt-5 w-full rounded-full bg-leaf-gradient py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checking ? "Verifyingâ€¦" : "Unlock"}
        </button>
      </motion.div>
    </div>
  );
}
