import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShieldCheck, Moon, Sun, LogOut, Timer } from "lucide-react";
import { InstallPrompt } from "@/components/InstallPrompt";
import { formatDuration, type GuardSession } from "@/lib/guard-session";

interface GuardBarProps {
  session: GuardSession;
  kiosk: boolean;
  onToggleKiosk: () => void;
  onEndShift: () => void;
}

export function GuardBar({ session, kiosk, onToggleKiosk, onEndShift }: GuardBarProps) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const tick = () => setElapsed(formatDuration(Date.now() - session.startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-leaf/25 bg-forest-deep px-5 py-2.5 text-primary-foreground"
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]">
        <ShieldCheck className="h-4 w-4 text-leaf" />
        On duty:&nbsp;<span className="text-leaf">{session.name}</span>
        {session.badge && (
          <span className="rounded-md bg-leaf/15 px-2 py-0.5 text-[10px] tracking-[0.15em] text-leaf">
            {session.badge}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold tabular-nums tracking-widest">
          <Timer className="h-3.5 w-3.5 text-leaf" /> {elapsed}
        </span>
        <InstallPrompt compact />
        <button
          onClick={onToggleKiosk}
          title="Toggle dark kiosk mode"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary-foreground/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-primary-foreground/10"
        >
          {kiosk ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {kiosk ? "Day" : "Kiosk"}
        </button>
        <button
          onClick={onEndShift}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gold transition-colors hover:bg-gold/10"
        >
          <LogOut className="h-3.5 w-3.5" /> End Shift
        </button>
      </div>
    </motion.div>
  );
}
