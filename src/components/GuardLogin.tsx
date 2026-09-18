import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, KeyRound, ShieldCheck, UserRound, X } from "lucide-react";
import type { StaffAccount } from "@/lib/staff-accounts";
import { staffSignInFn } from "@/lib/staff-auth.server";
import { signInWithStaffToken } from "@/lib/firebase-client";
import { haptic } from "@/lib/guard-session";

interface GuardLoginProps {
  onSuccess: (name: string, account: StaffAccount) => void;
  onCancel: () => void;
}

export function GuardLogin({ onSuccess, onCancel }: GuardLoginProps) {
  const [step, setStep] = useState<"name" | "pass">("name");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [checking, setChecking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (step === "name" ? nameRef : passRef).current?.focus();
  }, [step]);

  const next = () => {
    if (!name.trim()) {
      setError("Please enter the name on duty.");
      setShake((s) => s + 1);
      return;
    }
    setError("");
    setStep("pass");
    haptic(12);
  };

  const verify = async () => {
    if (checking) return;
    setChecking(true);
    try {
      // Password is checked on the server; the browser never holds the credential.
      const result = await staffSignInFn({ data: { password } });
      if (!result.ok) {
        setError("Invalid access password. Attendance is locked.");
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
      onSuccess(name.trim(), result.account);
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
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
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
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-leaf">
          Gate Authorization
        </p>
        <h3 className="mt-1.5 font-display text-2xl font-bold">
          {step === "name" ? "Who is on duty?" : "Access Password"}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-primary-foreground/60">
          {step === "name"
            ? "Type the full name of the personnel on duty. Any spelling is accepted."
            : `Signing in as ${name.trim().toUpperCase()} — enter your assigned password to unlock attendance recording.`}
        </p>

        <motion.div
          key={shake}
          animate={shake > 0 ? { x: [0, -9, 9, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.42 }}
          className="mt-6"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === "name" ? (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="relative"
              >
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/40" />
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder="Full name on duty"
                  autoComplete="off"
                  className="w-full rounded-xl border border-leaf/40 bg-primary-foreground/10 py-4 pl-11 pr-4 text-sm text-primary-foreground outline-none transition-all placeholder:text-primary-foreground/40 focus:border-leaf focus:shadow-glow"
                />
              </motion.div>
            ) : (
              <motion.div
                key="pass"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="relative"
              >
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-foreground/40" />
                <input
                  ref={passRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void verify()}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-leaf/40 bg-primary-foreground/10 py-4 pl-11 pr-4 text-center text-lg tracking-[0.25em] text-primary-foreground outline-none transition-all placeholder:text-primary-foreground/40 focus:border-leaf focus:shadow-glow"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {error && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[11px] font-semibold text-gold">
            {error}
          </p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={step === "pass" && checking}
          onClick={step === "name" ? next : () => void verify()}
          className="mt-6 w-full rounded-xl bg-leaf-gradient py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {step === "name" ? "Continue" : checking ? "Verifying…" : "Unlock Attendance"}
        </motion.button>

        {step === "pass" && (
          <button
            onClick={() => {
              setStep("name");
              setError("");
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground/50 transition-colors hover:text-primary-foreground/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Change name
          </button>
        )}
      </motion.div>
    </div>
  );
}
