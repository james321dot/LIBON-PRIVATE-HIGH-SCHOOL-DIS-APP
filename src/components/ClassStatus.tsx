import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Printer,
  UserCheck,
  UserX,
  Clock3,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import type { AttendanceEntry } from "@/lib/attendance";
import { GRADE_LEVELS, classLabel } from "@/lib/classes";
import { allSectionsForGrade, computeClassStatus, printClassStatus } from "@/lib/insights";
import { loadRoster, type RosterMember } from "@/lib/roster";
import logoUrl from "@/assets/lphslogo.png";
import { BrandMark } from "@/components/BrandMark";

interface ClassStatusProps {
  entries: AttendanceEntry[];
  onBack: () => void;
}

export function ClassStatusView({ entries, onBack }: ClassStatusProps) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");

  useEffect(() => {
    const sync = () => setRoster(loadRoster());
    sync();
    window.addEventListener("lphs-roster-change", sync);
    return () => window.removeEventListener("lphs-roster-change", sync);
  }, []);

  const sections = useMemo(() => (grade ? allSectionsForGrade(grade) : []), [grade]);
  const result = useMemo(
    () => computeClassStatus(roster, entries, grade, section),
    [roster, entries, grade, section],
  );
  const ready = Boolean(grade && section);

  return (
    <div className="min-h-screen bg-canvas px-5 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <BrandMark showClub compact className="mb-5" />
            <button
              onClick={onBack}
              className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-leaf transition-colors hover:text-emerald"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to registry
            </button>
            <h1 className="font-display text-4xl font-bold text-forest">Class Status</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Live present · late · absent board for class advisers — no admin password needed.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-leaf/40 bg-secondary/50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-emerald">
            <RefreshCw className="h-3.5 w-3.5 animate-spin animation-duration:4s" /> Live sync
          </div>
        </div>

        {/* Grade picker */}
        <div className="rounded-2xl bg-card p-6 shadow-soft">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-leaf" /> Select grade level
          </p>
          <div className="flex flex-wrap gap-2">
            {GRADE_LEVELS.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGrade(g);
                  setSection("");
                }}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  grade === g
                    ? "bg-leaf-gradient text-primary-foreground shadow-glow"
                    : "border border-border bg-muted text-forest hover:-translate-y-0.5 hover:bg-secondary"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {grade && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="mb-3 mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Select section
                </p>
                <div className="flex flex-wrap gap-2">
                  {sections.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSection(s)}
                      className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                        section === s
                          ? "bg-forest text-primary-foreground"
                          : "border border-border bg-muted text-forest hover:-translate-y-0.5 hover:bg-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {ready && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Enrolled"
                value={result.total}
                icon={GraduationCap}
                tone="text-forest"
              />
              <StatCard
                label="Present"
                value={result.present}
                icon={UserCheck}
                tone="text-emerald"
              />
              <StatCard label="Late" value={result.late} icon={Clock3} tone="text-gold" />
              <StatCard label="Absent" value={result.absent} icon={UserX} tone="text-destructive" />
            </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-forest">
                {classLabel(grade, section)}
              </h2>
              <button
                onClick={() => printClassStatus(result, grade, section, logoUrl)}
                className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-5 py-2.5 text-xs font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
              >
                <Printer className="h-4 w-4" /> Print status
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl bg-card shadow-soft">
              <table className="w-full min-w-125 border-collapse">
                <thead>
                  <tr className="bg-primary text-left text-[10px] uppercase tracking-[0.15em] text-primary-foreground">
                    <th className="px-5 py-4 font-semibold">Student</th>
                    <th className="px-5 py-4 font-semibold">ID</th>
                    <th className="px-5 py-4 font-semibold">Time In</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr
                      key={r.name + (r.studentId ?? "")}
                      className={`border-b border-border ${
                        r.status === "Absent"
                          ? "border-l-4 border-l-destructive bg-destructive/5"
                          : r.status === "Late"
                            ? "border-l-4 border-l-gold bg-gold/5"
                            : "hover:bg-secondary/40"
                      }`}
                    >
                      <td className="px-5 py-3.5 text-sm font-semibold text-foreground">
                        {r.name}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold tabular-nums text-emerald">
                        {r.studentId ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm tabular-nums text-muted-foreground">
                        {r.time ?? "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            r.status === "Absent"
                              ? "border border-destructive bg-destructive/10 text-destructive"
                              : r.status === "Late"
                                ? "border border-gold bg-gold/10 text-gold"
                                : "border border-emerald bg-secondary text-emerald"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {result.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-sm text-muted-foreground"
                      >
                        No students registered for this class yet — add them in Admin → Roster.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-xl border-t-4 border-leaf bg-card p-5 text-center shadow-soft">
      <Icon className={`mx-auto mb-2 h-5 w-5 ${tone}`} />
      <h3 className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</h3>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
