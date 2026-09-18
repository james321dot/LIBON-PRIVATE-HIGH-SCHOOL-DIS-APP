import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { LayoutDashboard, Eye, ClipboardList, UsersRound, QrCode } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { DeadlineChip } from "@/components/DeadlineChip";

interface AppHeaderProps {
  onShowClient: () => void;
  onOpenGate: (quick: boolean) => void;
  onOpenClasses: () => void;
  onOpenQR: () => void;
}

const navBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function AppHeader({ onShowClient, onOpenGate, onOpenClasses, onOpenQR }: AppHeaderProps) {
  const [time, setTime] = useState("--:--:--");
  const [date, setDate] = useState("");

  useEffect(() => {
    const tick = () => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      );
    };
    tick();
    setDate(
      new Date()
        .toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        .toUpperCase(),
    );
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Utility bar */}
      <div className="flex flex-col items-center justify-between gap-1 bg-forest-deep px-5 py-2 text-[10px] font-medium tracking-[0.16em] text-primary-foreground/85 sm:flex-row lg:px-10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" />
          </span>
          LPHS DIGITAL ATTENDANCE SYSTEM (DAS) · OFFICIAL GATE ACCESS
        </div>
        <div className="text-leaf">{date || "\u00A0"}</div>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 shadow-soft backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 20 }}
            className="flex min-w-0 items-center justify-between gap-3"
          >
            <BrandMark showClub />
            <div className="hidden shrink-0 text-right sm:block lg:hidden">
              <div className="whitespace-nowrap font-mono text-sm font-bold tabular-nums leading-none text-forest">
                {time}
              </div>
              <div className="mt-1 text-[8px] font-bold tracking-[0.2em] text-muted-foreground">
                GMT+8
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
              <DeadlineChip />
              <div className="hidden text-right lg:block">
                <div className="font-mono text-2xl font-bold tabular-nums leading-none text-forest">
                  {time}
                </div>
                <div className="mt-1 text-[9px] font-bold tracking-[0.2em] text-muted-foreground">
                  SYSTEM TIME (GMT+8)
                </div>
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-2">
              <button
                onClick={onShowClient}
                title="Open the attendance registry"
                className={`${navBase} border border-border bg-muted text-forest hover:bg-secondary hover:shadow-soft`}
              >
                <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                Registry
              </button>
              <button
                onClick={onOpenClasses}
                title="Live present / late / absent board per class"
                className={`${navBase} border border-border bg-muted text-forest hover:bg-secondary hover:shadow-soft`}
              >
                <UsersRound className="h-3.5 w-3.5 shrink-0" />
                Classes
              </button>
              <button
                onClick={() => onOpenGate(true)}
                title="Read-only admin snapshot"
                className={`${navBase} border border-border bg-card text-forest hover:bg-secondary hover:shadow-soft`}
              >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                Quick View
              </button>
              <button
                onClick={onOpenQR}
                title="QR code scanning station (password protected)"
                className={`${navBase} border border-leaf/40 bg-secondary text-forest hover:bg-leaf/15 hover:shadow-soft`}
              >
                <QrCode className="h-3.5 w-3.5 shrink-0" />
                QR Mode
              </button>
              <button
                onClick={() => onOpenGate(false)}
                title="Full admin dashboard"
                className={`${navBase} col-span-2 bg-leaf-gradient text-primary-foreground hover:shadow-glow sm:col-span-1`}
              >
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                Admin
              </button>
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
