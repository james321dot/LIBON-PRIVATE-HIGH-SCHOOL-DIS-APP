import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Lock } from "lucide-react";

interface AdminLockProps {
  isQuickView: boolean;
  attemptsLeft: number;
  /** May be async — verification happens on the server. */
  onVerify: (password: string) => void | Promise<void>;
  onCancel: () => void;
}

export function AdminLock({ isQuickView, attemptsLeft, onVerify, onCancel }: AdminLockProps) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const prevAttempts = useRef(attemptsLeft);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape must close this full-screen overlay; without it the opaque backdrop
  // stays on top of the header and every nav button looks dead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    if (attemptsLeft < prevAttempts.current) setShakeKey((k) => k + 1);
    prevAttempts.current = attemptsLeft;
  }, [attemptsLeft]);

  const submit = () => {
    void onVerify(password);
    setPassword("");
  };

  return (
    <div className="fixed inset-0 z-2000 flex flex-col items-center justify-center bg-hero-gradient px-6 text-primary-foreground">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="glass-panel flex w-full max-w-sm flex-col items-center rounded-2xl px-8 py-10 text-center"
      >
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-leaf/15 text-leaf">
          <Lock className="h-6 w-6" />
        </div>
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.3em] opacity-80">
          {isQuickView ? "Quick View Security" : "Full Admin Security"}
        </p>
        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="w-full"
        >
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="••••"
            className="w-full rounded-xl border border-leaf/60 bg-primary-foreground/10 px-4 py-4 text-center text-2xl tracking-[0.4em] text-primary-foreground outline-none transition-all placeholder:text-primary-foreground/40 focus:border-leaf focus:shadow-glow"
          />
        </motion.div>
        <p className="mt-4 text-[11px] font-bold tracking-[0.2em] text-leaf">
          {attemptsLeft} ATTEMPT{attemptsLeft === 1 ? "" : "S"} REMAINING
        </p>
        <button
          onClick={submit}
          className="mt-6 w-full rounded-xl bg-leaf-gradient py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow"
        >
          Verify Access
        </button>
        <button
          onClick={onCancel}
          className="mt-5 text-xs text-primary-foreground/50 transition-opacity hover:text-primary-foreground/80"
        >
          Return to Registry
        </button>
      </motion.div>
    </div>
  );
}
