import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Download,
  LogOut,
  DoorOpen,
  AlertTriangle,
  Users,
  Clock3,
  Trash2,
  TimerOff,
  FileText,
  BarChart3,
  ClipboardList,
  Flame,
  Filter,
  Archive,
  BookUser,
  GraduationCap,
  ShieldCheck,
  UserX,
  ScanLine,
  ChevronDown,
} from "lucide-react";
import {
  computeHourlyDistribution,
  computeRepeatLate,
  computeWeekdayHeatmap,
  DEADLINE_LABEL,
  exportEntriesToCSV,
  exportEntriesToPDF,
  groupByMonth,
  monthKey,
  monthLabel,
  type AttendanceEntry,
} from "@/lib/attendance";
import { GRADE_LEVELS, classLabel } from "@/lib/classes";
import { RosterManager } from "@/components/RosterManager";
import { ClassesPanel } from "@/components/ClassesPanel";
import { ScanLogPanel } from "@/components/ScanLogPanel";
import { BrandMark } from "@/components/BrandMark";
import type { ScanEvent } from "@/lib/firebase-client";
import logoUrl from "@/assets/lphslogo.png";

interface AdminViewProps {
  entries: AttendanceEntry[];
  scanEvents: ScanEvent[];
  isQuickView: boolean;
  csvDownloaded: boolean;
  onExport: () => void;
  onLogout: () => void;
  onDelete: (id: string) => void;
  onClearScanLog: () => void;
}

type Tab = "log" | "scans" | "analytics" | "classes" | "roster" | "archive";
type StatusFilter = "all" | "on-time" | "late";
type RoleFilter = "all" | "Student" | "Faculty" | "Staff" | "Admin";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["5AM", "6AM", "7AM", "8AM", "9AM", "10AM", "11AM"];

export function AdminView({
  entries,
  scanEvents,
  isQuickView,
  csvDownloaded,
  onExport,
  onLogout,
  onDelete,
  onClearScanLog,
}: AdminViewProps) {
  const [tab, setTab] = useState<Tab>("log");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [dateFilter, setDateFilter] = useState<string>(""); // YYYY-MM-DD, blank=all
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const repeatLate = useMemo(() => computeRepeatLate(entries), [entries]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const list = entries.filter((e) => {
      if (statusFilter === "on-time" && e.status !== "On-Time") return false;
      if (statusFilter === "late" && e.status !== "Late") return false;
      if (roleFilter !== "all" && e.role !== roleFilter) return false;
      if (gradeFilter !== "all" && e.gradeLevel !== gradeFilter) return false;
      if (sectionFilter !== "all" && e.section !== sectionFilter) return false;
      if (dateFilter) {
        const d = new Date(e.timestamp);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`;
        if (iso !== dateFilter) return false;
      }
      if (
        term &&
        !`${e.name} ${e.role} ${e.gradeLevel ?? ""} ${e.section ?? ""} ${e.time} ${e.status}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
    return list.sort((a, b) => {
      if (a.status === "Late" && b.status !== "Late") return -1;
      if (a.status !== "Late" && b.status === "Late") return 1;
      return b.timestamp - a.timestamp;
    });
  }, [entries, search, statusFilter, roleFilter, dateFilter, gradeFilter, sectionFilter]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.section && (gradeFilter === "all" || e.gradeLevel === gradeFilter)) set.add(e.section);
    });
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [entries, gradeFilter]);

  const onTime = entries.filter((e) => e.status === "On-Time").length;
  const late = entries.filter((e) => e.status === "Late").length;
  const rate = entries.length ? Math.round((onTime / entries.length) * 100) : 0;

  const stats = [
    { label: "Total Present", value: entries.length, icon: Users, color: "text-forest" },
    { label: "On-Time", value: onTime, icon: Clock3, color: "text-emerald" },
    { label: "Late", value: late, icon: TimerOff, color: "text-destructive" },
    { label: "Punctuality", value: `${rate}%`, icon: BarChart3, color: "text-leaf" },
  ];

  const handlePDF = () => exportEntriesToPDF(entries, logoUrl);

  // Keyboard shortcuts: /, e, l
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA"))
        return;
      if (ev.key === "/") {
        ev.preventDefault();
        searchRef.current?.focus();
      } else if (ev.key.toLowerCase() === "e") {
        onExport();
      } else if (ev.key.toLowerCase() === "l") {
        if (isQuickView || csvDownloaded) onLogout();
      } else if (ev.key.toLowerCase() === "p") {
        handlePDF();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvDownloaded, isQuickView]);

  return (
    <div className="min-h-screen w-full bg-canvas px-5 py-10 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <BrandMark showClub compact className="mb-5" />
            <h1 className="font-display text-4xl font-bold text-forest">Executive Log</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Real-time attendance tracking &amp; analytics
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:items-end lg:justify-end">
            <div className="flex max-w-sm items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-gold" />
              <p className="text-xs font-semibold leading-relaxed text-foreground/80">
                DATA PROTOCOL: Logout unlocks only after CSV download. Shortcuts: <kbd>/</kbd>{" "}
                search · <kbd>E</kbd> CSV · <kbd>P</kbd> PDF · <kbd>L</kbd> logout.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePDF}
                className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-5 py-3 text-sm font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
              >
                <FileText className="h-4 w-4" /> PDF Report
              </button>
              <button
                onClick={onExport}
                className="inline-flex items-center gap-2 rounded-xl bg-leaf-gradient px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-glow"
              >
                <Download className="h-4 w-4" /> CSV
              </button>
              {!isQuickView && csvDownloaded && (
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-emerald"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              )}
              {isQuickView && (
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-xl bg-muted-foreground px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:opacity-90"
                >
                  <DoorOpen className="h-4 w-4" /> Exit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border-t-4 border-leaf bg-card p-5 text-center shadow-soft"
            >
              <stat.icon className={`mx-auto mb-2 h-5 w-5 ${stat.color}`} />
              <h3 className={`text-3xl font-bold tabular-nums ${stat.color}`}>{stat.value}</h3>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:inline-flex sm:overflow-visible sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-1 sm:shadow-soft">
          <TabButton active={tab === "log"} onClick={() => setTab("log")} icon={ClipboardList}>
            Attendance Log
          </TabButton>
          <TabButton active={tab === "scans"} onClick={() => setTab("scans")} icon={ScanLine}>
            Scanner Log
          </TabButton>
          <TabButton
            active={tab === "analytics"}
            onClick={() => setTab("analytics")}
            icon={BarChart3}
          >
            Analytics
          </TabButton>
          <TabButton active={tab === "classes"} onClick={() => setTab("classes")} icon={UserX}>
            Classes &amp; Absentees
          </TabButton>
          <TabButton active={tab === "roster"} onClick={() => setTab("roster")} icon={BookUser}>
            Roster
          </TabButton>
          <TabButton active={tab === "archive"} onClick={() => setTab("archive")} icon={Archive}>
            Archives
          </TabButton>
        </div>

        {tab === "scans" && (
          <ScanLogPanel events={scanEvents} canClear={!isQuickView} onClear={onClearScanLog} />
        )}

        {tab === "log" && (
          <>
            {/* Filters */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, role, status… (press /)"
                  className="w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base outline-none transition-all focus:border-leaf focus:shadow-glow"
                />
              </div>
              <FilterSelect
                icon={Filter}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[
                  { v: "all", l: "All Status" },
                  { v: "on-time", l: "On-Time" },
                  { v: "late", l: "Late Only" },
                ]}
              />
              <FilterSelect
                icon={Users}
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as RoleFilter)}
                options={[
                  { v: "all", l: "All Roles" },
                  { v: "Student", l: "Student" },
                  { v: "Faculty", l: "Faculty" },
                  { v: "Staff", l: "Staff" },
                  { v: "Admin", l: "Admin" },
                ]}
              />
              <FilterSelect
                icon={GraduationCap}
                value={gradeFilter}
                onChange={(v) => {
                  setGradeFilter(v);
                  setSectionFilter("all");
                }}
                options={[
                  { v: "all", l: "All Grades" },
                  ...GRADE_LEVELS.map((g) => ({ v: g, l: g })),
                ]}
              />
              <FilterSelect
                icon={BookUser}
                value={sectionFilter}
                onChange={setSectionFilter}
                options={[
                  { v: "all", l: "All Sections" },
                  ...sectionOptions.map((sc) => ({ v: sc, l: sc })),
                ]}
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-xl border border-input bg-card px-3 py-3 text-sm outline-none focus:border-leaf focus:shadow-glow"
              />
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              Showing <b className="text-forest">{filtered.length}</b> of {entries.length} records
              {(statusFilter !== "all" ||
                roleFilter !== "all" ||
                gradeFilter !== "all" ||
                sectionFilter !== "all" ||
                dateFilter ||
                search) && (
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setRoleFilter("all");
                    setGradeFilter("all");
                    setSectionFilter("all");
                    setDateFilter("");
                    setSearch("");
                  }}
                  className="ml-3 text-leaf underline underline-offset-2 hover:text-emerald"
                >
                  clear filters
                </button>
              )}
            </p>

            <div className="overflow-x-auto rounded-xl bg-card shadow-soft">
              <table className="w-full min-w-175 border-collapse">
                <thead>
                  <tr className="bg-primary text-left text-[10px] uppercase tracking-[0.15em] text-primary-foreground">
                    <th className="px-5 py-4 font-semibold">Full Name</th>
                    <th className="px-5 py-4 font-semibold">Designation</th>
                    <th className="px-5 py-4 font-semibold">Grade &amp; Section</th>
                    <th className="px-5 py-4 font-semibold">Time In</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Logged By</th>
                    <th className="px-5 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {filtered.map((entry) => {
                      const repeatCount = repeatLate.get(entry.name.trim().toUpperCase()) ?? 0;
                      const isRepeat = repeatCount >= 3;
                      return (
                        <motion.tr
                          key={entry.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={
                            entry.status === "Late"
                              ? "border-b border-border border-l-4 border-l-destructive bg-destructive/5"
                              : "border-b border-border transition-colors hover:bg-secondary/40"
                          }
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-foreground">
                            {entry.studentId && (
                              <span className="mb-0.5 block text-[10px] font-bold tracking-wider text-emerald">
                                {entry.studentId}
                              </span>
                            )}
                            <div className="flex items-center gap-2">
                              {entry.status === "Late" && "⚠️"}
                              <span>{entry.name}</span>
                              {isRepeat && (
                                <span
                                  title={`Late ${repeatCount} times`}
                                  className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive"
                                >
                                  <Flame className="h-3 w-3" /> Repeat ×{repeatCount}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-muted-foreground">{entry.role}</td>
                          <td className="px-5 py-4 text-sm">
                            {entry.gradeLevel || entry.section ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setGradeFilter(entry.gradeLevel ?? "all");
                                  setSectionFilter(entry.section ?? "all");
                                }}
                                title="Filter this class"
                                className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald transition-colors hover:bg-leaf hover:text-primary-foreground"
                              >
                                {classLabel(entry.gradeLevel, entry.section)}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm tabular-nums">{entry.time}</td>
                          <td className="px-5 py-4">
                            <span
                              className={
                                entry.status === "Late"
                                  ? "rounded-full border border-destructive bg-destructive/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-destructive"
                                  : "rounded-full border border-emerald bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald"
                              }
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-leaf" />
                              {entry.guard ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => onDelete(entry.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-sm text-muted-foreground"
                      >
                        No attendance records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "analytics" && <AnalyticsPanel entries={entries} repeatLate={repeatLate} />}

        {tab === "classes" && <ClassesPanel entries={entries} />}

        {tab === "roster" && <RosterManager />}

        {tab === "archive" && <ArchivePanel entries={entries} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
        active
          ? "bg-leaf-gradient text-primary-foreground shadow-glow"
          : "text-muted-foreground hover:text-forest"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function FilterSelect({
  icon: Icon,
  value,
  onChange,
  options,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-input bg-card py-3 pl-9 pr-8 text-sm outline-none transition-colors focus:border-leaf focus:shadow-glow"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function AnalyticsPanel({
  entries,
  repeatLate,
}: {
  entries: AttendanceEntry[];
  repeatLate: Map<string, number>;
}) {
  const weekday = useMemo(() => computeWeekdayHeatmap(entries), [entries]);
  const hourly = useMemo(() => computeHourlyDistribution(entries), [entries]);
  const maxWeek = Math.max(1, ...weekday);
  const maxHour = Math.max(1, ...hourly);

  const offenders = useMemo(() => {
    return [...repeatLate.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [repeatLate]);

  const roleBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.role, (map.get(e.role) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);
  const roleTotal = entries.length || 1;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Weekday late heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-card p-6 shadow-soft"
      >
        <h3 className="mb-1 font-display text-xl font-bold text-forest">Late by Weekday</h3>
        <p className="mb-5 text-xs text-muted-foreground">
          Distribution of late arrivals across the week
        </p>
        <div className="flex items-end justify-between gap-3">
          {weekday.map((count, i) => {
            const h = (count / maxWeek) * 100;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.7, delay: i * 0.05 }}
                    className={`w-full rounded-t-md ${
                      count === maxWeek && count > 0 ? "bg-destructive" : "bg-leaf-gradient"
                    }`}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {WEEKDAYS[i]}
                </span>
                <span className="text-xs font-bold tabular-nums text-forest">{count}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Hourly arrival distribution */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl bg-card p-6 shadow-soft"
      >
        <h3 className="mb-1 font-display text-xl font-bold text-forest">Arrival Distribution</h3>
        <p className="mb-5 text-xs text-muted-foreground">
          Check-ins per hour · red line = {DEADLINE_LABEL} cut-off
        </p>
        <div className="relative flex items-end justify-between gap-2">
          {hourly.map((count, i) => {
            const h = (count / maxHour) * 100;
            const isLateHour = i >= 2 && !(i === 2); // >7AM
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.7, delay: i * 0.05 }}
                    className={`w-full rounded-t-md ${
                      isLateHour ? "bg-destructive/70" : "bg-leaf"
                    }`}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {HOURS[i]}
                </span>
                <span className="text-xs font-bold tabular-nums text-forest">{count}</span>
              </div>
            );
          })}
          {/* Deadline marker between 6AM and 7AM columns */}
          <div className="pointer-events-none absolute inset-y-0 left-[35%] w-px border-l-2 border-dashed border-destructive/60" />
        </div>
      </motion.div>

      {/* Role breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl bg-card p-6 shadow-soft"
      >
        <h3 className="mb-1 font-display text-xl font-bold text-forest">Role Breakdown</h3>
        <p className="mb-5 text-xs text-muted-foreground">Who's checking in today</p>
        <div className="space-y-3">
          {roleBreakdown.length === 0 && (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
          {roleBreakdown.map(([role, count]) => {
            const pct = Math.round((count / roleTotal) * 100);
            return (
              <div key={role}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-forest">{role}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-leaf-gradient"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Repeat offenders */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-destructive/30 bg-card p-6 shadow-soft"
      >
        <div className="mb-1 flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          <h3 className="font-display text-xl font-bold text-forest">Repeat Offenders</h3>
        </div>
        <p className="mb-5 text-xs text-muted-foreground">
          Names logged Late 3+ times (all history)
        </p>
        {offenders.length === 0 ? (
          <p className="rounded-lg bg-secondary/60 p-4 text-center text-sm text-emerald">
            🎉 Clean record — no repeat late arrivals.
          </p>
        ) : (
          <ul className="space-y-2">
            {offenders.map(([name, count]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg bg-destructive/5 px-4 py-2.5"
              >
                <span className="text-sm font-semibold text-foreground">{name}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  <TimerOff className="h-3 w-3" /> ×{count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}

function ArchivePanel({ entries }: { entries: AttendanceEntry[] }) {
  const grouped = useMemo(() => groupByMonth(entries), [entries]);
  const current = monthKey(Date.now());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-gold/40 bg-gold/10 px-5 py-4 text-xs font-semibold text-foreground/80">
        Records are grouped by month automatically. Download a month before removing it from the
        live database to keep a permanent offline copy.
      </div>
      {[...grouped.entries()].map(([key, list]) => {
        const late = list.filter((e) => e.status === "Late").length;
        return (
          <div
            key={key}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-card p-5 shadow-soft"
          >
            <div>
              <p className="font-display text-lg font-bold text-forest">
                {monthLabel(key)}
                {key === current && (
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald">
                    Active
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {list.length} records · {late} late · {list.length - late} on-time
              </p>
            </div>
            <button
              onClick={() => exportEntriesToCSV(list, `LPHS_Attendance_${key}.csv`)}
              className="inline-flex items-center gap-2 rounded-xl border border-forest bg-card px-5 py-2.5 text-xs font-semibold text-forest transition-all hover:-translate-y-0.5 hover:bg-secondary"
            >
              <Download className="h-3.5 w-3.5" /> Download {key}
            </button>
          </div>
        );
      })}
      {grouped.size === 0 && (
        <p className="rounded-xl bg-card p-12 text-center text-sm text-muted-foreground shadow-soft">
          No archived months yet.
        </p>
      )}
    </motion.div>
  );
}
