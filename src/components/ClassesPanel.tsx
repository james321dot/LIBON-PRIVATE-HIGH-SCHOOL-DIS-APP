import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Printer, UserX, Flame, GraduationCap, ClipboardList } from "lucide-react";
import { LATE_FROM_LABEL, type AttendanceEntry } from "@/lib/attendance";
import { GRADE_LEVELS, classLabel } from "@/lib/classes";
import {
  allSectionsForGrade,
  computeAbsentees,
  printSignInSheet,
  todaysEntries,
} from "@/lib/insights";
import { loadRoster, type RosterMember } from "@/lib/roster";
import logoUrl from "@/assets/lphslogo.png";

export function ClassesPanel({ entries }: { entries: AttendanceEntry[] }) {
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [grade, setGrade] = useState("all");
  const [section, setSection] = useState("all");

  useEffect(() => {
    const sync = () => setRoster(loadRoster());
    sync();
    window.addEventListener("lphs-roster-change", sync);
    return () => window.removeEventListener("lphs-roster-change", sync);
  }, []);

  const sections = useMemo(() => (grade === "all" ? [] : allSectionsForGrade(grade)), [grade]);

  const scoped = useMemo(
    () =>
      roster.filter(
        (m) =>
          (grade === "all" || m.gradeLevel === grade) &&
          (section === "all" || m.section === section),
      ),
    [roster, grade, section],
  );

  const absentees = useMemo(() => computeAbsentees(scoped, entries), [scoped, entries]);

  const lateToday = useMemo(
    () =>
      todaysEntries(entries)
        .filter(
          (e) =>
            e.status === "Late" &&
            (grade === "all" || e.gradeLevel === grade) &&
            (section === "all" || e.section === section),
        )
        .sort((a, b) => a.timestamp - b.timestamp),
    [entries, grade, section],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="rounded-xl bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-forest">Class Monitoring</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Who is missing today, who came in late, and printable sign-in sheets per section.
            </p>
          </div>
          <button
            onClick={() =>
              printSignInSheet(
                scoped.filter((m) => m.role === "Student"),
                grade === "all" ? "" : grade,
                section === "all" ? "" : section,
                logoUrl,
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-4 py-2.5 text-xs font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
          >
            <Printer className="h-3.5 w-3.5" /> Print sign-in sheet
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {["all", ...GRADE_LEVELS].map((g) => (
            <button
              key={g}
              onClick={() => {
                setGrade(g);
                setSection("all");
              }}
              className={`rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                grade === g
                  ? "bg-leaf-gradient text-primary-foreground shadow-glow"
                  : "border border-border bg-muted text-forest hover:bg-secondary"
              }`}
            >
              {g === "all" ? "All Grades" : g}
            </button>
          ))}
        </div>
        {sections.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {["all", ...sections].map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`rounded-xl px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  section === s
                    ? "bg-forest text-primary-foreground"
                    : "border border-border bg-muted text-forest hover:bg-secondary"
                }`}
              >
                {s === "all" ? "All Sections" : s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Not Yet Logged Today"
          subtitle={`${absentees.length} of ${scoped.length} registered members`}
          icon={UserX}
          tone="text-destructive"
        >
          {absentees.length === 0 ? (
            <Empty>
              {scoped.length
                ? "Everyone in this scope has logged in today. 🎉"
                : "No registered members yet — add them in the Roster tab."}
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {absentees.map((m) => (
                <li key={m.id + m.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {m.id} · {classLabel(m.gradeLevel, m.section) || m.role}
                    </p>
                  </div>
                  <span className="rounded-full border border-destructive bg-destructive/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive">
                    Absent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Late Arrivals Today"
          subtitle={`${lateToday.length} student${lateToday.length === 1 ? "" : "s"} past ${LATE_FROM_LABEL}`}
          icon={Flame}
          tone="text-gold"
        >
          {lateToday.length === 0 ? (
            <Empty>No late arrivals recorded today.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {lateToday.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{e.name}</p>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {classLabel(e.gradeLevel, e.section) || e.role}
                    </p>
                  </div>
                  <span className="rounded-full border border-gold bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold tabular-nums">
                    {e.time}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="rounded-xl border border-leaf/30 bg-secondary/40 p-5 text-xs text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-forest">
          <ClipboardList className="h-4 w-4 text-leaf" /> Tip
        </p>
        <p className="mt-1.5">
          Absentee accuracy depends on the roster. Import your official class lists under{" "}
          <b className="text-forest">Roster</b> with grade level and section so every class is
          cross-checked automatically.
        </p>
      </div>
    </motion.div>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-soft">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Icon className={`h-5 w-5 ${tone}`} />
        <div>
          <h4 className="font-display text-lg font-bold text-forest">{title}</h4>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-12 text-center text-sm text-muted-foreground">
      <GraduationCap className="mx-auto mb-3 h-6 w-6 text-leaf/60" />
      {children}
    </p>
  );
}
