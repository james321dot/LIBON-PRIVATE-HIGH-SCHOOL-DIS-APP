import { useEffect, useState } from "react";
import { Clock3, TimerReset } from "lucide-react";
import { DEADLINE_LABEL, LATE_FROM_LABEL, isLateAt, msUntilDeadline } from "@/lib/attendance";

function format(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}h ` : ""}${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

interface DeadlineChipProps {
  inverted?: boolean;
  className?: string;
}

/** Live indicator for the on-time window (up to 7:14 AM) and the late cut-off (7:15 AM). */
export function DeadlineChip({ inverted = false, className = "" }: DeadlineChipProps) {
  const [late, setLate] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    const tick = () => {
      setLate(isLateAt());
      setLeft(msUntilDeadline());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const base =
    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors";
  const tone = late
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : inverted
      ? "border-leaf/40 bg-leaf/15 text-leaf"
      : "border-leaf/40 bg-secondary text-emerald";

  return (
    <span className={`${base} ${tone} ${className}`} title={`Late from ${LATE_FROM_LABEL}`}>
      {late ? <TimerReset className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
      {late ? (
        <>Late window · after {DEADLINE_LABEL}</>
      ) : (
        <>
          On-time until {DEADLINE_LABEL}
          <span className="font-mono tabular-nums opacity-80">{format(left)}</span>
        </>
      )}
    </span>
  );
}
