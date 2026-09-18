import { motion } from "motion/react";
import { Printer, Download, ShieldCheck, X } from "lucide-react";
import { buildCSV, exportEntriesToCSV } from "@/lib/attendance";
import { printShiftReport, type ShiftSummary } from "@/lib/insights";
import { formatDuration } from "@/lib/guard-session";
import logoUrl from "@/assets/lphslogo.png";

export function ShiftReportModal({
  summary,
  onClose,
}: {
  summary: ShiftSummary;
  onClose: () => void;
}) {
  const stats = [
    { label: "Logged", value: summary.total },
    { label: "On-Time", value: summary.onTime },
    { label: "Late", value: summary.late },
  ];

  return (
    <div className="fixed inset-0 z-2000 flex items-center justify-center bg-forest-deep/70 p-5 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="w-full max-w-lg rounded-2xl bg-card p-7 shadow-glow"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-leaf">
              End of Shift
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-forest">Shift Summary</h2>
            <p className="mt-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-leaf" />
              {summary.guard} · {formatDuration(summary.endedAt - summary.startedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close shift report"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-forest"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border-t-4 border-leaf bg-secondary/40 p-4 text-center"
            >
              <div className="text-3xl font-bold tabular-nums text-forest">{s.value}</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => printShiftReport(summary, logoUrl)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-forest bg-card px-5 py-3 text-sm font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
          >
            <Printer className="h-4 w-4" /> PDF Report
          </button>
          <button
            onClick={() =>
              exportEntriesToCSV(
                summary.entries,
                `LPHS_Shift_${summary.guard.replace(/\s+/g, "_")}_${new Date(summary.endedAt).toLocaleDateString()}.csv`,
              )
            }
            disabled={!buildCSV(summary.entries)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-leaf-gradient px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-forest"
        >
          Close &amp; sign out
        </button>
      </motion.div>
    </div>
  );
}
